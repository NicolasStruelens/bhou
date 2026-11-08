/* ═══════════════════════════════════════════════════════════════════════════════════════════
   LE PLAN DES OUVERTURES (window.SSPlan) — la carte « Ouvertures » de la fiche devis.

   POURQUOI CE FICHIER EXISTE
   Nicolas, 08/11/2026, devant la fiche d'un devis de quatre volets : vingt-quatre tuiles par
   volet, toutes dans la même police de code, la couleur du caisson écrite deux fois, le moteur
   deux fois, « 7016 — Gris anthracite · réf. 7T16 (laque texturée) » recopié trois fois, et
   quatre volets qui répétaient les mêmes seize valeurs — la seule vraie différence (coulisses
   117 sur le volet du jardin) et l'ajourage oublié sur la chambre étaient noyés dedans.
   Sa demande : « une bonne upgrade visualisation design au max, ça doit être bcp plus
   parlant ». Il a choisi sur maquette la variante « Plan de pose » : « A est génial, fait au
   max et au plus logique et parlant ».

   CE QUE LA CARTE MONTRE, DANS CET ORDRE (règle 60 ter de CLAUDE.md)
     1. une bande résumé : combien d'ouvertures, de m², et combien sont prêtes / ont un écart /
        manquent d'une information pour commander — chaque état mène à la fiche concernée ;
     2. la FAÇADE : toutes les ouvertures dessinées côte à côte, à la MÊME échelle ;
     3. ce qui manque pour commander (la règle `SSProducts.champsManquants`, inchangée) ;
     4. la CONFIGURATION COMMUNE, écrite une seule fois par groupe d'ouvertures semblables ;
     5. une FICHE par ouverture : son dessin coté, ses mesures, son prix, ce qui la distingue
        des autres, ce qui lui manque, sa note et ses photos.

   CE FICHIER NE DÉCIDE D'AUCUNE RÈGLE MÉTIER. Les groupes et leurs différences viennent de
   `SSVolet.groupesConfig` (l'encadré du devis, au niveau COMPLET ici : la fiche est interne)
   pour les volets, et de `SSProducts.ecartsOuvertures` (l'outil des différences du simulateur)
   pour les autres types. Ce qui manque vient de `SSProducts.champsManquants`. Les teintes de
   `SSProducts.ralCode / ralNom / ralHex`. Ici, on ne fait que DESSINER et RANGER.

   ⚠️ LES COULEURS DES DESSINS SONT DES DONNÉES, PAS DU THÈME. Un volet RAL 7016 est dessiné en
   gris anthracite dans les cinq thèmes. Une teinte hors RAL (« Chêne », « Bronze ») est
   approchée d'après son nom et le dit (« teinte approchée ») ; une couleur pas encore choisie
   est HACHURÉE — jamais une couleur inventée qui ressemblerait à un choix.

   ⚠️ PAGE INTERNE. Les références de commande Harol (réf. 7T16, perçage A168…) restent
   visibles ici, à la demande de Nicolas. Ce module n'est chargé QUE par `app/vue.html` (derrière
   Cloudflare Access) : jamais par `devis-review.html` ni par le suivi client.

   Dépend de `ui.js`, `products.js` et `volet.js`, chargés AVANT.
   Protégé par `tests/plan.test.html`.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const P = function () { return window.SSProducts || null; };
  const V = function () { return window.SSVolet || null; };
  const U = function () { return window.SSUI || null; };

  const esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  /** « 2 050 » : l'espace fine insécable des milliers, comme les montants de l'ERP. */
  function nb(x, d) {
    const t = Math.abs(Number(x) || 0).toFixed(d || 0).split('.');
    return (x < 0 ? '-' : '') + t[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + (t[1] ? ',' + t[1] : '');
  }
  const cap = function (s) { s = String(s == null ? '' : s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  function typeDe(it) { return it && it.type === 'volet' ? 'volet_roulant' : ((it && it.type) || ''); }
  const estTente = function (it) { return typeDe(it) === 'tente_solaire'; };
  /** La 2e dimension : la projection d'une tente, la hauteur de tout le reste (comme `SSCalc.totalSurface`). */
  function dim2(it) { return estTente(it) ? num(it && it.projection) : num(it && it.hauteur); }
  /** La quantité comme la LIGNE du devis l'affiche (même lecture que `SSVolet.titreGroupe`). */
  function qte(it) { return Number(it && it.quantite) || 1; }
  function nomType(it) {
    const u = U();
    const t = it && it.type;
    return (u && u.TYPE_LABEL && u.TYPE_LABEL[t]) || t || 'Ouverture';
  }
  /** « Volet VR150 (Standard) » — ce qu'on achète, en une ligne. */
  function produit(it) {
    return nomType(it) + (it.modele ? ' ' + it.modele : '') + (it.variante ? ' (' + it.variante + ')' : '');
  }
  /** « Volet 3 (Jardin) » : la même désignation que la ligne « Différences » du devis. */
  function nomLigne(i, items) {
    const v = V();
    if (v && v.nomLigne) return v.nomLigne(i, items);
    const it = (items || [])[i] || {};
    return 'Ouverture ' + (i + 1) + (it.emplacement ? ' (' + it.emplacement + ')' : '');
  }

  /* ── ICÔNES (traits, comme `SSUI.icon`) ── */
  const IC = {
    fenetre: '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/>',
    regle: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1 .2-2.2 1.3-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    meca: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    commande: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="m10 8.5 2-2 2 2M10 15.5l2 2 2-2"/>',
    eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moteur: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5V2M12 22v-3"/>',
    cote: '<path d="M4 12h16M15 7l5 5-5 5"/>',
    mur: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    diff: '<path d="M5 9h14M5 15h14M15 4 9 20"/>',
    alerte: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>',
    calques: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    haut: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    batterie: '<rect x="3" y="7" width="16" height="10" rx="1.5"/><path d="M21 10v4M7 10v4M11 10v4"/>',
    cable: '<path d="M4 4v6a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v2"/>',
    capteur: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  };
  function ic(n, cls) {
    return '<svg class="pl-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  }

  /* ══ LES TEINTES ══════════════════════════════════════════════════════════════════════════
     Une valeur de couleur, telle qu'elle est enregistrée, peut être :
       « 7016 — Gris anthracite »                          (RAL choisi au nuancier)
       « 7016 — Gris anthracite · réf. 7T16 (laque texturée) »  (référence Harol choisie au catalogue)
       « 38 — 7016 Gris anthracite »                        (coloris de lame n° 38 du portail)
       « 7016 »                                             (tapé au code)
       « 11 — Chêne », « Bronze »                           (hors RAL)
     On en tire de quoi la DIRE (nom, RAL, référence, n° de coloris) et la MONTRER (teinte). La
     référence n'est affichée que si elle est ÉCRITE dans la valeur : on n'en déduit jamais une. */
  const APPROCHEES = [
    [/ch[êe]ne|oak|teak|bois|noyer/i, '#9a6a3a'], [/bronze/i, '#6e5b43'], [/anthracite/i, '#3a3f44'],
    [/cr[èe]me|ivoire/i, '#ece2c6'], [/beige/i, '#cdb98f'], [/blanc|white/i, '#f1f0ea'], [/noir|black/i, '#1d1e20'],
    [/samtgrau|b[ée]ton|santiago|gris|grey|gray/i, '#8a8d8f'], [/brun|brown|marron/i, '#5a3d2b'],
    [/alu|argent|silver|inox/i, '#a8a9ab'], [/vert|green/i, '#3d5a3d'], [/bleu|blue/i, '#2e4a7a'],
    [/pourpre|rouge|bordeaux|red/i, '#7a2e2e'],
  ];
  function teinte(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    const p = P();
    const code = p && p.ralCode ? p.ralCode(s) : null;
    const ref = s.match(/·\s*réf\.\s*([^\s(]+)\s*(?:\(([^)]+)\))?/);
    const lame = s.match(/^(\d{1,2})\s*—\s*/);
    let nom = code && p.ralNom ? p.ralNom(s) : '';
    if (!nom) nom = s.replace(/\s*·\s*réf\..*$/, '').replace(/^\d{1,2}\s*—\s*/, '').replace(/^\d{4}\s*—\s*/, '').trim();
    let hex = code && p.ralHex ? p.ralHex(s) : null;
    let approx = false;
    if (!hex) {
      const a = APPROCHEES.filter(function (x) { return x[0].test(s); })[0];
      if (a) { hex = a[1]; approx = true; }
    }
    return { brut: s, code: code, nom: nom || s, hex: hex, approx: approx,
      ref: ref ? ref[1] : '', finition: ref && ref[2] ? ref[2] : '', lame: lame ? lame[1] : '' };
  }
  /** Comment une teinte se nomme en petit, sous son nom : « RAL 7016 · réf. 7T16 · laque texturée ». */
  function codesTeinte(t, sansLame) {
    if (!t) return '';
    return [t.lame && !sansLame ? 'coloris n° ' + t.lame : '', t.code ? 'RAL ' + t.code : '', t.ref ? 'réf. ' + t.ref : '',
      t.finition || '', t.approx ? 'teinte approchée' : ''].filter(Boolean).join(' · ');
  }

  /* ══ CE QU'UNE OUVERTURE DIT D'ELLE-MÊME ═══════════════════════════════════════════════════
     Une entrée par réglage RENSEIGNÉ : `{ k, l, v, check, sec, g, compare }`.
       sec     : la section où elle se range (Couleurs, Mécanique, Commande) ;
       g       : le sous-groupe du configurateur VR150 (Tablier, Caisson, Coulisses…) ;
       compare : le réglage entre dans la comparaison entre ouvertures (sinon : un champ d'un
                 ANCIEN devis, montré sur sa fiche — l'ancienne carte le montrait, il reste). */
  const SECTIONS = ['Couleurs', 'Mécanique', 'Commande'];
  const SEC_IC = { Couleurs: 'palette', 'Mécanique': 'meca', Commande: 'commande' };
  const COMMANDE = ['alimentation', 'moteur', 'moteur_ref', 'cote_manoeuvre', 'emetteur', 'batterie', 'panneau_solaire_separe',
    'panneau_cable', 'manoeuvre', 'cable_longueur', 'cable_couleur', 'telecommande', 'detecteur', 'lateralite', 'couple'];
  /** Le nom court d'une couleur dans la section Couleurs : le RÔLE de la pièce. */
  const ROLES = { couleur: 'Caisson', couleur_lame: 'Lames', lame_finale_couleur: 'Lame finale', couleur_coulisses: 'Coulisses',
    couleur_coulisses2: 'Coulisse 2', caisson_rivets: 'Rivets', coulisse_bouchon_couleur: 'Bouchons PVC',
    coulisse2_bouchon_couleur: 'Bouchons PVC (coulisse 2)', toile_couleur: 'Toile' };
  /** L'ordre de lecture des couleurs : de la pièce la plus visible à la plus discrète. */
  const ORDRE_ROLES = ['couleur', 'couleur_lame', 'lame_finale_couleur', 'couleur_coulisses', 'couleur_coulisses2', 'toile_couleur',
    'caisson_rivets', 'coulisse_bouchon_couleur', 'coulisse2_bouchon_couleur'];
  function rangRole(k) { const i = ORDRE_ROLES.indexOf(k); return i < 0 ? 99 : i; }
  function estCouleur(k) { return k !== 'cable_couleur' && (k in ROLES || /couleur/.test(k)); }
  function sectionDe(k, g) {
    if (g === 'Manœuvre' || COMMANDE.indexOf(k) >= 0) return 'Commande';
    if (estCouleur(k) || k === 'collection' || k === 'toile' || k === 'toile_num') return 'Couleurs';
    return 'Mécanique';
  }
  function role(it, k) {
    if (k === 'couleur') return typeDe(it) === 'tente_solaire' ? 'Structure' : typeDe(it) === 'volet_roulant' || typeDe(it) === 'screen' ? 'Caisson' : 'Couleur';
    return ROLES[k] || '';
  }
  /* Les champs d'un ANCIEN devis que l'ancienne carte affichait pour un screen, une tente ou un
     autre produit. Ceux que le configurateur d'aujourd'hui connaît encore sont lus par
     `champsConfig` ; les autres (barre surélevée retirée du catalogue, câble, lambrequins…)
     ne doivent pas disparaître pour autant d'un vieux dossier. [clé, libellé, case à cocher] */
  const ANCIENS = [
    ['couleur', 'Couleur'], ['couleur_coulisses', 'Couleur des coulisses'], ['couleur_lame', 'Couleur des lames'],
    ['lame_finale_couleur', 'Couleur lame finale'], ['lame_type', 'Type de lame'],
    ['collection', 'Collection toile'], ['toile', 'Toile'], ['toile_num', 'N° de toile'], ['toile_couleur', 'Couleur toile'],
    ['combinaison', 'Combinaison'], ['lateralite', 'Latéralité'], ['caisson_forme', 'Modèle de caisson'], ['caisson_mesure', 'Caisson'],
    ['colmatage', 'Colmatage'], ['emetteur', 'Commande murale Somfy incluse', 1], ['panneau_solaire_separe', 'Panneau solaire déporté', 1],
    ['panneau_cable', 'Câble du panneau'], ['allongement_caisson', 'Allongement de caisson', 1],
    ['barre_surelevee', 'Barre de charge surélevée (A2416)', 1], ['projection', 'Projection'], ['manoeuvre', 'Manœuvre'],
    ['moteur', 'Moteur'], ['moteur_ref', 'Moteur'], ['cable_longueur', 'Câble — longueur'], ['cable_couleur', 'Câble — couleur'],
    ['telecommande', 'Commande à distance', 1], ['eclairage_led', 'Éclairage LED'], ['couple', 'Couplage (jusqu’à 12 m)', 1],
    ['lambrequin_fixe', 'Lambrequin fixe', 1], ['lambrequin_vario', 'Lambrequin Vario (moteur io)', 1],
    ['detecteur', 'Détecteur soleil/vent/pluie', 1], ['spots_storelight', 'Spots LED Storelight', 1],
    ['chauffage_storelight', 'Chauffage Storelight', 1], ['borstels', 'Étanchéité par brosses', 1],
  ];
  /** Déjà dans le titre de la fiche (« Screen Coolscreen 8 (Standard) ») : pas une deuxième fois. */
  const DANS_LE_TITRE = ['modele', 'variante'];
  const rempli = function (v) { return !(v === undefined || v === null || v === '' || v === false); };

  function description(it) {
    const p = P(), v = V();
    if (!it) return [];
    if (typeDe(it) === 'volet_roulant' && v && p) {
      const champs = {};
      p.vrChamps(it).forEach(function (c) { champs[c.k] = c; });
      return v.resume(it, 'complet').map(function (x) {
        const c = champs[x.k] || {};
        return { k: x.k, l: x.l, v: x.v, check: c.t === 'check', sec: sectionDe(x.k, c.g), g: c.g || '', compare: true };
      });
    }
    const out = [], vus = {};
    const config = p && p.champsConfig ? p.champsConfig(it) : [];
    config.forEach(function (c) {
      vus[c.k] = true;
      if (DANS_LE_TITRE.indexOf(c.k) >= 0 || !rempli(it[c.k])) return;
      out.push({ k: c.k, l: c.l, v: c.check ? 'Oui' : String(it[c.k]), check: !!c.check, sec: sectionDe(c.k), g: '', compare: true });
    });
    ANCIENS.forEach(function (a) {
      const k = a[0];
      if (vus[k] || DANS_LE_TITRE.indexOf(k) >= 0 || !rempli(it[k])) return;
      if (k === 'combinaison' && it[k] === 'Simple') return;          // muet, comme sur l'ancienne carte
      if (k === 'projection' && estTente(it)) return;                  // c'est la 2e dimension de la tente
      vus[k] = true;
      out.push({ k: k, l: a[1], v: a[2] ? 'Oui' : String(it[k]), check: !!a[2], sec: sectionDe(k), g: '', compare: false });
    });
    return out;
  }

  /* ══ LES GROUPES ET LEURS DIFFÉRENCES ══════════════════════════════════════════════════════
     @returns { groupes: [{ type, indices, commun: [entrées], ecarts: { i: [écarts] } }],
                groupeDe: [index du groupe ou -1, par ouverture] }
     Un écart : `{ k, l, v, check, sec, g, vide, n }` — `vide` : le réglage MANQUE ici alors que
     les autres l'ont ; `n` : combien d'ouvertures du groupe ont la valeur commune. */
  function analyse(items) {
    const liste = items || [];
    const p = P(), v = V();
    const groupes = [];
    // Volets : la règle de l'encadré du devis (même seuil, mêmes groupes, mêmes « Différences »).
    if (v && v.groupesConfig && p) {
      v.groupesConfig(liste, 'complet').forEach(function (g) {
        if (g.indices.length < 2) return;
        const it0 = liste[g.indices[0]];
        const champs = {};
        g.indices.forEach(function (i) { p.vrChamps(liste[i]).forEach(function (c) { champs[c.k] = c; }); });
        const entree = function (x) {
          const c = champs[x.k] || {};
          return { k: x.k, l: x.l, v: x.v, check: c.t === 'check', sec: sectionDe(x.k, c.g), g: c.g || '', compare: true, vide: !!x.vide };
        };
        const ecarts = {};
        const nDiff = {};
        g.ecarts.forEach(function (e) {
          ecarts[e.i] = e.bouts.map(entree);
          e.bouts.forEach(function (b) { nDiff[b.k] = (nDiff[b.k] || 0) + 1; });
        });
        Object.keys(ecarts).forEach(function (i) { ecarts[i].forEach(function (x) { x.n = g.indices.length - (nDiff[x.k] || 0); }); });
        groupes.push({ type: typeDe(it0), indices: g.indices.slice(), commun: g.resume.map(entree), ecarts: ecarts });
      });
    }
    // Les autres types : l'outil des différences du simulateur (`ecartsOuvertures`).
    if (p && p.ecartsOuvertures) {
      p.ecartsOuvertures(liste).forEach(function (b) {
        if (b.type === 'volet_roulant') return;
        const ecarts = {};
        b.lignes.forEach(function (l) {
          const n = l.ouvertures.filter(function (o) { return o.etat === 'pareil'; }).length;
          l.ouvertures.forEach(function (o) {
            if (o.etat === 'pareil') return;
            (ecarts[o.i] = ecarts[o.i] || []).push({ k: l.k, l: l.l, v: l.check ? (o.v ? 'Oui' : '') : o.v, check: !!l.check,
              sec: sectionDe(l.k), g: '', compare: true, vide: o.etat === 'vide', n: n, ref: l.ref });
          });
        });
        const differents = {};
        b.lignes.forEach(function (l) { differents[l.k] = l; });
        const commun = description(liste[b.indices[0]]).filter(function (e) { return e.compare && !differents[e.k]; });
        groupes.push({ type: b.type, indices: b.indices.slice(), commun: commun, ecarts: ecarts, refs: differents });
      });
    }
    groupes.sort(function (a, b) { return a.indices[0] - b.indices[0]; });
    const groupeDe = liste.map(function () { return -1; });
    groupes.forEach(function (g, gi) { g.indices.forEach(function (i) { groupeDe[i] = gi; }); });
    return { groupes: groupes, groupeDe: groupeDe };
  }

  function manquants(it) { const p = P(); return p && p.champsManquants ? p.champsManquants(it) : []; }
  /** L'état d'une ouverture : ce qui manque pour commander d'abord, puis ce qui la distingue. */
  function etat(items, i, an) {
    const mq = manquants(items[i]);
    if (mq.length) return { k: 'manque', n: mq.length, t: mq.length + ' à compléter', i: 'alerte' };
    const g = an.groupeDe[i] >= 0 ? an.groupes[an.groupeDe[i]] : null;
    const e = g ? (g.ecarts[i] || []) : [];
    if (e.length) return { k: 'ecart', n: e.length, t: e.length + ' écart' + (e.length > 1 ? 's' : ''), i: 'diff' };
    return { k: 'ok', n: 0, t: 'Prête', i: 'check' };
  }

  /* ══ LES VALEURS, LISIBLES ══════════════════════════════════════════════════════════════
     L'index du menu Harol (« 3 : type 3 (sur le jour) ») ne dit rien : on le retire, comme
     `SSVolet.sansCodeMenu`. Une RÉFÉRENCE d'article (« A168 », « DVC2 ») sert à commander : la
     page est interne, elle reste, à part et en petit. */
  function codeEtTexte(s) {
    const str = String(s == null ? '' : s);
    const a = str.match(/^(A\d{2,5}|[A-Z]{2,4}\d{1,2})\s*:\s*(.+)$/);
    if (a) return { texte: cap(a[2]), code: a[1] };
    const n = str.match(/^(\d{1,2})\s*:\s*(.+)$/);
    if (n) return { texte: cap(n[2]), code: '' };
    return { texte: str, code: '' };
  }
  function libelle(it, e) {
    if (estCouleur(e.k)) return role(it, e.k) || codeEtTexte(e.l).texte;
    if (e.k === 'caisson_mesure') return 'Caisson';
    return codeEtTexte(e.l).texte;
  }
  function codeLibelle(e) { return estCouleur(e.k) ? '' : codeEtTexte(e.l).code; }
  function valHtml(e) {
    if (e.vide) return '<span class="pl-v-vide">non précisé</span>';
    if (e.check) return rempli(e.v) && e.v !== 'Non' ? '<span class="pl-oui">' + ic('check') + ' Oui</span>' : '<span class="pl-non">Non</span>';
    if (estCouleur(e.k)) {
      const t = teinte(e.v);
      if (!t) return '<span class="pl-v-vide">non précisé</span>';
      return '<span class="pl-sw' + (t.hex ? '' : ' pl-sw-x') + '" style="--c:' + (t.hex || 'transparent') + '"></span> ' + esc(t.nom) +
        (codesTeinte(t) ? ' <span class="pl-code">' + esc(codesTeinte(t)) + '</span>' : '');
    }
    const c = codeEtTexte(e.v);
    const mm = e.k === 'caisson_mesure' && /^\d+$/.test(String(e.v).trim()) ? ' mm' : '';
    return esc(c.texte) + mm + (c.code ? ' <span class="pl-code">' + esc(c.code) + '</span>' : '');
  }
  function valTexte(e) {
    if (e.vide) return 'non précisé';
    if (e.check) return rempli(e.v) && e.v !== 'Non' ? 'Oui' : 'Non';
    if (estCouleur(e.k)) { const t = teinte(e.v); return t ? t.nom + (t.code ? ' ' + t.code : '') : 'non précisé'; }
    const c = codeEtTexte(e.v);
    return c.texte + (e.k === 'caisson_mesure' && /^\d+$/.test(String(e.v).trim()) ? ' mm' : '') + (c.code ? ' ' + c.code : '');
  }

  /* ══ LE DESSIN D'UNE OUVERTURE ═════════════════════════════════════════════════════════════
     Vu de L'INTÉRIEUR (c'est de là que le Côté de manœuvre se lit, voir `VR_CHAMPS`), à
     l'échelle `s` (pixels par millimètre). Il montre : les vraies teintes du caisson, des
     lames, de la lame finale et des coulisses ; le moteur du côté de manœuvre ; le câble
     (filaire) ou le panneau (solaire) ; la commande murale ; l'ajourage ; les parties d'une
     porte-fenêtre DVC ; dans le jour (le mur entoure le volet) ou sur le jour (le volet couvre
     la baie, en tirets). Le tablier est dessiné à moitié descendu pour qu'on voie la fenêtre ;
     au survol (souris) ou d'un appui (`.ferme`), il descend.
     Un côté de manœuvre NON PRÉCISÉ n'est pas dessiné : on ne place jamais un moteur au hasard. */
  let NID = 0;
  function ajourFrac(a) { const m = String(a || '').match(/^(\d)\s*:/); return m ? ([0, 1 / 3, 1 / 2, 2 / 3, 1][+m[1]] || 0) : 0; }
  function nbParties(c) { const m = String(c || '').match(/DVC(\d)/); return m ? Math.max(1, Math.min(4, +m[1])) : 1; }
  function pasLame(t) { const m = String(t || '').match(/(\d\d)\s*s?$/i); return m ? +m[1] : 40; }
  const TOILE_NEUTRE = '#857d70', CHOISI_INCONNU = '#9aa0a6';
  function remplissage(t, id) { return t ? (t.hex || CHOISI_INCONNU) : 'url(#' + id + 'h)'; }

  function defsCommuns(id, lp, lameFill) {
    return '<pattern id="' + id + 'l" width="12" height="' + lp.toFixed(2) + '" patternUnits="userSpaceOnUse"><rect width="12" height="' + lp.toFixed(2) + '" fill="' + lameFill + '"/>' +
      '<rect y="' + (lp - 0.9).toFixed(2) + '" width="12" height=".9" fill="#000" fill-opacity=".3"/><rect width="12" height=".7" fill="#fff" fill-opacity=".22"/></pattern>' +
      '<pattern id="' + id + 'a" width="9" height="' + lp.toFixed(2) + '" patternUnits="userSpaceOnUse"><rect x="2" y="' + (lp - 1.4).toFixed(2) + '" width="4" height="1.4" fill="#fff4cc"/></pattern>' +
      '<pattern id="' + id + 'm" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height=".5" fill="#000" fill-opacity=".16"/><rect width=".5" height="3" fill="#000" fill-opacity=".16"/></pattern>' +
      '<pattern id="' + id + 'h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="pl-hz-f"/><rect width="2" height="6" class="pl-hz-t"/></pattern>' +
      '<linearGradient id="' + id + 'v" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" class="pl-v1"/><stop offset="1" class="pl-v2"/></linearGradient>';
  }
  function cotesHtml(w, h, W, H, gauche) {
    const y0 = -16;
    let g = '<path d="M0 ' + (y0 - 5) + ' V-2 M' + w + ' ' + (y0 - 5) + ' V-2" class="pl-cote-r"/>' +
      '<line x1="0" y1="' + y0 + '" x2="' + w + '" y2="' + y0 + '" class="pl-cote-l"/><path d="M-3 ' + (y0 + 3) + ' l6 -6 M' + (w - 3) + ' ' + (y0 + 3) + ' l6 -6" class="pl-cote-l"/>' +
      '<text x="' + (w / 2) + '" y="' + (y0 - 4) + '" text-anchor="middle" class="pl-cote-t">' + nb(W) + '</text>';
    const x0 = gauche ? -16 : w + 16;
    g += '<path d="M' + (gauche ? -21 : w + 2) + ' 0 H' + (gauche ? -2 : w + 21) + ' M' + (gauche ? -21 : w + 2) + ' ' + h + ' H' + (gauche ? -2 : w + 21) + '" class="pl-cote-r"/>' +
      '<line x1="' + x0 + '" y1="0" x2="' + x0 + '" y2="' + h + '" class="pl-cote-l"/><path d="M' + (x0 - 3) + ' 3 l6 -6 M' + (x0 - 3) + ' ' + (h + 3) + ' l6 -6" class="pl-cote-l"/>' +
      '<text transform="translate(' + (x0 + (gauche ? -5 : 13)) + ' ' + (h / 2) + ') rotate(-90)" text-anchor="middle" class="pl-cote-t">' + nb(H) + '</text>';
    return g;
  }
  function svg(id, vb, w, h, label, defs, corps, cls) {
    return '<svg class="pl-svg' + (cls ? ' ' + cls : '') + '" viewBox="' + vb.map(function (x) { return x.toFixed(1); }).join(' ') + '" width="' + w.toFixed(1) +
      '" height="' + h.toFixed(1) + '" role="img" aria-label="' + esc(label) + '"><defs>' + defs + '</defs>' + corps + '</svg>';
  }

  function dessinSansMesures(it) {
    return '<svg class="pl-svg pl-svg-x" viewBox="0 0 120 84" width="120" height="84" role="img" aria-label="' + esc(produit(it) + ' : mesures à compléter') + '">' +
      '<rect x="2" y="2" width="116" height="80" rx="3" class="pl-sans"/><text x="60" y="38" text-anchor="middle" class="pl-sans-t">mesures</text> ' +
      '<text x="60" y="54" text-anchor="middle" class="pl-sans-t">à compléter</text></svg>';
  }

  function dessinFenetre(it, s, o) {
    const id = 'pl' + (++NID);
    const t = typeDe(it);
    const vol = t === 'volet_roulant', scr = t === 'screen', tab = t === 'tablier_volet';
    const autre = !vol && !scr && !tab;
    const W = num(it.largeur), H = num(it.hauteur);
    const w = W * s, h = H * s;
    const avecCaisson = vol || scr;
    const ch = avecCaisson ? Math.max(5, Math.min((num(it.caisson_mesure) || (scr ? 130 : 180)) * s, h * 0.3)) : 0;
    const cw = avecCaisson ? Math.max(3, (scr ? 42 : 52) * s) : 0;
    const lf = Math.max(3, 46 * s);
    const th = h - ch;
    const cote = vol ? it.cote_manoeuvre : scr ? it.lateralite : '';
    const connu = cote === 'Gauche' || cote === 'Droite';
    const dr = cote !== 'Gauche';
    const sol = vol ? it.alimentation === 'Solaire' : scr ? /solar/i.test(String(it.variante || '') + ' ' + String(it.moteur_ref || '')) : false;
    const fil = vol && /filaire/i.test(String(it.alimentation || ''));
    const cmd = avecCaisson && !!it.emetteur;
    const big = !!o.cotes;
    const sideM = big ? 44 : (cmd ? 13 : (fil && connu ? 8 : 3));
    const sideO = big ? 34 : 3;
    const padT = big ? 30 : 3, padB = big ? 4 : 2;
    const padL = dr ? sideO : sideM, padR = dr ? sideM : sideO;
    const C = vol ? { k: teinte(it.couleur), l: teinte(it.couleur_lame), f: teinte(it.lame_finale_couleur), g: teinte(it.couleur_coulisses),
                      g2: it.coulisses_differentes ? teinte(it.couleur_coulisses2) : teinte(it.couleur_coulisses) }
      : scr ? { k: teinte(it.couleur), l: teinte(it.toile_couleur), f: teinte(it.couleur), g: teinte(it.couleur), g2: teinte(it.couleur) }
      : tab ? { l: teinte(it.couleur_lame || it.couleur), f: teinte(it.lame_finale_couleur || it.couleur_lame || it.couleur) }
      : { k: teinte(it.couleur) };
    const F = function (x) { return remplissage(x, id); };
    const lp = Math.max(2.2, pasLame(it.lame_type) * s);
    const frac = vol ? ajourFrac(it.ajourage) : 0;
    const iw = w - 2 * cw;
    const fr = Math.max(1.4, 48 * s);
    let g = '';
    if (autre) {
      g += '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + F(C.k) + '" class="pl-tr"/>';
    } else {
      if (big && vol && /dans le jour/.test(it.montage_type || '')) g += '<rect x="-7" y="-4" width="' + (w + 14) + '" height="' + (h + 8) + '" class="pl-mur"/>';
      if (tab) g += '<rect x="-3" y="-3" width="' + (w + 6) + '" height="' + (h + 6) + '" class="pl-baie"/>';
      // La fenêtre, derrière
      g += '<rect x="' + cw + '" y="' + ch + '" width="' + iw + '" height="' + th + '" fill="url(#' + id + 'v)"/>';
      g += '<rect x="' + (cw + fr / 2 + 1) + '" y="' + (ch + fr / 2) + '" width="' + Math.max(0, iw - fr - 2) + '" height="' + Math.max(0, th - fr) + '" class="pl-chassis" stroke-width="' + fr + '"/>';
      if (W > 1300) g += '<line x1="' + (w / 2) + '" y1="' + ch + '" x2="' + (w / 2) + '" y2="' + h + '" class="pl-chassis" stroke-width="' + fr + '"/>';
      g += '<line x1="' + (cw + iw * 0.18) + '" y1="' + (ch + th * 0.92) + '" x2="' + (cw + iw * 0.42) + '" y2="' + (ch + th * 0.62) + '" class="pl-reflet" stroke-width="' + Math.max(1, 14 * s) + '"/>';
      // Le tablier (lames ou toile), à moitié descendu
      let tb = '';
      if (scr) {
        const toile = C.l || (it.collection ? { hex: TOILE_NEUTRE } : null);
        tb += '<rect x="' + cw + '" y="' + ch + '" width="' + iw + '" height="' + (th - lf) + '" fill="' + F(toile) + '" fill-opacity="' + (toile ? 0.88 : 1) + '"/>';
        tb += '<rect x="' + cw + '" y="' + ch + '" width="' + iw + '" height="' + (th - lf) + '" fill="url(#' + id + 'm)"/>';
      } else {
        tb += '<rect x="' + cw + '" y="' + ch + '" width="' + iw + '" height="' + (th - lf) + '" fill="url(#' + id + 'l)"/>';
        if (frac) tb += '<rect x="' + cw + '" y="' + (ch + (th - lf) * (1 - frac)) + '" width="' + iw + '" height="' + ((th - lf) * frac) + '" fill="url(#' + id + 'a)"/>';
      }
      tb += '<rect x="' + cw + '" y="' + (ch + th - lf) + '" width="' + iw + '" height="' + lf + '" fill="' + F(C.f) + '" class="pl-tr"/>';
      const ty = -(th - lf) * 0.44;
      g += '<clipPath id="' + id + 'c"><rect x="' + cw + '" y="' + ch + '" width="' + iw + '" height="' + th + '"/></clipPath>';
      g += '<g clip-path="url(#' + id + 'c)"><g class="pl-tab" style="--ty:' + ty.toFixed(1) + 'px">' + tb + '</g></g>';
      // Porte-fenêtre en 2 ou 3 parties sous un même caisson (combinaison DVC)
      const n = vol ? nbParties(it.combinaison) : 1;
      for (let k = 1; k < n; k++) g += '<rect x="' + (w * k / n - cw / 2) + '" y="' + ch + '" width="' + cw + '" height="' + th + '" fill="' + F(C.g) + '" class="pl-tr"/>';
      if (avecCaisson) {
        g += '<rect x="0" y="' + ch + '" width="' + cw + '" height="' + th + '" fill="' + F(dr ? C.g : C.g2) + '" class="pl-tr"/>' +
          '<rect x="' + (w - cw) + '" y="' + ch + '" width="' + cw + '" height="' + th + '" fill="' + F(dr ? C.g2 : C.g) + '" class="pl-tr"/>';
        g += '<rect x="0" y="0" width="' + w + '" height="' + ch + '" fill="' + F(C.k) + '" class="pl-tr"/>';
        if (C.k) g += '<rect x="0" y="' + (ch * 0.68) + '" width="' + w + '" height="' + (ch * 0.32) + '" fill="#000" fill-opacity=".16"/><rect x="0" y="0" width="' + w + '" height="' + Math.min(1.4, ch * 0.12) + '" fill="#fff" fill-opacity=".3"/>';
      }
      // Panneau solaire sur le caisson, à l'opposé du moteur
      if (sol) {
        const pw = Math.min(w * 0.3, 44), ph = Math.max(3, ch * 0.62), px = dr ? 3 : w - pw - 3;
        g += '<rect x="' + px + '" y="' + ((ch - ph) / 2) + '" width="' + pw + '" height="' + ph + '" class="pl-pv"/>';
        for (let k = 1; k < 4; k++) g += '<line x1="' + (px + pw * k / 4) + '" y1="' + ((ch - ph) / 2) + '" x2="' + (px + pw * k / 4) + '" y2="' + ((ch + ph) / 2) + '" class="pl-pv-g"/>';
      }
      // Le moteur, du côté de manœuvre
      if (avecCaisson && connu) {
        const mr = Math.max(1.8, Math.min(ch * 0.27, 7));
        const mx = dr ? w - Math.max(mr + 2, ch * 0.5) : Math.max(mr + 2, ch * 0.5);
        g += '<circle cx="' + mx + '" cy="' + (ch / 2) + '" r="' + mr + '" class="pl-moteur"/>';
      }
      // Le câble (filaire) et la commande murale, du côté du moteur
      const ex = dr ? w : 0, sg = dr ? 1 : -1;
      const iy = ch + th * 0.42;
      const iwd = big ? 12 : 6, ihd = big ? 18 : 9;
      const ix = dr ? w + (big ? 16 : 5) : -(big ? 16 : 5) - iwd;
      if (fil && connu) {
        const cx = ex + sg * (big ? 7 : 3);
        g += '<path d="M' + ex + ' ' + (ch / 2) + ' H' + cx + ' V' + (cmd ? iy : ch + th * 0.25) + (cmd ? ' H' + (dr ? ix : ix + iwd) : '') + '" class="pl-cable"' + (big ? '' : ' stroke-width=".8"') + '/>';
        if (big) g += '<path transform="translate(' + (cx + sg * 5 - (dr ? 0 : 9)) + ' ' + (ch + 6) + ') scale(.42)" d="M13 2 4 14h7l-1 8 9-12h-7z" class="pl-inter-f"/>';
      }
      if (cmd) {
        g += '<rect x="' + ix + '" y="' + iy + '" width="' + iwd + '" height="' + ihd + '" rx="' + (big ? 2 : 1) + '" class="pl-inter"/>';
        if (big) g += '<path d="M' + (ix + 3) + ' ' + (iy + 7) + ' l3 -3 l3 3 z M' + (ix + 3) + ' ' + (iy + 11) + ' l3 3 l3 -3 z" class="pl-inter-f"/>';
      }
      if (big && vol && /sur le jour/.test(it.montage_type || '')) g += '<rect x="' + (cw + 6) + '" y="' + (ch + 4) + '" width="' + Math.max(0, iw - 12) + '" height="' + (th - 6) + '" class="pl-baie"/>';
    }
    if (big) g += cotesHtml(w, h, W, H, dr);
    const VW = w + padL + padR, VH = h + padT + padB;
    const lbl = produit(it) + (it.emplacement ? ', ' + it.emplacement : '') + ', ' + nb(W) + ' sur ' + nb(H) + ' mm' +
      (C.k ? ', caisson ' + C.k.nom : avecCaisson ? ', couleur du caisson à choisir' : '') +
      (avecCaisson && connu ? ', moteur à ' + (dr ? 'droite' : 'gauche') : '') + (sol ? ', solaire' : fil ? ', filaire' : '') + (cmd ? ', commande murale' : '');
    return svg(id, [-padL, -padT, VW, VH], VW, VH, lbl, defsCommuns(id, lp, F(C.l)), g, autre ? '' : 'pl-anim');
  }

  /** La tente solaire se dessine VUE DE DESSUS : sa 2e dimension est une projection, pas une hauteur. */
  function dessinTente(it, s, o) {
    const id = 'pl' + (++NID);
    const W = num(it.largeur), D = num(it.projection);
    const w = W * s, d = D * s;
    const big = !!o.cotes;
    const k = teinte(it.couleur), toile = teinte(it.toile_couleur) || (it.collection ? { hex: TOILE_NEUTRE } : null);
    const F = function (x) { return remplissage(x, id); };
    const cH = Math.max(4, 200 * s);
    const padT = big ? 30 : 12, padB = big ? 6 : 3, padL = big ? 8 : 3, padR = big ? 34 : 3;
    let g = '<rect x="-4" y="-10" width="' + (w + 8) + '" height="8" fill="url(#' + id + 'h)" class="pl-mur"/>';
    g += '<rect x="0" y="' + cH + '" width="' + w + '" height="' + Math.max(0, d - cH) + '" fill="' + F(toile) + '" class="pl-tr"/>';
    g += '<rect x="0" y="' + cH + '" width="' + w + '" height="' + Math.max(0, d - cH) + '" fill="url(#' + id + 's)"/>';
    g += '<path d="M' + (w * 0.08) + ' ' + cH + ' L' + (w * 0.22) + ' ' + (d - 3) + ' M' + (w * 0.92) + ' ' + cH + ' L' + (w * 0.78) + ' ' + (d - 3) + '" class="pl-bras"/>';
    g += '<rect x="0" y="0" width="' + w + '" height="' + cH + '" fill="' + F(k) + '" class="pl-tr"/>';
    g += '<rect x="0" y="' + (d - 3) + '" width="' + w + '" height="3" fill="' + F(k) + '" class="pl-tr"/>';
    if (it.lambrequin_fixe || it.lambrequin_vario) g += '<rect x="0" y="' + d + '" width="' + w + '" height="' + Math.max(2.5, 220 * s) + '" fill="' + F(toile) + '" fill-opacity=".8" class="pl-tr"/>';
    if (big) {
      g += '<line x1="0" y1="-20" x2="' + w + '" y2="-20" class="pl-cote-l"/><text x="' + (w / 2) + '" y="-24" text-anchor="middle" class="pl-cote-t">' + nb(W) + '</text>';
      g += '<line x1="' + (w + 16) + '" y1="0" x2="' + (w + 16) + '" y2="' + d + '" class="pl-cote-l"/><text transform="translate(' + (w + 29) + ' ' + (d / 2) + ') rotate(-90)" text-anchor="middle" class="pl-cote-t">' + nb(D) + '</text>';
    }
    const defs = '<pattern id="' + id + 's" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="7" height="10" fill="#fff" fill-opacity=".12"/></pattern>' +
      '<pattern id="' + id + 'h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="pl-hz-f"/><rect width="2" height="6" class="pl-hz-t"/></pattern>';
    const lbl = produit(it) + (it.emplacement ? ', ' + it.emplacement : '') + ', vue de dessus, ' + nb(W) + ' de large sur ' + nb(D) + ' mm de projection';
    return svg(id, [-padL, -padT, w + padL + padR, d + padT + padB + (it.lambrequin_fixe || it.lambrequin_vario ? Math.max(2.5, 220 * s) : 0)],
      w + padL + padR, d + padT + padB + (it.lambrequin_fixe || it.lambrequin_vario ? Math.max(2.5, 220 * s) : 0), lbl, defs, g, '');
  }

  function dessin(it, s, o) {
    o = o || {};
    if (!it || !(num(it.largeur) > 0) || !(dim2(it) > 0)) return dessinSansMesures(it || {});
    return estTente(it) ? dessinTente(it, s, o) : dessinFenetre(it, s, o);
  }

  /* Pictogrammes : la coupe de montage (sur / dans le jour) et le profil du caisson. Indicatifs :
     ils disent OÙ se pose le caisson, pas sa cote. */
  function coupe(montage) {
    const m = String(montage || '');
    const sur = /sur le jour/.test(m), dans = /dans le jour/.test(m);
    if (!sur && !dans) return '';
    const box = sur ? '<rect x="7" y="9" width="15" height="14" rx="1" fill="currentColor" fill-opacity=".85"/><line x1="14" y1="23" x2="14" y2="56" stroke="currentColor" stroke-width="2"/>'
      : '<rect x="27" y="22" width="14" height="13" rx="1" fill="currentColor" fill-opacity=".85"/><line x1="34" y1="35" x2="34" y2="56" stroke="currentColor" stroke-width="2"/>';
    return '<svg class="pl-picto" width="64" height="66" viewBox="0 0 64 66" role="img" aria-label="Coupe : caisson ' + (sur ? 'sur le mur, devant la baie' : 'dans la baie') + '">' +
      '<g fill="none" stroke="currentColor" stroke-width="1"><rect x="24" y="2" width="22" height="20" fill="currentColor" fill-opacity=".12"/><rect x="24" y="56" width="22" height="8" fill="currentColor" fill-opacity=".12"/>' +
      '<rect x="42" y="22" width="4" height="34" fill="currentColor" fill-opacity=".35"/></g>' + box +
      '<text x="1" y="64" font-size="7" fill="currentColor">ext.</text><text x="49" y="64" font-size="7" fill="currentColor">int.</text></svg>';
  }
  function profil(forme) {
    const f = String(forme || '');
    if (!f) return '';
    const d = /^S/.test(f) ? 'M4 4h26v20l-6 6H4z' : /^P/.test(f) ? 'M4 4h14a12 12 0 0 1 12 12v14H4z' : /^G/.test(f) ? 'M4 4h20l6 6v20H4z' : 'M4 4h26v26H4z';
    return '<svg class="pl-picto" width="34" height="34" viewBox="0 0 34 34" role="img" aria-label="Profil du caisson : ' + esc(f) + '"><path d="' + d +
      '" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="17" r="5" fill="none" stroke="currentColor" stroke-dasharray="2 2"/></svg>';
  }

  /* ══ LE RENDU DE LA CARTE ══════════════════════════════════════════════════════════════════ */
  function pill(e) { return '<span class="pl-pill pl-' + e.k + '">' + ic(e.i) + ' ' + esc(e.t) + '</span>'; }
  /** Un lien qui mène à un endroit de la carte (sans toucher à l'adresse : la fiche lit le # à l'arrivée). */
  function aller(cible, html, cls, extra) {
    return '<button type="button" class="' + (cls || 'pl-lien') + '" data-pl-aller="' + esc(cible) + '"' + (extra || '') + '>' + html + '</button>';
  }

  /** Les trois sections d'un ensemble d'entrées, avec les « sauf » de chaque réglage. */
  function sectionsHtml(it, entrees, opts) {
    const o = opts || {};
    const sauf = o.sauf || {};
    const enPlus = o.enPlus || [];
    const p = P();
    const out = [];
    SECTIONS.forEach(function (sec) {
      const l = entrees.filter(function (e) { return e.sec === sec; });
      const plus = enPlus.filter(function (x) { return x.e.sec === sec; });
      if (!l.length && !plus.length) return;
      let corps = '';
      const sautsHtml = function (k) { return (sauf[k] || []).map(function (x) { return x.html; }).join(''); };
      if (sec === 'Couleurs') {
        const couleurs = l.filter(function (e) { return estCouleur(e.k); }).sort(function (a, b) { return rangRole(a.k) - rangRole(b.k); });
        const autres = l.filter(function (e) { return !estCouleur(e.k); });
        const tuiles = [];
        couleurs.forEach(function (e) {
          const t = teinte(e.v);
          const cle = t ? (t.code || t.nom.toLowerCase()) + '|' + t.ref : '?';
          let tu = tuiles.filter(function (x) { return x.cle === cle; })[0];
          if (!tu) tuiles.push(tu = { cle: cle, t: t, roles: [] });
          tu.roles.push({ l: libelle(it, e) + (t && t.lame && e.k === 'couleur_lame' ? ' n° ' + t.lame : ''), k: e.k });
        });
        if (couleurs.length > 1) {
          corps += '<div class="pl-nuancier" aria-hidden="true">' + couleurs.map(function (e) { const t = teinte(e.v);
            return '<span style="--c:' + (t && t.hex ? t.hex : 'transparent') + '" title="' + esc(libelle(it, e) + ' : ' + (t ? t.nom : '')) + '"></span>'; }).join('') + '</div>';
        }
        corps += tuiles.map(function (tu) {
          const t = tu.t;
          return '<div class="pl-teinte"><span class="pl-pastille' + (t && t.hex ? '' : ' pl-sw-x') + '" style="--c:' + (t && t.hex ? t.hex : 'transparent') + '"></span><div class="pl-teinte-t">' +
            '<b>' + esc(t ? t.nom : 'À choisir') + '</b>' + (codesTeinte(t, true) ? '<span class="pl-code">' + esc(codesTeinte(t, true)) + '</span>' : '') +
            '<span class="pl-roles">' + tu.roles.map(function (r) { return '<span>' + esc(r.l) + '</span>'; }).join('') + '</span>' +
            tu.roles.map(function (r) { return sautsHtml(r.k); }).join('') + '</div></div>';
        }).join('');
        if (autres.length) corps += '<div class="pl-lignes">' + autres.map(function (e) { return ligneHtml(it, e, sautsHtml(e.k)); }).join('') + '</div>';
      } else if (sec === 'Commande') {
        corps += '<div class="pl-cmd">' + l.map(function (e) { return commandeHtml(it, e, sautsHtml(e.k)); }).join('') + '</div>';
      } else {
        let g0 = null;
        corps += '<div class="pl-lignes">' + l.map(function (e) {
          const tete = e.g && e.g !== g0 && l.some(function (x) { return x.g && x.g !== e.g; }) ? '<div class="pl-sg">' + esc(e.g) + '</div>' : '';
          g0 = e.g;
          let pic = '', aide = '';
          if (e.k === 'montage_type') { pic = coupe(e.v); aide = p && p.vrMontageAide ? p.vrMontageAide(e.v) : ''; }
          if (e.k === 'caisson_forme') pic = profil(e.v);
          return tete + ligneHtml(it, e, sautsHtml(e.k), pic, aide);
        }).join('') + '</div>';
      }
      if (plus.length) corps += plus.map(function (x) { return x.html; }).join('');
      out.push('<div class="pl-sec" data-sec="' + esc(sec) + '"><h4>' + ic(SEC_IC[sec]) + ' ' + esc(sec) + '</h4>' + corps + '</div>');
    });
    return out.join('');
  }
  function ligneHtml(it, e, sauf, pic, aide) {
    const code = codeLibelle(e);
    return '<div class="pl-ligne"><div class="pl-l-k">' + esc(libelle(it, e)) + (code ? ' <span class="pl-code">' + esc(code) + '</span>' : '') + '</div><div class="pl-l-v">' + valHtml(e) +
      '</div>' + (pic ? '<span class="pl-pic">' + pic + '</span>' : '') + (aide ? '<small class="pl-aide">' + esc(aide) + '</small>' : '') + (sauf || '') + '</div>';
  }
  function commandeHtml(it, e, sauf) {
    const icone = e.k === 'alimentation' ? (/solaire/i.test(e.v) ? 'soleil' : 'eclair') : e.k === 'cote_manoeuvre' || e.k === 'lateralite' ? 'cote'
      : e.k === 'emetteur' || e.k === 'telecommande' ? 'commande' : e.k === 'batterie' ? 'batterie' : e.k === 'panneau_solaire_separe' ? 'soleil'
      : /cable/.test(e.k) ? 'cable' : e.k === 'detecteur' ? 'capteur' : 'moteur';
    const code = codeLibelle(e);
    let grand, petit;
    if (e.check && !e.vide) { grand = esc(libelle(it, e)) + (code ? ' <span class="pl-code">' + esc(code) + '</span>' : ''); petit = rempli(e.v) && e.v !== 'Non' ? '' : 'non'; }
    else { grand = valHtml(e); petit = esc(libelle(it, e)) + (code ? ' · ' + esc(code) : '') + (e.k === 'cote_manoeuvre' ? ' · vu de l’intérieur' : ''); }
    if (e.k === 'alimentation' && /filaire/i.test(e.v)) petit += ' · un câble à amener au moteur';
    return '<div class="pl-cmd-l"><span class="pl-cmd-ic">' + ic(icone) + '</span><div><b>' + grand + '</b>' + (petit ? '<span>' + petit + '</span>' : '') + '</div>' + (sauf || '') + '</div>';
  }

  /** Les ouvertures d'un même type, au pluriel du client : « 4 volets », « 1 screen ». */
  function compteTypes(items) {
    const u = U();
    const n = {}, ordre = [];
    items.forEach(function (it) { const t = it.type || '?'; if (!(t in n)) { n[t] = 0; ordre.push(t); } n[t] += qte(it); });
    return ordre.map(function (t) {
      const f = u && u.TYPE_FORMES && u.TYPE_FORMES[t];
      return n[t] + ' ' + (f ? (n[t] > 1 ? f[1] : f[0]).toLowerCase() : t);
    }).join(' · ');
  }

  function carteHtml(items, opts) {
    const o = opts || {};
    const liste = items || [];
    if (!liste.length) return '';
    const pre = o.prefixe || 'ouv-';
    const eur = o.eur || function (x) { return nb(x, 2) + '\u00a0€'; };
    const an = analyse(liste);
    const etats = liste.map(function (it, i) { return etat(liste, i, an); });
    const surface = window.SSCalc && window.SSCalc.totalSurface ? window.SSCalc.totalSurface(liste)
      : liste.reduce(function (s, it) { return s + num(it.largeur) / 1000 * dim2(it) / 1000 * qte(it); }, 0);
    const nOuv = liste.reduce(function (s, it) { return s + qte(it); }, 0);
    const facade = liste.length >= 2;

    // 1. Le résumé
    const par = { ok: [], ecart: [], manque: [] };
    etats.forEach(function (e, i) { par[e.k].push(i); });
    const etatPill = function (k, txt, icone) {
      const l = par[k];
      if (!l.length) return '';
      return aller(pre + (l[0] + 1), ic(icone) + ' ' + esc(txt(l.length)), 'pl-pill pl-' + k, ' title="Aller à ' + esc(nomLigne(l[0], liste)) + '"');
    };
    const resume = '<div class="pl-resume"><div class="pl-r-chiffres"><div><b>' + nOuv + '</b><span>ouverture' + (nOuv > 1 ? 's' : '') + '</span></div>' +
      '<div><b>' + nb(surface, 2) + '</b><span>m²</span></div><div class="pl-r-types">' + esc(compteTypes(liste)) + '</div></div>' +
      '<div class="pl-r-etats">' +
      (par.ok.length === liste.length ? '<span class="pl-pill pl-ok">' + ic('check') + ' ' + (liste.length > 1 ? 'Toutes prêtes à commander' : 'Prête à commander') + '</span>'
        : etatPill('ok', function (n) { return n + ' prête' + (n > 1 ? 's' : ''); }, 'check') +
          etatPill('ecart', function (n) { return n + ' avec écart'; }, 'diff') +
          etatPill('manque', function (n) { return n + ' à compléter'; }, 'alerte')) + '</div></div>';

    // 2. La façade (remplie à la mesure par `remplirFacade`, qui connaît la largeur)
    const zone = facade ? '<div class="pl-facade-zone" id="' + pre + 'facade"><div class="pl-z-tete"><span class="pl-z-t">' + ic('mur') + ' La façade à l’échelle</span>' +
      '<span class="pl-z-s">vue de l’intérieur · touche une ouverture pour aller à sa fiche<span class="pl-glisse"> · fais glisser →</span></span></div>' +
      '<div class="pl-facade" data-pl-facade></div><div class="pl-echelle" data-pl-echelle></div></div>' : '';

    // 3. Ce qui manque pour commander
    const trous = liste.map(function (it, i) { return { i: i, m: manquants(it) }; }).filter(function (x) { return x.m.length; });
    const nTrous = trous.reduce(function (s, x) { return s + x.m.length; }, 0);
    const lienSim = function (i, k) { return o.id ? 'simulateur.html?id=' + encodeURIComponent(o.id) + '&ouv=' + (i + 1) + (k ? '&champ=' + encodeURIComponent(k) : '') : ''; };
    const bandeau = trous.length ? '<div class="pl-manque-b"><div class="pl-mb-t">' + ic('alerte') + ' ' + nTrous + ' information' + (nTrous > 1 ? 's' : '') + ' à compléter avant de commander</div>' +
      trous.map(function (x) { return '<div class="pl-mb-l">' + aller(pre + (x.i + 1), esc(nomLigne(x.i, liste))) + x.m.map(function (c) { return '<span class="pl-ch">' + esc(c.l) + '</span>'; }).join('') + '</div>'; }).join('') + '</div>' : '';

    // 4. Les configurations communes
    const multi = an.groupes;
    const communs = multi.map(function (g, gi) {
      const it0 = liste[g.indices[0]];
      const v = V();
      const titre = v && v.titreEncadre ? v.titreEncadre(g, multi, liste) : 'Configuration commune';
      const modeles = g.indices.map(function (i) { return liste[i].modele; }).filter(function (m, j, a) { return m && a.indexOf(m) === j; }).join(', ');
      const sauf = {}, enPlus = [];
      const cles = {};
      g.commun.forEach(function (e) { cles[e.k] = e; });
      g.indices.forEach(function (i) {
        (g.ecarts[i] || []).forEach(function (e) {
          const qui = aller(pre + (i + 1), esc(nomLigne(i, liste)));
          if (cles[e.k]) (sauf[e.k] = sauf[e.k] || []).push({ html: '<div class="pl-sauf pl-sauf-' + (e.vide ? 'vide' : 'diff') + '">' + ic(e.vide ? 'alerte' : 'diff') + 'sauf ' + qui + ' : ' + valHtml(e) + '</div>' });
          else enPlus.push({ e: e, html: '<div class="pl-sauf pl-sauf-diff">' + ic('diff') + 'seulement ' + qui + ' : ' + esc(libelle(liste[i], e)) + ' — ' + valHtml(e) + '</div>' });
        });
      });
      return '<section class="pl-commun" id="' + pre + 'cc-' + gi + '"><div class="pl-cc-tete"><span class="pl-cc-ic">' + ic('calques') + '</span><div class="pl-cc-titre"><b>' + esc(titre) + '</b>' +
        '<span>' + esc(modeles ? nomType(it0) + ' ' + modeles + ' · ' : '') + 'réglée une fois, valable pour chacun sauf mention</span></div>' +
        '<span class="pl-cc-nos">' + g.indices.map(function (i) { return aller(pre + (i + 1), String(i + 1), 'pl-no', ' data-etat="' + etats[i].k + '" aria-label="Aller à ' + esc(nomLigne(i, liste)) + '"'); }).join('') + '</span></div>' +
        '<div class="pl-cc-grille">' + sectionsHtml(it0, g.commun, { sauf: sauf, enPlus: enPlus }) + '</div></section>';
    }).join('');

    // 5. Les fiches
    const fiches = liste.map(function (it, i) {
      const e = etats[i];
      const gi = an.groupeDe[i];
      const g = gi >= 0 ? multi[gi] : null;
      const tente = estTente(it);
      const W = num(it.largeur), H = dim2(it);
      const sFiche = W > 0 && H > 0 ? Math.min(196 / W, 230 / H) : 0.1;
      let cfg = '';
      if (g) {
        const ec = g.ecarts[i] || [];
        const lienCc = aller(pre + 'cc-' + gi, 'configuration commune');
        cfg = ec.length
          ? '<div class="pl-cfg pl-cfg-ecart"><div class="pl-cfg-t">' + ic('diff') + '<span>Comme la ' + lienCc + ', sauf :</span></div><ul>' + ec.map(function (x) {
              const ref = g.commun.filter(function (c) { return c.k === x.k; })[0] || (g.refs && g.refs[x.k] ? { k: x.k, l: x.l, v: x.check ? (g.refs[x.k].ref ? 'Oui' : '') : g.refs[x.k].ref, check: x.check } : null);
              return '<li class="pl-e-' + (x.vide ? 'vide' : 'diff') + '"><span class="pl-k">' + esc(libelle(it, x)) + '</span><b>' + valHtml(x) + '</b>' +
                (ref && x.n ? '<span class="pl-autres">' + (x.n > 1 ? 'les ' + x.n + ' autres' : 'l’autre') + ' : ' + esc(valTexte(ref)) + '</span>' : '') + '</li>';
            }).join('') + '</ul></div>'
          : '<div class="pl-cfg pl-cfg-ok">' + ic('check') + '<span>Comme la ' + lienCc + ', sans différence</span></div>';
        const anciens = description(it).filter(function (x) { return !x.compare; });
        if (anciens.length) cfg += '<div class="pl-seul">' + sectionsHtml(it, anciens) + '</div>';
      } else {
        const d = description(it);
        cfg = d.length ? '<div class="pl-seul">' + sectionsHtml(it, d) + '</div>' : '<p class="pl-rien">Aucun réglage renseigné.</p>';
      }
      const mq = manquants(it);
      const lien = lienSim(i, mq[0] && mq[0].k);
      const manque = mq.length ? '<div class="pl-mq"><span class="pl-mq-t">' + ic('alerte') + ' À compléter avant de commander :</span>' +
        mq.map(function (c) { return '<span class="pl-ch">' + esc(c.l) + '</span>'; }).join('') +
        (lien ? '<a class="pl-btn" href="' + esc(lien) + '">Compléter ' + ic('fleche') + '</a>' : '') + '</div>' : '';
      const photos = typeof o.photos === 'function' ? o.photos(it, i) : '';
      const nPh = (it.photos || []).length;
      const anime = !tente && W > 0 && H > 0 && typeDe(it) && ['volet_roulant', 'screen', 'tablier_volet'].indexOf(typeDe(it)) >= 0;
      const dessinHtml = dessin(it, sFiche, { cotes: true });
      const leg = legende(it);
      return '<article class="pl-fiche" id="' + pre + (i + 1) + '" data-etat="' + e.k + '" data-i="' + i + '">' +
        '<div class="pl-f-dessin">' + (anime
          ? '<button type="button" class="pl-dv" aria-pressed="false" title="Descendre ou remonter le tablier sur le dessin" aria-label="' + esc(nomLigne(i, liste)) + ' : descendre ou remonter le tablier sur le dessin">' + dessinHtml + '</button>'
          : '<div class="pl-dv pl-dv-fixe">' + dessinHtml + '</div>') +
        (leg ? '<div class="pl-f-leg">' + leg + '</div>' : '') +
        '<div class="pl-f-astuce">' + (tente ? 'vue de dessus' : 'vu de l’intérieur') + (anime ? '<span class="pl-astuce-survol"> · survole le dessin</span><span class="pl-astuce-appui"> · touche le dessin</span>' : '') + '</div>' +
        (facade ? aller(pre + 'facade', ic('haut') + ' Sur la façade', 'pl-lien pl-retour', ' data-pl-fa="' + (i + 1) + '"') : '') + '</div>' +
        '<div class="pl-f-info"><header class="pl-f-tete"><span class="pl-no" data-etat="' + e.k + '">' + (i + 1) + '</span>' +
        '<div class="pl-f-nom"><b>' + esc(it.emplacement || nomLigne(i, liste)) + '</b><span>' + esc(produit(it)) + ' · ' + (it.etage ? esc(it.etage) : 'étage non indiqué') + '</span></div>' +
        // Le MÊME calcul que l'ancienne carte (aucun montant ne change) : prix catalogue × quantité de la ligne.
        pill(e) + '<div class="pl-f-prix"><b>' + esc(eur((it.prix_catalogue_ht || 0) * (it.quantite || 1))) + '</b><small>HTVA' +
        ((it.quantite || 1) !== 1 ? ' · ' + esc(it.quantite) + ' × ' + esc(eur(it.prix_catalogue_ht || 0)) : '') + '</small></div></header>' +
        '<dl class="pl-dims"><div><dt>' + ic('regle') + ' Largeur</dt><dd>' + (W > 0 ? nb(W) + '<i>mm</i>' : '—') + '</dd></div>' +
        '<div><dt>' + (tente ? 'Projection' : 'Hauteur') + '</dt><dd>' + (H > 0 ? nb(H) + '<i>mm</i>' : '—') + '</dd></div>' +
        '<div><dt>Surface</dt><dd>' + (W > 0 && H > 0 ? nb(W / 1000 * H / 1000, 2) + '<i>m²</i>' : '—') + '</dd></div>' +
        '<div><dt>Quantité</dt><dd>× ' + esc(it.quantite || 1) + '</dd></div></dl>' +
        manque + cfg +
        (it.notes ? '<p class="pl-note">' + ic('note') + '<span>' + esc(it.notes) + '</span></p>' : '') +
        (photos ? '<div class="pl-photos"><div class="pl-ph-t">' + ic('camera') + ' Photos <span class="pl-compte">' + nPh + '</span></div>' + photos + '</div>'
          : '<div class="pl-ph-vide">' + ic('camera') + ' Pas encore de photo</div>') +
        '</div></article>';
    }).join('');

    return '<div class="pl" data-pl>' + resume + zone + bandeau + communs + '<div class="pl-fiches">' + fiches + '</div></div>';
  }

  /** Sous le dessin : ce que les repères veulent dire, pour CETTE ouverture. */
  function legende(it) {
    const t = typeDe(it);
    const out = [];
    if (t === 'volet_roulant' || t === 'screen') {
      const cote = t === 'volet_roulant' ? it.cote_manoeuvre : it.lateralite;
      if (cote === 'Gauche' || cote === 'Droite') out.push(ic('moteur') + ' moteur à ' + (cote === 'Droite' ? 'droite' : 'gauche'));
      else out.push(ic('moteur') + ' côté du moteur non précisé');
      if (t === 'volet_roulant' && it.alimentation) out.push(ic(it.alimentation === 'Solaire' ? 'soleil' : 'eclair') + ' ' + (it.alimentation === 'Solaire' ? 'solaire' : 'filaire'));
      if (it.emetteur) out.push(ic('commande') + ' commande murale');
      if (t === 'volet_roulant' && /sur le jour/.test(it.montage_type || '')) out.push(ic('mur') + ' sur le jour');
      if (t === 'volet_roulant' && /dans le jour/.test(it.montage_type || '')) out.push(ic('mur') + ' dans le jour');
    }
    const hach = t === 'volet_roulant' ? [it.couleur, it.couleur_lame, it.lame_finale_couleur, it.couleur_coulisses].some(function (v) { return !rempli(v); })
      : t === 'screen' ? !rempli(it.couleur) || (!rempli(it.toile_couleur) && !rempli(it.collection)) : false;
    if (hach) out.push('<span class="pl-sw pl-sw-x"></span> hachures = couleur à choisir');
    return out.map(function (x) { return '<span>' + x + '</span>'; }).join('');
  }

  /* ══ LA FAÇADE, À LA MESURE ════════════════════════════════════════════════════════════════
     Une seule échelle pour toutes les ouvertures : le volet du jardin est vraiment deux fois plus
     large que celui de la chambre. Elle tient dans la largeur disponible ; quand il y en a trop
     (une douzaine de baies, ou un téléphone), elle ne descend pas sous un seuil lisible et la
     façade défile DANS son cadre, avec « fais glisser → » — jamais la page. */
  const ITEMS = new WeakMap();
  function remplirFacade(racine) {
    if (!racine) return;
    const items = ITEMS.get(racine);
    const f = racine.querySelector('[data-pl-facade]');
    if (!items || !f) return;
    const pre = f.closest('.pl-facade-zone').id.replace(/facade$/, '');
    const larg = f.clientWidth - 8;
    if (!(larg > 0)) return;
    const etroit = larg < 520;
    const n = items.length;
    const sumW = items.reduce(function (s, it) { return s + (num(it.largeur) > 0 ? num(it.largeur) : 1200); }, 0);
    const maxH = Math.max.apply(null, items.map(function (it) { return dim2(it) || 1200; }));
    const sMin = etroit ? 0.045 : 0.03;
    const s = Math.max(sMin, Math.min(0.08, (larg - 14 * (n - 1) - 20 * n) / sumW, (etroit ? 120 : 160) / maxH));
    const an = analyse(items);
    // Chaque baie prend la largeur de son dessin (86 px au moins, la place de ses cotes) : son nom passe à la
    // ligne plutôt que de l'élargir — sinon les noms longs poussaient la façade hors de son cadre.
    f.innerHTML = items.map(function (it, i) {
      const e = etat(items, i, an);
      const lw = Math.max(86, Math.round((num(it.largeur) > 0 ? num(it.largeur) : 1200) * s + 20));
      return '<button type="button" class="pl-fa-item" style="width:' + lw + 'px" data-pl-aller="' + pre + (i + 1) + '" data-pl-fi="' + (i + 1) + '" data-etat="' + e.k + '" aria-label="Aller à ' + esc(nomLigne(i, items)) + ' (' + esc(e.t) + ')">' +
        '<span class="pl-fa-d">' + dessin(it, s, {}) + '</span>' +
        '<span class="pl-fa-leg"><span class="pl-no" data-etat="' + e.k + '">' + (i + 1) + '</span><span>' + esc(it.emplacement || nomType(it)) + (qte(it) > 1 ? ' <b>×' + qte(it) + '</b>' : '') + '</span></span>' +
        '<span class="pl-fa-dim">' + (num(it.largeur) > 0 && dim2(it) > 0 ? nb(num(it.largeur)) + ' × ' + nb(dim2(it)) : 'mesures ?') + '</span>' +
        (estTente(it) ? '<span class="pl-fa-dim">vue de dessus</span>' : '') + '</button>';
    }).join('');
    const z = f.parentElement;
    z.classList.toggle('pl-deborde', f.scrollWidth > f.clientWidth + 2);
    const ech = z.querySelector('[data-pl-echelle]');
    if (ech) ech.innerHTML = '<span class="pl-barre" style="width:' + (1000 * s).toFixed(1) + 'px"></span> 1 m · même échelle pour toutes les ouvertures';
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove('pl-flash');
    void el.offsetWidth;
    el.classList.add('pl-flash');
    setTimeout(function () { el.classList.remove('pl-flash'); }, 1700);
  }
  /**
   * Branche la carte rendue dans `racine` : la façade à la mesure, les liens internes, le tablier
   * qui descend d'un appui. À rappeler après CHAQUE rendu (la fiche re-rend tout à chaque
   * enregistrement) ; les écouteurs, eux, ne se posent qu'une fois sur la racine.
   */
  function monter(racine, items) {
    if (!racine) return;
    poserCss(racine.ownerDocument);
    ITEMS.set(racine, items || []);
    remplirFacade(racine);
    if (racine.__plBranche) return;
    racine.__plBranche = true;
    racine.addEventListener('click', function (ev) {
      const dv = ev.target.closest('button.pl-dv');
      if (dv && racine.contains(dv)) {
        const f = dv.classList.toggle('pl-ferme');
        dv.setAttribute('aria-pressed', String(f));
        return;
      }
      const a = ev.target.closest('[data-pl-aller]');
      if (!a || !racine.contains(a)) return;
      const doc = racine.ownerDocument;
      const cible = doc.getElementById(a.getAttribute('data-pl-aller'));
      if (!cible) return;
      const vue = doc.defaultView;
      const doux = !(vue.matchMedia && vue.matchMedia('(prefers-reduced-motion: reduce)').matches);
      cible.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'center' });
      flash(cible);
      // « Sur la façade » : la baie de CETTE fiche s'allume aussi, et prend la main au clavier.
      const fi = a.getAttribute('data-pl-fa');
      if (fi) {
        const item = cible.querySelector('[data-pl-fi="' + fi + '"]');
        if (item) { flash(item); try { item.focus({ preventScroll: true }); } catch (e) { item.focus(); } }
      } else if (cible.matches('.pl-fiche, .pl-commun')) {
        cible.setAttribute('tabindex', '-1');
        try { cible.focus({ preventScroll: true }); } catch (e) { /* ancien navigateur : le défilement suffit */ }
      }
    });
    const vue = racine.ownerDocument.defaultView;
    if (vue.ResizeObserver) {
      let l0 = racine.clientWidth;   // la façade vient d'être remplie à cette largeur
      new vue.ResizeObserver(function () {
        const l = racine.clientWidth;
        if (Math.abs(l - l0) < 4) return;
        l0 = l;
        remplirFacade(racine);
      }).observe(racine);
    }
  }

  /* ══ LA FEUILLE DE STYLE (elle voyage avec le composant, comme celle de `volet.js`) ══════════
     Uniquement des jetons du thème : la carte suit les cinq thèmes. Les seules couleurs écrites
     en dur sont dans les DESSINS (le verre, le panneau solaire, l'ajourage) et les teintes RAL.
     Les mises en page suivent la largeur de la CARTE (requêtes de conteneur), pas de l'écran :
     la colonne centrale de la fiche va de ~830 px (écran de 1 500) à ~1 150 px (1 875). */
  const CSS = `
.pl{container:pl / inline-size;display:grid;gap:var(--sp-4);min-width:0;
  --pl-trait:color-mix(in srgb,var(--text) 50%,transparent);--pl-cote:var(--text-muted);
  --pl-mur:color-mix(in srgb,var(--text-muted) 16%,var(--surface));--pl-mur-t:color-mix(in srgb,var(--text-muted) 40%,var(--surface));
  --pl-v1:color-mix(in srgb,var(--accent) 12%,var(--surface));--pl-v2:color-mix(in srgb,var(--accent) 32%,var(--surface));
  --pl-chassis:color-mix(in srgb,var(--surface) 82%,var(--text));--pl-plan:color-mix(in srgb,var(--surface-2) 70%,var(--surface));
  --pl-diff:var(--accent-3);--pl-vide:var(--warn);}
.pl-i{width:1em;height:1em;flex:none;vertical-align:-.14em}
.pl-code{font-family:var(--font-mono);font-size:var(--fs-2xs);font-weight:400;color:var(--text-subtle);letter-spacing:0}
.pl-lien{font:inherit;color:var(--accent);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.pl-lien:hover{color:var(--accent-strong,var(--accent))}
.pl :focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}
.pl-flash{animation:pl-flash 1.6s ease-out}
@keyframes pl-flash{0%{box-shadow:0 0 0 3px var(--accent-2)}100%{box-shadow:0 0 0 0 transparent}}
@media (prefers-reduced-motion:reduce){.pl-flash{animation:none;outline:2px solid var(--accent-2)}}
/* Résumé */
.pl-resume{display:flex;flex-wrap:wrap;gap:var(--sp-3) var(--sp-5);align-items:center;justify-content:space-between}
.pl-r-chiffres{display:flex;flex-wrap:wrap;gap:var(--sp-1) var(--sp-5);align-items:baseline}
.pl-r-chiffres>div{display:grid}
.pl-r-chiffres b{font-family:var(--font-display);font-weight:800;font-size:var(--fs-xl);line-height:1.15;font-variant-numeric:tabular-nums}
.pl-r-chiffres span{font-size:var(--fs-xs);color:var(--text-muted)}
.pl-r-types{font-size:var(--fs-sm);color:var(--text-muted);align-self:center}
.pl-r-etats{display:flex;flex-wrap:wrap;gap:6px}
.pl-pill{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:var(--fs-xs);font-weight:600;padding:4px 10px;border-radius:var(--r-pill);white-space:nowrap;border:1px solid transparent;line-height:1.3}
button.pl-pill{cursor:pointer}
button.pl-pill:hover{border-color:currentColor}
.pl-ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
.pl-ecart{color:var(--pl-diff);background:color-mix(in srgb,var(--pl-diff) 13%,transparent)}
.pl-manque{color:var(--pl-vide);background:color-mix(in srgb,var(--pl-vide) 12%,transparent)}
/* Numéro + pastille d'état */
.pl-no{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:var(--r-sm);background:var(--accent);color:var(--on-accent);
  font-family:var(--font-display);font-weight:800;font-size:11px;flex:none;position:relative;border:0;font-variant-numeric:tabular-nums}
button.pl-no{cursor:pointer}
.pl-no[data-etat]::after{content:"";position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;border:2px solid var(--surface)}
.pl-no[data-etat="ok"]::after{background:var(--ok)}
.pl-no[data-etat="ecart"]::after{background:var(--pl-diff)}
.pl-no[data-etat="manque"]::after{background:var(--pl-vide)}
/* Façade */
.pl-facade-zone{border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-3) var(--sp-4) var(--sp-2);min-width:0;background-color:var(--pl-plan);
  background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px}
.pl-z-tete{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:baseline;margin-bottom:var(--sp-2)}
.pl-z-t{display:inline-flex;gap:7px;align-items:center;font-weight:600;font-size:var(--fs-sm)}
.pl-z-t .pl-i{color:var(--accent)}
.pl-z-s{font-size:var(--fs-xs);color:var(--text-subtle)}
.pl-glisse{display:none}
.pl-deborde .pl-glisse{display:inline}
.pl-facade{display:flex;align-items:flex-end;gap:14px;overflow-x:auto;padding:6px 2px 4px;scroll-snap-type:x proximity;scrollbar-width:thin}
.pl-fa-item{flex:none;display:grid;justify-items:center;align-content:end;gap:4px;font:inherit;color:inherit;background:transparent;border:0;padding:4px 2px 6px;border-radius:var(--r-sm);cursor:pointer;scroll-snap-align:start;min-width:86px}
.pl-fa-item:hover,.pl-fa-item:focus-visible{background:color-mix(in srgb,var(--accent) 9%,transparent)}
.pl-fa-leg{display:flex;justify-content:center;gap:5px;align-items:center;font-size:var(--fs-xs);font-weight:600;max-width:100%;text-align:left;line-height:1.2;overflow-wrap:break-word}
.pl-fa-leg>span:last-child{min-width:0}
.pl-fa-dim{font-family:var(--font-mono);font-size:var(--fs-2xs);color:var(--text-subtle);font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}
.pl-echelle{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-family:var(--font-mono);font-size:var(--fs-2xs);color:var(--text-subtle);margin-top:4px}
.pl-barre{height:6px;border:1.5px solid var(--pl-cote);border-top:0;flex:none}
/* Ce qui manque */
.pl-manque-b{border:1px solid var(--pl-vide);background:color-mix(in srgb,var(--pl-vide) 8%,transparent);border-radius:var(--r-md);padding:var(--sp-2) var(--sp-3);display:grid;gap:6px}
.pl-mb-t{display:flex;gap:8px;align-items:center;font-weight:600;color:var(--pl-vide);font-size:var(--fs-sm)}
.pl-mb-l{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:var(--fs-sm)}
.pl-mb-l .pl-lien{color:var(--text);font-weight:600}
.pl-ch{display:inline-block;font-size:var(--fs-xs);padding:1px 7px;border-radius:var(--r-sm);background:var(--surface);border:1px solid var(--pl-vide);color:var(--text)}
/* Configuration commune */
.pl-commun{border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface);min-width:0;scroll-margin-top:calc(var(--header-h,60px) + 12px)}
.pl-cc-tete{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:var(--sp-2) var(--sp-4);border-bottom:1px solid var(--border);background:var(--surface-2);border-radius:var(--r-md) var(--r-md) 0 0}
.pl-cc-ic{width:30px;height:30px;display:grid;place-items:center;border-radius:var(--r-sm);background:var(--accent);color:var(--on-accent);flex:none}
.pl-cc-ic .pl-i{width:17px;height:17px}
.pl-cc-titre{min-width:0;flex:1 1 220px}
.pl-cc-titre b{display:block;font-size:var(--fs-md)}
.pl-cc-titre span{font-size:var(--fs-xs);color:var(--text-muted)}
.pl-cc-nos{display:flex;gap:6px;flex-wrap:wrap}
.pl-cc-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}
.pl-cc-grille>.pl-sec{border-top:1px solid var(--border);margin-top:-1px}
.pl-cc-grille>.pl-sec+.pl-sec{border-left:1px solid var(--border);margin-left:-1px}
/* Mécanique est de loin la plus longue : à droite, sur toute la hauteur ; Couleurs et Commande empilées à
   gauche. Trois colonnes égales laissaient deux tiers de vide sous les deux courtes. */
@container pl (min-width: 700px){
  .pl-cc-grille:has(>.pl-sec[data-sec="Mécanique"]){grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}
  .pl-cc-grille:has(>.pl-sec[data-sec="Mécanique"])>.pl-sec{border-left:0;margin-left:0;grid-column:1}
  .pl-cc-grille:has(>.pl-sec[data-sec="Mécanique"])>.pl-sec[data-sec="Mécanique"]{grid-column:2;grid-row:1 / span 2;border-left:1px solid var(--border)}
}
.pl-sec{padding:var(--sp-3) var(--sp-4);display:grid;gap:10px;align-content:start;min-width:0}
.pl-sec h4{margin:0;display:flex;align-items:center;gap:7px;font-size:var(--fs-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.pl-sec h4 .pl-i{width:15px;height:15px}
.pl-nuancier{display:flex;height:12px;border-radius:3px;overflow:hidden;border:1px solid var(--pl-trait)}
.pl-nuancier span{flex:1;background:var(--c)}
.pl-teinte{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:start}
.pl-pastille{width:40px;height:40px;border-radius:5px;background:var(--c);border:1px solid var(--pl-trait);box-shadow:inset 0 -10px 14px rgba(0,0,0,.12),inset 0 6px 10px rgba(255,255,255,.12)}
.pl-teinte-t{display:grid;gap:2px;min-width:0}
.pl-teinte-t b{font-size:var(--fs-sm);line-height:1.25}
.pl-roles{display:flex;flex-wrap:wrap;gap:3px;margin-top:2px}
.pl-roles span{font-size:var(--fs-2xs);padding:0 6px;border-radius:3px;background:var(--surface-3);color:var(--text-muted)}
.pl-sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:var(--c);border:1px solid var(--pl-trait)}
.pl-sw-x{background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--pl-vide) 18%,transparent) 0 4px,transparent 4px 8px)!important;border:1px dashed var(--pl-vide)}
.pl-lignes{display:grid;gap:8px;margin:0}
.pl-sg{font-family:var(--font-mono);font-size:var(--fs-3xs);letter-spacing:.08em;text-transform:uppercase;color:var(--text-subtle);border-bottom:1px solid var(--border);padding-bottom:2px;margin-top:4px}
.pl-ligne{display:grid;grid-template-columns:minmax(90px,34%) minmax(0,1fr) auto;gap:2px 10px;align-items:start}
.pl-l-k{font-size:var(--fs-xs);color:var(--text-muted);padding-top:1px;min-width:0}
.pl-l-v{margin:0;font-size:var(--fs-sm);font-weight:600;min-width:0;overflow-wrap:anywhere}
.pl-aide{grid-column:1/-1;font-size:var(--fs-xs);color:var(--text-muted);line-height:1.45;padding-left:8px;border-left:2px solid var(--border)}
.pl-pic{color:var(--text-muted)}
.pl-picto{display:block}
.pl-oui{color:var(--ok);display:inline-flex;gap:4px;align-items:center}
.pl-non{color:var(--text-subtle);font-weight:400}
.pl-v-vide{color:var(--pl-vide)}
.pl-sauf{grid-column:1/-1;font-size:var(--fs-xs);font-weight:600;padding:2px 7px;border-radius:3px;justify-self:start;line-height:1.5}
.pl-sauf .pl-i{margin-right:4px}
.pl-sauf .pl-lien{color:inherit}
.pl-sauf-diff{color:var(--pl-diff);background:color-mix(in srgb,var(--pl-diff) 12%,transparent)}
.pl-sauf-vide{color:var(--pl-vide);background:color-mix(in srgb,var(--pl-vide) 11%,transparent)}
.pl-teinte-t .pl-sauf{margin-top:3px}
.pl-cmd{display:grid;gap:8px}
.pl-cmd-l{display:grid;grid-template-columns:34px minmax(0,1fr);gap:4px 10px;align-items:center}
.pl-cmd-ic{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 11%,transparent);color:var(--accent)}
.pl-cmd-ic .pl-i{width:17px;height:17px}
.pl-cmd-l b{display:block;font-size:var(--fs-sm);line-height:1.3}
.pl-cmd-l div>span{font-size:var(--fs-xs);color:var(--text-muted)}
/* Fiches */
.pl-fiches{display:grid;gap:var(--sp-3)}
.pl-fiche{display:grid;grid-template-columns:290px minmax(0,1fr);border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface);min-width:0;scroll-margin-top:calc(var(--header-h,60px) + 12px)}
.pl-fiche[data-etat="ecart"]{border-color:color-mix(in srgb,var(--pl-diff) 45%,var(--border))}
.pl-fiche[data-etat="manque"]{border-color:color-mix(in srgb,var(--pl-vide) 55%,var(--border))}
.pl-f-dessin{background:var(--pl-plan);border-right:1px solid var(--border);padding:var(--sp-3);display:grid;justify-items:center;align-content:center;gap:8px;border-radius:var(--r-md) 0 0 var(--r-md);min-width:0}
.pl-dv{font:inherit;color:inherit;background:transparent;border:0;padding:0;display:block;line-height:0;border-radius:var(--r-sm);max-width:100%}
button.pl-dv{cursor:pointer}
.pl-svg{display:block;max-width:100%;height:auto;overflow:visible}
.pl-f-leg{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 10px;font-size:var(--fs-xs);color:var(--text-muted)}
.pl-f-leg>span{display:inline-flex;gap:4px;align-items:center}
.pl-f-leg .pl-i{color:var(--accent)}
.pl-f-astuce{font-family:var(--font-mono);font-size:var(--fs-3xs);color:var(--text-subtle);text-align:center}
.pl-astuce-appui{display:none}
@media (hover:none){.pl-astuce-survol{display:none}.pl-astuce-appui{display:inline}}
.pl-retour{font-size:var(--fs-xs);display:inline-flex;gap:4px;align-items:center;min-height:32px}
.pl-f-info{padding:var(--sp-3) var(--sp-4);display:grid;gap:var(--sp-3);align-content:start;min-width:0}
.pl-f-tete{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.pl-f-tete .pl-no{min-width:28px;height:28px;font-size:13px}
.pl-f-nom{min-width:0;flex:1 1 170px}
.pl-f-nom b{display:block;font-size:var(--fs-lg);line-height:1.2}
.pl-f-nom span{font-size:var(--fs-xs);color:var(--text-muted)}
.pl-f-prix{text-align:right;display:grid}
.pl-f-prix b{font-family:var(--font-mono);font-size:var(--fs-lg);color:var(--accent-2-ink);font-variant-numeric:tabular-nums}
.pl-f-prix small{font-size:var(--fs-2xs);color:var(--text-subtle)}
.pl-dims{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden}
.pl-dims>div{padding:6px 10px;min-width:0}
.pl-dims>div+div{border-left:1px solid var(--border)}
.pl-dims dt{font-size:var(--fs-xs);color:var(--text-muted);display:flex;gap:5px;align-items:center}
.pl-dims dt .pl-i{color:var(--accent);width:12px;height:12px}
.pl-dims dd{margin:0;font-family:var(--font-mono);font-weight:600;font-size:var(--fs-md);font-variant-numeric:tabular-nums}
.pl-dims dd i{font-style:normal;font-size:var(--fs-2xs);color:var(--text-subtle);margin-left:3px;font-weight:400}
.pl-mq{border:1px dashed var(--pl-vide);border-radius:var(--r-sm);padding:var(--sp-2) var(--sp-3);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:var(--fs-sm)}
.pl-mq-t{font-weight:600;display:inline-flex;gap:6px;align-items:center}
.pl-btn{margin-left:auto;display:inline-flex;gap:6px;align-items:center;font-size:var(--fs-xs);font-weight:700;padding:6px 12px;border-radius:var(--r-sm);border:1px solid var(--pl-vide);color:var(--pl-vide);background:var(--surface);text-decoration:none;min-height:34px}
.pl-btn:hover{background:color-mix(in srgb,var(--pl-vide) 10%,var(--surface));text-decoration:none}
.pl-cfg{font-size:var(--fs-sm);border-radius:var(--r-sm);padding:var(--sp-2) var(--sp-3);display:grid;gap:6px}
.pl-cfg-ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 10%,transparent);display:flex;gap:8px;align-items:center;font-weight:600}
.pl-cfg-ok .pl-lien{color:inherit}
.pl-cfg-ecart{background:color-mix(in srgb,var(--pl-diff) 10%,transparent)}
.pl-cfg-t{display:flex;gap:8px;align-items:center;font-weight:600;color:var(--pl-diff)}
.pl-cfg-t .pl-lien{color:inherit}
.pl-cfg ul{margin:0;padding:0;list-style:none;display:grid;gap:4px}
.pl-cfg li{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;padding-left:10px;border-left:3px solid var(--pl-diff)}
.pl-cfg li.pl-e-vide{border-left-color:var(--pl-vide)}
.pl-k{color:var(--text-muted);font-size:var(--fs-xs)}
.pl-cfg li b{color:var(--pl-diff)}
.pl-cfg li.pl-e-vide b{color:var(--pl-vide)}
.pl-autres{font-size:var(--fs-xs);color:var(--text-subtle)}
.pl-seul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:var(--sp-2) var(--sp-4)}
.pl-seul .pl-sec{padding:0}
.pl-rien{margin:0;font-size:var(--fs-sm);color:var(--text-subtle)}
.pl-note{margin:0;font-size:var(--fs-sm);background:var(--surface-2);border-radius:var(--r-sm);padding:7px 10px;display:flex;gap:8px}
.pl-note .pl-i{color:var(--accent-2-ink);margin-top:3px}
.pl-photos{display:grid;gap:2px}
.pl-photos .photo-grid{margin-top:4px}
.pl-ph-t,.pl-ph-vide{display:flex;gap:6px;align-items:center;font-size:var(--fs-xs);color:var(--text-muted)}
.pl-ph-t .pl-i{color:var(--accent)}
.pl-ph-vide{color:var(--text-subtle)}
.pl-compte{font-family:var(--font-mono);font-size:var(--fs-2xs);background:var(--surface-3);padding:0 6px;border-radius:3px}
.pl-svg-x .pl-sans{fill:none;stroke:var(--pl-vide);stroke-dasharray:4 3}
.pl-svg-x .pl-sans-t{fill:var(--pl-vide);font-size:12px;font-family:var(--font-mono)}
/* Le dessin */
.pl-svg .pl-tr{stroke:var(--pl-trait);stroke-width:.8}
.pl-svg .pl-mur{fill:var(--pl-mur);stroke:var(--pl-mur-t);stroke-width:1}
.pl-svg .pl-baie{fill:none;stroke:var(--pl-cote);stroke-width:.9;stroke-dasharray:3 3}
.pl-svg .pl-chassis{fill:none;stroke:var(--pl-chassis)}
.pl-svg .pl-v1{stop-color:var(--pl-v1)}
.pl-svg .pl-v2{stop-color:var(--pl-v2)}
.pl-svg .pl-reflet{stroke:#fff;stroke-opacity:.35}
.pl-svg .pl-moteur{fill:#fff;stroke:#10142a;stroke-width:1}
.pl-svg .pl-cable{fill:none;stroke:var(--pl-cote);stroke-width:1.2}
.pl-svg .pl-inter{fill:var(--surface);stroke:var(--pl-cote);stroke-width:1}
.pl-svg .pl-inter-f{fill:var(--pl-cote)}
.pl-svg .pl-bras{stroke:var(--pl-trait);stroke-width:1.2;stroke-dasharray:3 2;fill:none}
.pl-svg .pl-cote-l{stroke:var(--pl-cote);stroke-width:.9;fill:none}
.pl-svg .pl-cote-r{stroke:var(--pl-cote);stroke-width:.6;stroke-dasharray:2 2;fill:none;opacity:.7}
.pl-svg .pl-cote-t{fill:var(--pl-cote);font-family:var(--font-mono);font-size:11px;font-weight:500}
.pl-svg .pl-hz-f{fill:color-mix(in srgb,var(--pl-vide) 10%,transparent)}
.pl-svg .pl-hz-t{fill:var(--pl-vide);fill-opacity:.55}
.pl-svg .pl-pv{fill:#1d3b8f;stroke:#0b1a4a;stroke-width:.6}
.pl-svg .pl-pv-g{stroke:#9bb6ff;stroke-opacity:.5;stroke-width:.5}
.pl-svg .pl-tab{transform:translateY(var(--ty));transition:transform 1.1s cubic-bezier(.3,.75,.2,1)}
.pl-dv.pl-ferme .pl-tab{transform:translateY(0)}
@media (hover:hover){.pl-dv:hover .pl-tab,.pl-fa-item:hover .pl-tab{transform:translateY(0)}}
.pl-dv:focus-visible .pl-tab,.pl-fa-item:focus-visible .pl-tab{transform:translateY(0)}
@media (prefers-reduced-motion:reduce){.pl-svg .pl-tab{transition:none}}
/* Carte étroite : la fiche s'empile (dessin au-dessus), les mesures passent en 2 × 2 */
@container pl (max-width: 840px){
  .pl-fiche{grid-template-columns:230px minmax(0,1fr)}
}
@container pl (max-width: 600px){
  .pl-fiche{grid-template-columns:minmax(0,1fr)}
  .pl-f-dessin{border-right:0;border-bottom:1px solid var(--border);border-radius:var(--r-md) var(--r-md) 0 0}
}
@container pl (max-width: 560px){
  .pl-dims{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pl-dims>div:nth-child(3){border-left:0}
  .pl-dims>div:nth-child(n+3){border-top:1px solid var(--border)}
  .pl-f-info{padding:var(--sp-3)}
  .pl-f-prix{text-align:left}
  .pl-sec{padding:var(--sp-3)}
  .pl-cc-tete{padding:var(--sp-2) var(--sp-3)}
  .pl-cc-grille>.pl-sec+.pl-sec{border-left:0;margin-left:0}
  .pl-ligne{grid-template-columns:minmax(80px,40%) minmax(0,1fr) auto}
  .pl-r-chiffres b{font-size:var(--fs-lg)}
  .pl-btn{margin-left:0;min-height:44px}
  /* ⚠️ Deux classes : sur écran TACTILE, \`.pl-lien{min-height:32px}\` (plus bas, même poids) l'emportait sur
     une seule — trouvé par la suite jouée en émulation tactile. */
  .pl-lien.pl-retour{min-height:44px}
  .pl-no{min-width:28px;height:28px}
  button.pl-pill{min-height:36px}
}
@media (pointer:coarse){.pl-fa-item{min-height:44px}.pl-lien{min-height:32px}}
`;
  function poserCss(doc) {
    const d = doc || document;
    if (d.getElementById('ss-plan-css')) return;
    const st = d.createElement('style');
    st.id = 'ss-plan-css';
    st.textContent = CSS;
    d.head.appendChild(st);
  }

  window.SSPlan = {
    teinte: teinte,
    codesTeinte: codesTeinte,
    description: description,
    sectionDe: sectionDe,
    analyse: analyse,
    etat: etat,
    dessin: dessin,
    coupe: coupe,
    profil: profil,
    carteHtml: carteHtml,
    remplirFacade: remplirFacade,
    monter: monter,
    poserCss: poserCss,
    valTexte: valTexte,
    codeEtTexte: codeEtTexte,
  };
})();
