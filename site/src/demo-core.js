/** @typedef {{id:string, deck:string, front:string, back:string, archived:boolean, renamedFrom:string|null}} Card */

/** Parse the same compact card shape used by the CLI demo. */
export function parseCards(markdown) {
  const cards = [];
  const ids = new Set();
  const fence = /```card\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = fence.exec(markdown))) {
    const pieces = match[1].split(/^---\s*$/m);
    if (pieces.length !== 3) throw new Error('Each card needs exactly two --- separators.');
    const metadata = Object.fromEntries(pieces[0].trim().split('\n').filter(Boolean).map((line) => {
      const split = line.indexOf(':');
      if (split < 1) throw new Error(`Invalid metadata line: ${line}`);
      return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
    }));
    if (!metadata.id) throw new Error('Every card needs an id.');
    if (!/^[a-z0-9._-]+$/.test(metadata.id)) throw new Error(`Invalid stable ID: ${metadata.id}`);
    if (ids.has(metadata.id)) throw new Error(`Duplicate stable ID: ${metadata.id}`);
    ids.add(metadata.id);
    const archived = metadata.archived === 'true';
    const front = pieces[1].trim();
    const back = pieces[2].trim();
    if (!archived && (!front || !back)) throw new Error(`${metadata.id} needs a question and answer.`);
    cards.push({ id: metadata.id, deck: metadata.deck || 'Default', front, back, archived, renamedFrom: metadata['renamed-from'] || null });
  }
  return cards;
}

const existing = [
  { id: 'tcp-handshake', deck: 'Systems', front: 'What does the TCP handshake establish?', back: 'Two peers agree to communicate.', noteId: 17041 },
  { id: 'legacy-lead-score', deck: 'Work', front: 'What is a qualified lead?', back: 'A lead meeting agreed intent and fit thresholds.', noteId: 17052 }
];

export function buildDemoPlan(cards) {
  const claimed = new Set();
  const rows = cards.map((card) => {
    const direct = existing.find((note) => note.id === card.id);
    if (card.archived) {
      if (!direct) return { id: card.id, kind: 'keep', detail: 'Already absent — nothing to archive' };
      claimed.add(direct.id);
      return { id: card.id, kind: 'archive', detail: `Suspend cards on note ${direct.noteId}; never delete` };
    }
    if (direct) {
      claimed.add(direct.id);
      const same = direct.deck === card.deck && direct.front === card.front && direct.back === card.back;
      return { id: card.id, kind: same ? 'keep' : 'update', detail: same ? `History stays on note ${direct.noteId}` : `Edit note ${direct.noteId} in place` };
    }
    if (card.renamedFrom) {
      const old = existing.find((note) => note.id === card.renamedFrom);
      if (!old) return { id: card.id, kind: 'blocked', detail: `No note has old ID ${card.renamedFrom}` };
      claimed.add(old.id);
      return { id: card.id, kind: 'rename', detail: `${card.renamedFrom} → ${card.id} on note ${old.noteId}` };
    }
    return { id: card.id, kind: 'add', detail: `Create in ${card.deck}` };
  });
  for (const note of existing) {
    if (!claimed.has(note.id)) rows.push({ id: note.id, kind: 'blocked', detail: 'Missing from source — restore or explicitly archive' });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}
