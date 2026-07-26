// Racine — file d'attente hors-ligne. Les créations possèdent un UUID client stable ;
// les éditions répétées d'un même élément sont regroupées avant synchronisation.

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
    return getAll().catch(function () { return []; }).then(function (items) {
      return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var payload = body === undefined ? null : body;
        // Plusieurs PUT successifs vers la même ressource n'ont pas besoin d'être rejoués un par un.
        if (method === 'PUT') {
          items.filter(function (item) { return item.path === path && item.method === 'PUT'; }).forEach(function (item) {
            payload = Object.assign({}, item.body || {}, payload || {});
            store.delete(item.id);
          });
        }
        store.add({ path: path, method: method, body: payload, ts: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
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

  function clear() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () {});
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
            var harmlessMissingDelete = item.method === 'DELETE' && res.status === 404;
            if (!res.ok && !harmlessMissingDelete) throw new Error('sync failed');
            return remove(item.id);
          }).then(function () { synced++; });
        });
      }, Promise.resolve());
    }).catch(function () { /* on s'arrête au premier échec, on retentera plus tard */ }).then(function () {
      flushing = false;
      return synced;
    });
  }

  return { enqueue: enqueue, count: count, flush: flush, clear: clear };
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
