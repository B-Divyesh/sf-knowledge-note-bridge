# Knowledge Note Bridge review 1 — Markdown-to-Anki history-safe sync

**Verdict: FAIL**

**Reviewed implementation:** `1652df0c0d1b1472ade1c4d83049d455554dac83` (`factory: repair knowledge-note-bridge-repair-1`)
**Documentation/review head:** `c2e556e8819d80513c368476c8ddc17cad3eb62f` (`factory: verifier knowledge-note-bridge-verify-2`)
**Live URL:** https://knowledge-note-bridge.sociobot.in/
**Audit date:** 2026-09-05

This review is a FAIL. It has 6 findings and 18 untested public claims. A PASS
requires zero findings at every severity and zero untested claims.

## What the product is for

The job is to update Anki cards from Markdown without losing an existing card's
review history. It is for self-learners maintaining technical or business notes
in Markdown. The intended first action should be to try a safe sample, then
install the CLI and create a reviewed `knb plan` before a sync.

On fresh desktop and phone loads, the first screen instead says “Change the
note. Keep the history.” It shows “Install the CLI” and “Try the diff.” It does
not name the audience, and it does not offer “Try it with sample data” or say
what a sample action will load.

## Findings

### P1-1 — Required claims manifest and claim tests are absent

`.factory/claims.json` does not exist. Therefore it declares zero commands and
there were no claim commands to run from a clean checkout. The required
one-test-per-claim evidence is absent for these 18 material public claims:

1. Markdown changes can be previewed and safely synced without losing review history.
2. Stable card IDs survive wording, deck, and filename changes.
3. The dry-run shows exact adds, updates, renames, archives, and blocks before Anki changes.
4. A reviewed `sync --yes --plan` backs up Anki and writes a before-state report.
5. Notes stay local.
6. The CLI/site has no telemetry.
7. The bridge never deletes cards.
8. The browser parser runs entirely in the browser.
9. Every write requires user consent.
10. Missing source cards stop the sync before backup or writes.
11. Updates retain Anki note IDs, scheduling, ease, lapses, and review logs.
12. Archives suspend rather than delete cards.
13. A failed write leaves a report and backup recovery information.
14. The CLI has no daemon, cloud account, runtime analytics, or CI prompt.
15. The full CLI, backups, reports, JSON export, and safety behavior remain free.
16. License verification is stored locally and checks at most once per day.
17. The site transmits neither pasted demo Markdown nor notes by default.
18. Refunds revoke the Steward license automatically.

Several Rust and browser tests support parts of the first 13 statements, but
none is tagged through the required manifest or establishes the full visitor
claim in the required demo sandbox. This is an untested-claims release failure.

### P1-2 — The required one-click isolated demo is not implemented

Fresh desktop and 390 px phone contexts showed two realistic populated rows
(`lead-qualification` rename and `tcp-handshake` update), and invalid Markdown
recovered through **Restore example**. However, this is the landing form's
default state, not a demo sandbox:

- There is no first-screen **Try it with sample data** action. **Try the diff**
  only changes the hash to `#demo`.
- `/?demo=1` returns the same landing document and two rows, but has no sample
  mode state or separate storage namespace.
- No persistent “Demo — sample data, nothing is saved” label exists.
- No **Reset demo** or **Start for real** action exists.
- The visible label is only “Dry-run plan / Free edition”.

The browser demo did not change localStorage during the observed sample,
clear, and restore flow, which is good, but it does not prove isolation from a
real-data namespace because no namespaces or mode boundary exist.

### P2-1 — CLI demo requirement is missing

The CLI is the product artifact, but a clean installed artifact reports only
`init`, `check`, `plan`, and `sync`. `knb demo --help` exits 2 with “unrecognized
subcommand 'demo'”. The landing page also has no self-hosted terminal recording
of the real binary operating on shipped sample input. This fails the CLI
demo-sandbox contract.

### P2-2 — Unknown paths and `/404.html` serve the landing page with HTTP 200

Fresh requests to both `/does-not-exist-review-1` and `/404.html` returned 200,
the home title, and the home h1. The live static configuration has a navigation
fallback but no designed 404 response override or 404 page. A deliberate HTTP
404 is expected; replacing it with an apparently valid home page is not.

### P2-3 — First-screen and plain-words contract is not met

The audience is absent from the first screen and the required sample action is
absent. The landing and legal pages also contain prohibited mood/metaphor copy
instead of descriptive headings, including “A deliberate crossing”, “Read the
dry-run strata”, “One quiet binary”, “It refuses to improvise”, “Make a risky
edit safely”, and “Privacy, kept local.” These labels do not name the task or
section in plain words.

### P3-1 — Required metadata and verification script are incomplete

The live home document has a title, description, SVG favicon, language, and
theme color, but no canonical link, Open Graph metadata, Twitter card metadata,
or apple-touch icon. `/demo` has the home title instead of “Demo — Knowledge
Note Bridge”. There is no repository `verify-url.sh`, so the required worker
verification script could not be run; equivalent live semantic, console, and
alt checks were performed directly instead.

## Evidence that passed

- Used fresh Chromium contexts at desktop 1440 × 900 and phone 390 × 844 before
  scrolling. Both returned 200 with the expected home title, one h1, a main
  landmark, a hero alt, and no horizontal overflow on phone.
- The realistic browser sample showed a rename on note 17052 and an in-place
  update on note 17041. Clearing source showed the empty state; restoring the
  example restored both rows. Duplicate IDs showed the parser error and could
  be recovered with Restore example.
- Keyboard reached the skip link. Reduced-motion styles resolved transition and
  animation duration to `0.01ms`. Axe found zero serious or critical issues in
  both contexts. No page or console errors occurred in normal sample flows.
- Fresh normal loads requested only the product origin. The dummy-license check
  contacted only the documented Sociobot verification origin and removed the
  `license` query from the address bar. No real credential was used.
- The installed clean-consumer binary passed `--help`, `init --json`, and
  `check --json`. A plan against `127.0.0.1:9` returned documented JSON
  recovery guidance and exit 4.
- The existing P1 findings in `.factory/verification.md` are resolved by the
  implementation candidate: its integration tests require a current approved
  plan before mutation and its production service-worker test precaches JS/CSS.
  In this review, a fresh live context obtained `/sw.js`, then rendered the
  home/sample after an offline reload with two sample rows and no console error.
- The clean candidate checkout ran `npm ci`, `npm test`, `npm run build`,
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
  `cargo package --allow-dirty` successfully. `npm run build` produced the
  release binary and `dist/site`; `cargo package` produced the 133 KiB crate.

## Earlier findings disposition

| Earlier finding | Current disposition | Evidence |
| --- | --- | --- |
| P1: `sync --yes` could write without a fresh preview | Resolved | `sync_rejects_missing_or_stale_approval_before_backup_or_write` passed in the clean candidate run. |
| P1: cold offline reload returned HTML for JS modules | Resolved in candidate tests | `service worker precaches a cold offline reload without returning HTML for modules` passed in the clean candidate run. |
| P3: test artifact could enter a package | Resolved | Current package command completed with the candidate package; no test-results artifact is listed in the candidate package source list. |
| Lighthouse unavailable in prior review container | Still not measured | No Lighthouse score is claimed in this review. |

## Commands run from clean candidate checkout

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
```

All completed successfully in the isolated checkout at `1652df0`. No declared
claim commands exist because the required manifest is missing.

## Required repair and retest

Add a complete `.factory/claims.json` and one tagged demo-sandbox test per
public claim; remove or narrow any claim that cannot be tested. Implement a
real `/demo` or `?demo=1` namespace with a first-screen sample action, persistent
sample notice, reset, and explicit exit to real data. Add `knb demo` using
shipped input and a self-hosted recording. Implement a designed HTTP 404,
route-specific Demo title, missing metadata, and plain descriptive copy. Then
repeat the full clean checkout, CLI, live desktop/phone, accessibility, privacy,
offline, and route audit.
