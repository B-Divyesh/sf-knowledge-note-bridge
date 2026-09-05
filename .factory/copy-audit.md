# Landing-page copy audit

Audited 5 September 2026 against `site/index.html`.

## First-screen check

- Headline: “Update Anki from Markdown without losing history” — 7 words.
- Audience: “For self-learners who edit Markdown notes and need existing Anki
  review records to stay attached.” — 15 words.
- Action: “Try it with sample data” — 5 words.
- Result: “Loads a four-change dry-run.” — 4 words.
- Boundary: “It cannot open or change your Anki collection.” — 8 words.
- Fact: “Notes stay on your computer” — 5 words.
- Fact: “The sample works offline after one visit” — 7 words.
- Fact: “The CLI is free; Steward costs $19 once” — 8 words.

The job, audience, action, action result, and three facts fit in the initial
390 × 844 viewport. The headline starts with a verb and is below nine words.

## Sentence inventory

| Words | Sentence |
| ---: | --- |
| 3 | You are offline. |
| 4 | The sample remains available. |
| 7 | Checkout and license checks need a connection. |
| 15 | For self-learners who edit Markdown notes and need existing Anki review records to stay attached. |
| 4 | Loads a four-change dry-run. |
| 8 | It cannot open or change your Anki collection. |
| 5 | Run `knb demo` after installation. |
| 8 | It uses bundled notes and a saved Anki snapshot. |
| 10 | The command writes sample files to a new temporary directory. |
| 4 | It never contacts Anki. |
| 8 | Recorded from the bundled sample with `knb demo`. |
| 15 | `knb demo` reports one add, one update, one rename, one archive, and no blocked changes. |
| 5 | It writes nothing to Anki. |
| 10 | The bridge compares stable source IDs with existing Anki notes. |
| 5 | Unclear changes stop the sync. |
| 8 | Put an ID in each Markdown card block. |
| 10 | The ID stays the same when wording or files change. |
| 14 | Review each add, update, rename, archive, or blocked item before you approve the file. |
| 11 | A matching approved plan makes Anki backups before the first write. |
| 7 | The bridge then records a recovery report. |
| 13 | Install the Rust binary, then run the bundled sample before using your notes. |
| 6 | This is a sync safety tool. |
| 12 | It is not a note editor, cloud service, or automatic card writer. |
| 12 | The CLI reads your files and calls the AnkiConnect address you choose. |
| 4 | It sends no analytics. |
| 8 | A missing source card becomes a blocked item. |
| 7 | You must restore, rename, or archive it. |
| 9 | An archive adds a tag and suspends existing cards. |
| 7 | The backup and report support recovery. |
| 12 | Every CLI command, backup, report, JSON output, and safety check remains free. |
| 8 | Steward saves browser demo reports on this device. |
| 5 | Sociobot/Dodo handles payment and refunds. |
| 8 | A revoked license loses Steward access after verification. |
| 4 | See Privacy and Terms. |
| 6 | Paste the token from your receipt. |
| 13 | This site stores it on this device and checks it once per day. |
| 5 | No license is stored. |
| 6 | The free CLI is ready. |
| 9 | Update Anki cards from Markdown while keeping review history. |

No sentence exceeds 22 words. No sentence contains a banned marketing word.
Section headings name their content; none uses metaphor or brand lore.

## Terminology

| Concept | Word used |
| --- | --- |
| Source files | Markdown |
| Existing review object | Anki note |
| Persistent source identifier | stable ID |
| Pre-write comparison | dry-run plan |
| Isolated sample mode | demo |
| Optional paid browser features | Steward |
| Recovery artifact | report |
