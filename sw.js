/* AmiciFC Service Worker v1.050 */
const CACHE = 'amicifc-v1050';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  // Never cache: API calls, Firebase, analytics
  const passThrough = ['anthropic.com','openai.com','generativelanguage','googleapis.com','firebaseio.com','nominatim','open-meteo','identitytoolkit'];
  if (passThrough.some(h => url.hostname.includes(h))) return;

  // HTML + version.json: always network-first (never stale)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('version.json') || url.pathname === '/') {
    e.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
    );
    return;
  }

  // Player photos: cache-first (download once, available offline)
  if (url.pathname.includes('/images/players/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(request, res.clone()));
          }
          return res;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // CDN assets (Vue, Dexie, fonts): cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      const net = fetch(request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
        return res;
      });
      return cached || net;
    })
  );
});

// Pre-cache player photos on demand (called from app)
self.addEventListener('message', async e => {
  if (e.data?.type === 'CACHE_PHOTOS' && e.data.urls) {
    const cache = await caches.open(CACHE);
    const urls = e.data.urls;
    for (const url of urls) {
      try {
        const already = await cache.match(url);
        if (!already) {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        }
      } catch(err) { /* ignore */ }
    }
    e.source?.postMessage({ type: 'PHOTOS_CACHED', count: urls.length });
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
