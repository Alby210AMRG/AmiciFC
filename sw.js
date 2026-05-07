/* AmiciFC Service Worker v1.065 */
const CACHE = 'amicifc-v1065';
const APP_URL = './amici-fc.html';

// CDN assets to cache on install
const CDN_ASSETS = [
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://unpkg.com/dexie@3/dist/dexie.min.js',
];

self.addEventListener('install', e => {
  self.skipWaiting(); // take over immediately
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache CDN assets — don't fail install if they fail
      for (const url of CDN_ASSETS) {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        } catch(err) {
          console.log('[SW] Could not cache:', url, err.message);
        }
      }
    })
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

  // Never intercept: Firebase, AI APIs, weather, geo
  const bypass = ['anthropic.com','openai.com','generativelanguage','googleapis.com/v1beta',
                  'firebaseio.com','firebasedatabase.app','nominatim','open-meteo',
                  'identitytoolkit','securetoken.googleapis'];
  if (bypass.some(h => url.href.includes(h))) return;

  // HTML + version.json: network-first, cache fallback for offline
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('version.json') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then(r => r || caches.match(APP_URL)))
    );
    return;
  }

  // Player photos: cache-first (offline ready)
  if (url.pathname.includes('/images/')) {
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

  // CDN assets (Vue, Dexie, fonts): cache-first, update in background
  e.respondWith(
    caches.match(request).then(cached => {
      const net = fetch(request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(request, res.clone()));
        }
        return res;
      }).catch(() => cached || new Response('', { status: 503 }));
      return cached || net;
    })
  );
});

// Pre-cache player photos on demand
self.addEventListener('message', async e => {
  if (e.data?.type === 'CACHE_PHOTOS' && e.data.urls) {
    const cache = await caches.open(CACHE);
    let count = 0;
    for (const photoUrl of e.data.urls) {
      try {
        const already = await cache.match(photoUrl);
        if (!already) {
          const res = await fetch(photoUrl, { mode: 'cors' });
          if (res.ok) { await cache.put(photoUrl, res); count++; }
        }
      } catch {}
    }
    e.source?.postMessage({ type: 'PHOTOS_CACHED', count });
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
