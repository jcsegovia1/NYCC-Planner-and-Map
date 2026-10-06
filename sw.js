const CACHE = 'nycc2026-friday-v7';
const CORE = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './data/locations.js', './data/booths.js', './data/events.js', './data/activities.js', './data/guests.js', './data/exhibitors.js',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/maps/overview.webp', './assets/maps/level1.webp', './assets/maps/level2.webp', './assets/maps/level3.webp',
  './assets/maps/level4.webp', './assets/maps/level5.webp', './assets/maps/showfloor.webp', './assets/maps/artistalley.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true })) || (request.mode === 'navigate' ? cache.match('./index.html') : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isMapOrImage = /\.(?:webp|png|jpg|jpeg|svg|ico)$/i.test(url.pathname);
  event.respondWith(isMapOrImage ? cacheFirst(event.request) : networkFirst(event.request));
});
