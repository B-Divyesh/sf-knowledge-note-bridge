# Knowledge Note Bridge — repair handoff

## Release status

**Repaired and deployed on 2026-08-28.** The independent-verifier P1 findings for
candidate `95cecbe2379e63b4cc61e418fb390392b17e3db4` are fixed in repair commits
`a731c59` and `4f77783` (pushed to `main`) and deployed to
https://knowledge-note-bridge.sociobot.in/ (Azure deployment
`9cca5a9a-4874-41c0-a9af-46c8357b8e07`). The deployed JS and service-worker
SHA-256 values exactly match the local `dist/site` output.

## Repairs

- **Approved write plan:** a writing `knb sync` now requires both `--yes` and
  `--plan FILE`. `FILE` must be unmodified JSON from `knb plan --json`; the
  command independently rebuilds the current plan and refuses with exit code 3
  before backup or mutation if it is absent or stale. The reversal report records
  the approved plan path. README, `--help`, and landing-page commands now show:

  ```sh
  knb plan notes/ --json > plan.json
  knb sync notes/ --yes --plan plan.json
  ```

- **Offline shell:** the site build now generates a versioned service worker from
  the actual Vite asset list. It precaches HTML routes, image, favicon, and the
  hashed JS/CSS, caches static resources first, uses the HTML fallback only for
  navigation requests, and ignores response `Vary` only when looking up this
  same-origin static cache. `skipWaiting`, `clients.claim`, and revalidated
  `/sw.js` caching provide immediate updates. Failed asset requests never receive
  the HTML document.
- Added `/test-results/` to `.gitignore`, so the package no longer picks up
  Playwright artifacts after test runs.

## Verification performed

From a clean `npm ci` install:

- `npm test` passed: 13 Rust unit/integration tests, 4 browser-diff unit tests,
  and 8 Playwright/Axe tests. Browser tests cover desktop Chromium and 390 px
  mobile, keyboard-visible normal interaction, semantic/accessibility checks,
  error/empty/offline states, a cold offline reload with cached JavaScript and
  CSS, and immediate service-worker cache activation after an update.
- The new CLI integration regression proves `sync --yes` without `--plan`, and
  a stale approved plan, make only `version`/`findNotes` reads—never
  `deckNames`, `exportPackage`, or `addNote`. The matching-plan test proves
  backup still precedes the first write.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
  `npm run build` passed. `dist/site` is present and the release binary is
  `target/release/knb`.
- `cargo package --allow-dirty` passed and verified a ready-to-publish
  `target/package/knowledge-note-bridge-0.1.0.crate` (132.5 KiB compressed).
  Do not publish from this worker. A fresh `cargo install --path . --root
  <temp>` consumer successfully ran `knb --help`, `init`, and `check --json`.
- `npm audit --omit=dev` reports 0 vulnerabilities. The final static payload is
  7,218 B JS, 9,799 B CSS, no font files, 58,002 B hero WebP, and 1,542 B service
  worker—below the product budgets.
- Post-deploy `/opt/fleet/lib/verify-url.sh` passed: HTTPS 200, 767 ms load,
  no console errors, title/lang, exactly one `h1`, main landmark, image alt, and
  labelled buttons. The live response has HSTS, self-restricted CSP, `nosniff`,
  strict referrer policy, and disabled camera/microphone/geolocation. `/sw.js`
  has `Cache-Control: public, max-age=0, must-revalidate`; assets retain immutable
  caching. No analytics, font CDN, or third-party runtime script is shipped.
- SHA-256 identity evidence: `main-DrYr9GZn.js`
  `09abaefaf9038662e24e3b9e518aed667862e4a24d1c8b7913d92c94ba26a158` and
  `sw.js` `dc374bdd8e94733bba3f0d143014c1bc3b94142cd1736ff69e138f55ef9f2612`
  are identical locally and at the production URL.

Lighthouse 12.8.2 was attempted against production with the installed Playwright
Chromium, but its tab crashed in this container; no score is claimed. The file
budgets and desktop/mobile Playwright/Axe evidence above are the available local
performance and accessibility evidence.

## Deploy and package

- Static deploy root: `dist/site`.
- Rebuild/deploy: `npm run build && /opt/fleet/lib/deploy-static.sh knowledge-note-bridge dist/site`.
- Package for the factory release pipeline: `cargo package --allow-dirty`.

## Remaining boundary

No personal Anki collection is available in this disposable environment. The
AnkiConnect v6 request order, approved-plan protection, and backup-before-write
sequence are exercised against a local HTTP double; a sacrificial real-collection
smoke test remains advisable before a platform-release announcement.
