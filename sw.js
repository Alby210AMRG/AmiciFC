/* AMICI FC – Service Worker v1.020 – NUCLEAR CACHE RESET */
const V = '1.020';
const CACHE = `amicifc-${V}`;

// INSTALL: skip waiting immediately, no precaching
self.addEventListener('install', event => {
  console.log(`[SW ${V}] install`);
  self.skipWaiting(); // Take over immediately
});

// ACTIVATE: delete ALL old caches, claim all clients
self.addEventListener('activate', event => {
  console.log(`[SW ${V}] activate - deleting all old caches`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => {
        console.log(`[SW ${V}] deleting cache: ${k}`);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
  );
});

// FETCH: amici-fc.html and version.json ALWAYS from network (never cached)
// Everything else: network first, cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip external APIs (AI, Firebase, weather, maps)
  const externalHosts = ['anthropic.com','openai.com','generativelanguage.googleapis.com',
    'firebaseio.com','nominatim.openstreetmap.org','open-meteo.com'];
  if (externalHosts.some(h => url.hostname.includes(h))) return;

  // HTML and JSON config: ALWAYS network, no cache
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('version.json') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Player images: cache-first (stable assets)
  if (url.pathname.includes('/images/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ||
        fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // Everything else (fonts, CDN libs): network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
