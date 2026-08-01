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
  const LS_OUTILLAGE = 'ss_outillage_cache';
  const LS_OUTBOX = 'ss_outbox';   // ce qui est écrit LOCALEMENT mais pas encore parti au serveur

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     FILE D'ATTENTE D'ENVOI (« outbox »)
     ─────────────────────────────────────────────────────────────────────────────────────────
     Sans elle, un devis créé chez un client SANS RÉSEAU était écrit dans le téléphone… et
     n'atteignait JAMAIS le serveur : au retour du réseau la liste venait de la base, et le devis
     disparaissait même de l'écran. Vérifié, c'était une vraie perte de travail.
     Désormais : tout enregistrement qui échoue faute de réseau laisse une trace ici, et repart
     tout seul dès que la connexion revient. On ne met en file QUE le vrai hors-ligne — un rejet
     du serveur (session Access expirée, données refusées) doit rester une erreur visible, pas
     une promesse d'envoi qui n'aboutira jamais.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  const outbox = {
    lire: function () { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || '[]'); } catch (e) { return []; } },
    ecrire: function (l) { try { localStorage.setItem(LS_OUTBOX, JSON.stringify(l)); } catch (e) {} },
    // `type` = 'devis' | 'client' | 'facture' | 'rdv' ; `ref` = id ou clé. Jamais de doublon.
    ajouter: function (type, ref) {
      const l = outbox.lire();
      if (!l.some(function (x) { return x.type === type && x.ref === ref; })) {
        l.push({ type: type, ref: ref, depuis: new Date().toISOString() });
        outbox.ecrire(l);
      }
    },
    retirer: function (type, ref) {
      outbox.ecrire(outbox.lire().filter(function (x) { return !(x.type === type && x.ref === ref); }));
    },
    compte: function () { return outbox.lire().length; },
  };

  async function req(path, options) {
    // Cache-buster : un paramètre unique par appel rend chaque URL inédite → aucun cache
    // (navigateur, CDN, ou service worker fantôme d'une ancienne PWA qui matcherait par URL)
    // ne peut resservir une réponse API périmée. Le backend ignore la query string.
    const bust = (path.indexOf('?') !== -1 ? '&' : '?') + '_=' + Date.now();
    const r = await fetch(BASE + path + bust, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
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
          outbox.ajouter('devis', devis.id);   // repartira tout seul au retour du réseau
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
    // ⚠️ ARCHITECTURE (corrige le bug « les notes disparaissent ») : un commentaire n'est PLUS
    // ajouté en relisant le devis complet puis en le réécrivant entièrement (ce chemin
    // « lecture → modification → réécriture » perdait la note dès qu'une autre écriture, ou une
    // lecture périmée, s'intercalait). On appelle une route dédiée qui fait une écriture CIBLÉE
    // côté serveur (json_insert sur la seule ligne concernée) — c'est le mécanisme, prouvé stable
    // en production, déjà utilisé par le lien client (/api/devis-review). Rien ne peut plus
    // écraser un commentaire.
    async addComment(id, opts) {
      opts = opts || {};
      const payload = { author: opts.author || 'nicolas', text: (opts.text || '').trim(), type: opts.type || 'note' };
      if (opts.visible_client === true) payload.visible_client = true;
      if (!payload.text) return { ok: false, error: 'Message vide' };
      try {
        const res = await req('/devis/' + encodeURIComponent(id) + '/comment', { method: 'POST', body: JSON.stringify(payload) });
        // Reflète le commentaire dans le cache local (affichage hors-ligne ultérieur).
        try { const d = local.get(id); if (d) { d.comments = d.comments || []; d.comments.push(res.comment); local.save(d); } } catch (e) {}
        return res; // { ok:true, comment, comments_count }
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (await isReallyOffline()) {
          // Vrai hors-ligne : commentaire gardé en local, visible sur cet appareil.
          const comment = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
            author: payload.author, text: payload.text, type: payload.type, date: new Date().toISOString(),
          };
          if (payload.visible_client) comment.visible_client = true;
          try { const d = local.get(id); if (d) { d.comments = d.comments || []; d.comments.push(comment); local.save(d); } } catch (e2) {}
          return { ok: true, offline: true, comment };
        }
        return { ok: false, error: MSG_SESSION };
      }
    },
    async deleteComment(devisId, commentId) {
      try {
        const res = await req('/devis/' + encodeURIComponent(devisId) + '/comment/' + encodeURIComponent(commentId), { method: 'DELETE' });
        try { const d = local.get(devisId); if (d && d.comments) { d.comments = d.comments.filter(function (c) { return String(c.id) !== String(commentId); }); local.save(d); } } catch (e) {}
        return res;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (await isReallyOffline()) {
          try { const d = local.get(devisId); if (d && d.comments) { d.comments = d.comments.filter(function (c) { return String(c.id) !== String(commentId); }); local.save(d); } } catch (e2) {}
          return { ok: true, offline: true };
        }
        return { ok: false, error: MSG_SESSION };
      }
    },

    // ── TICKETS SAV ──
    // Même architecture que les commentaires : écriture CIBLÉE côté serveur (route dédiée), pour
    // qu'un ticket ne puisse pas être écrasé par un enregistrement du devis complet fait ailleurs.
    // `ticket.id` absent = création ; présent = modification (édition ou changement de statut).
    async saveSavTicket(devisId, ticket) {
      try {
        return await req('/devis/' + encodeURIComponent(devisId) + '/sav', { method: 'POST', body: JSON.stringify(ticket || {}) });
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : le ticket SAV sera à ressaisir une fois la connexion revenue.' };
      }
    },
    async deleteSavTicket(devisId, ticketId) {
      try {
        return await req('/devis/' + encodeURIComponent(devisId) + '/sav/' + encodeURIComponent(ticketId), { method: 'DELETE' });
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : suppression impossible pour le moment.' };
      }
    },

    // ── JOURNAL DE CHANTIER (photos annotées prises pendant/après la pose) ──
    // Même architecture ciblée que les tickets SAV : la photo est d'abord déportée dans R2
    // (SSUI.compressAndUploadPhoto → uploadPhoto), puis SEULE sa métadonnée (url + note + phase +
    // date) est envoyée ici → écriture ciblée côté serveur, jamais le devis complet. `entry.id`
    // absent = ajout d'une photo ; présent = modification de l'annotation/phase/date.
    async saveChantierPhoto(devisId, entry) {
      try {
        return await req('/devis/' + encodeURIComponent(devisId) + '/chantier-photo', { method: 'POST', body: JSON.stringify(entry || {}) });
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : la photo de chantier sera à ajouter une fois la connexion revenue.' };
      }
    },
    async deleteChantierPhoto(devisId, photoId) {
      try {
        return await req('/devis/' + encodeURIComponent(devisId) + '/chantier-photo/' + encodeURIComponent(photoId), { method: 'DELETE' });
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : suppression impossible pour le moment.' };
      }
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
    // Même discipline que saveDevis (voir le commentaire détaillé plus haut) : un rejet SERVEUR
    // ou une session Access expirée ne doivent JAMAIS être présentés comme un enregistrement réussi.
    async saveClient(client) {
      localClients.save(client);
      try { return await req('/clients', { method: 'POST', body: JSON.stringify(client) }); }
      catch (e) {
        if (e && e.serverRejected) { console.warn('[SS] saveClient rejeté par le serveur:', e.message); return { ok: false, error: e.message }; }
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        console.warn('[SS] saveClient hors-ligne:', e.message);
        outbox.ajouter('client', client.key);
        return { ok: true, key: client.key, offline: true };
      }
    },
    // ── ÉCHANGES E-MAIL DU CLIENT ──
    // Même architecture que addComment : route CIBLÉE côté serveur (json_insert), jamais de
    // relecture-réécriture de la fiche complète — un mail archivé ne peut donc pas disparaître
    // parce que quelqu'un enregistre la fiche au même moment depuis un autre écran.
    async addClientMail(key, mail) {
      const payload = {
        sens: mail.sens === 'envoye' ? 'envoye' : 'recu',
        objet: (mail.objet || '').trim(), de: (mail.de || '').trim(),
        date_mail: (mail.date_mail || '').trim(), texte: (mail.texte || '').trim(),
        devis_id: mail.devis_id || '', par: mail.par || 'nicolas',
      };
      if (!payload.texte) return { ok: false, error: 'Message vide' };
      try {
        const res = await req('/clients/' + encodeURIComponent(key) + '/mail', { method: 'POST', body: JSON.stringify(payload) });
        try { const c = localClients.get(key); if (c) { c.mails = c.mails || []; c.mails.push(res.mail); localClients.save(c); } } catch (e) {}
        return res;   // { ok:true, mail, mails_count }
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (await isReallyOffline()) {
          // Vrai hors-ligne : on garde le mail sur cet appareil, visible immédiatement.
          const m = Object.assign({}, payload, {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
            date: new Date().toISOString(),
          });
          try { const c = localClients.get(key); if (c) { c.mails = c.mails || []; c.mails.push(m); localClients.save(c); } } catch (e2) {}
          return { ok: true, mail: m, offline: true };
        }
        return { ok: false, error: MSG_SESSION };
      }
    },
    async deleteClientMail(key, mailId) {
      try {
        const res = await req('/clients/' + encodeURIComponent(key) + '/mail/' + encodeURIComponent(mailId), { method: 'DELETE' });
        try { const c = localClients.get(key); if (c && Array.isArray(c.mails)) { c.mails = c.mails.filter(x => String(x.id) !== String(mailId)); localClients.save(c); } } catch (e) {}
        return res;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        try { const c = localClients.get(key); if (c && Array.isArray(c.mails)) { c.mails = c.mails.filter(x => String(x.id) !== String(mailId)); localClients.save(c); } } catch (e2) {}
        return { ok: true, offline: true };
      }
    },
    async deleteClient(key) {
      try {
        const r = await req('/clients/' + encodeURIComponent(key), { method: 'DELETE' });
        localClients.delete(key);   // suppression locale seulement APRÈS confirmation du serveur
        return r;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        localClients.delete(key);
        return { ok: true, offline: true };
      }
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
    // ⚠️ CRITIQUE côté comptable : une facture « créée » qui n'a jamais atteint le serveur fait
    // réattribuer son numéro (F2026-014) à la facture suivante → deux pièces au même numéro.
    // D'où la même distinction stricte que saveDevis entre rejet serveur et vraie panne réseau.
    async saveFacture(f) {
      localFactures.save(f);
      try { return await req('/factures', { method: 'POST', body: JSON.stringify(f) }); }
      catch (e) {
        if (e && e.serverRejected) { console.warn('[SS] saveFacture rejetée par le serveur:', e.message); return { ok: false, error: e.message }; }
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        console.warn('[SS] saveFacture hors-ligne:', e.message);
        outbox.ajouter('facture', f.id);
        return { ok: true, id: f.id, offline: true };
      }
    },
    async deleteFacture(id) {
      try {
        const r = await req('/factures/' + id, { method: 'DELETE' });
        localFactures.delete(id);   // suppression locale seulement APRÈS confirmation du serveur
        return r;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        localFactures.delete(id);
        return { ok: true, offline: true };
      }
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
      catch (e) {
        if (e && e.serverRejected) { console.warn('[SS] saveRdv rejeté par le serveur:', e.message); return { ok: false, error: e.message }; }
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        console.warn('[SS] saveRdv hors-ligne:', e.message);
        outbox.ajouter('rdv', rdv.id);
        return { ok: true, id: rdv.id, offline: true, error: e.message };
      }
    },
    async deleteRdv(id) {
      try {
        const r = await req('/rdv/' + encodeURIComponent(id), { method: 'DELETE' });
        localRdv.delete(id);   // suppression locale seulement APRÈS confirmation du serveur
        return r;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        localRdv.delete(id);
        return { ok: true, offline: true };
      }
    },

    // ── ÉCHANGE INTERNE SUR UNE DEMANDE DE RDV (Nicolas ↔ Yannick) ──
    // Même architecture que les commentaires de devis : écriture CIBLÉE côté serveur, donc deux
    // personnes peuvent écrire en même temps sans qu'un message soit écrasé.
    // `ask` = à qui on demande une réponse ('nicolas' | 'yannick' | '' pour ne rien demander).
    async addRdvComment(rdvId, opts) {
      opts = opts || {};
      const payload = {
        author: opts.author || 'nicolas', text: (opts.text || '').trim(),
        kind: opts.kind || 'note', ask: opts.ask || '',
      };
      if (!payload.text) return { ok: false, error: 'Message vide' };
      try {
        const res = await req('/rdv/' + encodeURIComponent(rdvId) + '/comment', { method: 'POST', body: JSON.stringify(payload) });
        try { const r = localRdv.get(rdvId); if (r) { r.comments = (r.comments || []).concat([res.comment]); localRdv.save(r); } } catch (e) {}
        return res;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : le message sera à renvoyer une fois la connexion revenue.' };
      }
    },
    async deleteRdvComment(rdvId, commentId) {
      try {
        const res = await req('/rdv/' + encodeURIComponent(rdvId) + '/comment/' + encodeURIComponent(commentId), { method: 'DELETE' });
        try { const r = localRdv.get(rdvId); if (r && r.comments) { r.comments = r.comments.filter(function (c) { return String(c.id) !== String(commentId); }); localRdv.save(r); } } catch (e) {}
        return res;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        return { ok: false, error: 'Hors-ligne : suppression impossible pour le moment.' };
      }
    },

    // ── OUTILLAGE (carnet de références perso : visserie, fixations, outils…) ──
    async listOutillage() {
      try { return (await req('/outillage')).data; }
      catch (e) { console.warn('[SS] listOutillage → cache local:', e.message); return localOutillage.list(); }
    },
    async saveOutillage(o) {
      localOutillage.save(o);
      try { return await req('/outillage', { method: 'POST', body: JSON.stringify(o) }); }
      catch (e) {
        if (e && e.serverRejected) { console.warn('[SS] saveOutillage rejeté par le serveur:', e.message); return { ok: false, error: e.message }; }
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        console.warn('[SS] saveOutillage hors-ligne:', e.message);
        return { ok: true, id: o.id, offline: true };
      }
    },
    async deleteOutillage(id) {
      try {
        const r = await req('/outillage/' + encodeURIComponent(id), { method: 'DELETE' });
        localOutillage.delete(id);   // suppression locale seulement APRÈS confirmation du serveur
        return r;
      } catch (e) {
        if (e && e.serverRejected) return { ok: false, error: e.message };
        if (!(await isReallyOffline())) return { ok: false, error: MSG_SESSION };
        localOutillage.delete(id);
        return { ok: true, offline: true };
      }
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

  const localOutillage = {
    list: function () { try { return JSON.parse(localStorage.getItem(LS_OUTILLAGE) || '[]'); } catch (e) { return []; } },
    get: function (id) { return localOutillage.list().find(function (o) { return o.id === id; }) || null; },
    save: function (o) {
      try {
        const all = localOutillage.list();
        const i = all.findIndex(function (x) { return x.id === o.id; });
        if (i !== -1) all[i] = o; else all.unshift(o);
        localStorage.setItem(LS_OUTILLAGE, JSON.stringify(all));
      } catch (e) { console.warn('[SS] cache outillage plein:', e.message); }
    },
    delete: function (id) {
      localStorage.setItem(LS_OUTILLAGE, JSON.stringify(localOutillage.list().filter(function (o) { return o.id !== id; })));
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     RENVOI DE LA FILE D'ATTENTE
     ─────────────────────────────────────────────────────────────────────────────────────────
     Rejoue les enregistrements restés bloqués faute de réseau, en repartant de la copie LOCALE
     (le cache est la source de vérité tant que le serveur ne l'a pas reçue).
     · Aucune détection de conflit ici : le serveur ne connaît pas encore ces enregistrements, et
       `upsertDevis` fusionne clé par clé — un renvoi ne peut donc rien écraser d'autre.
     · Idempotent : renvoyer deux fois le même id ne crée pas de doublon (INSERT … ON CONFLICT).
     · Un élément introuvable en local est retiré de la file (sinon elle ne se viderait jamais).
     · En cas d'échec, on s'arrête et on retentera : pas de boucle, pas de martèlement du réseau.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  SS.pendingCount = function () { return outbox.compte(); };
  SS.pendingList = function () { return outbox.lire(); };
  let syncEnCours = false;
  SS.syncOutbox = async function () {
    if (syncEnCours) return { ok: true, envoyes: 0, restants: outbox.compte(), deja: true };
    const file = outbox.lire();
    if (!file.length) return { ok: true, envoyes: 0, restants: 0 };
    syncEnCours = true;
    let envoyes = 0, echec = null;
    try {
      for (const item of file) {
        let corps = null, chemin = null;
        if (item.type === 'devis') { corps = local.get(item.ref); chemin = '/devis'; }
        else if (item.type === 'client') { corps = localClients.get(item.ref); chemin = '/clients'; }
        else if (item.type === 'facture') { corps = localFactures.get(item.ref); chemin = '/factures'; }
        else if (item.type === 'rdv') { corps = localRdv.get(item.ref); chemin = '/rdv'; }
        if (!corps || !chemin) { outbox.retirer(item.type, item.ref); continue; }
        try {
          await req(chemin, { method: 'POST', body: JSON.stringify(corps) });
          outbox.retirer(item.type, item.ref);
          envoyes++;
        } catch (e) {
          // Toujours pas de réseau, ou session Access expirée : on laisse en file et on arrête là.
          echec = e.message; break;
        }
      }
    } finally { syncEnCours = false; }
    const restants = outbox.compte();
    if (envoyes) console.log('[SolariScreen] file d\'attente : ' + envoyes + ' envoi(s) rattrapé(s), ' + restants + ' restant(s)');
    // Signal pour l'interface (bandeau du Mode Terrain, toasts…) sans coupler api.js à l'UI.
    try { window.dispatchEvent(new CustomEvent('ss-outbox', { detail: { envoyes: envoyes, restants: restants, erreur: echec } })); } catch (e) {}
    return { ok: !echec || envoyes > 0, envoyes: envoyes, restants: restants, error: echec };
  };

  window.SS = SS;
  SS.isOnline().then(function (on) {
    console.log('[SolariScreen] API ' + (on ? '✅ en ligne' : '⚠️ hors-ligne (cache local)'));
    if (on) SS.syncOutbox();   // au chargement : on rattrape ce qui n'était pas parti
  });
  // Le navigateur signale le retour du réseau → on retente immédiatement.
  window.addEventListener('online', function () { SS.syncOutbox(); });
  // iPhone : « online » ne se déclenche pas toujours au réveil de l'écran ou au retour dans
  // l'application. Le retour au premier plan est le moment le plus fiable pour retenter.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && outbox.compte()) SS.syncOutbox();
  });
})();
