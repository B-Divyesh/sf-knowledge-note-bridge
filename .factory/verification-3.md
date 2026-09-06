# Independent verification 3 — FAIL

**Job:** Update Anki cards from Markdown without losing review history.  
**Audience:** Self-learners who edit Markdown notes and need existing Anki review records to stay attached.  
**First action:** Try it with sample data.  
**Implementation candidate:** `db31f6cb25612439a356408be751c2d77a4bfa23`  
**Documentation baseline:** `f11c1e1a76aa35254781a112eb82dcea3b90bc40`  
**Live URL:** https://knowledge-note-bridge.sociobot.in/  
**Verified:** 2026-09-06  
**Verdict:** **FAIL**

## Result

The product works in the exercised CLI and browser paths, but this verification
cannot declare PASS. Three public promises are missing a complete sandbox claim
test, which violates the claims contract. There are no runtime, accessibility,
demo-isolation, build, or deployment-identity defects in the tested scope.

**Finding count: 3. Untested or incomplete public claims: 3.**

## Findings

### P1 — The CLI telemetry and connection privacy promise is unlisted and untested

The landing page says: “The CLI reads your files and calls the AnkiConnect address
you choose. It sends no analytics.” The Privacy page repeats that the CLI calls
only the chosen AnkiConnect address and has no analytics or telemetry. None of
the 20 manifest claims covers that CLI promise. `no-telemetry` only records
requests during normal **home and demo** browser use; it does not exercise a CLI
invocation and record or constrain its outbound requests.

The product may be private in practice, but this is a public privacy claim with
no matching observable sandbox test. Add a CLI-specific claim that records a
normal `check`/`plan`/`sync` flow against a local AnkiConnect double and proves
that no other connection is made, or narrow/remove the promise.

### P2 — The paid report-saving result is not asserted by its tagged claim test

The public paid copy promises that “Steward saves browser demo reports on this
device” and names “Save the current browser sample report” as its deliverable.
`@claim:price-and-deliverable` checks price and unavailable-checkout text only;
it never unlocks the fixture license, clicks **Save bundled sample report**, or
asserts a saved report. This fails the rule that a claim test must assert the
observable result rather than the presence of a button or copy.

An independent fixture smoke check did establish that the current live feature
works: with a recorded valid license response, the button became unlocked and
created `knb_saved_report` in local storage. That does not repair the declared
claim test. Extend the existing tagged test to assert the saved local report.

### P3 — “Receive future Steward browser features” is an untestable public promise

The paid feature list promises “Receive future Steward browser features.” It has
no manifest claim or test, and no present sandbox can prove an unspecified future
deliverable. Remove this line or replace it with a specific currently delivered,
testable feature.

## Clean candidate verification

I used a detached clean worktree at `f11c1e1`; the implementation files are
identical to `db31f6c`. The later `ab872b7` factory commit changes only the
handoff and Graphify output, not product runtime files. Existing Graphify changes
in the primary worktree were left untouched.

Passed from the clean worktree:

```sh
npm ci
npm test
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
./verify-url.sh
./verify-url.sh https://knowledge-note-bridge.sociobot.in
```

`npm test` passed 13 Rust tests, 5 JavaScript tests, and 38 Playwright tests.
`npm run build` produced `target/release/knb` and `dist/site/`. The package
verification completed and produced a 193.4 KiB compressed crate. Every one of
the 20 declared `test` commands in `.factory/claims.json` was then run
individually and passed. This confirms the declared commands, but not the three
coverage gaps above.

A clean consumer install using `cargo install --path . --locked --root <temp>`
passed `knb --help`, `knb demo --json`, `knb init <new-file> --json`, and `knb
check <file> --json`. The demo returned add, update, rename, and archive changes
with `anki_contacted: false`. A second `init` correctly refused to overwrite an
existing file with JSON error output and exit code 2.

## Live browser, demo, accessibility, and privacy checks

Fresh 1440 × 900 desktop and 390 × 844 phone Chromium contexts opened the live
home page before scrolling. Both showed the job, audience, and first action above
within the viewport, the three facts, no horizontal overflow, and no console
errors. The first action opened `/demo/` in one click.

On both devices the demo showed the persistent “Demo — sample data, nothing is
saved” label and realistic add, update, rename, and archive rows. Invalid Markdown
showed its recovery message, **Reset demo** restored all four rows, and **Start for
real** cleared demo storage. The observed browser storage was empty on entry,
after reset, and after exit. Requests during the normal live walkthrough were
only to `https://knowledge-note-bridge.sociobot.in`.

Desktop keyboard testing reached the visible skip link and moved focus to `main`.
The phone had no horizontal overflow and respected reduced motion. A fresh desktop
demo context obtained its service worker, went offline, reloaded, and retained all
four sample rows. `verify-url.sh` passed locally and against live home, demo,
Privacy, Terms, and the deliberate designed 404; each has one `h1`, one `main`,
`lang=en`, its route title, image alternatives, no console errors, and zero Axe
serious or critical violations. The unknown route returned HTTP 404 as expected.

The live origin sent HSTS, `nosniff`, strict-origin referrer policy, permissions
policy, and the configured self-restricted CSP. Checkout remains visibly
unavailable; no external billing endpoint was called.

## Earlier findings disposition

| Earlier finding | Current disposition | Current evidence |
| --- | --- | --- |
| `sync --yes` could write without a fresh preview | Resolved | `@claim:write-consent` and `@claim:approved-sync` passed individually; the local AnkiConnect double confirms no backup/write without the reviewed plan. |
| Offline reload returned HTML for JavaScript | Resolved | Fresh live service-worker offline reload rendered the four-row demo; the complete offline claim and service-worker tests passed. |
| Package could include test artifacts | Resolved | `cargo package --allow-dirty` verified the 67-file package after test runs. |
| No CLI one-click demo | Resolved | Installed `knb demo --json` created a unique temporary sample and returned all four change kinds without Anki contact. |
| No isolated browser demo | Resolved | `/demo/` offers the persistent sample label, reset, exit, and empty demo-only storage in fresh live contexts. |
| No designed HTTP 404 | Resolved | Unknown live path returned the designed page and HTTP 404. |
| First-screen, plain-language, or metadata gaps | Resolved | Fresh desktop/phone checks and live `verify-url.sh` passed; route titles, metadata, focus, and Axe checks are present. |
| Lighthouse measurement was unavailable earlier | No current finding | This report does not rely on a new Lighthouse measurement; the supplied handoff records 100/100/100/100 and the independent file-budget, browser, Axe, and build checks above passed. |

## Deployment identity

The fresh `dist/site/` output for the implementation candidate matched the live
deployment byte-for-byte for the application JavaScript, CSS, service worker, and
hero asset:

| Asset | SHA-256 |
| --- | --- |
| `/assets/main-DZolpa-f.js` | `4bcffd5710816edcaf803fb693e2dbeb295c1a3da92c35d1648ee3ab848257d0` |
| `/assets/styles-CCdEquPV.css` | `ce6ebae131d81a750df1bad862d46a5012671d438fd95366bd8d36b2cd6b6a7d` |
| `/sw.js` | `62ff6a556ae38cd0a296d120a330a7a1707be18747c4c4160e60026a945cb37d` |
| `/bridge-ceramic.webp` | `749f9e7ea0977265ae8d5e8f9fe4be373fb06e6477028ec81f81ae572eb8e630` |

Screenshots and command logs are in `/work/.evidence/`:
`verification-3-live-{desktop,phone}-{home,demo}.png`,
`verification-3-npm-test.log`, and `verification-3-build.log`.

## Required follow-up

Do not change implementation behavior merely to obtain a pass. First make every
public promise testable: add the CLI privacy request-recording claim, assert the
actual licensed report save in its tagged claim, and remove or specify the future
feature promise. Then rerun the complete clean checkout, each declared claim
command, consumer install, and fresh live desktop/phone verification.
