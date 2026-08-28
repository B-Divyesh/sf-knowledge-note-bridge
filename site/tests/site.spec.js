import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';

test('landing page is semantic, interactive, and error-free', async ({ page, context }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Knowledge Note Bridge/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('img')).toHaveAttribute('alt', /porcelain tiles/);
  await expect(page.getByText('lead-qualification', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear source' }).click();
  await expect(page.getByText('No source cards yet')).toBeVisible();
  await page.getByRole('button', { name: 'Restore example' }).click();
  await expect(page.getByText('lead-qualification', { exact: true })).toBeVisible();

  await page.locator('#demo-source').fill('```card\nid: Bad ID\n---\nQ\n---\nA\n```');
  await page.getByRole('button', { name: 'Compare with Anki' }).click();
  await expect(page.getByText('Could not parse this note')).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/You’re offline/)).toBeHidden();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('legal pages have one clear heading and a main landmark', async ({ page }) => {
  for (const path of ['/privacy/', '/terms/']) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
  }
});

async function workerCacheVersion(page) {
  return page.evaluate(async () => {
    const channel = new MessageChannel();
    const version = new Promise((resolve) => { channel.port1.onmessage = (event) => resolve(event.data); });
    navigator.serviceWorker.controller.postMessage('knb-cache-version', [channel.port2]);
    return version;
  });
}

test('service worker precaches a cold offline reload without returning HTML for modules', async ({ page, context }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toContain('/sw.js');
  const cacheEntries = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((name) => name.startsWith('knb-shell-')));
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cacheEntries.some((path) => path.endsWith('.js'))).toBeTruthy();
  expect(cacheEntries.some((path) => path.endsWith('.css'))).toBeTruthy();

  await context.setOffline(true);
  const offlineAssets = await page.evaluate(async (paths) => Promise.all(
    paths.filter((path) => /\.(?:js|css)$/.test(path)).map(async (path) => {
      const response = await fetch(path);
      return { path, status: response.status, type: response.headers.get('content-type') };
    })
  ), cacheEntries);
  expect(offlineAssets).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: expect.stringMatching(/\.js$/), status: 200, type: expect.stringContaining('javascript') }),
    expect.objectContaining({ path: expect.stringMatching(/\.css$/), status: 200, type: expect.stringContaining('text/css') })
  ]));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Change the note. Keep the history.' })).toBeVisible();
  await expect(page.getByText('lead-qualification', { exact: true })).toBeVisible();
  expect(errors.filter((message) => /module script|MIME type|Expected a JavaScript/.test(message))).toEqual([]);
  await context.setOffline(false);
});

test('service worker activates a newer cache immediately', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toContain('/sw.js');
  const previous = await workerCacheVersion(page);
  const worker = await readFile('dist/site/sw.js', 'utf8');
  const updated = worker.replace(previous, `${previous}-test-update`);
  await writeFile('dist/site/sw.js', updated);
  try {
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration.update()));
    await page.waitForTimeout(250);
    await page.reload();
    await expect.poll(() => workerCacheVersion(page), { timeout: 5_000 }).toBe(`${previous}-test-update`);
  } finally {
    await writeFile('dist/site/sw.js', worker);
  }
});
