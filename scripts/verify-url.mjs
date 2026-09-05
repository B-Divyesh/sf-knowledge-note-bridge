import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = new URL(process.argv[2] || 'http://127.0.0.1:4173');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

const routes = [
  ['/', 200, 'Knowledge Note Bridge — Update Anki from Markdown'],
  ['/demo/', 200, 'Demo — Knowledge Note Bridge'],
  ['/privacy/', 200, 'Privacy — Knowledge Note Bridge'],
  ['/terms/', 200, 'Terms — Knowledge Note Bridge'],
  ['/verify-url-missing-page', 404, 'Page not found — Knowledge Note Bridge']
];

const results = [];
for (const [path, expectedStatus, title] of routes) {
  errors.length = 0;
  const response = await page.goto(new URL(path, base).href);
  const status = response?.status();
  const facts = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelectorAll('h1').length,
    main: document.querySelectorAll('main').length,
    missingAlt: [...document.images].filter((image) => !image.hasAttribute('alt')).length,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''));
  if (status !== expectedStatus || facts.lang !== 'en' || facts.title !== title || facts.h1 !== 1 || facts.main !== 1 || facts.missingAlt || facts.overflow || serious.length) {
    throw new Error(`${path} failed verification: ${JSON.stringify({ status, expectedStatus, facts, serious: serious.map((item) => item.id) })}`);
  }
  if (expectedStatus !== 404 && errors.length) throw new Error(`${path} logged browser errors: ${JSON.stringify(errors)}`);
  results.push({ path, status, title, seriousAxeViolations: 0 });
}
await context.close();
await browser.close();
console.log(JSON.stringify({ ok: true, base: base.href, routes: results }, null, 2));
