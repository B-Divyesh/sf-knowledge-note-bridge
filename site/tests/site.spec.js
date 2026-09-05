import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';

const seriousAxeViolations = async (page) => {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''));
};

test('home explains the job, audience, first action, and facts before scrolling', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle('Knowledge Note Bridge — Update Anki from Markdown');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Update Anki from Markdown without losing history' })).toBeVisible();
  await expect(page.getByText(/For self-learners who edit Markdown notes/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeVisible();
  await expect(page.getByText(/Loads a four-change dry-run/)).toBeVisible();
  await expect(page.getByText('Notes stay on your computer')).toBeVisible();
  const actionBox = await page.getByRole('link', { name: 'Try it with sample data' }).boundingBox();
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await seriousAxeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('one click opens an isolated populated demo that resets and exits cleanly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page).toHaveTitle('Demo — Knowledge Note Bridge');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  for (const kind of ['add', 'update', 'rename', 'archive']) {
    await expect(page.locator(`[data-kind="${kind}"]`)).toHaveCount(1);
  }
  await expect(page.getByText('lead-qualification', { exact: true })).toBeVisible();
  await expect(page.getByText('Edit note 17041 in place')).toBeVisible();
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });

  await page.locator('#demo-source').fill('not a card');
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual(['demo:knb:source']);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.getByRole('button', { name: 'Compare sample' }).click();
  await expect(page.getByText('No card blocks found')).toBeVisible();
  await page.locator('#reset-demo').click();
  await expect(page.locator('[data-kind]')).toHaveCount(4);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);

  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/#install$/);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});

test('demo handles invalid input, keyboard use, sticky status, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo/');
  await page.locator('#demo-source').fill('```card\nid: Bad ID\n---\nQ\n---\nA\n```');
  await page.getByRole('button', { name: 'Compare sample' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Could not read this Markdown')).toBeVisible();
  await page.locator('#reset-demo').click();
  await expect(page.locator('[data-kind]')).toHaveCount(4);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const banner = await page.locator('.demo-banner').boundingBox();
  expect(banner.y).toBeGreaterThanOrEqual(0);
  const duration = await page.locator('.diff-row').first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(['0.01ms', '1e-05s']).toContain(duration);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await seriousAxeViolations(page)).toEqual([]);
});

test('keyboard focus is visible and the skip link reaches main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  const outline = await page.getByRole('link', { name: 'Skip to main content' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline).toEqual({ width: '3px', style: 'solid' });
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('legal pages and metadata use distinct routes and valid structure', async ({ page }) => {
  for (const [path, title] of [['/privacy/', 'Privacy — Knowledge Note Bridge'], ['/terms/', 'Terms — Knowledge Note Bridge']]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(path));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /social-card\.webp$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
    expect(await seriousAxeViolations(page)).toEqual([]);
  }
});

test('unknown paths return the designed page with HTTP 404', async ({ page }) => {
  const response = await page.goto('/does-not-exist-repair-2');
  expect(response.status()).toBe(404);
  await expect(page).toHaveTitle('Page not found — Knowledge Note Bridge');
  await expect(page.locator('h1')).toHaveText('The requested page does not exist');
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  expect(await seriousAxeViolations(page)).toEqual([]);
});

test('the demo query enters the same isolated demo route', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
});

async function workerCacheVersion(page) {
  return page.evaluate(async () => {
    const channel = new MessageChannel();
    const version = new Promise((resolve) => { channel.port1.onmessage = (event) => resolve(event.data); });
    navigator.serviceWorker.controller.postMessage('knb-cache-version', [channel.port2]);
    return version;
  });
}

test('service worker precaches a cold offline demo reload with correct asset types', async ({ page, context }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/demo/');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toContain('/sw.js');
  const cacheEntries = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((name) => name.startsWith('knb-shell-')));
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cacheEntries).toContain('/demo/');
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
  await expect(page.getByRole('heading', { name: 'Preview Markdown changes before Anki sync' })).toBeVisible();
  await expect(page.locator('[data-kind]')).toHaveCount(4);
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
