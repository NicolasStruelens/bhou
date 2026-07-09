/* ═══════════════════════════════════════════════════════════
   SOLARISCREEN — Service Worker (PWA hors-ligne)
   Stratégie :
   - /api/* et requêtes cross-origin (polices Google, météo…) → RÉSEAU direct
     (les données restent fraîches ; l'app gère déjà l'offline via localStorage).
   - Pages + assets same-origin → "stale-while-revalidate" : on sert le cache
     immédiatement (rapide, marche hors-ligne) et on met à jour en arrière-plan.
   Bump CACHE_NAME à chaque déploiement important pour purger l'ancien cache.
   ═══════════════════════════════════════════════════════════ */
const CACHE_NAME = 'solariscreen-v1';

// App shell pré-caché à l'installation (chemins relatifs à l'emplacement du SW = racine du site).
const PRECACHE = [
  'app/dashboard.html', 'app/simulateur.html', 'app/terrain.html', 'app/vue.html',
  'app/devis.html', 'app/clients.html', 'app/factures.html', 'app/facture.html',
  'app/rdv.html', 'app/stats.html', 'app/agenda.html', 'app/carte.html', 'app/sav.html',
  'app/picking.html', 'app/visite.html', 'app/reception.html', 'app/portfolio.html',
  'assets/js/theme.js', 'assets/js/ui.js', 'assets/js/nav.js', 'assets/js/api.js',
  'assets/js/company.js', 'assets/js/products.js', 'assets/js/mantras.js',
  'assets/css/tokens.css', 'assets/css/theme-dark.css', 'assets/css/theme-light.css',
  'assets/css/base.css', 'assets/css/document.css',
  'assets/img/logo-solariscreen.png', 'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // add() individuel + catch : un 404 sur un fichier ne fait pas échouer toute l'installation.
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                         // mutations → réseau direct
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;          // cross-origin (polices, météo) → réseau
  if (url.pathname.indexOf('/api/') !== -1) return;         // API → réseau (offline géré par l'app)

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    const fresh = cached || (await network);
    if (fresh) return fresh;
    // Hors-ligne + rien en cache : pour une navigation, on retombe sur le dashboard.
    if (req.mode === 'navigate') {
      const fallback = await cache.match('app/dashboard.html', { ignoreSearch: true });
      if (fallback) return fallback;
    }
    return Response.error();
  })());
});
