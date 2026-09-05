# Demo sandbox

## Browser

- URL: `https://knowledge-note-bridge.sociobot.in/demo/`
- Alternate entry: `https://knowledge-note-bridge.sociobot.in/?demo=1`
- First action: **Try it with sample data** on the home page.
- Sample: four Markdown cards produce one add, update, rename, and archive.
- Reset: **Reset demo** restores all four cards and clears demo state.
- Exit: **Start for real** clears demo state before opening the install section.

Browser edits use session storage keys beginning with `demo:knb:`. The demo does
not read or write license keys, saved reports, notes, or Anki data. Closing or leaving
the demo clears the namespace. The sample parser runs in the page.

## CLI

```sh
knb demo
knb demo --json
```

The same sample source ships at `examples/sample-notes.md`. Its saved Anki snapshot
ships at `examples/demo-anki.json`.

Each run creates a unique `knowledge-note-bridge-demo-*` directory under the
operating system temporary directory. It writes the source, snapshot, and dry-run
plan there. It does not contact Anki or read a project.

Delete the printed temporary directory when inspection is complete.
