// Racine — service worker minimal (cache de l'app shell, jamais l'API)
const CACHE = 'racine-shell-v1';
const SHELL = [
  '/app.html',
  '/login.html',
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/js/api.js',
  '/assets/js/app.js',
  '/assets/js/starfield.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // jamais de cache pour l'API
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res.ok) caches.open(CACHE).then(function (cache) { cache.put(event.request, res.clone()); });
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
