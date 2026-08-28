import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoPlan, parseCards } from './demo-core.js';

const active = (answer = 'Two peers agree to communicate.') => `\`\`\`card
id: tcp-handshake
deck: Systems
---
What does the TCP handshake establish?
---
${answer}
\`\`\``;

test('parses the documented card shape', () => {
  assert.equal(parseCards(active()).at(0).id, 'tcp-handshake');
});

test('reports an in-place update', () => {
  assert.equal(buildDemoPlan(parseCards(active('Sequence numbers and readiness.'))).at(1).kind, 'update');
});

test('missing existing notes are blocked', () => {
  const plan = buildDemoPlan([]);
  assert.ok(plan.every((row) => row.kind === 'blocked'));
});

test('rejects duplicate stable IDs', () => {
  assert.throws(() => parseCards(`${active()}\n${active()}`), /Duplicate stable ID/);
});
