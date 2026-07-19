// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Client API
// Inclure dans dashboard.html, calculateur.html, show.html, pdf.html
// <script src="assets/api.js"></script>
// ═══════════════════════════════════════════════════════════

const SS_API = (() => {

  const BASE = 'https://solariscreen-api.nicolas-struelens.workers.dev/api';

  // ── Helper fetch JSON ──
  async function req(path, options = {}) {
    const r = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  // ── Fallback localStorage (offline / dev) ──
  function localList()       { return JSON.parse(localStorage.getItem('solariscreen_devis') || '[]'); }
  function localGet(id)      { return localList().find(d => d.id === id) || null; }
  function localSave(devis)  {
    try {
      const all = localList();
      const idx = all.findIndex(d => d.id === devis.id);
      if (idx !== -1) all[idx] = devis; else all.unshift(devis);
      localStorage.setItem('solariscreen_devis', JSON.stringify(all));
    } catch(e) {
      // QuotaExceededError fréquent si les photos (base64) sont volumineuses — on ignore silencieusement
      console.warn('[SS_API] localSave ignoré (localStorage plein?):', e.message);
    }
  }
  function localDelete(id)   {
    localStorage.setItem('solariscreen_devis',
      JSON.stringify(localList().filter(d => d.id !== id)));
  }

  return {

    // Lister tous les devis (résumé)
    async listDevis() {
      try {
        const res = await req('/devis');
        return res.data;
      } catch(e) {
        console.warn('[SS_API] listDevis fallback localStorage:', e.message);
        return localList();
      }
    },

    // Lire un devis complet
    async getDevis(id) {
      try {
        const res = await req(`/devis/${id}`);
        return res.data;
      } catch(e) {
        console.warn('[SS_API] getDevis fallback localStorage:', e.message);
        return localGet(id);
      }
    },

    // Sauvegarder (créer ou mettre à jour)
    async saveDevis(devis) {
      try {
        const res = await req('/devis', {
          method: 'POST',
          body: JSON.stringify(devis)
        });
        // Garder aussi en local comme cache
        localSave(devis);
        return res;
      } catch(e) {
        console.warn('[SS_API] saveDevis fallback localStorage:', e.message);
        localSave(devis);
        return { ok: true, id: devis.id, offline: true };
      }
    },

    // Changer le statut uniquement
    async updateStatus(id, statut) {
      try {
        const devis = await this.getDevis(id);
        if (!devis) throw new Error('Devis introuvable');
        devis.statut = statut;
        devis.date_modification = new Date().toISOString();
        return await this.saveDevis(devis);
      } catch(e) {
        console.error('[SS_API] updateStatus error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // Supprimer un devis
    async deleteDevis(id) {
      try {
        const res = await req(`/devis/${id}`, { method: 'DELETE' });
        localDelete(id);
        return res;
      } catch(e) {
        console.warn('[SS_API] deleteDevis fallback localStorage:', e.message);
        localDelete(id);
        return { ok: true, offline: true };
      }
    },

    // Statistiques globales
    async getStats() {
      try {
        const res = await req('/stats');
        return res.data;
      } catch(e) {
        // Calcul local en fallback
        const all = localList();
        const signes = all.filter(d => d.statut === 'signe');
        const ca = signes.reduce((s,d) => s + (d.calculs?.total_ttc || d.total_ttc || 0), 0);
        const enCours = all.filter(d => !['signe','refuse','annule','termine'].includes(d.statut));
        return {
          total: all.length, signes: signes.length, ca_signe: ca,
          en_cours: enCours.length,
          taux_signature: all.length > 0 ? Math.round((signes.length/all.length)*100) : 0
        };
      }
    },

    // Vérifier si l'API est disponible
    async isOnline() {
      try {
        const r = await fetch(BASE + '/health');
        return r.ok;
      } catch { return false; }
    },

    // ══════════════════════════════════════
    // COMMENTAIRES — ajouter / supprimer
    // ══════════════════════════════════════
    async addComment(id, { author, text, type }) {
      try {
        const devis = await this.getDevis(id);
        if (!devis) throw new Error('Devis introuvable');
        if (!devis.comments) devis.comments = [];
        devis.comments.push({
          id:     Date.now(),
          author: author || 'nicolas',
          text:   (text  || '').trim(),
          type:   type   || 'note',
          date:   new Date().toISOString()
        });
        devis.date_modification = new Date().toISOString();
        return await this.saveDevis(devis);
      } catch(e) {
        console.error('[SS_API] addComment error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    async deleteComment(devisId, commentId) {
      try {
        const devis = await this.getDevis(devisId);
        if (!devis) throw new Error('Devis introuvable');
        devis.comments = (devis.comments || []).filter(c => String(c.id) !== String(commentId));
        devis.date_modification = new Date().toISOString();
        return await this.saveDevis(devis);
      } catch(e) {
        console.error('[SS_API] deleteComment error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // ══════════════════════════════════════
    // MIGRATION localStorage → API
    // Appeler une seule fois depuis le dashboard
    // ══════════════════════════════════════
    async migrateFromLocalStorage(onProgress) {
      const local = localList();
      if (local.length === 0) return { migrated: 0, errors: 0, total: 0, errorDetails: [] };

      let migrated = 0, errors = 0;
      const errorDetails = [];

      for (const devis of local) {
        try {
          const r = await fetch('/api/devis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(devis)
          });
          // Essayer de parser la réponse même en cas d'erreur HTTP
          let data;
          try { data = await r.json(); } catch { data = { ok: false, error: `HTTP ${r.status} — réponse non-JSON` }; }

          if (data.ok) {
            migrated++;
          } else {
            errors++;
            errorDetails.push({ id: devis.id, error: data.error || `HTTP ${r.status}` });
          }
        } catch(e) {
          errors++;
          errorDetails.push({ id: devis.id, error: e.message });
        }
        if (onProgress) onProgress(migrated + errors, local.length, devis);
      }

      return { migrated, errors, total: local.length, errorDetails };
    }
  };
})();

// Exposer globalement
window.SS_API = SS_API;

// Indicateur de connexion API (discret, en console)
SS_API.isOnline().then(online => {
  console.log(`[SolariScreen] API ${online ? '✅ connectée' : '⚠️ hors ligne (localStorage)'}`);
});
