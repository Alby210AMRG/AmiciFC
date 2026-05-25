// Amici FC Service Worker v1262
const CACHE = 'amicifc-v1262';
const ASSETS = ['./', './amici-fc.html', './version.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      for (const url of ASSETS) {
        try { await c.add(url); } catch(err) { console.warn('[SW] skip:', url); }
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
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open('amicifc-fonts').then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => { if (resp.ok) cache.put(e.request, resp.clone()); return resp; }).catch(() => cached);
      })
    )); return;
  }
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  const url = new URL(e.request.url);
  // HTML e version.json sempre network-first (no cache stantia)
  if (url.pathname.endsWith('amici-fc.html') || url.pathname.endsWith('version.json') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, {cache: 'no-store'})
        .then(r => { if (r?.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    ); return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r?.ok && r.type !== 'opaque') caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => e.request.mode === 'navigate' ? caches.match('./amici-fc.html') : new Response('Offline', {status:503}));
    })
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
