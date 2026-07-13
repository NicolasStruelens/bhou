// Racine — file d'attente hors-ligne pour les actions courantes sur des éléments déjà créés
// (cocher, éditer, supprimer, restaurer). Volontairement limité : créer un élément tout neuf
// nécessite encore une connexion dans cette première version (pas d'ID temporaire à réconcilier).

var OfflineQueue = (function () {
  var DB_NAME = 'racine-offline';
  var STORE = 'queue';
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB indisponible')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function enqueue(path, method, body) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add({ path: path, method: method, body: body === undefined ? null : body, ts: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function remove(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function count() { return getAll().then(function (all) { return all.length; }).catch(function () { return 0; }); }

  var flushing = false;
  function flush() {
    if (flushing) return Promise.resolve(0);
    flushing = true;
    var synced = 0;
    return getAll().then(function (items) {
      items.sort(function (a, b) { return a.ts - b.ts; });
      return items.reduce(function (chain, item) {
        return chain.then(function () {
          return fetch('/api' + item.path, {
            method: item.method,
            headers: item.body !== null ? { 'Content-Type': 'application/json' } : {},
            body: item.body !== null ? JSON.stringify(item.body) : undefined,
            credentials: 'same-origin',
          }).then(function (res) {
            if (!res.ok && res.status !== 404) throw new Error('sync failed');
            return remove(item.id);
          }).then(function () { synced++; });
        });
      }, Promise.resolve());
    }).catch(function () { /* on s'arrête au premier échec, on retentera plus tard */ }).then(function () {
      flushing = false;
      return synced;
    });
  }

  return { enqueue: enqueue, count: count, flush: flush };
})();

function updateOfflineBadge() {
  var badge = document.getElementById('offlineBadge');
  if (!badge) return;
  badge.classList.toggle('hidden', navigator.onLine);
}

window.addEventListener('online', function () {
  updateOfflineBadge();
  OfflineQueue.flush().then(function (synced) {
    if (typeof loadNotes === 'function') loadNotes();
    if (typeof loadClips === 'function') loadClips();
    if (typeof loadRecipes === 'function') loadRecipes();
    if (synced > 0 && typeof toast === 'function') toast(synced + ' action(s) synchronisée(s) — connexion rétablie');
  });
});
window.addEventListener('offline', updateOfflineBadge);
document.addEventListener('DOMContentLoaded', updateOfflineBadge);
