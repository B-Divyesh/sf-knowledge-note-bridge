# Knowledge Note Bridge

Keep Anki review history attached to the knowledge in your Markdown notes. Knowledge
Note Bridge (`knb`) gives every card a stable source ID, previews a dry-run diff, backs
up Anki before writing, and records how each change can be reversed.

It is for self-learners who want Markdown to remain the source of truth without turning
every edit or file rename into a new Anki card. Notes stay local. There is no telemetry.

## Install

Build the single binary with stable Rust:

```sh
cargo install --path .
knb --help
```

Anki must be open with the free AnkiConnect add-on installed (code `2055492159`) when
you run `plan` or `sync`. The default endpoint is `http://127.0.0.1:8765`.

## Markdown format

Cards use a compact fenced block. `id` is permanent; changing a question, answer,
deck, tags, or filename does not change the Anki note identity.

````markdown
# Transport protocols

```card
id: tcp-handshake
deck: Systems
tags: networking transport
---
What does the TCP three-way handshake establish?
---
Both peers' initial sequence numbers and readiness to exchange data.
```
````

IDs must be unique across all input paths and contain lowercase letters, digits,
`.` `_` or `-`. A card may be intentionally retired with `archived: true`. Rename an
incorrect old ID without losing history by adding `renamed-from: old-id` to the new
card. Missing cards are never silently deleted: `plan` reports them as `needs-action`
until the source explicitly archives or renames them.

## Usage

First inspect what would happen:

```sh
knb plan notes/ --json > plan.json
```

Example summary:

```text
2 unchanged · 1 update · 1 rename · 1 archive · 0 blocked
No changes were written. Run `knb sync notes/ --yes` after reviewing this plan.
```

Then apply the exact same reconciliation. `sync` creates an `.apkg` collection backup
through AnkiConnect before the first write and stores a local reversal report:

```sh
knb sync notes/ --yes
# report: .knb/reports/20260828T154012Z.json
```

Other useful commands:

```sh
knb check notes/                 # parse and validate without Anki
knb init notes/cards.md          # create a documented starter note
knb plan notes/ --endpoint URL   # use a non-default AnkiConnect endpoint
knb sync notes/ --yes --json     # non-interactive scripting output
```

The CLI never prompts. `sync` requires `--yes`; without it, it prints the plan and exits
with code 3. Parse/configuration errors use exit code 2, blocked safety conditions 3,
and Anki/network failures 4. `--json` writes one JSON value to stdout; human diagnostics
go to stderr.

## How identity and history are preserved

Each Anki note receives `knb_id::<id>` and `knb_managed` tags. On later runs, the bridge
looks up that tag and updates the existing note in place, retaining its note ID, cards,
scheduling, lapses, ease, and review log. A rename replaces only the identity tag on the
same note. An archive suspends the existing cards and adds `knb_archived`; it does not
delete them. The report records old fields/tags and card suspension state for recovery.

If Anki contains two notes with the same `knb_id` or a source ID collides, the operation
is blocked before backup or mutation. If any write fails, the report is retained with
the backup path and the failure; restore the backup from Anki's import screen.

## Free and Steward

The CLI and all integrity safeguards are MIT-licensed and fully usable for free.
Knowledge Note Bridge Steward is a one-time purchase that unlocks convenience on the
documentation site: saved browser demo reports and multi-root command presets. It does
not gate sync safety, accessibility, or data export. The hosted checkout and license
verification are handled by Sociobot; no payment details enter this repository.

## Development

Requirements: stable Rust, Node.js 20+, npm, and Chromium for browser tests.

```sh
npm install
npm test                 # Rust tests + site tests
npm run build            # release binary + site -> dist/
npm run build:site       # static site only -> dist/site/
cargo package --allow-dirty
```

The package starts at `0.1.0`. CI can use `knb sync --yes`; there are no interactive
prompts. The static site is deployed from `dist/site` and documents the downloadable
binary supplied by the factory release pipeline.

## Privacy and security

Markdown, manifests, backups, and reports stay on your machine. AnkiConnect is called
only at the configured endpoint. The site has no analytics or third-party runtime
scripts. Optional license verification sends only the entered license token to the
Sociobot API. See `/privacy/` and `/terms/` on the site.

## License

MIT © 2026 Sociobot (Param Factory). See [LICENSE](LICENSE).
