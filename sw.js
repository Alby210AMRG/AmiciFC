// Amici FC Service Worker v1321
const CACHE = 'amicifc-v1321';
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

// Domini da passare SEMPRE alla rete senza intercettare
const PASSTHROUGH = [
  'anthropic.com',
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'firebasedatabase.app',
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'securetoken.googleapis.com',
  'identitytoolkit.googleapis.com',
  'googleapis.com/identitytoolkit',
];

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // ── PASSTHROUGH: richieste API → sempre rete diretta ──
  if (PASSTHROUGH.some(d => url.includes(d))) {
    // respondWith(fetch) esplicito — non solo return — per Chrome mobile
    e.respondWith(fetch(e.request));
    return;
  }

  // Solo GET http/https da qui in poi
  if (e.request.method !== 'GET' || !url.startsWith('http')) return;

  // Font Google: cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open('amicifc-fonts').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp && resp.ok) cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  const parsedUrl = new URL(url);

  // HTML e version.json: sempre network-first
  if (
    parsedUrl.pathname.endsWith('amici-fc.html') ||
    parsedUrl.pathname.endsWith('version.json') ||
    parsedUrl.pathname === '/' ||
    parsedUrl.pathname.endsWith('/index.html')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(r => {
          if (r && r.ok && r.type === 'basic') {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Tutto il resto: cache-first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.ok && (r.type === 'basic' || r.type === 'cors')) {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
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
