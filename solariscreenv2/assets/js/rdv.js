// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LES DEMANDES DE RDV
// Script classique (file:// OK). Global : window.SSRdv
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// Ce que la page Demandes de RDV décide : chercher une demande, dire ce qu'il faut faire ensuite,
// ranger une colonne par urgence, garder « Converti » lisible, résumer les contacts avec le client,
// repérer un doublon à la saisie, lister les visites d'aujourd'hui et de demain. Des fonctions PURES
// testées (`tests/rdv.test.html`). « Qui doit agir » reste dans `attente.js` (règle 15), le lien
// avec le devis aussi (`SSAttente.devisDeRdv`, règle 17), la règle des doublons dans `ui.js`.
// Règle 54 de CLAUDE.md.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  const A = function () { return window.SSAttente; };

  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  const chiffres = function (s) { return String(s == null ? '' : s).replace(/\D/g, ''); };

  /** Le jour LOCAL d'un instant ou d'une date (« 2026-10-27 »). Une chaîne déjà au format jour reste
   *  telle quelle : la convertir en Date la lirait en UTC (règle 18). */
  function jour(v) {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(v))) return String(v).slice(0, 10);   // datetime-local, heure locale
    const d = new Date(v);
    if (!isFinite(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** Jours entre deux jours locaux (b − a). */
  function ecartJours(a, b) {
    if (!a || !b) return 0;
    const t = function (x) { const p = x.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
    return Math.round((t(b) - t(a)) / 86400000);
  }
  function plusJours(j, n) {
    const p = j.split('-'); const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function heure(v) { const m = /T(\d{2}:\d{2})/.exec(String(v || '')); return m ? m[1] : ''; }
  function nom(c) { const o = c || {}; return ((o.prenom || '') + ' ' + (o.nom || '')).trim() || 'Sans nom'; }

  /* ── C — Chercher : sans accents, mot à mot ; un mot en chiffres se cherche aussi dans le téléphone
     écrit sans espaces (« 0477123 » trouve « 0477 12 34 56 »). Le projet et la source aussi : on se
     souvient de « la véranda de Wavre » plus que du nom. */
  function correspond(r, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const c = (r && r.client) || {}, a = c.adresse || {};
    const foin = sansAccents([c.prenom, c.nom, c.telephone, c.email, a.rue, a.code_postal, a.ville, r && r.projet, r && r.source].join(' '));
    const tel = chiffres(c.telephone);
    return mots.every(function (m) { return foin.indexOf(m) >= 0 || (/^\d{3,}$/.test(m) && tel.indexOf(m) >= 0); });
  }

  /* ── C — Les contacts avec le client ─────────────────────────────────────────────────────────── */
  const CANAUX = { sms: 'SMS', email: 'E-mail', wa: 'WhatsApp', appel: 'Appel', copie: 'Message copié' };
  const TYPES = { creneaux: 'créneaux proposés', confirmation: 'confirmation', rappel: 'rappel de la veille', relance: 'relance', appel: 'appel' };
  function quand(iso, auj) {
    const n = ecartJours(jour(iso), auj);
    return n <= 0 ? 'aujourd’hui' : (n === 1 ? 'hier' : 'il y a ' + n + ' j');
  }
  /** « SMS hier » — le canal et le moment du DERNIER contact ; `null` s'il n'y en a aucun. */
  function resumeContact(r, auj) {
    const c = A().dernierContact(r);
    if (!c) return null;
    return { texte: (CANAUX[c.canal] || c.canal) + ' ' + quand(c.date, auj), nombre: (r.contacts || []).length, jours: ecartJours(jour(c.date), auj) };
  }

  /* ── Ce qu'il faut faire ensuite — UNE phrase, dite une fois (règle 40 bis) ──────────────────────
     `ton` : 'danger' (ça se perd), 'warn' (à toi de pousser), 'accent' (à faire de mon côté),
     'ok' (gagné), 'neutre' (rien à faire ou on attend le client). */
  function prochaineAction(r, lien, auj) {
    if (!r) return { texte: '', ton: 'neutre' };
    const st = r.statut || 'nouveau';
    if (st === 'annule') return { texte: 'Annulée', ton: 'neutre' };
    if (lien && lien.devis && (st === 'visite' || st === 'converti')) {
      const ds = String(lien.devis.statut || 'brouillon');
      const lib = (U().STATUT_DEVIS_LABEL || {})[ds] || ds;
      if (ds === 'brouillon') return { texte: 'Devis à envoyer', ton: 'warn' };
      if (ds === 'signe' || ds === 'termine') return { texte: 'Devis ' + lib.toLowerCase(), ton: 'ok' };
      if (ds === 'refuse' || ds === 'annule') return { texte: 'Devis ' + lib.toLowerCase(), ton: 'neutre' };
      return { texte: 'Devis ' + lib.toLowerCase() + ' — à suivre', ton: 'neutre' };
    }
    if (st === 'converti') return { texte: 'Converti sans devis — créer le devis', ton: 'warn' };
    if (st === 'visite') return { texte: 'Créer le devis', ton: 'accent' };
    if (st === 'rdv_fixe') {
      const j = jour(r.date_rdv), h = heure(r.date_rdv);
      if (!j) return { texte: 'Visite à dater', ton: 'warn' };
      const n = ecartJours(auj, j);
      if (n < 0) return { texte: 'Visite passée — la marquer faite', ton: 'warn' };
      if (n === 0) return { texte: 'Visite aujourd’hui' + (h ? ' à ' + h : ''), ton: 'accent' };
      if (n === 1) return A().rappelEnvoye(r) ? { texte: 'Visite demain' + (h ? ' à ' + h : '') + ' — rappel envoyé', ton: 'neutre' }
        : { texte: 'Visite demain' + (h ? ' à ' + h : '') + ' — envoyer le rappel', ton: 'warn' };
      return { texte: 'Visite le ' + U().fmtDate(j).slice(0, 5) + (h ? ' à ' + h : ''), ton: 'neutre' };
    }
    // nouveau / à contacter
    if (!r.assigned_to) return { texte: 'Personne dessus — à prendre', ton: 'danger' };
    if (r.date_rdv) return { texte: 'Visite le ' + U().fmtDate(jour(r.date_rdv)).slice(0, 5) + ' — passer en « RDV fixé »', ton: 'warn' };
    const c = A().dernierContact(r);
    if (!c) return { texte: 'À contacter', ton: 'warn' };
    const n = ecartJours(jour(c.date), auj);
    return n >= A().SEUILS.CONTACT_RELANCE_J ? { texte: 'Sans réponse — relancer', ton: 'warn' } : { texte: 'En attente du client', ton: 'neutre' };
  }

  /* ── F — Une colonne se lit du plus urgent au moins urgent ─────────────────────────────────────
     Avant : l'ordre de la dernière modification. Le lead que personne n'a pris depuis hier passait
     sous celui qu'on venait de renommer. */
  function trierColonne(liste, statut) {
    const l = (liste || []).slice();
    const txt = function (v) { return String(v || ''); };
    if (statut === 'nouveau' || statut === 'a_contacter') {
      return l.sort(function (a, b) {
        const pa = a.assigned_to ? 1 : 0, pb = b.assigned_to ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return txt(a.date_creation).localeCompare(txt(b.date_creation));
      });
    }
    if (statut === 'rdv_fixe' || statut === 'visite') {
      // La visite la plus proche (fixé) ou la plus ancienne (visité, donc le devis qui attend le plus) d'abord ;
      // une date manquante en dernier.
      return l.sort(function (a, b) {
        if (!a.date_rdv !== !b.date_rdv) return a.date_rdv ? -1 : 1;
        return txt(a.date_rdv).localeCompare(txt(b.date_rdv));
      });
    }
    return l.sort(function (a, b) { return txt(b.statut_le || b.date_modification).localeCompare(txt(a.statut_le || a.date_modification)); });
  }
  /** « Converti » et « Annulé » ne gardent à l'écran que les `jours` derniers jours : le reste attend
   *  derrière « plus anciennes ». La date est celle du changement d'étape (`statut_le`), pas la dernière
   *  modification — une photo ajoutée ne rend pas une demande récente. */
  function recents(liste, auj, jours) {
    const limite = plusJours(auj, -(jours == null ? 30 : jours));
    const out = { recents: [], anciens: [] };
    (liste || []).forEach(function (r) { (jour(r.statut_le || r.date_modification) >= limite ? out.recents : out.anciens).push(r); });
    return out;
  }

  /* ── E — Les visites d'aujourd'hui et de demain, à l'heure ─────────────────────────────────────── */
  function visitesProches(rdvs, auj) {
    const dem = plusJours(auj, 1);
    return (rdvs || []).filter(function (r) { return r && r.statut === 'rdv_fixe' && (jour(r.date_rdv) === auj || jour(r.date_rdv) === dem); })
      .sort(function (a, b) { return String(a.date_rdv).localeCompare(String(b.date_rdv)); })
      .map(function (r) { return { r: r, jour: jour(r.date_rdv) === auj ? 'Aujourd’hui' : 'Demain', heure: heure(r.date_rdv) }; });
  }

  /* ── D — Les doublons, au moment de la saisie ──────────────────────────────────────────────────
     Même téléphone (jamais un bouche-trou), même e-mail, nom proche — la règle de la page Clients
     (`SSUI.raisonDoublon`). Une demande ouverte ou un devis du même client : on le DIT et on propose de
     l'ouvrir ; rien n'est fusionné. `exclureDevis` : le devis déjà lié à la demande (montré à part). */
  function doublons(saisie, rdvs, devis, exclureDevis) {
    const s = saisie || {};
    if (!s.nom && !s.prenom && !s.telephone && !s.email) return [];
    const exclus = (exclureDevis || []).map(String);
    const out = [];
    (rdvs || []).forEach(function (r) {
      if (!r || String(r.id) === String(s.id || '')) return;
      const raison = U().raisonDoublon(s, r.client || {});
      if (raison) out.push({ type: 'rdv', id: r.id, raison: raison, nom: nom(r.client), statut: r.statut || 'nouveau', qui: r.assigned_to || '', date: r.date_creation || '' });
    });
    (devis || []).forEach(function (d) {
      if (!d || exclus.indexOf(String(d.id)) >= 0) return;
      const c = d.client || { nom: d.client_nom, prenom: d.client_prenom };
      const raison = U().raisonDoublon(s, c);
      if (raison) out.push({ type: 'devis', id: d.id, raison: raison, nom: nom(c), statut: d.statut || 'brouillon', archive: !!d.archive, date: d.date_creation || '' });
    });
    // Les demandes avant les devis, le plus récent d'abord : c'est la demande ouverte qu'on risque de doubler.
    return out.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'rdv' ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 4);
  }

  window.SSRdv = {
    sansAccents: sansAccents, jour: jour, ecartJours: ecartJours, plusJours: plusJours, heure: heure,
    correspond: correspond, CANAUX: CANAUX, TYPES: TYPES, quand: quand, resumeContact: resumeContact,
    prochaineAction: prochaineAction, trierColonne: trierColonne, recents: recents, visitesProches: visitesProches,
    doublons: doublons,
  };
})();
