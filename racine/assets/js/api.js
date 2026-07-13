// Racine — client API (script classique, pas de module ES : doit marcher servi par Cloudflare Pages)
window.RA = (function () {
  // certaines mutations (cocher/éditer/supprimer/restaurer un élément déjà créé) peuvent être mises en
  // file d'attente hors-ligne : leur ID est déjà connu, pas besoin de réconcilier un ID temporaire.
  async function queueOffline(path, opts) {
    await OfflineQueue.enqueue(path, opts.method || 'GET', opts.body);
    if (typeof toast === 'function') toast('Hors-ligne : sera synchronisé au retour du réseau');
    if (typeof updateOfflineBadge === 'function') updateOfflineBadge();
    return { ok: true, queued: true };
  }

  async function req(path, opts) {
    opts = opts || {};
    if (opts.offlineQueueable && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return queueOffline(path, opts);
    }
    var res;
    try {
      res = await fetch('/api' + path, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin',
      });
    } catch (networkErr) {
      if (opts.offlineQueueable && typeof OfflineQueue !== 'undefined') return queueOffline(path, opts);
      throw networkErr;
    }
    if (res.status === 401) {
      if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
      throw new Error('unauthorized');
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || ('erreur ' + res.status));
    return data;
  }

  return {
    login: function (password) { return req('/login', { method: 'POST', body: { password: password } }); },
    logout: function () { return req('/logout', { method: 'POST' }); },
    me: function () { return req('/me'); },

    listNotes: function () { return req('/notes'); },
    trashNotes: function () { return req('/notes/trash'); },
    createNote: function (note) { return req('/notes', { method: 'POST', body: note }); },
    updateNote: function (id, patch) { return req('/notes/' + id, { method: 'PUT', body: patch, offlineQueueable: true }); },
    deleteNote: function (id) { return req('/notes/' + id, { method: 'DELETE', offlineQueueable: true }); },
    restoreNote: function (id) { return req('/notes/' + id + '/restore', { method: 'PUT', offlineQueueable: true }); },
    purgeNote: function (id) { return req('/notes/' + id + '/purge', { method: 'DELETE' }); },

    listClips: function () { return req('/clips'); },
    trashClips: function () { return req('/clips/trash'); },
    getClip: function (id) { return req('/clips/' + id); },
    createClip: function (clip) { return req('/clips', { method: 'POST', body: clip }); },
    updateClip: function (id, patch) { return req('/clips/' + id, { method: 'PUT', body: patch, offlineQueueable: true }); },
    deleteClip: function (id) { return req('/clips/' + id, { method: 'DELETE', offlineQueueable: true }); },
    restoreClip: function (id) { return req('/clips/' + id + '/restore', { method: 'PUT', offlineQueueable: true }); },
    purgeClip: function (id) { return req('/clips/' + id + '/purge', { method: 'DELETE' }); },

    exportAll: function () { return req('/export'); },

    getPreferences: function () { return req('/preferences'); },
    setPreferences: function (patch) { return req('/preferences', { method: 'PUT', body: patch }); },

    health: function () { return req('/health'); },
    listBackups: function () { return req('/backups'); },
    createBackup: function () { return req('/backups', { method: 'POST' }); },
    getBackup: function (id) { return req('/backups/' + id); },

    // partage public : volontairement en dehors du wrapper req() authentifié
    // (pas de redirection vers login.html en cas d'échec — la page publique affiche son propre message)
    getPublicClip: async function (token) {
      var res = await fetch('/api/public/' + token, { method: 'GET' });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error((data && data.error) || ('erreur ' + res.status));
      return data;
    },

    getQuickToken: function () { return req('/quick-token'); },
    createQuickToken: function () { return req('/quick-token', { method: 'POST' }); },
    revokeQuickToken: function () { return req('/quick-token', { method: 'DELETE' }); },

    listRecipes: function () { return req('/recipes'); },
    trashRecipes: function () { return req('/recipes/trash'); },
    createRecipe: function (recipe) { return req('/recipes', { method: 'POST', body: recipe }); },
    updateRecipe: function (id, patch) { return req('/recipes/' + id, { method: 'PUT', body: patch, offlineQueueable: true }); },
    deleteRecipe: function (id) { return req('/recipes/' + id, { method: 'DELETE', offlineQueueable: true }); },
    restoreRecipe: function (id) { return req('/recipes/' + id + '/restore', { method: 'PUT', offlineQueueable: true }); },
    purgeRecipe: function (id) { return req('/recipes/' + id + '/purge', { method: 'DELETE' }); },
  };
})();
