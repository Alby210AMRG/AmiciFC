// Amici FC Service Worker v1309
const CACHE = 'amicifc-v1309';
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
  const url = e.request.url;

  // ── BYPASS COMPLETO: mai intercettare richieste esterne ──
  // Firebase Realtime Database (tutti i domini, incluso europe-west1)
  if (
    url.includes('firebaseio.com') ||
    url.includes('firebasedatabase.app') ||
    url.includes('firebasestorage') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('anthropic.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('api.openai.com')
  ) {
    return; // lascia passare direttamente alla rete senza intercettare
  }

  // Font Google: cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open('amicifc-fonts').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp && resp.ok) cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => cached || new Response('', {status: 503}));
        })
      )
    );
    return;
  }

  // Solo GET, solo http
  if (e.request.method !== 'GET' || !url.startsWith('http')) return;

  const parsedUrl = new URL(url);

  // HTML e version.json: sempre network-first (no cache stantia)
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
