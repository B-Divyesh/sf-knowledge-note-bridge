# Independent verification 2 — PASS

**Candidate:** `1652df0c0d1b1472ade1c4d83049d455554dac83`  
**Live URL:** https://knowledge-note-bridge.sociobot.in/  
**Verified:** 2026-08-28  
**Result:** **PASS**

This is a fresh, independent retest of the candidate after the earlier report in
`.factory/verification.md` failed it. The two prior P1 findings are resolved:
a writing sync requires an exact current `knb plan --json` artifact, and the PWA
precaches its versioned JS/CSS assets so a cold offline reload does not receive
HTML for a module. The currently live deployment hash-matches this candidate.

## Gate result

No P0, P1, P2, or P3 defects were found in the tested scope.

## Clean checkout and release checks

An isolated detached worktree at the exact candidate was used; the existing
primary worktree's unrelated `graphify-out/` changes were not used or changed.

- `npm ci` completed with 0 reported audit vulnerabilities.
- `npm test` passed: 13 Rust unit/integration tests, 4 browser diff/parser unit
  tests, and 8 Playwright tests. Playwright covered desktop Chromium and 390 px
  mobile, semantic/axe checks, empty/error/offline states, cold offline reload,
  and immediate service-worker cache activation after update.
- The exact release build, `npm run build`, passed and produced
  `target/release/knb` and `dist/site/`.
- `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` passed.
  No repository-provided lint or TypeScript type-check script exists beyond the
  Vite build and these Rust checks.
- `cargo package --allow-dirty` passed, verified the package, and produced
  `target/package/knowledge-note-bridge-0.1.0.crate` (132.2 KiB compressed;
  45 files). Nothing was published.

## CLI and integrity workflow

- A clean consumer installation with `cargo install --path <candidate> --root
  <temporary-root>` succeeded. The installed `knb --help`, `init --json`, and
  `check --json` ran successfully. A second `init` refused to overwrite the
  note and returned structured JSON with exit code 2.
- The source integration test exercised the normal write path against an
  independent AnkiConnect v6 HTTP double: `plan --json` first performed only
  `version`/`findNotes`; matching `sync --yes --plan` then performed
  `version`, `findNotes`, `deckNames`, `exportPackage`, and `addNote`, in that
  order. It retained a complete reversal report with the approved plan and
  backup path.
- The companion approval regression exercised a missing approval and a stale
  approval. Both exited 3 before `deckNames`, backup, or mutation. This verifies
  that every write set is first represented by the exact current dry-run plan,
  fixing the earlier P1.
- Independent boundary checks against the release binary: an invalid stable ID
  (`Bad ID`) returned one JSON error and exit 2; an empty Markdown source was a
  valid 0-card check (exit 0); an unavailable AnkiConnect endpoint returned its
  recovery guidance and exit 4. Existing coverage also checks duplicate IDs,
  unknown metadata, blocked missing source cards, in-place updates, explicit
  rename preservation, and reversible archives.

## Website, PWA, accessibility, and privacy

- Fresh live Chromium checks at desktop and a 390 x 844 viewport found the
  single expected h1, `lang=en`, main landmark, descriptive hero alt text, no
  horizontal overflow, no console/page errors, and no axe serious or critical
  findings. Keyboard Tab reached **Clear source** with a visible
  `rgb(21, 94, 117) solid 3px` focus ring; Enter cleared the example, Restore
  example recovered it, and keyboard submission of invalid Markdown showed the
  parse error. With reduced motion, hero animation/transition durations were
  `0.01ms`.
- Normal live page requests remained on
  `https://knowledge-note-bridge.sociobot.in`; there are no analytics, font
  CDN, or third-party runtime scripts. An isolated invalid-license flow made
  exactly one optional external request, a GET to the documented Sociobot
  verification endpoint with only the test token; the URL was stripped and only
  `sb_license:knowledge-note-bridge` plus its local cached verdict were stored.
  The local demo Markdown was not sent. The CLI defaults to loopback
  AnkiConnect and has no telemetry.
- The new service-worker tests passed on both viewports: the generated cache
  contains JS and CSS, those assets return their correct MIME types while
  offline, a cold offline reload renders the demo, and a changed cache version
  activates without waiting. The generated worker precaches the Vite asset list
  and uses the HTML fallback only for navigations.
- Live headers on `/` include HSTS, a self-restricted CSP (the optional
  Sociobot API is the only `connect-src` exception), `nosniff`, strict referrer
  policy, and disabled camera/microphone/geolocation. Documents revalidate in
  30 seconds; `/sw.js` uses `public, max-age=0, must-revalidate`; hashed assets
  and the WebP hero use `public, max-age=31536000, immutable`.
- Built/live payloads are within the stated budgets: JS 7,218 B, CSS 9,799 B,
  no font files, hero WebP 58,002 B, and service worker 1,542 B.

## Live candidate identity

The live response bytes equal the fresh local build:

| Asset | SHA-256 |
| --- | --- |
| `assets/main-DrYr9GZn.js` | `09abaefaf9038662e24e3b9e518aed667862e4a24d1c8b7913d92c94ba26a158` |
| `assets/styles-Dkyo7abA.css` | `fb680653d286132e8fc7e85b16f138ea6f0578f0dab15abadb8838ecb788f871` |
| `sw.js` | `dc374bdd8e94733bba3f0d143014c1bc3b94142cd1736ff69e138f55ef9f2612` |
| `bridge-ceramic.webp` | `749f9e7ea0977265ae8d5e8f9fe4be373fb06e6477028ec81f81ae572eb8e630` |

## Limitations / follow-up

- There was no personal Anki collection in this disposable environment. The
  transactional call ordering, stale-plan safety, backup-before-write behavior,
  and reversal report were verified against the local AnkiConnect v6 double; a
  sacrificial real-collection smoke test remains sensible before a broad
  announcement.
- Lighthouse 12.8.2 was attempted against production with the installed
  Playwright Chromium. Its launcher could not connect to Chrome in this
  container, so no Lighthouse score is claimed. This did not hide a failed
  browser check: the measured file budgets and the independent desktop/mobile
  Playwright/Axe results above passed.

## Repeat

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
```
