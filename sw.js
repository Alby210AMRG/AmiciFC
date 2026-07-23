const CACHE='amicifc-v1732';
const ASSETS=['./','./amici-fc.html','./sw.js'];

// Firebase va sempre in rete — mai in cache.
// Includere ENTRAMBI i domini: firebaseio.com (legacy) e firebasedatabase.app (europe-west1 e altre regioni).
// Se Firebase introduce nuovi domini RTDB, vanno aggiunti qui immediatamente (vedi REGOLE-PROGETTO.md Regola 10).
const isFb = url => url.includes('firebasedatabase.app') || url.includes('firebaseio.com');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Firebase: sempre dalla rete, mai dalla cache
  if (isFb(e.request.url)) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Asset statici: cache-first con fallback rete
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const rc = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, rc));
      }
      return res;
    }))
  );
});
