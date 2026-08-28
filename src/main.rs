use clap::{Args, Parser, Subcommand};
use knowledge_note_bridge::{
    build_plan, parse_paths, Change, ExistingNote, Plan, SourceCard, ARCHIVED_TAG, ID_PREFIX,
    MANAGED_TAG,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Parser, Debug)]
#[command(
    name = "knb",
    version,
    about = "Keep Anki review history attached to Markdown cards",
    long_about = "Knowledge Note Bridge parses explicit Markdown card blocks, previews every change, backs up Anki, and updates notes in place so review history survives content edits and file moves.\n\nStart with `knb check notes/`, then inspect `knb plan notes/`. No command prompts; sync requires --yes."
)]
struct Cli {
    #[arg(long, global = true, help = "Emit one JSON value to stdout")]
    json: bool,
    #[arg(
        long,
        global = true,
        default_value = "http://127.0.0.1:8765",
        value_name = "URL",
        help = "AnkiConnect endpoint"
    )]
    endpoint: String,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Create a starter Markdown note without overwriting an existing file
    Init {
        #[arg(value_name = "FILE")]
        file: PathBuf,
    },
    /// Parse and validate cards without contacting Anki
    Check(Paths),
    /// Compare source cards with Anki; never writes
    Plan(Paths),
    /// Back up Anki, then apply the reviewed plan
    Sync {
        #[command(flatten)]
        paths: Paths,
        #[arg(long, help = "Required confirmation for non-interactive writes")]
        yes: bool,
    },
}

#[derive(Args, Debug)]
struct Paths {
    #[arg(
        required = true,
        value_name = "PATH",
        help = "Markdown file or directory (repeatable)"
    )]
    paths: Vec<PathBuf>,
}

#[derive(Debug)]
struct AppError {
    code: u8,
    message: String,
    output_emitted: bool,
}
impl AppError {
    fn usage(message: impl Into<String>) -> Self {
        Self {
            code: 2,
            message: message.into(),
            output_emitted: false,
        }
    }
    fn blocked(message: impl Into<String>) -> Self {
        Self {
            code: 3,
            message: message.into(),
            output_emitted: false,
        }
    }
    fn anki(message: impl Into<String>) -> Self {
        Self {
            code: 4,
            message: message.into(),
            output_emitted: false,
        }
    }

    fn after_output(mut self) -> Self {
        self.output_emitted = true;
        self
    }
}

#[derive(Serialize)]
struct CheckResult {
    schema: u8,
    valid: bool,
    cards: usize,
    files: usize,
    ids: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct SyncReport {
    schema: u8,
    created_at_unix: u64,
    backups: Vec<String>,
    status: String,
    applied: Vec<String>,
    plan: Plan,
    error: Option<String>,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(&cli) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            if cli.json && !error.output_emitted {
                println!(
                    "{}",
                    json!({"ok": false, "error": error.message, "exit_code": error.code})
                );
            } else if !cli.json {
                eprintln!("error: {}", error.message);
            }
            ExitCode::from(error.code)
        }
    }
}

fn run(cli: &Cli) -> Result<(), AppError> {
    match &cli.command {
        Command::Init { file } => init(file, cli.json),
        Command::Check(paths) => check(&paths.paths, cli.json),
        Command::Plan(paths) => {
            let cards = load(&paths.paths)?;
            let client = AnkiClient::new(&cli.endpoint)?;
            let plan = build_plan(&cards, &client.existing_notes()?);
            print_plan(&plan, cli.json);
            if plan.is_blocked() {
                Err(AppError::blocked(
                    "plan is blocked; resolve each needs-action item before syncing",
                )
                .after_output())
            } else {
                Ok(())
            }
        }
        Command::Sync { paths, yes } => sync(&paths.paths, *yes, cli.json, &cli.endpoint),
    }
}

fn init(file: &Path, as_json: bool) -> Result<(), AppError> {
    if file.exists() {
        return Err(AppError::usage(format!(
            "{} already exists; nothing was overwritten",
            file.display()
        )));
    }
    if file
        .extension()
        .is_none_or(|ext| !ext.eq_ignore_ascii_case("md"))
    {
        return Err(AppError::usage("starter file must use the .md extension"));
    }
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::usage(format!("could not create {}: {e}", parent.display())))?;
    }
    let starter = "# Knowledge cards\n\n```card\nid: replace-with-stable-id\ndeck: Default\ntags: learning\n---\nWrite one focused question.\n---\nWrite the smallest complete answer.\n```\n";
    fs::write(file, starter)
        .map_err(|e| AppError::usage(format!("could not write {}: {e}", file.display())))?;
    if as_json {
        println!("{}", json!({"ok": true, "created": file}));
    } else {
        println!(
            "Created {}\nNext: edit the starter card, then run `knb check {}`.",
            file.display(),
            file.display()
        );
    }
    Ok(())
}

fn load(paths: &[PathBuf]) -> Result<Vec<SourceCard>, AppError> {
    parse_paths(paths).map_err(|errors| AppError::usage(errors.join("\n")))
}

fn check(paths: &[PathBuf], as_json: bool) -> Result<(), AppError> {
    let cards = load(paths)?;
    if as_json {
        let files = cards
            .iter()
            .map(|card| &card.source)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        println!(
            "{}",
            serde_json::to_string_pretty(&CheckResult {
                schema: 1,
                valid: true,
                cards: cards.len(),
                files,
                ids: cards.iter().map(|card| card.id.clone()).collect()
            })
            .unwrap()
        );
    } else if cards.is_empty() {
        println!("Valid, but no `card` blocks were found. Run `knb init cards.md` for a starter.");
    } else {
        println!(
            "Valid: {} card{} with unique stable IDs.",
            cards.len(),
            if cards.len() == 1 { "" } else { "s" }
        );
    }
    Ok(())
}

fn print_plan(plan: &Plan, as_json: bool) {
    if as_json {
        println!("{}", serde_json::to_string_pretty(plan).unwrap());
        return;
    }
    let s = &plan.summary;
    println!(
        "{} unchanged · {} add · {} update · {} rename · {} archive · {} blocked",
        s.unchanged, s.add, s.update, s.rename, s.archive, s.blocked
    );
    for change in &plan.changes {
        let (mark, label, detail) = match change {
            Change::Add { card } => ("+", "add", format!("{} → {}", card.source, card.deck)),
            Change::Update { card, .. } => ("~", "update", format!("in place → {}", card.deck)),
            Change::Rename { card, from, .. } => ("→", "rename", format!("{from} → {}", card.id)),
            Change::Archive { before, .. } => (
                "−",
                "archive",
                format!("suspend {} card(s); never delete", before.card_ids.len()),
            ),
            Change::Unchanged { .. } => ("=", "keep", "history attached".into()),
            Change::Blocked { reason, .. } => ("!", "needs-action", reason.clone()),
        };
        println!(" {mark} {:<14} {:<28} {detail}", label, change.id());
    }
    println!("No changes were written.");
}

fn sync(paths: &[PathBuf], yes: bool, as_json: bool, endpoint: &str) -> Result<(), AppError> {
    let cards = load(paths)?;
    let client = AnkiClient::new(endpoint)?;
    let mut plan = build_plan(&cards, &client.existing_notes()?);
    if plan.is_blocked() {
        print_plan(&plan, as_json);
        return Err(AppError::blocked(
            "sync stopped before backup: resolve every needs-action item",
        )
        .after_output());
    }
    if !plan.has_writes() {
        print_plan(&plan, as_json);
        if !as_json {
            println!("Already in sync; no backup was needed.");
        }
        return Ok(());
    }
    if !yes {
        print_plan(&plan, as_json);
        return Err(AppError::blocked(
            "review the plan, then rerun with --yes to back up and apply it",
        )
        .after_output());
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let backups = client.create_backups(now)?;
    plan.dry_run = false;
    let mut report = SyncReport {
        schema: 1,
        created_at_unix: now,
        backups,
        status: "applying".into(),
        applied: Vec::new(),
        plan,
        error: None,
    };
    let report_path = report_path(now);
    write_report(&report_path, &report)?;
    for change in &report.plan.changes {
        if !change.is_write() {
            continue;
        }
        if let Err(error) = client.apply(change) {
            report.status = "failed".into();
            report.error = Some(error.message.clone());
            write_report(&report_path, &report)?;
            return Err(AppError::anki(format!(
                "sync stopped after {} change(s): {}. Restore the .apkg backups listed in {}; report retained",
                report.applied.len(),
                error.message,
                report_path.display()
            )));
        }
        report
            .applied
            .push(format!("{}:{}", change_kind(change), change.id()));
        write_report(&report_path, &report)?;
    }
    report.status = "complete".into();
    write_report(&report_path, &report)?;
    write_manifest(&cards, now)?;
    if as_json {
        println!("{}", serde_json::to_string_pretty(&report).unwrap());
    } else {
        println!("Applied {} change(s). Review history stayed on existing note IDs.\nBackups: {} deck package(s)\nReversal report: {}", report.applied.len(), report.backups.len(), report_path.display());
    }
    Ok(())
}

fn change_kind(change: &Change) -> &'static str {
    match change {
        Change::Add { .. } => "add",
        Change::Update { .. } => "update",
        Change::Rename { .. } => "rename",
        Change::Archive { .. } => "archive",
        _ => "none",
    }
}

fn report_path(now: u64) -> PathBuf {
    PathBuf::from(format!(".knb/reports/{now}.json"))
}

fn write_report(path: &Path, report: &SyncReport) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::usage(format!("could not create report directory: {e}")))?;
    }
    fs::write(path, serde_json::to_vec_pretty(report).unwrap())
        .map_err(|e| AppError::usage(format!("could not write report {}: {e}", path.display())))
}

fn write_manifest(cards: &[SourceCard], now: u64) -> Result<(), AppError> {
    fs::create_dir_all(".knb")
        .map_err(|e| AppError::usage(format!("could not create .knb: {e}")))?;
    let entries: Vec<_> = cards.iter().map(|card| json!({"id": card.id, "fingerprint": card.fingerprint, "source": card.source, "archived": card.archived})).collect();
    fs::write(
        ".knb/manifest.json",
        serde_json::to_vec_pretty(&json!({"schema": 1, "synced_at_unix": now, "cards": entries}))
            .unwrap(),
    )
    .map_err(|e| AppError::usage(format!("could not write manifest: {e}")))
}

struct AnkiClient {
    endpoint: String,
}

impl AnkiClient {
    fn new(endpoint: &str) -> Result<Self, AppError> {
        if !endpoint.starts_with("http://") && !endpoint.starts_with("https://") {
            return Err(AppError::usage(
                "endpoint must start with http:// or https://",
            ));
        }
        Ok(Self {
            endpoint: endpoint.trim_end_matches('/').into(),
        })
    }

    fn call(&self, action: &str, params: Value) -> Result<Value, AppError> {
        let body = json!({"action": action, "version": 6, "params": params}).to_string();
        let response = ureq::post(&self.endpoint).set("content-type", "application/json").send_string(&body)
            .map_err(|error| AppError::anki(format!("could not reach AnkiConnect at {}: {error}. Open Anki and confirm add-on 2055492159 is installed", self.endpoint)))?;
        let text = response.into_string().map_err(|error| {
            AppError::anki(format!("could not read AnkiConnect response: {error}"))
        })?;
        let value: Value = serde_json::from_str(&text).map_err(|error| {
            AppError::anki(format!("AnkiConnect returned invalid JSON: {error}"))
        })?;
        if let Some(error) = value.get("error").and_then(Value::as_str) {
            return Err(AppError::anki(format!(
                "AnkiConnect {action} failed: {error}"
            )));
        }
        value
            .get("result")
            .cloned()
            .ok_or_else(|| AppError::anki(format!("AnkiConnect {action} response had no result")))
    }

    fn existing_notes(&self) -> Result<Vec<ExistingNote>, AppError> {
        let version = self
            .call("version", json!({}))?
            .as_i64()
            .unwrap_or_default();
        if version < 6 {
            return Err(AppError::anki(format!(
                "AnkiConnect API version {version} is too old; version 6 is required"
            )));
        }
        let ids = self
            .call("findNotes", json!({"query": format!("tag:{MANAGED_TAG}")}))?
            .as_array()
            .cloned()
            .unwrap_or_default();
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let notes = self
            .call("notesInfo", json!({"notes": ids}))?
            .as_array()
            .cloned()
            .unwrap_or_default();
        let card_ids: Vec<Value> = notes
            .iter()
            .flat_map(|note| {
                note.get("cards")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .cloned()
            })
            .collect();
        let card_info = if card_ids.is_empty() {
            Vec::new()
        } else {
            self.call("cardsInfo", json!({"cards": card_ids}))?
                .as_array()
                .cloned()
                .unwrap_or_default()
        };
        let decks: HashMap<i64, String> = card_info
            .iter()
            .filter_map(|card| {
                Some((
                    card.get("note")?.as_i64()?,
                    card.get("deckName")?.as_str()?.to_owned(),
                ))
            })
            .collect();
        notes
            .into_iter()
            .map(|note| parse_existing(note, &decks))
            .collect()
    }

    fn create_backups(&self, now: u64) -> Result<Vec<String>, AppError> {
        let decks = self
            .call("deckNames", json!({}))?
            .as_array()
            .cloned()
            .unwrap_or_default();
        let directory = std::env::current_dir()
            .map_err(|error| {
                AppError::usage(format!("could not resolve backup directory: {error}"))
            })?
            .join(format!(".knb/backups/{now}"));
        fs::create_dir_all(&directory).map_err(|error| {
            AppError::usage(format!("could not create {}: {error}", directory.display()))
        })?;
        let mut paths = Vec::new();
        for (index, deck) in decks.iter().filter_map(Value::as_str).enumerate() {
            let safe_name: String = deck
                .chars()
                .map(|character| {
                    if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                        character
                    } else {
                        '-'
                    }
                })
                .collect();
            let path = directory.join(format!("{:03}-{}.apkg", index + 1, safe_name));
            self.call(
                "exportPackage",
                json!({"deck": deck, "path": path, "includeSched": true}),
            )?;
            paths.push(path.display().to_string());
        }
        Ok(paths)
    }

    fn apply(&self, change: &Change) -> Result<(), AppError> {
        match change {
            Change::Add { card } => {
                let tags = desired_tags(card);
                self.call("addNote", json!({"note": {"deckName": card.deck, "modelName": "Basic", "fields": {"Front": card.front, "Back": card.back}, "options": {"allowDuplicate": false}, "tags": tags}}))?;
            }
            Change::Update { card, before } => self.update_note(card, before, None)?,
            Change::Rename { card, before, from } => self.update_note(card, before, Some(from))?,
            Change::Archive { before, .. } => {
                self.call(
                    "addTags",
                    json!({"notes": [before.note_id], "tags": ARCHIVED_TAG}),
                )?;
                if !before.card_ids.is_empty() {
                    self.call("suspend", json!({"cards": before.card_ids}))?;
                }
            }
            Change::Unchanged { .. } | Change::Blocked { .. } => {}
        }
        Ok(())
    }

    fn update_note(
        &self,
        card: &SourceCard,
        before: &ExistingNote,
        renamed_from: Option<&String>,
    ) -> Result<(), AppError> {
        self.call("updateNoteFields", json!({"note": {"id": before.note_id, "fields": {"Front": card.front, "Back": card.back}}}))?;
        let mut remove = before.tags.clone();
        if let Some(old) = renamed_from {
            remove.push(format!("{ID_PREFIX}{old}"));
        }
        if before.archived {
            remove.push(ARCHIVED_TAG.into());
        }
        if !remove.is_empty() {
            self.call(
                "removeTags",
                json!({"notes": [before.note_id], "tags": remove.join(" ")}),
            )?;
        }
        self.call(
            "addTags",
            json!({"notes": [before.note_id], "tags": desired_tags(card).join(" ")}),
        )?;
        if before.deck != card.deck && !before.card_ids.is_empty() {
            self.call(
                "changeDeck",
                json!({"cards": before.card_ids, "deck": card.deck}),
            )?;
        }
        if before.archived && !before.card_ids.is_empty() {
            self.call("unsuspend", json!({"cards": before.card_ids}))?;
        }
        Ok(())
    }
}

fn desired_tags(card: &SourceCard) -> Vec<String> {
    let mut tags = card.tags.clone();
    tags.push(MANAGED_TAG.into());
    tags.push(format!("{ID_PREFIX}{}", card.id));
    tags.sort();
    tags.dedup();
    tags
}

fn parse_existing(note: Value, decks: &HashMap<i64, String>) -> Result<ExistingNote, AppError> {
    let note_id = note
        .get("noteId")
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::anki("notesInfo returned a note without noteId"))?;
    let raw_tags: Vec<String> = note
        .get("tags")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|tag| tag.as_str().map(str::to_owned))
        .collect();
    let id_tags: Vec<_> = raw_tags
        .iter()
        .filter_map(|tag| tag.strip_prefix(ID_PREFIX))
        .collect();
    if id_tags.len() != 1 {
        return Err(AppError::anki(format!(
            "Anki note {note_id} must have exactly one `{ID_PREFIX}…` tag"
        )));
    }
    let tags = raw_tags
        .iter()
        .filter(|tag| {
            tag.as_str() != MANAGED_TAG
                && tag.as_str() != ARCHIVED_TAG
                && !tag.starts_with(ID_PREFIX)
        })
        .cloned()
        .collect();
    let card_ids: Vec<i64> = note
        .get("cards")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_i64)
        .collect();
    let field = |name: &str| {
        note.get("fields")
            .and_then(|fields| fields.get(name))
            .and_then(|field| field.get("value"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned()
    };
    Ok(ExistingNote {
        note_id,
        deck: decks
            .get(&note_id)
            .cloned()
            .unwrap_or_else(|| "Default".into()),
        card_ids,
        id: id_tags[0].into(),
        tags,
        front: field("Front"),
        back: field("Back"),
        archived: raw_tags.iter().any(|tag| tag == ARCHIVED_TAG),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_bridge_tags_from_anki_note() {
        let note = json!({"noteId": 7, "tags": ["knb_managed", "knb_id::stable", "user"], "cards": [9], "fields": {"Front": {"value": "Q"}, "Back": {"value": "A"}}});
        let parsed = parse_existing(note, &HashMap::from([(7, "Deck".into())])).unwrap();
        assert_eq!(parsed.id, "stable");
        assert_eq!(parsed.tags, vec!["user"]);
        assert_eq!(parsed.deck, "Deck");
    }

    #[test]
    fn report_contains_complete_before_state() {
        let before = ExistingNote {
            note_id: 1,
            card_ids: vec![2],
            id: "old".into(),
            deck: "D".into(),
            tags: vec!["t".into()],
            front: "Q".into(),
            back: "A".into(),
            archived: false,
        };
        let value = serde_json::to_value(Change::Blocked {
            id: before.id.clone(),
            reason: "test".into(),
        })
        .unwrap();
        assert_eq!(value["kind"], "blocked");
    }
}
