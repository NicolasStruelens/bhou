// Racine — service worker : fichiers statiques + app-shell HTML + dernières données API en cache,
// pour que l'app s'ouvre et affiche au moins les dernières données connues hors-ligne.
// Les mutations (POST/PUT/DELETE) ne sont JAMAIS interceptées ici : voir assets/js/offline-queue.js.
const CACHE = 'racine-shell-v52';
const SHELL = [
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/js/offline-queue.js',
  '/assets/js/api.js',
  '/assets/js/preferences.js',
  '/assets/js/starfield.js',
  '/assets/js/theme-init.js',
  '/assets/js/login.js',
  '/assets/js/shell.js',
  '/assets/js/capture.js',
  '/assets/js/search.js',
  '/assets/js/links.js',
  '/assets/js/tree.js',
  '/assets/js/notes.js',
  '/assets/js/reminders.js',
  '/assets/js/importexport.js',
  '/assets/js/system.js',
  '/assets/js/focus.js',
  '/assets/js/clips.js',
  '/assets/js/views.js',
  '/assets/js/graph-v49.js',
  '/assets/js/daily-v50.js',
  '/assets/js/mental-v51.js',
  '/assets/js/harvest-v52.js',
  '/assets/js/recipes.js',
  '/assets/js/trash.js',
  '/assets/js/main.js',
  '/app.html',
];

// lecture seule : la dernière réponse connue s'affiche hors-ligne, jamais utilisée pour les mutations
const CACHEABLE_API_GET = ['/api/notes', '/api/clips', '/api/recipes'];

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

  // pages HTML (app.html, login.html, ...) : réseau d'abord, secours sur la dernière version en cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res.ok && !res.redirected) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req.url, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req.url).then(function (cached) { return cached || caches.match('/app.html'); });
      })
    );
    return;
  }

  if (req.method !== 'GET') return; // jamais intercepter les mutations : gérées côté client par OfflineQueue
  var url = new URL(req.url);

  // données API en lecture : réseau d'abord (fraîcheur), secours sur la dernière copie connue si hors-ligne
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API_GET.indexOf(url.pathname) === -1) return; // login/me/export/backups/preferences... jamais mis en cache
    event.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || new Response(JSON.stringify({ error: 'hors-ligne' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        });
      })
    );
    return;
  }

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
