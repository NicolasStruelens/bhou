/* ═══════════════════════════════════════════════════════════
   SOLARISCREEN — Service Worker (PWA hors-ligne)
   Stratégie :
   - NAVIGATIONS (pages) → NETWORK-FIRST : on laisse le réseau/navigateur gérer
     nativement (indispensable derrière Cloudflare Access : login, redirections).
     On ne retombe sur le cache QUE si le réseau échoue (vraiment hors-ligne).
     ⚠️ Ne JAMAIS servir une navigation via une réponse fetch transformée : ça casse
        (ERR_FAILED) dès qu'Access renvoie une redirection.
   - /api/* et cross-origin (polices, météo) → RÉSEAU direct (l'app gère l'offline
     via localStorage).
   - ASSETS same-origin (css/js/img) → stale-while-revalidate (rapide + auto-MàJ).
   Bump CACHE_NAME à chaque déploiement important pour purger l'ancien cache.
   ═══════════════════════════════════════════════════════════ */
const CACHE_NAME = 'solariscreen-v2';

// App shell pré-caché à l'installation (chemins relatifs à l'emplacement du SW = racine du site).
const PRECACHE = [
  'app/dashboard.html', 'app/simulateur.html', 'app/terrain.html', 'app/vue.html',
  'app/devis.html', 'app/clients.html', 'app/factures.html', 'app/facture.html',
  'app/rdv.html', 'app/stats.html', 'app/agenda.html', 'app/carte.html', 'app/sav.html',
  'app/picking.html', 'app/visite.html', 'app/reception.html', 'app/portfolio.html',
  'assets/js/theme.js', 'assets/js/ui.js', 'assets/js/nav.js', 'assets/js/api.js',
  'assets/js/company.js', 'assets/js/products.js', 'assets/js/mantras.js', 'assets/js/calc.js',
  'assets/css/tokens.css', 'assets/css/theme-dark.css', 'assets/css/theme-light.css',
  'assets/css/base.css', 'assets/css/document.css',
  'assets/img/logo-solariscreen.png', 'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // add() individuel + catch : un 404 (ou une redirection Access) sur un fichier ne fait
      // pas échouer toute l'installation.
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

  // ── Navigations (pages) : NETWORK-FIRST ──
  // On sert la réponse réseau TELLE QUELLE (le navigateur gère Access/redirections). On met en
  // cache une copie propre pour l'offline. Si le réseau échoue → cache → repli dashboard.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req, { ignoreSearch: true });
        return cached || (await cache.match('app/dashboard.html', { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  // ── Assets same-origin : stale-while-revalidate ──
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
