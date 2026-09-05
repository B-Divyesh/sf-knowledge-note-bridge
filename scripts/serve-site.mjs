import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist/site');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

async function regularFile(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = '/404'; }
  if (['/demo', '/privacy', '/terms'].includes(pathname)) {
    response.writeHead(308, { location: `${pathname}/` });
    response.end();
    return;
  }
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  let path = resolve(root, `.${relative}`);
  let status = 200;
  if (!path.startsWith(`${root}${sep}`) || !(await regularFile(path))) {
    path = resolve(root, '404.html');
    status = 404;
  }
  try {
    const body = await readFile(path);
    response.writeHead(status, {
      'content-type': types[extname(path)] || 'application/octet-stream',
      'cache-control': path.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('The local preview could not read this file.');
  }
}).listen(4173, '127.0.0.1');
