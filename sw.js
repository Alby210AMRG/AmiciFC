/* ================================================
   AMICI FC Service Worker v1.027
   Strategia:
   - amici-fc.html → SEMPRE dalla rete (mai cache)
   - version.json  → SEMPRE dalla rete (mai cache)  
   - Assets CDN    → cache-first con fallback rete
   - Immagini giocatori → cache-first
   ================================================ */

const CACHE_NAME = 'amicifc-v1.027';

// Elimina TUTTI i vecchi cache all'attivazione
self.addEventListener('install', event => {
  console.log('[SW 1.027] install - skipWaiting');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW 1.027] activate - purging old caches');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW 1.027] deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // ── API esterne: sempre rete, niente cache ──
  const passThrough = [
    'anthropic.com', 'openai.com', 'generativelanguage.googleapis.com',
    'identitytoolkit.googleapis.com', 'firebaseio.com',
    'nominatim.openstreetmap.org', 'open-meteo.com', 'firebase.google.com'
  ];
  if (passThrough.some(h => url.hostname.includes(h))) return;

  // ── HTML principale e version.json → SEMPRE RETE ──
  if (url.pathname.endsWith('.html') ||
      url.pathname.endsWith('version.json') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match(request)) // fallback offline
    );
    return;
  }

  // ── Immagini giocatori → cache-first ──
  if (url.pathname.includes('/images/')) {
    event.respondWith(
      caches.match(request).then(cached => cached ||
        fetch(request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // ── CDN (Vue, Dexie, fonts) → cache-first con aggiornamento in background ──
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        return res;
      });
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    console.log('[SW 1.027] SKIP_WAITING received');
    self.skipWaiting();
  }
});
