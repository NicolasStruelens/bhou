// Racine — service worker : app-shell statique uniquement.
// Les données privées de l'API ne sont jamais persistées dans CacheStorage.
// Les mutations (POST/PUT/DELETE) ne sont JAMAIS interceptées ici : voir assets/js/offline-queue.js.
const CACHE = 'racine-shell-v60';
const SHELL = [
  '/assets/css/tokens.css',
  '/assets/css/racine.css',
  '/assets/js/theme-init.js',
  '/assets/js/starfield.js',
  '/assets/js/offline-queue.js',
  '/assets/js/api.js',
  '/assets/js/racine.js',
  '/assets/js/login.js',
  '/app.html',
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

  // Données API : toujours réseau. Aucun contenu privé ne reste dans CacheStorage après déconnexion.
  if (url.pathname.startsWith('/api/')) {
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
