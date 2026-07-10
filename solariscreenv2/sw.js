/* ═══════════════════════════════════════════════════════════
   SOLARISCREEN — Service Worker NEUTRALISÉ (kill-switch)
   ─────────────────────────────────────────────────────────
   Un ancien service worker (PWA hors-ligne) cassait TOUTES les navigations
   en ERR_FAILED derrière Cloudflare Access. On le neutralise définitivement :

   1) AUCUN gestionnaire 'fetch' → ce worker n'intercepte plus la moindre
      requête. Les pages passent donc toujours directement par le réseau,
      exactement comme s'il n'y avait pas de service worker.
   2) À l'activation : on vide tous les caches, on se DÉSINSCRIT, puis on
      recharge les onglets ouverts → ils repartent en réseau direct.

   Effet : tout navigateur qui avait encore l'ancien SW se répare tout seul
   dès qu'il récupère ce fichier (le navigateur vérifie sw.js à chaque visite,
   indépendamment du gestionnaire fetch). Aucune action utilisateur requise.

   ⚠️ Ne PAS réintroduire de mise en cache des navigations ici sans un test
      réel derrière Cloudflare Access (c'est ce qui avait tout cassé).
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    // 0) Prendre le contrôle des pages ouvertes pour que le nettoyage soit définitif.
    try { await self.clients.claim(); } catch (e) {}
    // 1) Purge tous les caches laissés par l'ancienne PWA.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    // 2) Se désinscrire : plus aucun service worker ne contrôlera ce site.
    try { await self.registration.unregister(); } catch (e) {}
    // 3) Recharger les onglets ouverts (même non contrôlés) pour qu'ils repartent en réseau direct.
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(function (c) { if ('navigate' in c) c.navigate(c.url); });
    } catch (e) {}
  })());
});

// Volontairement AUCUN addEventListener('fetch', …) : le worker ne touche à rien.
