/* =============================================
   AMICI FC – Service Worker v1.0.0
   Offline-first con cache intelligente
   ============================================= */

const CACHE_NAME = 'amicifc-v1.0.0';
const STATIC_CACHE = 'amicifc-static-v1.0.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://unpkg.com/dexie@3/dist/dexie.min.js',
  'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://unpkg.com/sortablejs@1.15.0/Sortable.min.js'
];

// Install: precache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Amici FC Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache error:', err))
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Amici FC Service Worker...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('anthropic.com') ||
      url.hostname.includes('openai.com') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('generativelanguage')) return;

  // Cache-first for static assets
  if (STATIC_ASSETS.some(a => request.url.includes(a.replace('./', '')))) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for update messages
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
