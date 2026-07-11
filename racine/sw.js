// Racine — service worker minimal (cache des fichiers statiques, jamais l'API ni les pages HTML)
const CACHE = 'racine-shell-v18';
const SHELL = [
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/js/api.js',
  '/assets/js/starfield.js',
  '/assets/js/theme-init.js',
  '/assets/js/login.js',
  '/assets/js/shell.js',
  '/assets/js/notes.js',
  '/assets/js/reminders.js',
  '/assets/js/importexport.js',
  '/assets/js/system.js',
  '/assets/js/focus.js',
  '/assets/js/clips.js',
  '/assets/js/views.js',
  '/assets/js/recipes.js',
  '/assets/js/trash.js',
  '/assets/js/main.js',
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
