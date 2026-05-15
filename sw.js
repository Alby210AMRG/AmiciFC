// Amici FC Service Worker v1149
const CACHE = 'amicifc-v1149';
const ASSETS = [
  './',
  './amici-fc.html',
  './version.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      for (const url of ASSETS) {
        try { await c.add(url); }
        catch(err) { console.warn('[SW] Failed to cache:', url, err.message); }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            const rc = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, rc));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.status === 200 && r.type !== 'opaque') {
          const rc = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, rc));
        }
        return r;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./amici-fc.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
