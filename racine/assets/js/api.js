// Racine — client API (script classique, pas de module ES : doit marcher servi par Cloudflare Pages)
window.RA = (function () {
  async function req(path, opts) {
    opts = opts || {};
    var res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
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
    updateNote: function (id, patch) { return req('/notes/' + id, { method: 'PUT', body: patch }); },
    deleteNote: function (id) { return req('/notes/' + id, { method: 'DELETE' }); },
    restoreNote: function (id) { return req('/notes/' + id + '/restore', { method: 'PUT' }); },
    purgeNote: function (id) { return req('/notes/' + id + '/purge', { method: 'DELETE' }); },

    listClips: function () { return req('/clips'); },
    trashClips: function () { return req('/clips/trash'); },
    getClip: function (id) { return req('/clips/' + id); },
    createClip: function (clip) { return req('/clips', { method: 'POST', body: clip }); },
    updateClip: function (id, patch) { return req('/clips/' + id, { method: 'PUT', body: patch }); },
    deleteClip: function (id) { return req('/clips/' + id, { method: 'DELETE' }); },
    restoreClip: function (id) { return req('/clips/' + id + '/restore', { method: 'PUT' }); },
    purgeClip: function (id) { return req('/clips/' + id + '/purge', { method: 'DELETE' }); },

    exportAll: function () { return req('/export'); },

    health: function () { return req('/health'); },
    listBackups: function () { return req('/backups'); },
    createBackup: function () { return req('/backups', { method: 'POST' }); },
    getBackup: function (id) { return req('/backups/' + id); },
  };
})();
