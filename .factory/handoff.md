# Knowledge Note Bridge — build handoff

> **Independent verification status (2026-08-28): FAIL.** Candidate
> `95cecbe2379e63b4cc61e418fb390392b17e3db4` is deployed at
> https://knowledge-note-bridge.sociobot.in/ and the deployed assets exactly match
> the candidate, but it does not satisfy the acceptance contract. `sync --yes` can
> mutate without a fresh visible dry-run, and the service worker fails a cold-cache
> offline reload by returning HTML for the uncached JS module. See
> `.factory/verification.md` for exact reproduction, passing checks, and required
> fixes. Do not release as verified until both P1 defects are resolved and retested.

## Shipped

- Rust `knb` 0.1.0 single binary with `init`, `check`, `plan`, and `sync`.
- Recursive Markdown card discovery, strict stable-ID validation, CommonMark-to-Anki
  field rendering, and duplicate detection.
- Pure reconciliation planner for unchanged, add, in-place update, explicit rename,
  explicit archive, and blocked/missing-source states.
- Stock AnkiConnect v6 adapter. Before its first mutation, `sync` calls documented
  `deckNames` and `exportPackage(includeSched: true)` for every deck, writing scheduled
  `.apkg` files beneath `.knb/backups/<unix-time>/`.
- No deletion path: archive adds `knb_archived` and suspends cards. Reactivation removes
  that tag and unsuspends them. Updates and renames retain the Anki note/card IDs.
- Incremental reversal report with the complete pre-change fields, tags, deck, note ID,
  card IDs, backup paths, applied actions, and failure state; local sync manifest.
- Human and single-value JSON output, stable exit codes, no interactive prompts.
- Responsive static documentation and local browser diff lab at `dist/site`, with
  explicit empty, parse-error, blocked, and offline states.
- $19 one-time Steward license flow using the Sociobot checkout/verify contract,
  once-daily cached verification, optimistic offline access, query-token capture, and
  paste-to-restore. Core CLI safety and export remain free.
- Original 58 KB WebP ceramic bridge hero, privacy and terms pages, offline shell service
  worker, CSP/caching config, sitemap, and robots file.

## Verify and package

From a clean clone with stable Rust and Node.js 20+:

```sh
npm install
npm test
npm run build
cargo package --allow-dirty
```

Verification completed on 2026-08-28:

- `npm test`: 12 Rust tests (including a mock-Anki end-to-end backup-before-write sync),
  4 browser-diff unit tests, and 4 Playwright/Axe tests passed at desktop and 390 px.
- `npm run build`: passed; `dist/site/index.html` exists and the release CLI is at
  `target/release/knb`.
- `cargo package --allow-dirty`: passed; package is 106.4 KB compressed. Do not publish
  from the worker; the factory owns registry credentials.
- Factory `verify-url.sh`: HTTP 200, no console errors, title and `lang` present, exactly
  one `h1`, main landmark present, no missing alt text or unlabeled buttons.
- Lighthouse 12.8.2 mobile lab: Performance 100, Accessibility 100, Best Practices 100,
  SEO 100; LCP 1.37 s, CLS 0, total blocking time 0 ms. Lab INP is not available without
  user interaction; TBT is the lab responsiveness proxy.
- Initial payload: 7.22 KB JavaScript, 9.80 KB CSS, no font files, 58.0 KB hero WebP.
  All are far below the 200/50/120/300 KB budgets.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Deployment and release

- Static deploy root: `dist/site`.
- Exact site build command: `npm run build:site` (full product build: `npm run build`).
- The factory should attach platform binaries built from the `0.1.0` tag or publish the
  verified Cargo package, then register the paid product for slug
  `knowledge-note-bridge`. No product ID or payment-provider secret is in the repo.
- Production checkout and verification intentionally target
  `https://api.sociobot.in/api/v1/products/knowledge-note-bridge/...`.

## Known gaps and v1 boundaries

- A live personal Anki collection was not available in the disposable worker. The full
  request sequence and backup-before-mutation ordering are integration-tested against a
  local HTTP double; release QA should run one sacrificial collection smoke test with
  stock AnkiConnect v6 on each supported desktop platform.
- New notes use Anki's built-in `Basic` model and its `Front`/`Back` fields. Custom note
  types, cloze cards, media import, and automatic card generation are deliberately out
  of v1 scope.
- AnkiConnect exports backups per deck because its documented API does not expose a
  whole-collection backup action. Every current deck is exported with scheduling data
  before writes; the report lists each package for restoration.
- The browser demo models reconciliation locally; it does not connect to Anki or upload
  notes. This is intentional for privacy and because browsers cannot safely reach every
  user's local AnkiConnect configuration.

## Asset provenance

The exact hero prompt, visual rationale, palette, type, motion policy, generator, and
license are recorded in `.factory/design.md`. It was generated once with
`/opt/fleet/lib/gen-image.sh` on the factory `factory-image` deployment and locally
converted to WebP; no third-party stock assets are used.
