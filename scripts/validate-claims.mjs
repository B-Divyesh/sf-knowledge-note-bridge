import { readFile } from 'node:fs/promises';

const claims = JSON.parse(await readFile('.factory/claims.json', 'utf8'));
const tests = await readFile('site/tests/claims.spec.js', 'utf8');
const ids = new Set();
for (const claim of claims) {
  if (ids.has(claim.id)) throw new Error(`duplicate claim id: ${claim.id}`);
  ids.add(claim.id);
  const tag = `@claim:${claim.id}`;
  const count = tests.split(tag).length - 1;
  if (count !== 1) throw new Error(`${tag} must name exactly one test; found ${count}`);
  if (!claim.test.includes(tag)) throw new Error(`${claim.id} command does not select its tagged test`);
  if (!claim.claim || !claim.where || !claim.sandbox) throw new Error(`${claim.id} is missing required claim metadata`);
}
console.log(`${claims.length} claims each select exactly one outcome test.`);
