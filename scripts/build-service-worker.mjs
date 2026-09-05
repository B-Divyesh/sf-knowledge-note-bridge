import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist/site');
const assets = resolve(output, 'assets');

async function assetPaths(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    return entry.isDirectory() ? assetPaths(resolve(directory, entry.name), next) : [next];
  }));
  return paths.flat();
}

const hashedAssets = (await assetPaths(assets)).sort().map((file) => `/assets/${file}`);
const shell = ['/', '/demo/', '/privacy/', '/terms/', '/404.html', '/bridge-ceramic.webp', '/knb-demo.svg', '/social-card.webp', '/favicon.svg', '/apple-touch-icon.png', ...hashedAssets];
const cacheVersion = createHash('sha256').update(JSON.stringify(shell)).digest('hex').slice(0, 12);
const template = await readFile('site/public/sw.js', 'utf8');
const worker = template
  .replace('__KBN_CACHE_VERSION__', cacheVersion)
  .replace(/const SHELL = .+;/, `const SHELL = ${JSON.stringify(shell)};`);

if (worker.includes('__KBN_')) throw new Error('service worker template placeholders were not replaced');
await writeFile(resolve(output, 'sw.js'), worker);
