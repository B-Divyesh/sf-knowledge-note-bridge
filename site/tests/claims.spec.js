import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binary = resolve('target/release/knb');

async function runCli(args, cwd, env = process.env) {
  return new Promise((done) => {
    execFile(binary, args, { cwd, env, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

async function workspace(markdown = '') {
  const directory = await mkdtemp(join(tmpdir(), 'knb-claim-'));
  await writeFile(join(directory, 'cards.md'), markdown);
  return directory;
}

const card = ({ id = 'safe-id', question = 'Question?', answer = 'Answer.', extra = '', deck = 'Default' } = {}) => [
  '```card',
  `id: ${id}`,
  `deck: ${deck}`,
  extra.trimEnd(),
  '---',
  question,
  '---',
  answer,
  '```'
].filter(Boolean).join('\n');

function ankiNote({ id = 'safe-id', noteId = 17041, cardId = 27041, deck = 'Default', front = '<p>Question?</p>', back = '<p>Answer.</p>', tags = [], archived = false } = {}) {
  return {
    noteId,
    cards: [cardId],
    tags: ['knb_managed', `knb_id::${id}`, ...tags, ...(archived ? ['knb_archived'] : [])],
    fields: { Front: { value: front }, Back: { value: back } },
    deck
  };
}

async function startAnki({ notes = [], failAction = null } = {}) {
  const calls = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      calls.push(body);
      let result;
      let error = null;
      if (body.action === failAction) {
        error = `recorded ${body.action} failure`;
        result = null;
      } else {
        result = {
          version: 6,
          findNotes: notes.map((note) => note.noteId),
          notesInfo: notes,
          cardsInfo: notes.flatMap((note) => note.cards.map((id) => ({ cardId: id, note: note.noteId, deckName: note.deck }))),
          deckNames: [...new Set(['Default', ...notes.map((note) => note.deck)])],
          exportPackage: true,
          addNote: 99001,
          updateNoteFields: true,
          removeTags: true,
          addTags: true,
          changeDeck: true,
          suspend: true,
          unsuspend: true
        }[body.action];
      }
      const payload = JSON.stringify({ result, error });
      response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), connection: 'close' });
      response.end(payload);
    });
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise((done) => server.close(done))
  };
}

async function savePlan(directory, endpoint) {
  const result = await runCli(['plan', 'cards.md', '--json', '--endpoint', endpoint], directory);
  expect(result.code).toBe(0);
  await writeFile(join(directory, 'approved-plan.json'), result.stdout);
  return JSON.parse(result.stdout);
}

test('@claim:cli-demo runs bundled sample data in a temporary sandbox', async () => {
  const result = await runCli(['demo', '--json'], process.cwd());
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output).toMatchObject({ demo: true, sample_data: true, anki_contacted: false });
  expect(output.plan.changes.map((change) => change.kind).sort()).toEqual(['add', 'archive', 'rename', 'update']);
  expect((await stat(output.source)).isFile()).toBeTruthy();
  expect((await stat(output.plan_file)).isFile()).toBeTruthy();
  await rm(output.output_dir, { recursive: true });
});

test('@claim:demo-realistic opens a populated four-change plan and reset restores it', async ({ page }) => {
  await page.goto('/demo/');
  expect(await page.locator('[data-kind]').evaluateAll((rows) => rows.map((row) => row.dataset.kind).sort())).toEqual(['add', 'archive', 'rename', 'update']);
  await page.locator('#demo-source').fill('not a card');
  await page.getByRole('button', { name: 'Compare sample' }).click();
  await expect(page.getByText('No card blocks found')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('[data-kind]')).toHaveCount(4);
});

test('@claim:demo-isolation keeps sample state in its namespace and clears it on exit', async ({ page }) => {
  await page.goto('/demo/');
  await page.locator('#demo-source').fill(card({ answer: 'Temporary answer.' }));
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual(['demo:knb:source']);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.getByRole('link', { name: 'Start for real' }).click();
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('@claim:offline-demo reloads the sample offline after one visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/demo/');
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toContain('/sw.js');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-kind]')).toHaveCount(4);
    await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});

test('@claim:stable-id maps wording changes and renames to the existing Anki note IDs', async () => {
  const result = await runCli(['demo', '--json'], process.cwd());
  const output = JSON.parse(result.stdout);
  const update = output.plan.changes.find((change) => change.kind === 'update');
  const rename = output.plan.changes.find((change) => change.kind === 'rename');
  expect(update.before.note_id).toBe(17041);
  expect(rename.before.note_id).toBe(17052);
  await rm(output.output_dir, { recursive: true });
});

test('@claim:dry-run-actions reports adds, updates, renames, archives, and blocks without writing', async ({ page }) => {
  await page.goto('/demo/');
  const kinds = await page.locator('[data-kind]').evaluateAll((rows) => rows.map((row) => row.dataset.kind));
  expect(kinds.sort()).toEqual(['add', 'archive', 'rename', 'update']);
  await page.locator('#demo-source').fill(card({ id: 'new-card' }));
  await page.getByRole('button', { name: 'Compare sample' }).click();
  await expect(page.locator('[data-kind="blocked"]')).toHaveCount(3);
  await expect(page.getByText(/No Anki changes/)).toBeVisible();
});

test('@claim:approved-sync backs up before writing and records the approved plan', async () => {
  const directory = await workspace(card());
  const anki = await startAnki();
  try {
    await savePlan(directory, anki.endpoint);
    anki.calls.length = 0;
    const result = await runCli(['sync', 'cards.md', '--yes', '--plan', 'approved-plan.json', '--json', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(0);
    expect(anki.calls.map((call) => call.action)).toEqual(['version', 'findNotes', 'deckNames', 'exportPackage', 'addNote']);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe('complete');
    expect(report.approved_plan).toBe('approved-plan.json');
    expect(report.backups[0]).toContain('.knb/backups/');
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:notes-local never places pasted Markdown in a request', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push({ url: request.url(), data: request.postData() || '' }));
  await page.goto('/demo/');
  const marker = 'private-answer-849217';
  await page.locator('#demo-source').fill(card({ answer: marker }));
  await page.getByRole('button', { name: 'Compare sample' }).click();
  await expect(page.getByText('Create in Default')).toBeVisible();
  expect(requests.every((request) => !request.url.includes(marker) && !request.data.includes(marker))).toBeTruthy();
  expect(new Set(requests.map((request) => new URL(request.url).origin))).toEqual(new Set(['http://127.0.0.1:4173']));
});

test('@claim:no-telemetry loads the home and demo using only product-origin requests', async ({ page }) => {
  const origins = new Set();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Compare sample' }).click();
  expect(origins).toEqual(new Set(['http://127.0.0.1:4173']));
});

test('@claim:archive-not-delete tags and suspends cards without a delete call', async () => {
  const directory = await workspace(card({ id: 'old-card', extra: 'archived: true\n' }));
  const anki = await startAnki({ notes: [ankiNote({ id: 'old-card' })] });
  try {
    await savePlan(directory, anki.endpoint);
    anki.calls.length = 0;
    const result = await runCli(['sync', 'cards.md', '--yes', '--plan', 'approved-plan.json', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(0);
    const actions = anki.calls.map((call) => call.action);
    expect(actions).toContain('addTags');
    expect(actions).toContain('suspend');
    expect(actions.some((action) => /delete/i.test(action))).toBeFalsy();
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:write-consent refuses a writing sync without its exact reviewed plan', async () => {
  const directory = await workspace(card());
  const anki = await startAnki();
  try {
    const result = await runCli(['sync', 'cards.md', '--yes', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(3);
    expect(anki.calls.map((call) => call.action)).toEqual(['version', 'findNotes']);
    expect(result.stderr).toContain('requires --plan FILE');
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:missing-source-block stops before backup or writes', async () => {
  const directory = await workspace('');
  const anki = await startAnki({ notes: [ankiNote()] });
  try {
    const result = await runCli(['sync', 'cards.md', '--yes', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(3);
    const actions = anki.calls.map((call) => call.action);
    expect(actions).toEqual(['version', 'findNotes', 'notesInfo', 'cardsInfo']);
    expect(actions).not.toContain('deckNames');
    expect(result.stderr).toContain('resolve every needs-action item');
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:update-in-place changes fields on the same note without replacing it', async () => {
  const directory = await workspace(card({ question: 'Changed question?', answer: 'Changed answer.' }));
  const anki = await startAnki({ notes: [ankiNote()] });
  try {
    await savePlan(directory, anki.endpoint);
    anki.calls.length = 0;
    const result = await runCli(['sync', 'cards.md', '--yes', '--plan', 'approved-plan.json', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(0);
    const update = anki.calls.find((call) => call.action === 'updateNoteFields');
    expect(update.params.note.id).toBe(17041);
    expect(anki.calls.some((call) => ['addNote', 'deleteNotes', 'deleteCards'].includes(call.action))).toBeFalsy();
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:failure-recovery leaves a failed report with backup recovery paths', async () => {
  const directory = await workspace(card());
  const anki = await startAnki({ failAction: 'addNote' });
  try {
    await savePlan(directory, anki.endpoint);
    const result = await runCli(['sync', 'cards.md', '--yes', '--plan', 'approved-plan.json', '--endpoint', anki.endpoint], directory);
    expect(result.code).toBe(4);
    const reportNames = await readdir(join(directory, '.knb/reports'));
    const report = JSON.parse(await readFile(join(directory, '.knb/reports', reportNames[0]), 'utf8'));
    expect(report.status).toBe('failed');
    expect(report.error).toContain('recorded addNote failure');
    expect(report.backups.length).toBeGreaterThan(0);
  } finally {
    await anki.close();
    await rm(directory, { recursive: true });
  }
});

test('@claim:free-core runs the installed CLI workflow without a license', async () => {
  const directory = await workspace(card());
  const cleanEnvironment = { PATH: process.env.PATH };
  try {
    const help = await runCli(['--help'], directory, cleanEnvironment);
    const check = await runCli(['check', 'cards.md', '--json'], directory, cleanEnvironment);
    const demo = await runCli(['demo', '--json'], directory, cleanEnvironment);
    expect([help.code, check.code, demo.code]).toEqual([0, 0, 0]);
    expect(JSON.parse(check.stdout).valid).toBeTruthy();
    const output = JSON.parse(demo.stdout);
    expect(output.demo).toBeTruthy();
    await rm(output.output_dir, { recursive: true });
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('@claim:json-cli emits one JSON value for success and errors', async () => {
  const directory = await workspace(card());
  try {
    const good = await runCli(['check', 'cards.md', '--json'], directory);
    expect(JSON.parse(good.stdout)).toMatchObject({ valid: true, cards: 1 });
    await writeFile(join(directory, 'cards.md'), card({ id: 'Bad ID' }));
    const bad = await runCli(['check', 'cards.md', '--json'], directory);
    expect(bad.code).toBe(2);
    expect(JSON.parse(bad.stdout)).toMatchObject({ ok: false, exit_code: 2 });
    expect(bad.stderr).toBe('');
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('@claim:markdown-fields renders documented Markdown features for Anki', async () => {
  const result = await new Promise((done) => {
    execFile('cargo', ['test', 'renders_commonmark_for_anki_fields'], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error?.code ?? 0, stdout, stderr });
    });
  });
  expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain('test result: ok');
});

test('@claim:license-daily caches a valid license check for one day', async ({ page }) => {
  let checks = 0;
  await page.route('https://api.sociobot.in/api/v1/products/knowledge-note-bridge/verify?license=test-license', async (route) => {
    checks += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok' }) });
  });
  await page.addInitScript(() => localStorage.setItem('sb_license:knowledge-note-bridge', 'test-license'));
  await page.goto('/');
  await expect(page.getByText('License verified. Steward browser features are ready.')).toBeVisible();
  await page.reload();
  await expect(page.locator('#save-report')).toHaveAttribute('data-unlocked', 'true');
  expect(checks).toBe(1);
});

test('@claim:license-revocation removes Steward access after an invalid verdict', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/knowledge-note-bridge/verify?license=revoked-license', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: false, reason: 'revoked' }) }));
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:knowledge-note-bridge', 'revoked-license');
    localStorage.setItem('sb_license:knowledge-note-bridge:verdict', JSON.stringify({ valid: true, checkedAt: 0 }));
  });
  await page.goto('/');
  await expect(page.getByText('This license is not active. Every CLI command remains available.')).toBeVisible();
  await page.getByRole('button', { name: 'Save bundled sample report' }).click();
  expect(await page.evaluate(() => localStorage.getItem('knb_saved_report'))).toBeNull();
});

test('@claim:price-and-deliverable shows the exact one-time price and paid feature', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.price')).toContainText('$19');
  await expect(page.locator('.price')).toContainText('one-time purchase');
  await expect(page.getByText('Save the current browser sample report')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy Steward once/ })).toHaveAttribute('href', 'https://api.sociobot.in/api/v1/products/knowledge-note-bridge/checkout');
  await page.goto('/terms/');
  await expect(page.getByText('Steward costs $19 once.')).toBeVisible();
});
