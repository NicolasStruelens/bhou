// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Client API (same-origin /api/*)
// Backend : Cloudflare Pages Functions, derrière Cloudflare Access.
// Fallback localStorage automatique. Script classique : window.SS
// ═══════════════════════════════════════════════════════════
(function () {
  const BASE = '/api';
  const LS_DEVIS = 'ss_devis_cache';
  const LS_CLIENTS = 'ss_clients_cache';
  const LS_FACTURES = 'ss_factures_cache';

  async function req(path, options) {
    const r = await fetch(BASE + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }, options || {}));
    let data;
    try { data = await r.json(); }
    catch (e) { throw new Error('HTTP ' + r.status + ' — réponse non-JSON'); }
    if (!data.ok) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  }

  const local = {
    list: function () { try { return JSON.parse(localStorage.getItem(LS_DEVIS) || '[]'); } catch (e) { return []; } },
    get: function (id) { return local.list().find(function (d) { return d.id === id; }) || null; },
    save: function (devis) {
      try {
        const all = local.list();
        const i = all.findIndex(function (d) { return d.id === devis.id; });
        if (i !== -1) all[i] = devis; else all.unshift(devis);
        localStorage.setItem(LS_DEVIS, JSON.stringify(all));
      } catch (e) { console.warn('[SS] cache local plein:', e.message); }
    },
    delete: function (id) {
      localStorage.setItem(LS_DEVIS, JSON.stringify(local.list().filter(function (d) { return d.id !== id; })));
    },
  };

  // Fiches clients (enrichissement : contact, notes, tags) — clé = client_key
  const localClients = {
    list: function () { try { return JSON.parse(localStorage.getItem(LS_CLIENTS) || '[]'); } catch (e) { return []; } },
    get: function (key) { return localClients.list().find(function (c) { return c.key === key; }) || null; },
    save: function (c) {
      try {
        const all = localClients.list();
        const i = all.findIndex(function (x) { return x.key === c.key; });
        if (i !== -1) all[i] = c; else all.unshift(c);
        localStorage.setItem(LS_CLIENTS, JSON.stringify(all));
      } catch (e) { console.warn('[SS] cache clients plein:', e.message); }
    },
    delete: function (key) {
      localStorage.setItem(LS_CLIENTS, JSON.stringify(localClients.list().filter(function (c) { return c.key !== key; })));
    },
  };

  // Factures
  const localFactures = {
    list: function () { try { return JSON.parse(localStorage.getItem(LS_FACTURES) || '[]'); } catch (e) { return []; } },
    get: function (id) { return localFactures.list().find(function (f) { return f.id === id; }) || null; },
    save: function (f) {
      try {
        const all = localFactures.list();
        const i = all.findIndex(function (x) { return x.id === f.id; });
        if (i !== -1) all[i] = f; else all.unshift(f);
        localStorage.setItem(LS_FACTURES, JSON.stringify(all));
      } catch (e) { console.warn('[SS] cache factures plein:', e.message); }
    },
    delete: function (id) {
      localStorage.setItem(LS_FACTURES, JSON.stringify(localFactures.list().filter(function (f) { return f.id !== id; })));
    },
  };

  const SS = {
    async listDevis() {
      try { return (await req('/devis')).data; }
      catch (e) { console.warn('[SS] listDevis → cache local:', e.message); return local.list(); }
    },
    async getDevis(id) {
      try { return (await req('/devis/' + id)).data; }
      catch (e) { console.warn('[SS] getDevis → cache local:', e.message); return local.get(id); }
    },
    async saveDevis(devis) {
      local.save(devis);
      try { return await req('/devis', { method: 'POST', body: JSON.stringify(devis) }); }
      catch (e) { console.warn('[SS] saveDevis hors-ligne:', e.message); return { ok: true, id: devis.id, offline: true }; }
    },
    async deleteDevis(id) {
      local.delete(id);
      try { return await req('/devis/' + id, { method: 'DELETE' }); }
      catch (e) { console.warn('[SS] deleteDevis hors-ligne:', e.message); return { ok: true, offline: true }; }
    },
    async updateStatus(id, statut) {
      const devis = await this.getDevis(id);
      if (!devis) return { ok: false, error: 'Devis introuvable' };
      devis.statut = statut;
      devis.date_modification = new Date().toISOString();
      return this.saveDevis(devis);
    },

    // ── COMMENTAIRES INTERNES (fil de discussion Nicolas / Yannick sur un devis) ──
    async addComment(id, opts) {
      opts = opts || {};
      const devis = await this.getDevis(id);
      if (!devis) return { ok: false, error: 'Devis introuvable' };
      devis.comments = devis.comments || [];
      devis.comments.push({
        id: Date.now(),
        author: opts.author || 'nicolas',
        text: (opts.text || '').trim(),
        type: opts.type || 'note',
        date: new Date().toISOString(),
      });
      devis.date_modification = new Date().toISOString();
      return this.saveDevis(devis);
    },
    async deleteComment(devisId, commentId) {
      const devis = await this.getDevis(devisId);
      if (!devis) return { ok: false, error: 'Devis introuvable' };
      devis.comments = (devis.comments || []).filter(function (c) { return String(c.id) !== String(commentId); });
      devis.date_modification = new Date().toISOString();
      return this.saveDevis(devis);
    },

    // ── CLIENTS (fiches d'enrichissement : contact, notes, tags) ──
    async listClients() {
      try { return (await req('/clients')).data; }
      catch (e) { console.warn('[SS] listClients → cache local:', e.message); return localClients.list(); }
    },
    async getClient(key) {
      try { return (await req('/clients/' + encodeURIComponent(key))).data; }
      catch (e) { return localClients.get(key); }
    },
    async saveClient(client) {
      localClients.save(client);
      try { return await req('/clients', { method: 'POST', body: JSON.stringify(client) }); }
      catch (e) { console.warn('[SS] saveClient hors-ligne:', e.message); return { ok: true, key: client.key, offline: true }; }
    },
    async deleteClient(key) {
      localClients.delete(key);
      try { return await req('/clients/' + encodeURIComponent(key), { method: 'DELETE' }); }
      catch (e) { return { ok: true, offline: true }; }
    },

    // ── FACTURES ──
    async listFactures() {
      try { return (await req('/factures')).data; }
      catch (e) { console.warn('[SS] listFactures → cache local:', e.message); return localFactures.list(); }
    },
    async getFacture(id) {
      try { return (await req('/factures/' + id)).data; }
      catch (e) { return localFactures.get(id); }
    },
    async saveFacture(f) {
      localFactures.save(f);
      try { return await req('/factures', { method: 'POST', body: JSON.stringify(f) }); }
      catch (e) { console.warn('[SS] saveFacture hors-ligne:', e.message); return { ok: true, id: f.id, offline: true }; }
    },
    async deleteFacture(id) {
      localFactures.delete(id);
      try { return await req('/factures/' + id, { method: 'DELETE' }); }
      catch (e) { return { ok: true, offline: true }; }
    },

    async getStats() {
      try { return (await req('/stats')).data; }
      catch (e) {
        console.warn('[SS] getStats → calcul local:', e.message);
        const all = local.list();
        const signes = all.filter(function (d) { return ['signe', 'termine'].includes(d.statut); });
        const ttc = function (d) { return (d.calculs && d.calculs.total_ttc) || d.total_ttc || 0; };
        return {
          total: all.length, signes: signes.length,
          ca_total_ttc: all.reduce(function (s, d) { return s + ttc(d); }, 0),
          ca_signe_ttc: signes.reduce(function (s, d) { return s + ttc(d); }, 0),
          by_status: {}, by_month: {},
        };
      }
    },
    async isOnline() {
      try { const r = await fetch(BASE + '/health', { credentials: 'same-origin' }); return r.ok; }
      catch (e) { return false; }
    },
  };

  window.SS = SS;
  SS.isOnline().then(function (on) {
    console.log('[SolariScreen] API ' + (on ? '✅ en ligne' : '⚠️ hors-ligne (cache local)'));
  });
})();
