// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — L'APRÈS-VENTE (page SAV)
// Script classique (file:// OK). Global : window.SSSav
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// Un ticket SAV, c'est un client mécontent : ce qui compte, c'est QUI s'en occupe, DEPUIS QUAND il
// attend, et ce qu'on a déjà fait. Les règles de la page vivent ici, en fonctions PURES, pour être
// testées (`tests/sav.test.html`) ; la page ne fait que dessiner. Le vocabulaire (natures, étapes,
// historique des passages) vit dans `ui.js`, partagé avec la carte SAV de la fiche devis.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  // Mêmes seuils que le reste de l'ERP (règle 15) : une attente devient gênante à 3 jours,
  // criante à 7. Lus dans `SSAttente.SEUILS` quand le module est là, pour ne pas en avoir deux.
  function seuils() {
    const S = (window.SSAttente && window.SSAttente.SEUILS) || {};
    return { gene: Number(S.SAV_SANS_SUITE_J) || 3, criant: 7 };
  }
  function auj() { return U().aujourdhui(); }
  /** Nombre de jours entiers entre une date (ISO ou AAAA-MM-JJ) et aujourd'hui (heure LOCALE). */
  function joursDepuis(iso, ref) {
    const d = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
    const a = new Date(d + 'T12:00:00'), b = new Date((ref || auj()) + 'T12:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  // ── Où en est un ticket ───────────────────────────────────────────────────────────────────────
  const resolu = function (t) { return !!t && t.statut === 'resolu'; };
  /** L'étape affichée (0 ouvert · 1 pris en charge · 2 pièce commandée · 3 réparé). Un ticket qui
   *  porte un nom est PRIS EN CHARGE même si son statut stocké est encore « ouvert » (données
   *  d'avant le 27/10/2026 : le serveur ne le faisait pas encore passer tout seul). */
  function etape(t) {
    if (!t) return 0;
    if (resolu(t)) return 3;
    if (t.statut === 'attente_piece') return 2;
    return (t.statut === 'en_cours' || t.pour) ? 1 : 0;
  }
  /** En retard : l'échéance est dépassée, ou la pièce attendue n'est pas arrivée à la date prévue. */
  function enRetard(t, ref) {
    if (!t || resolu(t)) return false;
    const r = ref || auj();
    return !!((t.echeance && t.echeance < r) || (t.statut === 'attente_piece' && t.piece_prevue && t.piece_prevue < r));
  }
  /** « depuis 9 j » et son niveau : c'est l'ancienneté qui rend un SAV urgent, pas sa date. */
  function anciennete(t, ref) {
    const j = joursDepuis(t && t.date_creation, ref);
    const S = seuils();
    return { j: j, niveau: j >= S.criant ? 'criant' : (j >= S.gene ? 'gene' : 'ok') };
  }

  /* ── A — La file de travail ────────────────────────────────────────────────────────────────────
     L'ordre EST le raisonnement (règle 15) : ce que PERSONNE n'a pris passe devant tout, puis ce qui
     est en retard, puis le plus ANCIEN. Avant, les tickets étaient rangés du plus récent au plus
     ancien — le client qui attend depuis trois semaines finissait en bas de la page. */
  function file(tickets, ref) {
    const r = ref || auj();
    const ouverts = (tickets || []).filter(function (t) { return t && !resolu(t); });
    const repares = (tickets || []).filter(resolu);
    ouverts.sort(function (a, b) {
      const pa = a.pour ? 1 : 0, pb = b.pour ? 1 : 0;
      if (pa !== pb) return pa - pb;
      const ra = enRetard(a, r) ? 0 : 1, rb = enRetard(b, r) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(a.date_creation || '').localeCompare(String(b.date_creation || ''));
    });
    repares.sort(function (a, b) {
      return String(b.date_resolution || b.date_creation || '').localeCompare(String(a.date_resolution || a.date_creation || ''));
    });
    return { aTraiter: ouverts, repares: repares };
  }
  /** La ligne de résumé, qui remplace les trois tuiles (317 px sur téléphone). */
  function resume(tickets, ref) {
    const f = file(tickets, ref);
    return {
      aTraiter: f.aTraiter.length,
      sansPersonne: f.aTraiter.filter(function (t) { return !t.pour; }).length,
      enRetard: f.aTraiter.filter(function (t) { return enRetard(t, ref); }).length,
      piece: f.aTraiter.filter(function (t) { return t.statut === 'attente_piece'; }).length,
      repares: f.repares.length,
    };
  }

  /* ── G — Ce qui casse le plus ──────────────────────────────────────────────────────────────────
     Sur les 12 derniers mois : les tickets par NATURE, et pour les pannes de moteur, les moteurs des
     chantiers concernés. Un même moteur sur deux pannes ou plus, c'est peut-être un défaut de série
     — à signaler à Harol, preuves (les tickets) à l'appui. Les moteurs viennent des ouvertures de la
     liste (`items_min` : `moteur_ref` pour un screen, `moteur` pour un volet ou une tente). */
  function moteursDe(devis) {
    const vus = {};
    ((devis && (devis.items_min || devis.items)) || []).forEach(function (it) {
      const m = String((it && (it.moteur_ref || it.moteur)) || '').trim();
      if (m) vus[m] = true;
    });
    return Object.keys(vus);
  }
  function synthese(tickets, ref, mois) {
    const r = ref || auj();
    const d = new Date(r + 'T12:00:00'); d.setMonth(d.getMonth() - (mois || 12));
    const depuis = U().isoDate(d);
    const dans = (tickets || []).filter(function (t) { return t && String(t.date_creation || '').slice(0, 10) >= depuis; });
    const parNature = {}, parMoteur = {};
    dans.forEach(function (t) {
      const k = t.probleme || 'autre';
      parNature[k] = (parNature[k] || 0) + 1;
      if (k === 'moteur') moteursDe(t.devis).forEach(function (m) { parMoteur[m] = (parMoteur[m] || 0) + 1; });
    });
    const tri = function (o, lib) {
      return Object.keys(o).map(function (k) { return { k: k, label: lib ? (lib[k] || k) : k, n: o[k] }; })
        .sort(function (a, b) { return (b.n - a.n) || a.label.localeCompare(b.label); });
    };
    const moteurs = tri(parMoteur);
    return { total: dans.length, depuis: depuis, parNature: tri(parNature, U().SAV_TYPE_LABEL), moteurs: moteurs,
      aSignaler: moteurs.filter(function (m) { return m.n >= 2; }) };
  }

  /* ── E — Le bon d'intervention ─────────────────────────────────────────────────────────────────
     Hors garantie, une intervention se FACTURE : on prépare un dépannage avec le client, le chantier
     et le ticket, et le simulateur s'ouvre dessus. Le dépannage porte `sav_origine` : la page SAV
     retrouve son bon dans la liste des devis, sans rien réécrire sur le ticket. */
  function bonDe(t, liste) {
    return (liste || []).filter(function (d) {
      return d && String(d.sav_origine_devis || '') === String(t.devisId || '') && String(d.sav_origine_ticket || '') === String(t.id || '');
    })[0] || null;
  }
  /** Ce que le simulateur reçoit (par la session du navigateur, comme le client pré-rempli). */
  function preparationBon(t) {
    const d = t.devis || {};
    const nature = (U().SAV_TYPE_LABEL[t.probleme] || 'SAV').toLowerCase();
    return {
      client: { prenom: d.prenom || '', nom: d.nom || '', telephone: d.telephone || '', email: d.email || '', adresse: d.adresse || {} },
      depannage: {
        motif: 'SAV ' + nature + ' — ' + String(t.description || '').trim(),
        sav_origine: { devis_id: String(t.devisId || ''), ticket_id: String(t.id || '') },
      },
    };
  }

  window.SSSav = {
    joursDepuis: joursDepuis, etape: etape, enRetard: enRetard, anciennete: anciennete,
    file: file, resume: resume, moteursDe: moteursDe, synthese: synthese,
    bonDe: bonDe, preparationBon: preparationBon,
  };
})();
