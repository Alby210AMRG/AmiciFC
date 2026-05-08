// v1.083 — cache key aggiornata per forzare reload del nuovo HTML
const CACHE = 'amicifc-v1083';
const ASSETS = ['./amici-fc.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new Request(a, {cache: 'reload'}))))
      .catch(() => {})
  );
  self.skipWaiting(); // attiva subito senza aspettare che le vecchie schede chiudano
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // prende controllo di tutte le schede aperte subito
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    })).catch(() => caches.match('./amici-fc.html'))
  );
});
