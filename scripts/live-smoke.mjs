import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = new URL(process.argv[2] || 'https://knowledge-note-bridge.sociobot.in').origin;
const evidenceDirectory = process.argv[3] ? resolve(process.argv[3]) : null;
if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });

function assert(value, message) {
  if (!value) throw new Error(message);
}

const browser = await chromium.launch();
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 }
];
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const requestOrigins = new Set();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requestOrigins.add(new URL(request.url()).origin));

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  assert(await page.title() === 'Knowledge Note Bridge — Update Anki from Markdown', `${viewport.name}: wrong home title`);
  const firstScreenSelectors = ['h1', '.lede', '.hero-actions', '.trust-line'];
  for (const selector of firstScreenSelectors) {
    const box = await page.locator(selector).boundingBox();
    assert(box && box.y + box.height <= viewport.height, `${viewport.name}: ${selector} is below the first screen`);
  }
  const homeAxe = await new AxeBuilder({ page }).analyze();
  assert(!homeAxe.violations.some((item) => ['serious', 'critical'].includes(item.impact || '')), `${viewport.name}: serious home Axe violation`);
  if (evidenceDirectory) await page.screenshot({ path: resolve(evidenceDirectory, `live-${viewport.name}-home.png`), fullPage: false });

  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.waitForLoadState('networkidle');
  assert(await page.title() === 'Demo — Knowledge Note Bridge', `${viewport.name}: wrong demo title`);
  assert(await page.getByText('Demo — sample data, nothing is saved').isVisible(), `${viewport.name}: demo label missing`);
  const kinds = await page.locator('[data-kind]').evaluateAll((rows) => rows.map((row) => row.dataset.kind).sort());
  assert(JSON.stringify(kinds) === JSON.stringify(['add', 'archive', 'rename', 'update']), `${viewport.name}: sample plan is not populated`);
  assert((await page.evaluate(() => Object.keys(localStorage))).length === 0, `${viewport.name}: demo touched real local storage`);

  await page.locator('#demo-source').fill('```card\nid: Bad ID\n---\nQ\n---\nA\n```');
  await page.getByRole('button', { name: 'Compare sample' }).click();
  assert(await page.getByText('Could not read this Markdown').isVisible(), `${viewport.name}: invalid input did not show an error`);
  await page.locator('#reset-demo').click();
  assert(await page.locator('[data-kind]').count() === 4, `${viewport.name}: reset did not restore sample`);
  assert((await page.evaluate(() => Object.keys(sessionStorage))).length === 0, `${viewport.name}: reset did not clear demo state`);
  await page.waitForTimeout(250);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const banner = await page.locator('.demo-banner').boundingBox();
  assert(banner && banner.y >= 0, `${viewport.name}: demo label did not persist`);
  const demoAxe = await new AxeBuilder({ page }).analyze();
  const seriousDemo = demoAxe.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''));
  assert(!seriousDemo.length, `${viewport.name}: serious demo Axe violation ${JSON.stringify(seriousDemo.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.html) })))}`);
  if (evidenceDirectory) await page.screenshot({ path: resolve(evidenceDirectory, `live-${viewport.name}-demo.png`), fullPage: false });
  await page.getByRole('link', { name: 'Start for real' }).click();
  assert((await page.evaluate(() => Object.keys(sessionStorage))).length === 0, `${viewport.name}: demo state survived exit`);
  assert([...requestOrigins].every((value) => value === origin), `${viewport.name}: unexpected request origin ${[...requestOrigins].join(', ')}`);
  assert(errors.length === 0, `${viewport.name}: console errors ${errors.join(' | ')}`);
  results.push({ viewport: viewport.name, firstScreen: true, changes: kinds, demoStorageCleared: true, seriousAxeViolations: 0, requestOrigins: [...requestOrigins] });
  await context.close();
}

const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const offlinePage = await offlineContext.newPage();
await offlinePage.goto(`${origin}/demo/`);
await offlinePage.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('/sw.js'));
await offlineContext.setOffline(true);
await offlinePage.reload();
assert(await offlinePage.locator('[data-kind]').count() === 4, 'phone: offline reload lost the sample');
await offlineContext.setOffline(false);
await offlineContext.close();

const statusContext = await browser.newContext();
const statusPage = await statusContext.newPage();
const missing = await statusPage.goto(`${origin}/live-smoke-missing-page`);
assert(missing?.status() === 404, 'unknown live path did not return HTTP 404');
assert(await statusPage.title() === 'Page not found — Knowledge Note Bridge', 'unknown live path did not use the designed page');
await statusContext.close();
await browser.close();

console.log(JSON.stringify({ ok: true, origin, viewports: results, offlineReload: true, unknownPathStatus: 404 }, null, 2));
