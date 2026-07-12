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
  const LS_RDV = 'ss_rdv_cache';

  async function req(path, options) {
    const r = await fetch(BASE + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }, options || {}));
    let data;
    try { data = await r.json(); }
    catch (e) { const err = new Error('HTTP ' + r.status + ' — réponse non-JSON'); err.status = r.status; err.serverRejected = true; throw err; }
    if (!data.ok) { const err = new Error(data.error || ('HTTP ' + r.status)); err.status = r.status; err.serverRejected = true; throw err; }
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

  // ── Sonde "vraiment hors-ligne ?" ──
  // Quand la session Cloudflare Access EXPIRE, un fetch /api/* ne renvoie PAS une erreur serveur :
  // il meurt en TypeError "Failed to fetch" (redirection cross-origin vers la page de login → CORS),
  // EXACTEMENT comme une coupure réseau. Vérifié en conditions réelles sur la prod (12/07/2026).
  // Discriminateur fiable : un fichier statique (/assets/*, exempté d'Access) répond toujours tant
  // que le réseau fonctionne. Statique OK + API morte = session expirée, pas hors-ligne.
  async function isReallyOffline() {
    try {
      await fetch('/assets/img/logo-solariscreen.png?ping=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      return false; // le réseau répond → l'échec API vient d'Access/du serveur, pas du réseau
    } catch (e) { return true; }
  }
  const MSG_SESSION = 'Session expirée — recharge la page (F5) puis réessaie. Ta saisie est conservée.';

  // Lecture "stricte" réservée aux flux lecture→modification→écriture (addComment, updateStatus,
  // deleteComment) : un rejet SERVEUR (session Access expirée, erreur 500…) est propagé au lieu
  // d'être avalé silencieusement. Sans ça, ces fonctions retombaient sur le cache localStorage
  // (potentiellement vieux de plusieurs jours), y ajoutaient la modif, puis la RÉENREGISTRAIENT —
  // écrasant durablement tout ce qui existait réellement côté serveur, sans jamais afficher
  // d'erreur (l'écriture elle-même réussit). Seule une vraie panne réseau (hors-ligne réel, ex.
  // Mode Terrain sans connexion) garde le comportement de repli sur le cache local.
  async function getDevisForMutation(id) {
    try { return (await req('/devis/' + id)).data; }
    catch (e) {
      if (e && e.serverRejected) throw e;
      if (!(await isReallyOffline())) throw new Error(MSG_SESSION);
      console.warn('[SS] getDevis (mutation) → cache local:', e.message);
      return local.get(id);
    }
  }

  const SS = {
    async listDevis() {
      try { return (await req('/devis')).data; }
      catch (e) { console.warn('[SS] listDevis → cache local:', e.message); return local.list(); }
    },
    async getDevis(id) {
      try { return (await req('/devis/' + id)).data; }
      catch (e) { console.warn('[SS] getDevis → cache local:', e.message); return local.get(id); }
    },
    // opts.expectedDateModification : si fourni, le serveur refuse d'écraser si une version PLUS RÉCENTE
    // existe déjà (détection de conflit — 2 utilisateurs sur le même devis). Omis par défaut : comportement
    // inchangé (dernier écrit gagne) pour tous les appelants qui n'ont pas encore été adaptés.
    // opts.force : ignore la détection de conflit et écrase quand même (après confirmation utilisateur).
    async saveDevis(devis, opts) {
      opts = opts || {};
      local.save(devis);
      try {
        const payload = (!opts.force && opts.expectedDateModification !== undefined)
          ? Object.assign({}, devis, { _expected_date_modification: opts.expectedDateModification })
          : devis;
        return await req('/devis', { method: 'POST', body: JSON.stringify(payload) });
      }
      // Distinction cruciale (déjà appliquée dans deleteDevis, oubliée ici) : un rejet SERVEUR
      // (session Access expirée → page de login HTML au lieu de JSON, erreur 500, payload refusé…)
      // n'est PAS une panne réseau. Le traiter comme "hors-ligne, ok:true" masque un échec réel :
      // l'appelant croit avoir sauvegardé (toast succès, compteur incrémenté) alors que rien n'a
      // atteint le serveur — la donnée "disparaît" au prochain rechargement, qui lit l'état réel.
      catch (e) {
        if (e && e.serverRejected) { console.warn('[SS] saveDevis rejeté par le serveur:', e.message); return { ok: false, error: e.message }; }
        // TypeError "Failed to fetch" = hors-ligne OU session Access expirée (indistinguables
        // sans sonde — les deux meurent en erreur réseau). On tranche avec un fichier statique.
        if (await isReallyOffline()) {
          console.warn('[SS] saveDevis hors-ligne:', e.message);
          return { ok: true, id: devis.id, offline: true, error: e.message };
        }
        console.warn('[SS] saveDevis : réseau OK mais API injoignable (session Access expirée ?)');
        return { ok: false, error: MSG_SESSION };
      }
    },
    async deleteDevis(id) {
      try {
        const r = await req('/devis/' + id, { method: 'DELETE' });
        local.delete(id);   // ne supprime en local qu'APRÈS confirmation du serveur
        return r;
      } catch (e) {
        // Rejet explicite du serveur (ex. factures liées → 409) : NE PAS supprimer localement, remonter l'erreur.
        if (e && e.serverRejected) return { ok: false, error: e.message };
        // Session Access expirée (réseau OK, API morte) : ne rien supprimer, remonter l'erreur —
        // sinon le devis "supprimé" localement réapparaît au prochain chargement (jamais effacé serveur).
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        // Vrai hors-ligne (réseau) : suppression locale optimiste.
        local.delete(id);
        console.warn('[SS] deleteDevis hors-ligne:', e.message);
        return { ok: true, offline: true };
      }
    },
    // ── PHOTOS (R2) ── Best-effort : renvoie l'URL de service en cas de succès, `null` sinon (réseau
    // coupé, bucket non lié…). L'appelant garde alors le dataURL local — une photo n'est JAMAIS perdue,
    // juste pas encore déportée hors du blob JSON tant que le réseau ne revient pas.
    async uploadPhoto(ownerId, blob) {
      try {
        const fd = new FormData();
        fd.append('file', blob, 'photo.jpg');
        const r = await fetch(BASE + '/photos/' + encodeURIComponent(ownerId), { method: 'POST', body: fd, credentials: 'same-origin' });
        const data = await r.json();
        return (data && data.ok && data.url) ? data.url : null;
      } catch (e) { console.warn('[SS] uploadPhoto hors-ligne:', e.message); return null; }
    },
    async updateStatus(id, statut, by) {
      let devis;
      try { devis = await getDevisForMutation(id); }
      catch (e) { return { ok: false, error: e.message }; }
      if (!devis) return { ok: false, error: 'Devis introuvable' };
      devis.statut = statut;
      devis.date_modification = new Date().toISOString();
      devis.statut_history = devis.statut_history || [];
      devis.statut_history.push({ statut, date: devis.date_modification, by: by || null });
      return this.saveDevis(devis);
    },

    // ── COMMENTAIRES INTERNES (fil de discussion Nicolas / Yannick sur un devis) ──
    async addComment(id, opts) {
      opts = opts || {};
      let devis;
      try { devis = await getDevisForMutation(id); }
      catch (e) { return { ok: false, error: e.message }; }
      if (!devis) return { ok: false, error: 'Devis introuvable' };
      devis.comments = devis.comments || [];
      const comment = {
        // id unique même si deux commentaires sont créés dans la même milliseconde (Date.now()
        // seul pouvait collisionner → deleteComment en aurait supprimé deux d'un coup).
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
        author: opts.author || 'nicolas',
        text: (opts.text || '').trim(),
        type: opts.type || 'note',
        date: new Date().toISOString(),
      };
      // Opt-in explicite uniquement : absent/false → jamais exposé sur devis-review.html (voir
      // le filtre serveur dans /api/devis-review). N'écrit la clé que si vraie pour ne pas gonfler
      // inutilement le JSON stocké de milliers de `visible_client:false`.
      if (opts.visible_client === true) comment.visible_client = true;
      devis.comments.push(comment);
      devis.date_modification = new Date().toISOString();
      const res = await this.saveDevis(devis);
      // Renvoie aussi le devis complet à jour : évite à l'appelant de refaire un GET juste après ce
      // POST pour rafraîchir son affichage — un re-fetch immédiat après écriture peut renvoyer une
      // version D1 pas encore à jour (latence de propagation), ce qui ferait "disparaître" le
      // commentaire qu'on vient pourtant d'ajouter avec succès.
      return Object.assign({}, res, { data: devis });
    },
    async deleteComment(devisId, commentId) {
      let devis;
      try { devis = await getDevisForMutation(devisId); }
      catch (e) { return { ok: false, error: e.message }; }
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
    async whoAmI() {
      try { return (await req('/whoami')).data; }
      catch (e) { return { email: null }; }
    },
    async listConnections() {
      try { return (await req('/connections')).data; }
      catch (e) { return []; }
    },

    // ── JOURNAL D'ACTIVITÉ (qui a fait quoi) ──
    // "fire and forget" : ne bloque jamais l'action utilisateur, ignore silencieusement les
    // erreurs (hors-ligne). L'acteur (nicolas/yannick) est ajouté côté serveur via Access.
    logActivity(evt) {
      try { req('/activity', { method: 'POST', body: JSON.stringify(evt) }).catch(function () {}); } catch (e) {}
    },
    // Renvoie null en cas d'échec réseau/API (à distinguer d'un [] « vraiment rien de neuf ») :
    // permet à checkWhatsNew de NE PAS avancer le marqueur « déjà vu » sur une erreur transitoire.
    async listActivity(since) {
      try { return (await req('/activity' + (since ? '?since=' + encodeURIComponent(since) : ''))).data || []; }
      catch (e) { return null; }
    },

    // ── RDV (demandes de visite / leads avant devis) ──
    async listRdv() {
      try { return (await req('/rdv')).data; }
      catch (e) { console.warn('[SS] listRdv → cache local:', e.message); return localRdv.list(); }
    },
    async getRdv(id) {
      try { return (await req('/rdv/' + encodeURIComponent(id))).data; }
      catch (e) { return localRdv.get(id); }
    },
    async saveRdv(rdv) {
      localRdv.save(rdv);
      try { return await req('/rdv', { method: 'POST', body: JSON.stringify(rdv) }); }
      catch (e) { console.warn('[SS] saveRdv hors-ligne:', e.message); return { ok: true, id: rdv.id, offline: true, error: e.message }; }
    },
    async deleteRdv(id) {
      localRdv.delete(id);
      try { return await req('/rdv/' + encodeURIComponent(id), { method: 'DELETE' }); }
      catch (e) { return { ok: true, offline: true }; }
    },
  };

  const localRdv = {
    list: function () { try { return JSON.parse(localStorage.getItem(LS_RDV) || '[]'); } catch (e) { return []; } },
    get: function (id) { return localRdv.list().find(function (r) { return r.id === id; }) || null; },
    save: function (rdv) {
      try {
        const all = localRdv.list();
        const i = all.findIndex(function (r) { return r.id === rdv.id; });
        if (i !== -1) all[i] = rdv; else all.unshift(rdv);
        localStorage.setItem(LS_RDV, JSON.stringify(all));
      } catch (e) { console.warn('[SS] cache RDV plein:', e.message); }
    },
    delete: function (id) {
      localStorage.setItem(LS_RDV, JSON.stringify(localRdv.list().filter(function (r) { return r.id !== id; })));
    },
  };

  window.SS = SS;
  SS.isOnline().then(function (on) {
    console.log('[SolariScreen] API ' + (on ? '✅ en ligne' : '⚠️ hors-ligne (cache local)'));
  });
})();
