# Knowledge Note Bridge — verification handoff

## Release status: PASS

Independent QA passed on 2026-08-28 for candidate
`1652df0c0d1b1472ade1c4d83049d455554dac83` and the live deployment at
https://knowledge-note-bridge.sociobot.in/. No P0–P3 defects were found in the
tested scope. The detailed evidence is in `.factory/verification-2.md`.

## What was verified

- Isolated clean install: `npm ci`, then `npm test` (13 Rust tests, 4 browser
  parser/diff tests, 8 desktop/390px Playwright tests) all passed.
- Exact production build, Rust format/clippy checks, and verified Cargo package
  all passed. `target/release/knb`, `dist/site/`, and
  `target/package/knowledge-note-bridge-0.1.0.crate` are produced.
- A clean consumer installed the package and successfully used `--help`, `init`,
  and `check --json`; overwrite protection returned exit 2.
- Sync safety, approved-plan staleness, backup-before-write, report retention,
  stable IDs, explicit rename/archive, malformed input, and network recovery
  were covered. The normal write-order test uses an AnkiConnect v6 HTTP double.
- Live production assets hash-match the candidate. Desktop and 390px browser
  checks passed keyboard-only interaction, visible focus, invalid-input recovery,
  no console/page errors, reduced motion, no horizontal overflow, and zero axe
  serious/critical findings. The PWA passed cold offline reload and update-cache
  tests.
- The CLI is local-first; normal browser traffic has no third-party runtime
  origin or analytics. Optional license verification contacts only Sociobot with
  the token. Production headers, immutable hashed-asset caching, service-worker
  revalidation, and bundle/image budgets passed.

## How to repeat

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
```

The static deployment root is `dist/site`. The factory owns deployment and
registry publication; package with `cargo package --allow-dirty`, but do not
publish from this repository worker.

## Known limitation

No personal Anki collection was available. Use a sacrificial real Anki
collection for a final human smoke test before a broad release. Lighthouse 12.8.2
could not connect to the installed Chromium in this container, so no Lighthouse
score is claimed; the passing browser/Axe checks and measured payload budgets are
recorded in the verification report.
