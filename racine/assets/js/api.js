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
    createNote: function (note) { return req('/notes', { method: 'POST', body: note }); },
    updateNote: function (id, patch) { return req('/notes/' + id, { method: 'PUT', body: patch }); },
    deleteNote: function (id) { return req('/notes/' + id, { method: 'DELETE' }); },

    listClips: function () { return req('/clips'); },
    getClip: function (id) { return req('/clips/' + id); },
    createClip: function (clip) { return req('/clips', { method: 'POST', body: clip }); },
    deleteClip: function (id) { return req('/clips/' + id, { method: 'DELETE' }); },
  };
})();
