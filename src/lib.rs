//! Core parser and reconciliation planner for Knowledge Note Bridge.
//!
//! The planner is deliberately independent of AnkiConnect. It compares parsed source
//! cards with existing Anki notes and produces an auditable [`Plan`] before any write.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

pub const MANAGED_TAG: &str = "knb_managed";
pub const ARCHIVED_TAG: &str = "knb_archived";
pub const ID_PREFIX: &str = "knb_id::";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceCard {
    pub id: String,
    pub deck: String,
    pub tags: Vec<String>,
    pub front: String,
    pub back: String,
    pub archived: bool,
    pub renamed_from: Option<String>,
    pub source: String,
    pub line: usize,
    pub fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExistingNote {
    pub note_id: i64,
    pub card_ids: Vec<i64>,
    pub id: String,
    pub deck: String,
    pub tags: Vec<String>,
    pub front: String,
    pub back: String,
    pub archived: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Change {
    Add {
        card: SourceCard,
    },
    Update {
        card: SourceCard,
        before: ExistingNote,
    },
    Rename {
        card: SourceCard,
        before: ExistingNote,
        from: String,
    },
    Archive {
        card: SourceCard,
        before: ExistingNote,
    },
    Unchanged {
        id: String,
        note_id: Option<i64>,
    },
    Blocked {
        id: String,
        reason: String,
    },
}

impl Change {
    pub fn id(&self) -> &str {
        match self {
            Self::Add { card }
            | Self::Update { card, .. }
            | Self::Rename { card, .. }
            | Self::Archive { card, .. } => &card.id,
            Self::Unchanged { id, .. } | Self::Blocked { id, .. } => id,
        }
    }

    pub fn is_write(&self) -> bool {
        matches!(
            self,
            Self::Add { .. } | Self::Update { .. } | Self::Rename { .. } | Self::Archive { .. }
        )
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Summary {
    pub unchanged: usize,
    pub add: usize,
    pub update: usize,
    pub rename: usize,
    pub archive: usize,
    pub blocked: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Plan {
    pub schema: u8,
    pub dry_run: bool,
    pub summary: Summary,
    pub changes: Vec<Change>,
}

impl Plan {
    pub fn has_writes(&self) -> bool {
        self.changes.iter().any(Change::is_write)
    }

    pub fn is_blocked(&self) -> bool {
        self.summary.blocked > 0
    }
}

pub fn parse_paths(paths: &[PathBuf]) -> Result<Vec<SourceCard>, Vec<String>> {
    let mut files = Vec::new();
    let mut errors = Vec::new();
    for path in paths {
        collect_markdown(path, &mut files, &mut errors);
    }
    files.sort();
    files.dedup();
    if files.is_empty() && errors.is_empty() {
        errors.push("no Markdown files found in the supplied paths".into());
    }

    let mut cards = Vec::new();
    for file in files {
        match fs::read_to_string(&file) {
            Ok(text) => match parse_markdown(&text, &file.to_string_lossy()) {
                Ok(mut parsed) => cards.append(&mut parsed),
                Err(mut found) => errors.append(&mut found),
            },
            Err(error) => errors.push(format!("{}: could not read: {error}", file.display())),
        }
    }

    let mut seen: HashMap<String, (String, usize)> = HashMap::new();
    for card in &cards {
        if let Some((source, line)) = seen.insert(card.id.clone(), (card.source.clone(), card.line))
        {
            errors.push(format!(
                "{}:{}: duplicate id `{}` (first declared at {}:{})",
                card.source, card.line, card.id, source, line
            ));
        }
    }
    if errors.is_empty() {
        Ok(cards)
    } else {
        Err(errors)
    }
}

fn collect_markdown(path: &Path, files: &mut Vec<PathBuf>, errors: &mut Vec<String>) {
    if path.is_file() {
        if path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        {
            files.push(path.to_path_buf());
        } else {
            errors.push(format!("{}: expected a .md file", path.display()));
        }
    } else if path.is_dir() {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(error) => {
                errors.push(format!("{}: could not list: {error}", path.display()));
                return;
            }
        };
        for entry in entries.flatten() {
            let child = entry.path();
            if child
                .file_name()
                .is_some_and(|name| name == ".git" || name == ".knb")
            {
                continue;
            }
            collect_markdown(&child, files, errors);
        }
    } else {
        errors.push(format!("{}: path does not exist", path.display()));
    }
}

pub fn parse_markdown(text: &str, source: &str) -> Result<Vec<SourceCard>, Vec<String>> {
    let lines: Vec<&str> = text.lines().collect();
    let mut cards = Vec::new();
    let mut errors = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        if lines[index].trim() != "```card" {
            index += 1;
            continue;
        }
        let start = index + 1;
        index += 1;
        let mut block = Vec::new();
        while index < lines.len() && lines[index].trim() != "```" {
            block.push(lines[index]);
            index += 1;
        }
        if index == lines.len() {
            errors.push(format!("{source}:{start}: unclosed `card` fence"));
            break;
        }
        match parse_block(&block, source, start) {
            Ok(card) => cards.push(card),
            Err(error) => errors.push(error),
        }
        index += 1;
    }
    if errors.is_empty() {
        Ok(cards)
    } else {
        Err(errors)
    }
}

fn parse_block(lines: &[&str], source: &str, line: usize) -> Result<SourceCard, String> {
    let separators: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter_map(|(i, value)| (value.trim() == "---").then_some(i))
        .collect();
    if separators.len() != 2 {
        return Err(format!(
            "{source}:{line}: card needs exactly two `---` separators"
        ));
    }
    let (first, second) = (separators[0], separators[1]);
    let mut meta = BTreeMap::new();
    for raw in &lines[..first] {
        if raw.trim().is_empty() {
            continue;
        }
        let Some((key, value)) = raw.split_once(':') else {
            return Err(format!("{source}:{line}: invalid metadata line `{raw}`"));
        };
        let key = key.trim();
        if !matches!(key, "id" | "deck" | "tags" | "archived" | "renamed-from") {
            return Err(format!("{source}:{line}: unknown metadata key `{key}`"));
        }
        if meta
            .insert(key.to_owned(), value.trim().to_owned())
            .is_some()
        {
            return Err(format!("{source}:{line}: duplicate metadata key `{key}`"));
        }
    }
    let id = meta
        .remove("id")
        .ok_or_else(|| format!("{source}:{line}: missing `id`"))?;
    validate_id(&id).map_err(|reason| format!("{source}:{line}: invalid id `{id}`: {reason}"))?;
    let deck = meta.remove("deck").unwrap_or_else(|| "Default".into());
    if deck.trim().is_empty() {
        return Err(format!("{source}:{line}: deck cannot be empty"));
    }
    let tags = normalize_tags(
        meta.remove("tags")
            .unwrap_or_default()
            .split_whitespace()
            .map(str::to_owned),
    );
    let archived = match meta.remove("archived").as_deref() {
        None | Some("false") => false,
        Some("true") => true,
        Some(value) => {
            return Err(format!(
                "{source}:{line}: archived must be true or false, got `{value}`"
            ))
        }
    };
    let renamed_from = meta
        .remove("renamed-from")
        .filter(|value| !value.is_empty());
    if let Some(old) = &renamed_from {
        validate_id(old)
            .map_err(|reason| format!("{source}:{line}: invalid renamed-from `{old}`: {reason}"))?;
        if old == &id {
            return Err(format!("{source}:{line}: renamed-from must differ from id"));
        }
    }
    let front_markdown = lines[first + 1..second].join("\n").trim().to_owned();
    let back_markdown = lines[second + 1..].join("\n").trim().to_owned();
    if !archived && (front_markdown.is_empty() || back_markdown.is_empty()) {
        return Err(format!(
            "{source}:{line}: active card needs a non-empty question and answer"
        ));
    }
    let front = render_markdown(&front_markdown);
    let back = render_markdown(&back_markdown);
    let fingerprint = stable_fingerprint(&deck, &tags, &front, &back);
    Ok(SourceCard {
        id,
        deck,
        tags,
        front,
        back,
        archived,
        renamed_from,
        source: source.into(),
        line,
        fingerprint,
    })
}

fn render_markdown(markdown: &str) -> String {
    let options = pulldown_cmark::Options::ENABLE_TABLES
        | pulldown_cmark::Options::ENABLE_STRIKETHROUGH
        | pulldown_cmark::Options::ENABLE_TASKLISTS;
    let parser = pulldown_cmark::Parser::new_ext(markdown, options);
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    html.trim_end().to_owned()
}

fn validate_id(id: &str) -> Result<(), &'static str> {
    if id.is_empty() {
        return Err("cannot be empty");
    }
    if id.len() > 96 {
        return Err("must be 96 characters or fewer");
    }
    if !id.bytes().all(|byte| {
        byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_' | b'-')
    }) {
        return Err("use lowercase letters, digits, `.`, `_`, or `-`");
    }
    Ok(())
}

fn normalize_tags(tags: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut tags: Vec<_> = tags
        .into_iter()
        .filter(|tag| !tag.trim().is_empty())
        .collect();
    tags.sort();
    tags.dedup();
    tags
}

fn stable_fingerprint(deck: &str, tags: &[String], front: &str, back: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in deck
        .bytes()
        .chain(tags.join("\0").bytes())
        .chain(front.bytes())
        .chain(back.bytes())
    {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn build_plan(source: &[SourceCard], existing: &[ExistingNote]) -> Plan {
    let mut changes = Vec::new();
    let mut by_id: HashMap<&str, Vec<&ExistingNote>> = HashMap::new();
    for note in existing {
        by_id.entry(&note.id).or_default().push(note);
    }
    let mut claimed = BTreeSet::new();

    for card in source {
        if by_id
            .get(card.id.as_str())
            .is_some_and(|notes| notes.len() > 1)
        {
            changes.push(Change::Blocked {
                id: card.id.clone(),
                reason: "multiple Anki notes carry this stable ID".into(),
            });
            claimed.insert(card.id.clone());
            continue;
        }
        let direct = by_id
            .get(card.id.as_str())
            .and_then(|notes| notes.first())
            .copied();
        if card.archived {
            match direct {
                Some(note) if !note.archived => changes.push(Change::Archive {
                    card: card.clone(),
                    before: note.clone(),
                }),
                Some(note) => changes.push(Change::Unchanged {
                    id: card.id.clone(),
                    note_id: Some(note.note_id),
                }),
                None => changes.push(Change::Unchanged {
                    id: card.id.clone(),
                    note_id: None,
                }),
            }
            claimed.insert(card.id.clone());
            continue;
        }
        if let Some(note) = direct {
            claimed.insert(card.id.clone());
            if note_matches(card, note) {
                changes.push(Change::Unchanged {
                    id: card.id.clone(),
                    note_id: Some(note.note_id),
                });
            } else {
                changes.push(Change::Update {
                    card: card.clone(),
                    before: note.clone(),
                });
            }
            continue;
        }
        if let Some(old_id) = &card.renamed_from {
            let old = by_id
                .get(old_id.as_str())
                .and_then(|notes| (notes.len() == 1).then(|| notes[0]));
            match old {
                Some(note) if !claimed.contains(old_id) => {
                    claimed.insert(old_id.clone());
                    changes.push(Change::Rename {
                        card: card.clone(),
                        before: note.clone(),
                        from: old_id.clone(),
                    });
                }
                Some(_) => changes.push(Change::Blocked {
                    id: card.id.clone(),
                    reason: format!("renamed-from `{old_id}` is already claimed"),
                }),
                None => changes.push(Change::Blocked {
                    id: card.id.clone(),
                    reason: format!(
                        "renamed-from `{old_id}` does not identify exactly one Anki note"
                    ),
                }),
            }
        } else {
            changes.push(Change::Add { card: card.clone() });
        }
    }
    for note in existing {
        if !claimed.contains(&note.id) && !note.archived {
            changes.push(Change::Blocked {
                id: note.id.clone(),
                reason:
                    "managed Anki note is missing from source; restore it or add `archived: true`"
                        .into(),
            });
        }
    }
    changes.sort_by(|a, b| a.id().cmp(b.id()));
    let mut summary = Summary::default();
    for change in &changes {
        match change {
            Change::Add { .. } => summary.add += 1,
            Change::Update { .. } => summary.update += 1,
            Change::Rename { .. } => summary.rename += 1,
            Change::Archive { .. } => summary.archive += 1,
            Change::Unchanged { .. } => summary.unchanged += 1,
            Change::Blocked { .. } => summary.blocked += 1,
        }
    }
    Plan {
        schema: 1,
        dry_run: true,
        summary,
        changes,
    }
}

fn note_matches(card: &SourceCard, note: &ExistingNote) -> bool {
    let mut source_tags = card.tags.clone();
    source_tags.sort();
    let mut note_tags = note.tags.clone();
    note_tags.sort();
    card.deck == note.deck
        && card.front == note.front
        && card.back == note.back
        && source_tags == note_tags
        && !note.archived
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = r#"# Transport

```card
id: tcp-handshake
deck: Systems
tags: transport networking transport
---
What does TCP establish?
---
Sequence numbers and readiness.
```
"#;

    #[test]
    fn parses_documented_example_and_normalizes_tags() {
        let cards = parse_markdown(EXAMPLE, "notes.md").unwrap();
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].id, "tcp-handshake");
        assert_eq!(cards[0].tags, vec!["networking", "transport"]);
        assert_eq!(cards[0].line, 3);
    }

    #[test]
    fn rejects_duplicate_ids_across_paths() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), EXAMPLE).unwrap();
        fs::write(dir.path().join("b.md"), EXAMPLE).unwrap();
        let errors = parse_paths(&[dir.path().to_owned()]).unwrap_err();
        assert!(errors[0].contains("duplicate id"));
    }

    #[test]
    fn rejects_unknown_metadata_and_empty_active_cards() {
        let invalid = "```card\nid: good-id\nmagic: yes\n---\n\n---\n\n```";
        assert!(parse_markdown(invalid, "x.md").unwrap_err()[0].contains("unknown metadata"));
    }

    fn existing(id: &str) -> ExistingNote {
        ExistingNote {
            note_id: 10,
            card_ids: vec![20],
            id: id.into(),
            deck: "Systems".into(),
            tags: vec!["networking".into(), "transport".into()],
            front: "<p>What does TCP establish?</p>".into(),
            back: "<p>Sequence numbers and readiness.</p>".into(),
            archived: false,
        }
    }

    #[test]
    fn plans_in_place_update_without_changing_identity() {
        let mut source = parse_markdown(EXAMPLE, "notes.md").unwrap();
        source[0].back = "New answer".into();
        let plan = build_plan(&source, &[existing("tcp-handshake")]);
        assert_eq!(plan.summary.update, 1);
        match &plan.changes[0] {
            Change::Update { before, .. } => assert_eq!(before.note_id, 10),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn explicit_rename_claims_old_note_and_preserves_note_id() {
        let mut source = parse_markdown(EXAMPLE, "notes.md").unwrap();
        source[0].id = "tcp-open".into();
        source[0].renamed_from = Some("tcp-handshake".into());
        let plan = build_plan(&source, &[existing("tcp-handshake")]);
        assert_eq!(plan.summary.rename, 1);
        match &plan.changes[0] {
            Change::Rename { before, .. } => assert_eq!(before.note_id, 10),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn missing_source_is_blocked_not_deleted() {
        let plan = build_plan(&[], &[existing("tcp-handshake")]);
        assert_eq!(plan.summary.blocked, 1);
        assert!(!plan.has_writes());
    }

    #[test]
    fn explicit_archive_is_reversible_write() {
        let mut source = parse_markdown(EXAMPLE, "notes.md").unwrap();
        source[0].archived = true;
        let plan = build_plan(&source, &[existing("tcp-handshake")]);
        assert_eq!(plan.summary.archive, 1);
        assert!(plan.has_writes());
    }

    #[test]
    fn renders_commonmark_for_anki_fields() {
        let cards = parse_markdown(
            &EXAMPLE.replace("Sequence numbers", "**Sequence numbers**"),
            "notes.md",
        )
        .unwrap();
        assert!(cards[0].back.contains("<strong>Sequence numbers</strong>"));
    }
}
