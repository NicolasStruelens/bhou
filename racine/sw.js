// Racine — service worker minimal (cache des fichiers statiques, jamais l'API ni les pages HTML)
const CACHE = 'racine-shell-v2';
const SHELL = [
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
  var req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') return; // jamais intercepter le chargement des pages HTML
  var url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // jamais de cache pour l'API
  if (SHELL.indexOf(url.pathname) === -1) return; // ne cache que les fichiers statiques listés

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res.ok && !res.redirected) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
