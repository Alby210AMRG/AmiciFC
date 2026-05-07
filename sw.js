/* AmiciFC Service Worker v1.061 */
const CACHE = 'amicifc-v1061';

const STATIC = [
  './amici-fc.html',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://unpkg.com/dexie@3/dist/dexie.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
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
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  // Never intercept: Firebase, AI APIs, analytics
  const bypass = ['anthropic.com','openai.com','generativelanguage','googleapis.com/v1',
                  'firebaseio.com','firebasedatabase.app','nominatim','open-meteo',
                  'identitytoolkit','securetoken.googleapis'];
  if (bypass.some(h => url.href.includes(h))) return;

  // HTML + version.json: network-first, fall back to cache
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Player photos: cache-first (works offline)
  if (url.pathname.includes('/images/players/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
          return res;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // CDN assets (Vue, Dexie, fonts, icons): cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      const net = fetch(request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

// Pre-cache player photos on demand
self.addEventListener('message', async e => {
  if (e.data?.type === 'CACHE_PHOTOS' && e.data.urls) {
    const cache = await caches.open(CACHE);
    for (const url of e.data.urls) {
      try {
        const already = await cache.match(url);
        if (!already) {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        }
      } catch {}
    }
    e.source?.postMessage({ type: 'PHOTOS_CACHED', count: e.data.urls.length });
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
