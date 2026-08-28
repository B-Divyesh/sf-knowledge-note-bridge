import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
