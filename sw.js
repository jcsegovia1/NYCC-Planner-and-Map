const CACHE = 'nycc2026-planner-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './data/locations.js',
  './data/booths.js',
  './data/events.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maps/overview.webp',
  './assets/maps/level1.webp',
  './assets/maps/level2.webp',
  './assets/maps/level3.webp',
  './assets/maps/level4.webp',
  './assets/maps/level5.webp',
  './assets/maps/showfloor.webp',
  './assets/maps/artistalley.webp'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
