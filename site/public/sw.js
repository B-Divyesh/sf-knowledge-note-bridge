const CACHE = 'knb-shell-__KBN_CACHE_VERSION__';
const SHELL = ['/', '/privacy/', '/terms/', '/bridge-ceramic.webp', '/favicon.svg'];

self.addEventListener('install', (event) => event.waitUntil(
  caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
));

self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreVary: true }).then((cached) => cached || caches.match('/')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'knb-cache-version') event.ports[0]?.postMessage(CACHE);
});
