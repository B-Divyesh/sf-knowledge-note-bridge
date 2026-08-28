# Independent verification — FAIL

**Candidate:** `95cecbe2379e63b4cc61e418fb390392b17e3db4`  
**Live URL:** https://knowledge-note-bridge.sociobot.in/  
**Verified:** 2026-08-28  
**Result:** **FAIL**

The candidate is buildable, the live static deployment exactly matches it, and the
normal CLI and site paths are strong. It does not meet the high-stakes acceptance
contract because a write can be performed without showing the user its current
destructive plan, and the PWA's own cache does not contain the JS/CSS needed for a
cold-cache offline reload.

## Blocking defects

### P1 — `sync --yes` can mutate Anki without a fresh visible dry-run

The brief's success measure requires every destructive change to be previewed before
sync. `knb sync <paths> --yes` calculates the plan, immediately creates backups, and
then applies write actions. It does not print a plan or require a plan artifact/hash
produced by a preceding `knb plan`. The only branch that prints the plan before a
write is `sync` *without* `--yes`, which exits 3 and does not establish that a later
`--yes` run has the same inputs or Anki state.

Evidence: an independent clean-consumer `sync --yes --json` against an AnkiConnect
double made this sequence with no preceding preview: `version`, `findNotes`,
`deckNames`, `exportPackage` (per deck, `includeSched: true`), then `addNote`. Its
only stdout was the post-mutation report (`dry_run: false`). Source inspection of
`src/main.rs:262-317` confirms no `print_plan` call in the `yes` branch before
`create_backups`/`apply`.

Impact: a Markdown edit or source/Anki state change after a separately run `plan`
can be applied unseen, contrary to the product's central integrity guarantee.

Required resolution: bind `sync` to an approved, current plan (for example an
explicit plan file/fingerprint), or make a pre-write preview plus a specific
confirmation unavoidable. Add an integration test proving no mutation occurs before
the exact current write set has been presented.

### P1 — cold-cache offline reload serves HTML as the JavaScript module

The service worker precaches only `/`, legal pages, image, and favicon. It excludes
the hashed JS and CSS assets. On a freshly installed worker with a cold HTTP cache,
an offline reload asks the worker for `/assets/main-DrYr9GZn.js`; its catch fallback
returns cached `/` HTML for that module request. Chromium reports:

```
Failed to load module script: Expected a JavaScript-or-Wasm module script but the
server responded with a MIME type of "text/html".
```

Reproduction: production `dist/site` built from the clean checkout, served by Vite
preview; load once online, wait for `navigator.serviceWorker.ready`, set the browser
offline, then reload. The document shell appears but JavaScript is not loaded, so the
claimed local demo/offline behavior is not functional. A live browser with a warm
ordinary HTTP cache did reload successfully, which masks rather than fixes this
service-worker cache gap. The candidate's deployed `sw.js` hash is identical to the
local failing file.

Required resolution: version and precache the build's JS/CSS (or return an explicit
error response, never HTML, for failed asset requests), use an update strategy such
as `skipWaiting`/`clients.claim` where appropriate, and add a cold-cache offline
reload/update Playwright test.

## What passed

### Clean checkout, build, quality checks, and package

- Isolated clone detached at the exact candidate; `npm ci` succeeded with 0 audit
  vulnerabilities.
- `npm test` passed: 12 Rust tests, 4 browser parser/diff unit tests, and 4
  Playwright tests (desktop Chromium and 390px mobile).
- Exact production build, `npm run build`, passed and produced `target/release/knb`
  and `dist/site/`.
- `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` passed. There
  are no repository-provided TypeScript lint/typecheck scripts.
- `cargo package --allow-dirty` passed and produced
  `knowledge-note-bridge-0.1.0.crate` (110,935 bytes in this post-test run). A clean
  consumer installed it with `cargo install --path`; `knb --help`, `init`, and
  `check --json` worked.
- The package test run creates `test-results/.last-run.json`; because it is not
  excluded, a package made *after* `npm test` contains that harmless test artifact.
  This is a P3 packaging hygiene observation, not a release blocker.

### CLI end-to-end and recovery cases

- Normal add sync against an independent AnkiConnect v6 double: backup calls for
  `Default` and `Work` with `includeSched: true` preceded `addNote`; JSON report had
  `status: complete`, a local manifest, and backup paths.
- A rename plan mapped `legacy-id` to `current-id` on existing `note_id: 42`; an
  archive plan proposed suspension of `card_id: 77` and no deletion.
- Invalid stable ID and duplicate stable IDs were rejected as one JSON value with
  exit code 2. Existing target (`init`) and non-Markdown target refusals also returned
  exit code 2 without overwrite. An unreachable AnkiConnect endpoint returned the
  documented JSON recovery message and exit code 4.
- Existing automated integration coverage also verified backup-before-first-write.

### Live deployment, privacy, accessibility, and performance budget

- Downloaded live `/`, `/assets/main-DrYr9GZn.js`,
  `/assets/styles-Dkyo7abA.css`, `/sw.js`, and `/bridge-ceramic.webp`; each SHA-256
  exactly equals `dist/site` from this candidate. This supersedes the earlier
  deployment-only concern: the current live deployment is the candidate.
- Live response policy is present: HSTS, CSP restricted to self plus the Sociobot
  license API, `nosniff`, strict referrer policy, and disabled camera/microphone/
  geolocation. Hashed assets and hero use `public, max-age=31536000, immutable`;
  documents and `sw.js` use 30-second revalidation.
- Initial live desktop and 390px requests stayed on the site origin; no analytics,
  font CDN, or third-party runtime request was observed. Code scan confirms the CLI
  contacts only the configured AnkiConnect endpoint; the optional license verifier
  is the sole site runtime cross-origin request.
- Live desktop and 390px functional checks passed: clear/restore source, parse error
  recovery, visible 3px keyboard focus, no horizontal overflow at 390px, and
  reduced-motion computed durations of `0.01ms`. Axe found zero serious/critical
  findings in both viewports; no page or console errors occurred during normal use.
- Output sizes are within budget: JS 7,218 B (<200 KB), CSS 9,799 B (<50 KB), no
  font files, hero WebP 58,002 B (<300 KB).

## Measurement limitation

Lighthouse 12.8.2 was attempted twice against the live URL using the supplied
Playwright Chromium (both direct `CHROME_PATH` and a manually opened debug port).
This container's launcher could not attach / crashed the tab, so independent
Lighthouse scores are unavailable. This is not used to infer a passing score; the
file-budget and Playwright accessibility evidence above are recorded instead.

## Retest command set

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
```

After the P1 fixes, repeat clean-profile service-worker offline reload and update
tests, then validate that a `sync --yes` write cannot begin without approval of the
specific current plan.
