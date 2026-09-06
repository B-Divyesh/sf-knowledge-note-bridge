# Knowledge Note Bridge — repair 2 handoff

## Release status

Repair complete and deployed on 2026-09-06.

- Live URL: https://knowledge-note-bridge.sociobot.in
- Implementation SHA: `db31f6cb25612439a356408be751c2d77a4bfa23`
- Documentation SHA: the later report-only commit containing this handoff; obtain it with `git log -1 --format=%H -- .factory/handoff.md`
- Final deployment: `9b37b510-b84e-406c-b6e5-6af744206e40`
- Earlier deployment during this repair: `5672f2ad-a90c-4338-9749-ed54c999a561`

The live JavaScript, CSS, and service worker hashes match the final implementation build.

## What changed

- Added `.factory/claims.json` with 20 public claims. Each claim selects exactly one tagged outcome test and all 20 declared commands pass independently.
- Added `knb demo` and `knb demo --json`. The installed binary copies bundled realistic Markdown and Anki data into a new temporary directory, shows add, update, rename, and archive changes, and never contacts Anki.
- Added a self-hosted terminal recording based on the binary's sample output.
- Added a real `/demo/` sandbox and `?demo=1` entry. It has a persistent sample label, realistic populated output, reset, and exit actions. Demo state uses only `demo:knb:` session keys and is discarded on reset, exit, or tab close.
- Rewrote the first screen to name the job, audience, first action, result, privacy, offline behavior, and free core before scrolling on desktop and 390 px phones.
- Replaced metaphor and mood copy with task-based headings and plain words. `.factory/copy-audit.md` records sentence counts and terminology.
- Added a designed page for unknown paths with a real HTTP 404 response.
- Added route titles, canonical URLs, Open Graph and Twitter metadata, an original social image, an apple-touch icon, sitemap entries, security headers, and `verify-url.sh`.
- Preserved the glacial-ceramics visual system and recorded asset provenance in `.factory/design.md`.
- Kept the $19 one-time Steward offer and its paid deliverable. Billing registration is absent, so the page reports checkout and license checks as unavailable instead of linking to a 404. Public registration metadata is in `/work/.evidence/billing-offer.json`.
- Added a reusable cold-live browser check at `scripts/live-smoke.mjs`.

## Review findings disposition

| Finding | Disposition and evidence |
| --- | --- |
| P1-1: no claims manifest or tests | Resolved. The manifest declares 20 claims; the validator finds exactly one outcome test per claim; every declared command passed from the final clean checkout. |
| P1-2: no isolated one-click demo | Resolved. The first-screen action opens `/demo/`; desktop and phone checks proved populated output, persistent label, reset, exit, and separation from local license storage. |
| P2-1: no CLI demo | Resolved. A clean installed artifact ran `knb demo --json`, returned all four change kinds, wrote to a unique temporary directory, and reported `anki_contacted: false`. |
| P2-2: no real 404 | Resolved. Unknown live paths return HTTP 404 with `Page not found — Knowledge Note Bridge` and a route home. |
| P2-3: first-screen and plain-words failure | Resolved. Job, audience, action, result, and three facts fit before the fold at 1440 × 900 and 390 × 844. Copy audit has no sentence over 22 words or banned term. |
| P3-1: metadata and verification incomplete | Resolved. Metadata and route titles are complete; both local and live `./verify-url.sh` checks pass. |

The 18 claims named in review 1 are either represented directly or split into narrower observable claims. Two additional claims cover the CLI demo and exact paid state.

## Earlier verification disposition

| Earlier item | Current evidence |
| --- | --- |
| `sync --yes` could write without a fresh preview | Resolved. The integration test rejects missing and stale plans before backup or write. |
| Cold offline reload returned HTML for JavaScript | Resolved. Browser tests use a fresh context and the live cold check reloads `/demo/` offline with four rows. |
| Test artifacts could enter the crate | Resolved. `cargo package --allow-dirty` verifies 67 files and a 191.8 KiB compressed crate without Playwright results. |
| Lighthouse could not be measured | Resolved. Lighthouse 12.8.2 reports 100 performance, 100 accessibility, 100 best practices, and 100 SEO. |

## Clean verification

The final SHA was fetched into a detached clean worktree. `npm ci` installed 23 packages with zero reported vulnerabilities. These commands passed:

```sh
npm ci
# Every test command in .factory/claims.json, one at a time: 20/20 passed
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
```

`npm test` passed 13 Rust tests, 5 JavaScript parser tests, and 38 Playwright tests across desktop, phone, and claim projects. It covers normal, invalid, boundary, and recovery paths; keyboard and focus; reduced motion; Axe; privacy; offline reload and service-worker update; legal pages; titles; and the 404.

A separate clean consumer installed the crate with `cargo install --path ... --locked`. It exercised `--help`, `demo --json`, `init --json`, and `check --json`. The sample returned add, archive, rename, and update without contacting Anki.

The release build produced `target/release/knb` and `dist/site/`. The site payload is 9.09 KiB JavaScript raw (3.89 KiB gzip), 12.93 KiB CSS raw (3.89 KiB gzip), and 93,609 bytes total in the Lighthouse run.

Lighthouse mobile results:

- Performance: 100
- Accessibility: 100
- Best practices: 100
- SEO: 100
- LCP: 1,357 ms
- CLS: 0
- Total blocking time: 0 ms

## Live verification

`./verify-url.sh https://knowledge-note-bridge.sociobot.in` passed home, demo, privacy, terms, and an unknown route. Each page has the required title, language, one h1, main landmark, image alternatives, no console errors, and zero serious or critical Axe findings.

Fresh desktop and 390 px phone contexts then proved the complete live path: first-screen contract, one-click sample, four realistic change kinds, invalid-input recovery, reset, persistent demo label, exit, no local-license storage access, only same-origin demo requests, offline reload, and HTTP 404. Screenshots are in `/work/.evidence/live-{desktop,phone}-{home,demo}.png`.

Final live/build SHA-256 matches:

- JavaScript: `4bcffd5710816edcaf803fb693e2dbeb295c1a3da92c35d1648ee3ab848257d0`
- CSS: `ce6ebae131d81a750df1bad862d46a5012671d438fd95366bd8d36b2cd6b6a7d`
- Service worker: `62ff6a556ae38cd0a296d120a330a7a1707be18747c4c4160e60026a945cb37d`

The live origin sends CSP, HSTS, `nosniff`, and strict-origin referrer headers. Home, demo, privacy, terms, robots, and sitemap return 200; unknown paths deliberately return 404.

## Demo and catalog

- Browser: https://knowledge-note-bridge.sociobot.in/demo/
- CLI: `knb demo` or `knb demo --json`
- Reset: use **Reset demo**; **Start for real** discards sample state and opens installation steps.
- Catalog description: “Update Anki cards from Markdown while preserving existing review history.”

See `.factory/demo.md` for sample contents and storage details.

## Known external gaps

- The Sociobot billing product is not registered: its checkout and verification endpoints return 404. The site says this plainly and does not offer a broken purchase link. A billing operator must register the exact offer in `/work/.evidence/billing-offer.json`; the $19 one-time paid deliverable remains in the product and terms.
- No personal Anki collection was available. Protocol-level sync tests use a local AnkiConnect v6 HTTP double and verify plan approval, backup-before-write, note-ID preservation, archive behavior, and recovery reports. A sacrificial real collection remains the final optional human integration smoke test.
- The crate is verified and ready to publish, but was not published because registry publication belongs to the factory.

No external AI service is needed for this integrity-focused job, and no credentials were read or recorded.
