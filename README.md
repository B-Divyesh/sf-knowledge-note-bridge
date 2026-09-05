# Knowledge Note Bridge

Update Anki cards from Markdown without losing review history.

Knowledge Note Bridge is for self-learners who keep technical or business notes in
Markdown. It compares stable source IDs with existing Anki notes before anything
changes.

## Try the sample

Install the CLI, then run its isolated sample:

```sh
cargo install --path .
knb demo
```

The command uses the files in `examples/`. It creates a new temporary directory,
writes a dry-run plan there, and never contacts Anki.

The browser sample is at
[knowledge-note-bridge.sociobot.in/demo/](https://knowledge-note-bridge.sociobot.in/demo/).
It uses a separate `demo:knb:` session storage namespace. Reset or exit clears that
namespace.

## Install

Requirements:

- Stable Rust
- Anki with AnkiConnect installed, add-on code `2055492159`

```sh
cargo install --git https://github.com/B-Divyesh/sf-knowledge-note-bridge
knb --help
```

Anki must be open for `plan` and `sync`. The default AnkiConnect address is
`http://127.0.0.1:8765`. Use `--endpoint URL` to choose another address.

## Markdown format

Each card uses a fenced block:

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

IDs use lowercase letters, numbers, `.`, `_`, or `-`. They must be unique across
the supplied files.

Use `archived: true` to retire a card. Use `renamed-from: old-id` to correct an ID
while keeping the existing Anki note.

Card fields support links, lists, code, emphasis, tables, and strikethrough.

## Review and sync

First validate the source:

```sh
knb check notes/
```

Save the exact dry-run you review:

```sh
knb plan notes/ --json > plan.json
```

Apply that plan:

```sh
knb sync notes/ --yes --plan plan.json
```

A writing sync requires the exact current plan. Missing cards and stale plans stop
before backup or writes.

A matching sync exports scheduled Anki backups before the first write. It then stores
a recovery report in `.knb/reports/`.

Updates change fields on the existing Anki note. Explicit archives add a tag and
suspend cards instead of deleting them.

If a write fails, the failed report keeps its backup paths. Restore an `.apkg` file
through Anki when recovery is needed.

Use `--json` for one machine-readable value. Success and error output both follow
that rule.

## Privacy

The CLI reads local files and calls only the AnkiConnect address you choose. It sends
no analytics.

The browser demo never places pasted Markdown in a request. Normal home and demo use
makes no analytics or third-party runtime request.

The sample works offline after one visit.

## Free CLI and Steward

Every CLI command, backup, report, JSON output, and safety check works without a
license.

Steward costs $19 once. It saves the bundled browser sample report on the device.
Checkout and license checks use the Sociobot billing API.

A valid license result is cached for one day. Steward access ends when Sociobot
reports that the license is invalid.

See the public [Privacy](https://knowledge-note-bridge.sociobot.in/privacy/) and
[Terms](https://knowledge-note-bridge.sociobot.in/terms/) pages.

## Develop and verify

Requirements are stable Rust, Node.js 20 or later, npm, and Chromium.

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
./verify-url.sh
```

`npm test` runs Rust tests, browser parser tests, a production site build, desktop
checks, 390-pixel phone checks, and every declared claim.

`npm run build` produces the release binary and `dist/site/`. The factory deploys
`dist/site/`; do not publish the crate from a worker.

Every public product claim and its isolated command is listed in
[.factory/claims.json](.factory/claims.json). Demo boundaries are documented in
[.factory/demo.md](.factory/demo.md).

## License

MIT © 2026 Sociobot (Param Factory). See [LICENSE](LICENSE).
