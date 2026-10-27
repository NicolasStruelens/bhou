// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LE BAC À SABLE : des dossiers FICTIFS pour essayer l'ERP sans toucher au réel
// Script classique (pas de module). Global : window.SSBacASable
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI (26/10/2026, demande de Nicolas : « des tests avec un client fictif et des simulations
// tous azimuts »). En PRODUCTION, un client fictif n'est pas inoffensif : une facture d'essai
// consomme un vrai numéro F2026-xxx, jamais réutilisé (règle 5) ; le CA, le cockpit et les
// compteurs de l'autre le comptent ; le journal d'activité en garde la trace. D'où une base d'ESSAI
// séparée, branchée sur les seuls APERÇUS de branche (DEPLOIEMENT.md, étape 12), et ce module pour
// la remplir.
//
// TROIS GARDES, toutes vérifiées AVANT la première écriture (`verifier`) :
//  1. l'HÔTE est un aperçu de branche (`SSUI.hoteBacASable`) — jamais la production ;
//  2. une IDENTITÉ Access répond — sans elle l'aperçu est ouvert à tous, et une base branchée sur
//     un aperçu public serait une API ouverte (le dépôt est public, les noms de branche aussi) ;
//  3. la BASE est vide, ou porte déjà des dossiers ESSAI- : une base pleine SANS un seul dossier
//     ESSAI- est une vraie base (la production branchée par erreur sur les aperçus) — refus.
//  La troisième est celle qui compte : elle ne dépend d'aucun réglage Cloudflare.
//
// Tout ce qui est créé est REPÉRABLE (identifiants ESSAI-…, SUJ-ESSAI-…, DISPO-ESSAI-…, clés des
// fiches listées ici), donc « Vider » ne retire QUE ce que « Remplir » a posé — jamais ce qu'on a
// saisi à la main pendant un essai. Les dates sont RELATIVES au jour où l'on remplit : relancer
// « Remplir » remet chaque dossier dans son état de départ (« envoyé il y a 6 jours » reste vrai
// la semaine suivante).
//
// Les montants sortent du VRAI moteur (`SSCalc.computeDevis`, réglages par défaut de `SSConf`),
// construits comme le simulateur les enregistre : un essai sur des totaux inventés ne prouverait rien.
(function () {
  'use strict';

  const PREFIXE = 'ESSAI-';
  const U = function () { return window.SSUI; };
  /* LA FICHE QUI MARQUE LA BASE D'ESSAI. Sans elle, une base d'essai vidée qui ne garderait que des
     devis saisis à la main pendant un essai ressemblerait trait pour trait à une vraie base, et la
     garde refuserait de la remplir pour toujours. « Remplir » la pose, « Vider » ne la retire JAMAIS,
     et aucune vraie base ne la porte. */
  const MARQUE = { prenom: 'Bac à sable', nom: 'ESSAI' };
  function cleMarque() { return U().clientKeyOf(MARQUE.prenom, MARQUE.nom); }

  // ── Les dates, relatives au jour de remplissage (heure LOCALE, règle 18) ──────────────────────
  function jour(base, n) { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + n); return U().isoDate(d); }
  function horo(base, n, h) { return new Date(jour(base, n) + 'T' + (h || '10:00') + ':00').toISOString(); }
  function samediSuivant(base) { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7)); return U().isoDate(d); }

  // ── Des photos DESSINÉES, légères, qui disent qu'elles sont fausses ──────────────────────────
  function photo(texte, fond) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">'
      + '<rect width="800" height="600" fill="' + fond + '"/><text x="40" y="300" font-family="sans-serif" font-size="56" fill="#fff">'
      + texte + '</text><text x="40" y="370" font-family="sans-serif" font-size="28" fill="#ffffffaa">photo d’essai</text></svg>');
  }

  /* ── Les clients ──────────────────────────────────────────────────────────────────────────────
     Des noms qui ont la FORME des vrais : une apostrophe dans le nom (L'Hoest) et dans la commune
     (Braine-l'Alleud), des accents, une particule, un nom long — c'est sur eux que les écrans
     cassent. Les communes et codes postaux sont réels (carte, météo, portfolio s'en servent) ; les
     rues, les numéros de téléphone et les adresses e-mail sont FAUX par construction : « 0000 … »
     ne compose rien, et le domaine « .invalid » ne peut recevoir aucun mail (RFC 2606). */
  const CLIENTS = [
    ['c01', 'Sophie', 'Lambert', 'Waterloo', '1410'],
    ['c02', 'Marc', 'Dubois', 'Wavre', '1300'],
    ['c03', 'Martine', "L'Hoest", 'Nivelles', '1400', { civilite: 'Madame', ton: 'pro' }],
    ['c04', 'Luc', 'Van den Bossche', 'Genval', '1332'],
    ['c05', 'Claire', 'Dewit', 'Rixensart', '1330'],
    ['c06', 'Anne', 'Lejeune', 'Ottignies', '1340'],
    ['c07', 'Pierre', 'Meunier', 'Louvain-la-Neuve', '1348'],
    ['c08', 'Isabelle', 'Fontaine', 'Jodoigne', '1370'],
    ['c09', 'Thomas', 'Renard', 'Gembloux', '5030'],
    ['c10', 'Direction', 'École Saint-Exemple', "Braine-l'Alleud", '1420', { civilite: 'Madame', ton: 'pro' }],
    ['c11', 'Julie', 'Martin', 'Uccle', '1180'],
    ['c12', 'Bernard', 'Dupont', 'Écaussinnes', '7190'],
    ['c13', 'Nathalie', 'Henry', 'Tubize', '1480'],
    ['c14', 'Olivier', 'Collin', 'Namur', '5000'],
    ['c15', 'Syndic', 'Résidence Les Tilleuls', 'Wavre', '1300', { ton: 'pro' }],
    ['c16', 'Gérard', 'Lemaire', 'Waterloo', '1410'],
    ['c17', 'Sarah', 'Peeters', 'Ottignies', '1340'],
    ['c18', 'Jacques', 'Archivé', 'Wavre', '1300'],
    ['c19', 'Kevin', 'Lambot', 'Nivelles', '1400'],
    ['c20', 'Test', 'Dégradé', '', ''],
    ['c21', 'Laura', 'Simon', 'Wavre', '1300'],
    ['c22', 'Paul', 'Gilson', 'Rixensart', '1330'],
    ['c23', 'Hélène', 'Charlier', 'Louvain-la-Neuve', '1348'],
    ['c24', 'Damien', 'Leroy', 'Genval', '1332'],
    ['c25', 'Robert', 'Delvaux', 'La Hulpe', '1310'],
    ['c26', 'Nadia', 'Benali', 'Wavre', '1300'],
    ['c27', 'Hugo', 'Lemoine', 'Nivelles', '1400'],
  ];
  function client(code) {
    const i = CLIENTS.findIndex(function (c) { return c[0] === code; });
    const c = CLIENTS[i];
    const n = String(i + 1).padStart(2, '0');
    const fiche = {
      prenom: c[1], nom: c[2],
      telephone: c[3] ? '0000 00 00 ' + n : '',
      email: c[3] ? 'essai.' + c[0] + '@exemple.invalid' : '',
      adresse: c[3] ? { rue: "Rue de l'Essai", numero: String(i + 1), code_postal: c[4], ville: c[3] } : {},
    };
    return Object.assign(fiche, c[5] || {});
  }

  /* ── Les ouvertures (mêmes champs que le simulateur) ──────────────────────────────────────────
     COMPLÈTES, avec des valeurs prises dans les VRAIES listes du catalogue (`SSProducts` :
     CS8_VARIANTES, CS8_COLLECTIONS, CS8_MOTEURS, VR_LAMES, VR_CAISSONS, VR_COULEURS_LAMES,
     TS_MANOEUVRES, TS_COLLECTIONS) : une valeur hors liste s'afficherait « valeur enregistrée »
     (règle 31 bis), et un champ exigé vide allume « à compléter » (`CHAMPS_REQUIS`). Seul le
     dossier ABÎMÉ (ESSAI-20) doit porter ce badge — c'est lui qui le teste (test R12).
     Le caisson de volet (165) couvre la hauteur de 1 400 mm. */
  function screens(n, o) {
    return Object.assign({ type: 'screen', modele: 'SC 90', variante: 'Standard', largeur: 2400, hauteur: 2200, quantite: n, prix_catalogue_ht: 1450,
      collection: 'Collectie soltis 86', toile_couleur: 'Gris', couleur: '7016 — Gris anthracite', caisson_mesure: '110x115',
      moteur_ref: '4114: Sunea 40 RTS', emplacement: 'Façade sud', emetteur: true, photos: [] }, o || {});
  }
  function volets(n, o) {
    return Object.assign({ type: 'volet_roulant', modele: 'VR150', largeur: 1200, hauteur: 1400, quantite: n, prix_catalogue_ht: 780,
      lame_type: 'alu35', caisson_mesure: '165', alimentation: 'Électrique (filaire)', moteur: 'Secure (RF, standard)',
      couleur: '9016 — Blanc signalisation', couleur_lame: '01 — 9016 Blanc', emplacement: 'Chambres', emetteur: true, photos: [] }, o || {});
  }
  function tente(o) {
    return Object.assign({ type: 'tente_solaire', modele: 'BX270', largeur: 4000, projection: 3000, quantite: 1, prix_catalogue_ht: 3200,
      manoeuvre: 'Moteur', moteur: 'IO (standard)', collection: 'Dickson Orchestra', toile_couleur: 'Écru',
      couleur: '7016 — Gris anthracite', telecommande: true, photos: [] }, o || {});
  }

  /* ── Un devis, comme le simulateur l'enregistre ───────────────────────────────────────────────
     Les champs `_attente`, `_notes`, `_sav`, `_factures` ne partent PAS avec le devis : ce sont des
     écritures CIBLÉES (règle 3) que `remplir` fait ensuite par leurs propres routes — c'est aussi
     ce qui les rend fidèles (l'auteur, la date et la validation viennent du serveur). */
  function devis(base, o) {
    const prix = (window.SSConf && window.SSConf.DEFAUTS && window.SSConf.DEFAUTS.prix) || {};
    const principal = o.vendeur || 'nicolas';
    const items = o.items || [];
    const ouv = window.SSCalc.ouverturesReelles(items);
    const input = {
      rates: { supplier_rate: prix.supplier_rate, material_margin: prix.material_margin, net_divisor: prix.net_divisor },
      items: items.map(function (i) { return { quantite: i.quantite, prix_catalogue_ht: i.prix_catalogue_ht, largeur: i.largeur, hauteur: i.hauteur }; }),
      sellers: { principal: principal, nicolas_pct: principal === 'nicolas' ? prix.commission_principal : prix.commission_second,
        yannick_pct: principal === 'yannick' ? prix.commission_principal : prix.commission_second },
      installation: { install_gross: prix.install_gross, tech1_gross: prix.tech1_gross, tech2_gross: prix.tech2_gross, tools_gross: prix.tools_gross,
        install_qty: ouv, tech1_qty: ouv, tech2_qty: ouv, tools_qty: ouv },
      extras: o.extras || [], tva_pct: o.tva || prix.tva_pct, acompte_pct: prix.acompte_pct, surplus_difficulte: 0,
      remise_catalogue: { mode: 'eur', value: o.remise || 0 }, remise_installation: { mode: 'eur', value: 0 }, remise_outillage: { mode: 'eur', value: 0 },
    };
    const c = window.SSCalc.computeDevis(input);
    const d = {
      id: PREFIXE + o.n, version: 1,
      date_creation: horo(base, o.cree || 0, '09:00'), date_modification: horo(base, o.modifie != null ? o.modifie : (o.cree || 0), '09:30'),
      statut: o.statut || 'brouillon', type_document: o.depannage ? 'depannage' : 'devis',
      informatif: !!o.informatif, client: client(o.client), items: items, calculs: c,
      pricing_v2: {
        rates: c.rates, tva_pct: input.tva_pct, acompte_pct: input.acompte_pct, surplus_difficulte: 0, note: o.note || '',
        material: { sellers: { mode: 'fixed', principal: principal, nicolas_pct: c.nicolas_pct, yannick_pct: c.yannick_pct } },
        installation: { per_opening: input.installation, install_qty: ouv, tech1_qty: ouv, tech2_qty: ouv, tools_qty: ouv },
        extras: c.extra_lines,
      },
      essai: true,
    };
    if (o.depannage) { d.depannage_mode = o.depannage.mode; d.depannage = o.depannage.rapport; }
    // Ce qui ne part pas avec le devis (préfixe « _ », retiré par `sansPrives` avant l'envoi).
    d._role = o.role || '';
    ['_attente', '_notes', '_sav', '_factures'].forEach(function (k) { if (o[k]) d[k] = o[k]; });
    return Object.assign(d, o.champs || {});
  }

  /* ── LE JEU : un dossier par situation que l'ERP sait reconnaître ─────────────────────────────
     L'ordre suit la vie d'une affaire, de la demande au chantier soldé, puis les cas à part
     (dépannages, SAV, archive, données abîmées). Chaque dossier dit en une phrase ce qu'il doit
     montrer : c'est ce qu'on vérifie à l'écran. */
  function construire(base) {
    base = base || U().aujourdhui();
    const J = function (n) { return jour(base, n); };
    const T = function (n, h) { return horo(base, n, h); };
    // Des consultations du lien, étalées depuis l'envoi et jamais dans le futur (au plus tard hier).
    const vues = function (n, depuis) { return Array.from({ length: n }, function (_, i) { return T(Math.min(-1, depuis + Math.floor(i / 2)), (10 + i) + ':00'); }); };
    const D = [
      devis(base, { n: '01', client: 'c01', vendeur: 'nicolas', cree: -2, items: [screens(2)],
        role: 'Brouillon à finir et envoyer' }),
      devis(base, { n: '02', client: 'c02', vendeur: 'yannick', cree: -9, modifie: -1, statut: 'envoye_client', items: [screens(3, { emplacement: 'Véranda' })],
        role: 'Envoyé avant-hier, lien ouvert 5 fois — client chaud, issu d’une visite',
        champs: { date_envoi: J(-2), review_token: 'essai-tok-02', review_views: vues(5, -2), rdv_id: PREFIXE + 'RDV-5' } }),
      devis(base, { n: '03', client: 'c03', vendeur: 'nicolas', cree: -8, modifie: -6, statut: 'envoye_client', items: [volets(4)],
        role: 'Envoyé il y a 6 jours, lien jamais ouvert — relance 1 due (nom avec apostrophe)',
        champs: { date_envoi: J(-6), review_token: 'essai-tok-03' } }),
      devis(base, { n: '04', client: 'c04', vendeur: 'yannick', cree: -17, modifie: -10, statut: 'relance_1', items: [screens(2), volets(2, { emplacement: 'Cuisine' })],
        role: 'Relance 1 il y a 10 jours — relance 2 due',
        champs: { date_envoi: J(-15), review_token: 'essai-tok-04', review_views: vues(1, -14), relances: [{ n: 1, date: J(-10) }] },
        _notes: ['Hésite entre un screen et un volet pour la cuisine — rappeler après le week-end.'] }),
      devis(base, { n: '05', client: 'c05', vendeur: 'nicolas', cree: -28, modifie: -11, statut: 'relance_1', items: [tente()],
        role: 'Mis en attente : la cliente revient vers nous — cadence gelée',
        champs: { date_envoi: J(-26), review_token: 'essai-tok-05', relances: [{ n: 1, date: J(-21) }] },
        _attente: { motif: 'La cliente revient vers nous après les vacances de Toussaint (réponse à la relance 1).', revoir_le: J(14) } }),
      devis(base, { n: '06', client: 'c06', vendeur: 'nicolas', cree: -5, modifie: -1, statut: 'envoye_client', items: [screens(2)],
        role: 'Accepté en ligne — à faire signer',
        champs: { date_envoi: J(-3), review_token: 'essai-tok-06', review_views: vues(2, -2), client_accepted: true, client_accepted_at: T(-1, '20:15') } }),
      devis(base, { n: '07', client: 'c07', vendeur: 'yannick', cree: -15, modifie: -2, statut: 'signe', items: [screens(4)],
        role: 'Signé, matériel à commander, acompte facturé pas encore payé',
        champs: { date_envoi: J(-12), statut_history: [{ statut: 'envoye_client', date: T(-12) }, { statut: 'signe', date: T(-3) }], commande: { statut: 'a_commander' } },
        _factures: [{ type: 'acompte', pct: 50, date: J(-2), echeance: J(13) }] }),
      devis(base, { n: '08', client: 'c08', vendeur: 'nicolas', cree: -30, modifie: -12, statut: 'signe', items: [volets(6)],
        role: 'Commandé, en fabrication chez Harol — rien à faire de notre côté',
        champs: { date_envoi: J(-27), statut_history: [{ statut: 'signe', date: T(-20) }], commande: { statut: 'fabrication', date_commande: J(-12), delai_semaines: 5 } },
        _factures: [{ type: 'acompte', pct: 50, date: J(-19), echeance: J(-4), ref: '2600020', paiements: [{ date: J(-15), moyen: 'Virement' }] }] }),
      devis(base, { n: '09', client: 'c09', vendeur: 'yannick', cree: -50, modifie: -5, statut: 'signe', items: [volets(3)],
        role: 'Matériel reçu, pas de date de pose — à planifier',
        champs: { date_envoi: J(-45), statut_history: [{ statut: 'signe', date: T(-40) }], commande: { statut: 'recu', date_commande: J(-35), delai_semaines: 4 } },
        _factures: [{ type: 'acompte', pct: 50, date: J(-39), echeance: J(-24), paiements: [{ date: J(-30), moyen: 'Virement' }] }] }),
      devis(base, { n: '10', client: 'c10', vendeur: 'nicolas', cree: -60, modifie: -3, statut: 'signe', tva: 21, items: [screens(8, { emplacement: 'Classes du 1er étage', modele: 'SC 110' })],
        role: 'École : pose dans 3 jours, à deux (TVA 21 %, commune avec apostrophe)',
        champs: { date_envoi: J(-56), statut_history: [{ statut: 'signe', date: T(-50) }], commande: { statut: 'recu', date_commande: J(-45), delai_semaines: 5 },
          chantier: { date_pose: J(3), heure: '08:00', equipe: 'nicolas_yannick' } },
        _factures: [{ type: 'acompte', pct: 30, date: J(-49), echeance: J(-34), paiements: [{ date: J(-40), moyen: 'Virement' }] }] }),
      devis(base, { n: '11', client: 'c11', vendeur: 'yannick', cree: -75, modifie: -19, statut: 'signe', items: [screens(2)],
        role: 'Posé, solde facturé et EN RETARD de paiement',
        champs: { date_envoi: J(-70), statut_history: [{ statut: 'signe', date: T(-65) }], commande: { statut: 'pose', date_commande: J(-60), delai_semaines: 5 },
          chantier: { date_pose: J(-20), equipe: 'nicolas' }, reception_date: J(-20) },
        _factures: [{ type: 'acompte', pct: 50, date: J(-64), echeance: J(-49), paiements: [{ date: J(-58), moyen: 'Virement' }] },
          { type: 'solde', date: J(-19), echeance: J(-4), relance: 'email' }],
        // SAV : la balle est chez le fournisseur, avec la date où s'inquiéter (page SAV, étape « Pièce »).
        _sav: [{ probleme: 'moteur', description: 'Le moteur du screen du salon fait un bruit de crécelle à la descente.', pour: 'yannick', echeance: J(6),
          statut: 'attente_piece', piece_prevue: J(4), piece_note: 'Moteur Sunea 40 RTS, commandé chez Harol' }] }),
      devis(base, { n: '12', client: 'c12', vendeur: 'nicolas', cree: -120, modifie: -30, statut: 'termine',
        items: [screens(1, { photos: [photo('Screen posé', '#2e4a62'), photo('Screen, détail', '#3b5b75')] }), volets(2, { couleur: '7016 — Gris anthracite', couleur_lame: '38 — 7016 Gris anthracite', photos: [photo('Volets posés', '#4a3b62')] })],
        role: 'Chantier terminé et soldé, dans le portfolio (avant / après)',
        champs: { date_envoi: J(-115), statut_history: [{ statut: 'signe', date: T(-110) }, { statut: 'termine', date: T(-30) }],
          commande: { statut: 'pose', date_commande: J(-100), delai_semaines: 5 }, chantier: { date_pose: J(-40), equipe: 'nicolas_yannick' }, reception_date: J(-40),
          portfolio: true,
          chantier_photos: [
            { id: 'essai-cp1', url: photo('Avant', '#6b6b6b'), phase: 'avant', date: J(-41) },
            { id: 'essai-cp2', url: photo('Pendant', '#55705a'), phase: 'pendant', date: J(-40) },
            { id: 'essai-cp3', url: photo('Après', '#3f7a4c'), phase: 'apres', date: J(-40) }] },
        _factures: [{ type: 'acompte', pct: 50, date: J(-109), echeance: J(-94), ref: '2600012', paiements: [{ date: J(-100), moyen: 'Virement' }] },
          { type: 'solde', date: J(-39), echeance: J(-24), ref: '2600031', paiements: [{ date: J(-33), moyen: 'Virement' }] }],
        _sav: [{ probleme: 'reglage', description: 'Le volet de la chambre ne descend pas jusqu’en bas.', statut: 'resolu',
          resolution: 'Fin de course basse réglée (deux tours), essai fait devant la cliente.', cause: 'Fin de course réglée trop court à la pose.' }] }),
      devis(base, { n: '13', client: 'c13', vendeur: 'yannick', cree: -40, modifie: -20, statut: 'refuse', items: [volets(2)],
        role: 'Refusé (trop cher)',
        champs: { date_envoi: J(-35), raison_refus: 'Trop cher', statut_history: [{ statut: 'refuse', date: T(-20) }] } }),
      devis(base, { n: '14', client: 'c14', vendeur: 'nicolas', cree: -50, modifie: -36, statut: 'relance_2', items: [screens(2)],
        role: 'Trois relances faites, devis de 45 jours — expiré, à relancer ou classer',
        champs: { date_envoi: J(-45), review_token: 'essai-tok-14', relances: [{ n: 1, date: J(-41) }, { n: 2, date: J(-36) }, { n: 3, date: J(-24) }] } }),
      devis(base, { n: '15', client: 'c15', vendeur: 'yannick', cree: -4, modifie: -4, statut: 'signe',
        extras: [{ label: 'Déplacement', qty: 1, unit_price_ht: 45 }, { label: 'Main-d’œuvre', qty: 1.5, unit_price_ht: 55 }, { label: 'Moteur Somfy de remplacement', qty: 1, unit_price_ht: 280 }],
        depannage: { mode: 'realise', rapport: { date_intervention: J(-4), heure: '14:00', duree_h: 1.5, techniciens: ['Yannick'],
          motif: 'Volet bloqué en position basse', diagnostic: 'Moteur grillé, remplacé par un moteur Somfy.', garantie: 'non', garantie_note: '', garantie_mois: 12, suite: 'aucune', suite_note: '' } },
        role: 'Bon d’intervention (dépannage fait), rien facturé — jamais d’acompte, pas de relance' }),
      devis(base, { n: '16', client: 'c16', vendeur: 'nicolas', cree: -1, statut: 'envoye_client',
        extras: [{ label: 'Déplacement', qty: 1, unit_price_ht: 45 }, { label: 'Main-d’œuvre (estimée)', qty: 2, unit_price_ht: 55 }],
        depannage: { mode: 'a_realiser', rapport: { date_intervention: J(2), heure: '09:00', duree_h: 2, techniciens: ['Nicolas'],
          motif: 'Screen qui ne descend plus', diagnostic: '', garantie: 'non', garantie_note: '', garantie_mois: 12, suite: 'aucune', suite_note: '' } },
        role: 'Proposition de dépannage envoyée, passage dans 2 jours',
        champs: { date_envoi: J(-1), review_token: 'essai-tok-16' } }),
      devis(base, { n: '17', client: 'c17', vendeur: 'nicolas', cree: -110, modifie: -6, statut: 'signe', items: [screens(3)],
        role: 'Posé et payé, ticket SAV ouvert confié à Yannick',
        champs: { date_envoi: J(-105), statut_history: [{ statut: 'signe', date: T(-100) }], commande: { statut: 'pose', date_commande: J(-95), delai_semaines: 5 },
          chantier: { date_pose: J(-90), equipe: 'nicolas' }, reception_date: J(-90) },
        _factures: [{ type: 'totale', date: J(-89), echeance: J(-74), paiements: [{ date: J(-80), moyen: 'Virement' }] }],
        _sav: [{ probleme: 'toile', description: 'La toile du screen de la cuisine se déroule de travers depuis la tempête.', pour: 'yannick', echeance: J(5) }] }),
      devis(base, { n: '18', client: 'c18', vendeur: 'yannick', cree: -540, modifie: -400, statut: 'termine', items: [screens(1)],
        role: 'Ancien dossier archivé (ne doit apparaître nulle part sauf dans les archives)',
        champs: { archive: true, statut_history: [{ statut: 'termine', date: T(-400) }], commande: { statut: 'pose' }, reception_date: J(-410) } }),
      devis(base, { n: '19', client: 'c19', vendeur: 'yannick', cree: -2, modifie: -1, statut: 'envoye_client', informatif: true, items: [tente()],
        role: 'Devis INFORMATIF envoyé hier (cadence de relance propre)',
        champs: { date_envoi: J(-1), review_token: 'essai-tok-19' } }),
      devis(base, { n: '20', client: 'c20', vendeur: 'nicolas', cree: -3, statut: 'brouillon',
        items: [{ type: '', quantite: 0, photos: [] }, { type: 'screen', quantite: -1, prix_catalogue_ht: 500, photos: [] }],
        role: 'Données ABÎMÉES : ouverture sans type, quantité négative, client sans adresse ni contact, sans calculs' }),
      /* SAV HORS GARANTIE (règle 47) : posé il y a seize mois, un moteur qui lâche, et PERSONNE dessus
         depuis neuf jours — le ticket que la page SAV doit mettre en tête, avec « Créer le bon
         d'intervention ». ⚠️ Écrit dans le devis et non par la route : le serveur date un ticket
         « maintenant », et c'est justement son ANCIENNETÉ qu'il faut voir. Réécrit à chaque
         « Remplir », comme les dates du reste du jeu. Même moteur que la pièce d'ESSAI-11 : deux
         pannes du même moteur, « Ce qui casse le plus » le signale (à dire à Harol). */
      devis(base, { n: '21', client: 'c25', vendeur: 'nicolas', cree: -520, modifie: -9, statut: 'termine', items: [screens(2, { emplacement: 'Terrasse' })],
        role: 'Posé il y a 16 mois (hors garantie) : moteur en panne, personne dessus depuis 9 jours — bon d’intervention à faire',
        champs: { date_envoi: J(-515), statut_history: [{ statut: 'signe', date: T(-510) }, { statut: 'termine', date: T(-480) }],
          commande: { statut: 'pose', date_commande: J(-505), delai_semaines: 5 }, chantier: { date_pose: J(-485), equipe: 'nicolas' }, reception_date: J(-485),
          sav_tickets: [{ id: 'essai-sav-21', probleme: 'moteur', description: 'Le screen de la terrasse ne remonte plus : le moteur claque puis s’arrête.',
            statut: 'ouvert', photos: [photo('Moteur, constat', '#6b4a3b')], photos_apres: [], pour: '', echeance: '', date_creation: T(-9),
            date_resolution: null, cause: '', resolution: '', resolu_par: null, passages: [], piece_prevue: '', piece_note: '', notes: [] }] },
        _factures: [{ type: 'totale', date: J(-484), echeance: J(-469), paiements: [{ date: J(-475), moyen: 'Virement' }] }] }),
      /* LA FACTURATION (règle 49) : un chantier signé hier dont l'acompte n'est pas encore FACTURÉ, et
         un chantier posé dont l'acompte a été ramené de 100 € par une note de crédit (geste
         commercial) puis payé pour le reste — il ne doit plus rien, et son solde reste à facturer. */
      devis(base, { n: '22', client: 'c26', vendeur: 'yannick', cree: -6, modifie: -1, statut: 'signe', items: [volets(3, { emplacement: 'Séjour' })],
        role: 'Signé hier — acompte pas encore facturé',
        champs: { date_envoi: J(-5), statut_history: [{ statut: 'envoye_client', date: T(-5) }, { statut: 'signe', date: T(-1) }], commande: { statut: 'a_commander' } } }),
      devis(base, { n: '23', client: 'c27', vendeur: 'nicolas', cree: -60, modifie: -6, statut: 'signe', items: [screens(2, { emplacement: 'Bureau' })],
        role: 'Posé : acompte réduit par une note de crédit et payé — solde à facturer',
        champs: { date_envoi: J(-58), statut_history: [{ statut: 'signe', date: T(-50) }], commande: { statut: 'pose', date_commande: J(-45), delai_semaines: 4 },
          chantier: { date_pose: J(-6), equipe: 'nicolas' }, reception_date: J(-6) },
        _factures: [{ type: 'acompte', pct: 30, date: J(-49), echeance: J(-34), paiements: [{ date: J(-40), moyen: 'Virement', moins: 100 }] },
          { type: 'avoir', de: 'acompte', montant: 100, date: J(-45), motif: 'Geste commercial (essai)' }] }),
    ];
    // Le dossier abîmé n'a PAS de calculs : c'est précisément le cas à rejouer (règle 6 de « vérifier son travail »).
    delete D[19].calculs;

    const RDV = [
      { n: '1', client: 'c21', statut: 'nouveau', assigned_to: '', source: 'Site web', cree: T(0, '06:00'), projet: '3 screens pour la véranda, exposition plein sud.',
        role: 'Lead du matin, personne ne l’a pris' },
      { n: '2', client: 'c22', statut: 'a_contacter', assigned_to: 'yannick', source: 'Téléphone', cree: T(-3), projet: 'Volets roulants en rénovation, 5 fenêtres.',
        role: 'À contacter depuis 3 jours' },
      { n: '3', client: 'c23', statut: 'rdv_fixe', assigned_to: 'nicolas', source: 'Bouche à oreille', cree: T(-6), date_rdv: J(1) + 'T10:00', projet: 'Tente solaire pour la terrasse.',
        role: 'Visite fixée demain à 10 h' },
      { n: '4', client: 'c24', statut: 'visite', assigned_to: 'nicolas', source: 'Multimedian', cree: T(-12), date_rdv: J(-2) + 'T14:00', projet: 'Deux screens pour le bureau.',
        role: 'Visité il y a 2 jours, devis pas encore fait' },
      { n: '5', client: 'c02', statut: 'converti', assigned_to: 'yannick', source: 'Salon / foire', cree: T(-14), date_rdv: J(-9) + 'T16:00', devis_id: PREFIXE + '02',
        projet: 'Screens pour la véranda.', role: 'Visite convertie en devis (ESSAI-02)' },
    ].map(function (r) {
      return { id: PREFIXE + 'RDV-' + r.n, client: client(r.client), statut: r.statut, assigned_to: r.assigned_to, source: r.source,
        pref_contact: 'tel', pref_visite: '', dates_proposees: '', creneaux: [], date_rdv: r.date_rdv || '', rappel_date: '',
        projet: r.projet, photos: [], devis_id: r.devis_id || '', date_creation: r.cree, date_modification: r.cree, essai: true, _role: r.role };
    });

    const cle = function (code) { const c = client(code); return U().clientKeyOf(c.prenom, c.nom); };
    const SUJETS = [
      Object.assign(U().nouveauSujet('On commande les coulisses en 7016 ou en 7021 ?\nLe client hésite, il a vu les deux chez le voisin.',
        { kind: 'question', pour: 'yannick', client_nom: 'Pierre Meunier', client_key: cle('c07'), devis_id: PREFIXE + '07', echeance: J(1) }), { id: 'SUJ-ESSAI-1' }),
      Object.assign(U().nouveauSujet('Demander à l’école l’accès au parking pour la camionnette',
        { kind: 'afaire', pour: 'nicolas', client_nom: 'École Saint-Exemple', client_key: cle('c10'), devis_id: PREFIXE + '10', echeance: J(2) }), { id: 'SUJ-ESSAI-2' }),
      Object.assign(U().nouveauSujet('Proposer un contrat d’entretien annuel des screens', { kind: 'idee' }), { id: 'SUJ-ESSAI-3' }),
    ];

    const DISPOS = [
      { id: 'DISPO-ESSAI-1', qui: 'yannick', kind: 'indispo', du: J(7), au: J(9), journee: true, motif: 'Congé (essai)' },
      { id: 'DISPO-ESSAI-2', qui: 'nicolas', kind: 'dispo', du: samediSuivant(base), au: samediSuivant(base), journee: true, motif: 'Exceptionnellement disponible (essai)' },
    ];

    // Une fiche CRM par client de dossier ou de demande, plus un QUASI-DOUBLON (même e-mail que
    // Marc Dubois, une faute dans le nom) : c'est ce que le panneau « À ranger » doit signaler.
    const FICHES = CLIENTS.map(function (c) {
      const f = client(c[0]);
      return Object.assign({ key: U().clientKeyOf(f.prenom, f.nom), type_bien: '', tags: [], notes: '', essai: true,
        date_creation: T(-30), date_modification: T(-30) }, f);
    });
    const dbl = client('c02');
    FICHES.push(Object.assign({}, dbl, { prenom: 'Marc', nom: 'Dubbois', key: U().clientKeyOf('Marc', 'Dubbois'), type_bien: '', tags: [], notes: 'Quasi-doublon volontaire (essai).',
      essai: true, date_creation: T(-30), date_modification: T(-30) }));

    /* L'OUTILLAGE (règle 48) : des références fictives (liens en .invalid, qui ne mènent nulle part),
       deux fournisseurs dont un prix ANCIEN, une référence sans catégorie, une apostrophe, une photo
       dessinée laissée dans la base (pour essayer « Alléger »), et deux kits de pose. La pose de
       l'école (ESSAI-10, 8 screens dans 3 jours) a donc de quoi remplir « À emporter ». */
    const lien = function (n) { return 'https://boutique.exemple.invalid/ref-' + n; };
    const OUTILLAGE = [
      { id: 'OUT-ESSAI-1', nom: 'Vis inox tête fraisée 4×40', categorie: 'Visserie & boulonnerie', reference: '0179 4 40', fournisseur: 'Würth', prix: 12.9, prix_le: J(-20), url: lien(1),
        autre: { fournisseur: 'Brico', reference: '', prix: 14.5, prix_le: J(-200), url: lien('1b') }, notes: 'Caisson sur béton — boîte de 200. Pré-percer à 3 mm dans l’alu.',
        photos: [photo('Vis 4×40', '#4a5a6b')] },
      { id: 'OUT-ESSAI-2', nom: 'Cheville nylon 6×40', categorie: 'Chevilles & fixations', reference: 'SX 6x40', fournisseur: 'Fixami', prix: 6.9, prix_le: J(-35), url: lien(2), notes: 'Paquet de 100' },
      { id: 'OUT-ESSAI-3', nom: 'Foret béton SDS-plus 6 mm', categorie: 'Perçage & découpe', reference: '2608.597.523', fournisseur: 'Würth', prix: 8.4, prix_le: J(-10), url: lien(3) },
      { id: 'OUT-ESSAI-4', nom: 'Mastic silicone transparent 310 ml', categorie: 'Consommables', reference: 'SIL-310', fournisseur: 'ManoMano', prix: 7.2, prix_le: J(-60), url: lien(4) },
      { id: 'OUT-ESSAI-5', nom: 'Embout Torx T25', categorie: '', reference: 'T25-50', notes: 'Pour les coulisses des screens.' },
      { id: 'OUT-ESSAI-6', nom: 'Cheville à frapper L’Universelle 6×40', categorie: 'Chevilles & fixations', reference: "UX 6×40 R", fournisseur: 'Brico', prix: 8.49, prix_le: J(-5) },
    ].map(function (o) { return Object.assign({ photos: [], date_creation: T(-30), date_modification: T(-3), essai: true }, o); });
    const KITS = [
      { id: 'KIT-ESSAI-1', nom: 'Pose screen sur béton', pour: 'screen', notes: 'Prévoir le perforateur SDS.',
        lignes: [{ ref: 'OUT-ESSAI-1', qte: 4, par: 'ouverture' }, { ref: 'OUT-ESSAI-2', qte: 4, par: 'ouverture' }, { ref: 'OUT-ESSAI-3', qte: 1, par: 'chantier' }, { ref: 'OUT-ESSAI-4', qte: 1, par: 'chantier' }] },
      { id: 'KIT-ESSAI-2', nom: 'Volet en rénovation', pour: 'volet_roulant', notes: '',
        lignes: [{ ref: 'OUT-ESSAI-1', qte: 6, par: 'ouverture' }, { ref: 'OUT-ESSAI-4', qte: 1, par: 'chantier' }] },
    ];
    // « À racheter », par la route ciblée (signée par le serveur) : il n'y a plus de chevilles.
    const RACHETER = [{ id: 'OUT-ESSAI-2', qte: 2, note: 'Il en reste une demi-boîte (essai)' }];

    return { base: base, devis: D, rdv: RDV, sujets: SUJETS, dispos: DISPOS, fiches: FICHES, outillage: OUTILLAGE, kits: KITS, racheter: RACHETER };
  }

  // ── Les gardes ────────────────────────────────────────────────────────────────────────────────
  /** Lit la base SANS repli sur le cache du navigateur (contrairement à `SS.list*`) : une garde qui
   *  se rabattrait sur un cache local « vide » laisserait passer une vraie base qu'elle n'a pas pu lire. */
  async function lireStrict(fetchFn, chemin) {
    const r = await fetchFn('/api' + chemin + (chemin.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' });
    let j = null;
    try { j = await r.json(); } catch (e) { throw new Error(chemin + ' : réponse illisible (HTTP ' + r.status + ') — session Access expirée ?'); }
    if (!j || j.ok === false) { const err = new Error(chemin + ' : ' + ((j && (j.hint || j.error)) || ('HTTP ' + r.status))); err.reponse = j; throw err; }
    return j;
  }
  /**
   * @returns {ok, raisons[], etat}  — `ok` faux dès qu'une garde tombe ; `raisons` dit pourquoi,
   *          en phrases à montrer telles quelles.
   */
  async function verifier(opts) {
    const o = opts || {};
    const fetchFn = o.fetch || window.fetch.bind(window);
    const hote = o.hote != null ? o.hote : location.hostname;
    const raisons = [], etat = { hote: hote };
    if (!U().hoteBacASable(hote) && !o.hoteLocalPermis) {
      raisons.push('Cette page ne remplit QUE la base d’un aperçu de branche (…solariscreen-erp.pages.dev). Ici : « ' + hote + ' ».');
      return { ok: false, raisons: raisons, etat: etat };
    }
    try {
      const h = await lireStrict(fetchFn, '/health');
      etat.devis_count = h.devis_count;
    } catch (e) {
      raisons.push(e.reponse && e.reponse.needsSchema
        ? 'La base d’essai n’a pas encore ses tables : exécute schema.sql dans sa console D1 (DEPLOIEMENT.md, étape 12).'
        : 'La base ne répond pas : ' + e.message + ' — la liaison « DB » de l’environnement Preview est-elle faite ?');
      return { ok: false, raisons: raisons, etat: etat };
    }
    try {
      const w = await lireStrict(fetchFn, '/whoami');
      etat.identite = (w.data && w.data.email) || null;
    } catch (e) { etat.identite = null; }
    if (!etat.identite) raisons.push('Aucune identité Access : les aperçus ne sont pas protégés. Branche Access sur les aperçus AVANT la base (DEPLOIEMENT.md, étape 12).');
    try {
      const listes = await Promise.all(['/devis', '/factures', '/clients', '/rdv'].map(function (p) { return lireStrict(fetchFn, p); }));
      const devisL = listes[0].data || [];
      etat.devis = devisL.length;
      etat.essai = devisL.filter(function (d) { return String(d.id || '').indexOf(PREFIXE) === 0; }).length;
      etat.factures = (listes[1].data || []).length;
      etat.clients = (listes[2].data || []).length;
      etat.rdv = (listes[3].data || []).length;
      etat.marque = (listes[2].data || []).some(function (c) { return c && c.key === cleMarque(); });
      etat.vide = !etat.devis && !etat.factures && !etat.clients && !etat.rdv;
      if (!etat.vide && !etat.essai && !etat.marque) {
        raisons.push('Cette base contient ' + etat.devis + ' devis, ' + etat.factures + ' factures et ' + etat.clients
          + ' fiches, et AUCUN dossier ESSAI- : c’est une vraie base. Rien ne sera écrit. Vérifie la liaison « DB » de l’environnement Preview.');
      }
    } catch (e) { raisons.push('Lecture de la base impossible : ' + e.message); }
    return { ok: raisons.length === 0, raisons: raisons, etat: etat };
  }

  // ── Remplir ──────────────────────────────────────────────────────────────────────────────────
  function sansPrives(d) { const x = {}; Object.keys(d).forEach(function (k) { if (k.charAt(0) !== '_') x[k] = d[k]; }); return x; }
  function echec(res) { return !res || res.ok === false || res.offline || res.conflict; }
  function lignesFacture(d, type, pct, montantHt) {
    const quoi = d.type_document === 'depannage' ? 'dépannage' : 'devis';
    if (type === 'totale') return [{ desc: 'Travaux selon ' + quoi + ' N° ' + d.id, qty: 1, pu: montantHt, total: montantHt }];
    const label = type === 'acompte' ? 'Acompte de ' + pct + ' % sur ' + quoi + ' N° ' + d.id : 'Solde sur ' + quoi + ' N° ' + d.id;
    return [{ desc: label, qty: 1, pu: montantHt, total: montantHt }];
  }
  const r2 = function (x) { return Math.round(x * 100) / 100; };

  /**
   * Écrit le jeu, par les MÊMES fonctions que les écrans (`SS.*`), donc par les mêmes routes.
   * Rejouable : les devis, demandes, sujets et congés sont réécrits à l'identique (dates
   * rafraîchies) ; une attente se corrige au lieu de s'empiler ; une note, un ticket SAV ou une
   * facture déjà présents ne sont pas recréés.
   * @returns {crees, ignores, erreurs[]}
   */
  async function remplir(SS, opts) {
    const o = opts || {};
    const log = o.journal || function () {};
    const jeu = construire(o.base);
    const bilan = { crees: 0, ignores: 0, erreurs: [] };
    const note = function (ok, quoi, err) { if (ok) { bilan.crees++; log('✓ ' + quoi); } else { bilan.erreurs.push(quoi + ' : ' + (err || 'refusé')); log('✗ ' + quoi + ' — ' + (err || 'refusé')); } };

    // La marque d'abord : si la suite s'interrompt, la base reste reconnaissable comme base d'essai.
    const resM = await SS.saveClient({ key: cleMarque(), prenom: MARQUE.prenom, nom: MARQUE.nom, telephone: '', email: '', adresse: {},
      type_bien: '', tags: [], essai: true, notes: 'Cette fiche MARQUE la base d’essai (bac à sable). Ne pas la supprimer : sans elle, la page de remplissage refusera d’écrire ici.',
      date_creation: horo(jeu.base, 0, '08:00'), date_modification: horo(jeu.base, 0, '08:00') });
    note(!echec(resM), 'fiche-marqueur du bac à sable', resM && resM.error);
    if (echec(resM)) return bilan;   // la première écriture échoue : inutile d'aligner vingt échecs

    for (const f of jeu.fiches) {
      const ex = await SS.getClient(f.key);
      // On repart de la fiche existante (règle 2) : les mails archivés pendant un essai survivent.
      const res = await SS.saveClient(Object.assign({}, ex || {}, f));
      note(!echec(res), 'fiche ' + f.prenom + ' ' + f.nom, res && res.error);
    }
    for (const d of jeu.devis) {
      const res = await SS.saveDevis(sansPrives(d));
      note(!echec(res), d.id + ' (' + d.statut + ')', res && (res.error || (res.offline && 'hors-ligne')));
    }
    // Les écritures CIBLÉES, par leurs routes (auteur et validation par le serveur).
    for (const d of jeu.devis) {
      if (d._attente) {
        const res = await SS.setDevisAttente(d.id, d._attente);
        note(!echec(res), d.id + ' mis en attente', res && res.error);
      }
      if (d._notes || d._sav) {
        const actuel = (await SS.getDevis(d.id)) || {};
        for (const t of (d._notes || [])) {
          if ((actuel.comments || []).some(function (c) { return c.text === t; })) { bilan.ignores++; continue; }
          const res = await SS.addComment(d.id, { text: t, type: 'note' });
          note(!echec(res), d.id + ' : note interne', res && res.error);
        }
        for (const t of (d._sav || [])) {
          const ex = (actuel.sav_tickets || []).filter(function (x) { return x.description === t.description; })[0];
          const res = await SS.saveSavTicket(d.id, Object.assign({}, ex || {}, t, ex ? { id: ex.id } : {}));
          note(!echec(res), d.id + ' : ticket SAV', res && res.error);
        }
      }
    }
    // Les factures : numérotées par le SERVEUR de la base d'essai (sa propre série), jamais en double.
    const facturesEx = (await SS.listFactures()) || [];
    for (const d of jeu.devis) {
      if (!d._factures) continue;
      let deja = facturesEx.filter(function (f) { return f.devis_id === d.id; }).reduce(function (s, f) { return s + (Number(f.total_ttc) || 0); }, 0);
      const ids = {};   // type → numéro, pour qu'une note de crédit désigne la facture qu'elle annule
      facturesEx.filter(function (f) { return f.devis_id === d.id; }).forEach(function (f) { ids[f.type] = f.id; });
      for (const spec of d._factures) {
        if (facturesEx.some(function (f) { return f.devis_id === d.id && f.type === spec.type; })) { bilan.ignores++; continue; }
        const c = d.calculs || {}, ttc = c.total_ttc || 0;
        let fac, montant;
        if (spec.type === 'avoir') {
          // Une NOTE DE CRÉDIT partielle (règle 49) : total négatif, au même taux que la facture annulée.
          if (!ids[spec.de]) { note(false, d.id + ' : note de crédit', 'la facture à annuler n’existe pas'); continue; }
          montant = -r2(spec.montant);
          const ht = r2(spec.montant / (1 + (c.tva_pct || 6) / 100));
          fac = { type: 'avoir', avoir_de: ids[spec.de], devis_id: d.id, source_type: d.type_document || 'devis', date: spec.date, echeance: spec.date, ref_externe: '',
            client: d.client, lines: [{ desc: 'Annulation de la facture N° ' + ids[spec.de], sub: spec.motif || '', qty: 1, pu: -ht, total: -ht }],
            total_ht: -ht, total_tva: -r2(spec.montant - ht), total_ttc: montant, tva_pct: c.tva_pct || 6, motif: spec.motif || '', paiements: [],
            date_creation: horo(spec.date, 0, '11:00'), essai: true };
        } else {
          montant = spec.type === 'acompte' ? Math.min(ttc * spec.pct / 100, ttc - deja) : Math.max(0, ttc - deja);
          const facteur = ttc > 0 ? montant / ttc : 0;
          fac = {
            type: spec.type, devis_id: d.id, source_type: d.type_document || 'devis', date: spec.date, echeance: spec.echeance, ref_externe: spec.ref || '',
            client: d.client, lines: lignesFacture(d, spec.type, spec.pct, r2((c.total_ht || 0) * facteur)),
            total_ht: r2((c.total_ht || 0) * facteur), total_tva: r2((c.total_tva || 0) * facteur), total_ttc: r2(montant), tva_pct: c.tva_pct || 6,
            devis_ttc: ttc, paiements: [], date_creation: horo(spec.date, 0, '11:00'), essai: true,
          };
        }
        const res = await SS.saveFacture(fac, spec.type === 'avoir' ? 'NC' : 'F');
        note(!echec(res) && !!(res && res.id), d.id + ' : ' + (spec.type === 'avoir' ? 'note de crédit' : 'facture ' + spec.type) + (res && res.id ? ' ' + res.id : ''), res && res.error);
        if (echec(res) || !res.id) continue;
        ids[spec.type] = res.id;
        deja += montant;
        for (const p of (spec.paiements || [])) {
          const rp = await SS.addPaiement(res.id, { date: p.date, montant: r2(montant - (p.moins || 0)), moyen: p.moyen });
          note(!echec(rp), res.id + ' : encaissement', rp && rp.error);
        }
        // Une relance de paiement déjà faite, par sa route (signée par le serveur).
        if (spec.relance) {
          const rr = await SS.relancerFacture(res.id, spec.relance);
          note(!echec(rr), res.id + ' : relance de paiement', rr && rr.error);
        }
      }
    }
    for (const r of jeu.rdv) {
      const res = await SS.saveRdv(sansPrives(r));
      note(!echec(res), r.id + ' (' + r.statut + ')', res && res.error);
    }
    for (const s of jeu.sujets) {
      const res = await SS.saveSujet(s);
      note(!echec(res), s.id + ' (' + s.kind + ')', res && res.error);
    }
    for (const x of jeu.dispos) {
      const res = await SS.saveDispo(x);
      note(!echec(res), x.id + ' (' + x.kind + ')', res && res.error);
    }
    for (const o of jeu.outillage) {
      const res = await SS.saveOutillage(o);
      note(!echec(res), o.id + ' (référence)', res && res.error);
    }
    for (const k of jeu.kits) {
      const res = await SS.saveKit(k);
      note(!echec(res), k.id + ' (kit)', res && res.error);
    }
    const refs = (await SS.listOutillage()) || [];
    for (const r of jeu.racheter) {
      const ex = refs.filter(function (o) { return o.id === r.id; })[0];
      if (ex && ex.racheter) { bilan.ignores++; continue; }   // déjà sur la liste : on ne la redate pas
      const res = await SS.setRacheter(r.id, r.qte, r.note);
      note(!echec(res), r.id + ' : à racheter', res && res.error);
    }
    return bilan;
  }

  // ── Vider ────────────────────────────────────────────────────────────────────────────────────
  /** Retire ce que `remplir` a posé — et RIEN d'autre : un devis saisi à la main pendant un essai
   *  n'a pas d'identifiant ESSAI-, il reste. Les factures partent avec leur devis d'essai. */
  async function vider(SS, opts) {
    const o = opts || {};
    const log = o.journal || function () {};
    const jeu = construire(o.base);
    const bilan = { retires: 0, erreurs: [] };
    const note = function (ok, quoi, err) { if (ok) { bilan.retires++; log('− ' + quoi); } else { bilan.erreurs.push(quoi + ' : ' + (err || 'refusé')); log('✗ ' + quoi + ' — ' + (err || 'refusé')); } };
    const essai = function (id) { return String(id || '').indexOf(PREFIXE) === 0; };
    // Une facture encaissée, reprise dans Falco ou annulée ne se supprime plus (règle 49) : on défait
    // d'abord, dans l'ordre — encaissements, référence, puis les notes de crédit avant leurs factures.
    const facsEssai = ((await SS.listFactures()) || []).filter(function (f) { return essai(f.devis_id); })
      .sort(function (a, b) { return (b.type === 'avoir') - (a.type === 'avoir'); });
    for (const f of facsEssai) {
      for (const p of (f.paiements || []).slice().reverse()) { await SS.deletePaiement(f.id, p.id != null ? p.id : '0'); }
      if (f.ref_externe) await SS.setRefFacture(f.id, '');
      const res = await SS.deleteFacture(f.id); note(!echec(res), 'facture ' + f.id, res && res.error);
    }
    for (const d of ((await SS.listDevis()) || []).filter(function (d) { return essai(d.id); })) {
      const res = await SS.deleteDevis(d.id); note(!echec(res), d.id, res && res.error);
    }
    for (const r of ((await SS.listRdv()) || []).filter(function (r) { return essai(r.id); })) {
      const res = await SS.deleteRdv(r.id); note(!echec(res), r.id, res && res.error);
    }
    for (const s of jeu.sujets) { const res = await SS.deleteSujet(s.id); note(!echec(res), s.id, res && res.error); }
    for (const x of jeu.dispos) { const res = await SS.deleteDispo(x.id); note(!echec(res), x.id, res && res.error); }
    for (const f of jeu.fiches) { const res = await SS.deleteClient(f.key); note(!echec(res), 'fiche ' + f.prenom + ' ' + f.nom, res && res.error); }
    for (const o of jeu.outillage) { const res = await SS.deleteOutillage(o.id); note(!echec(res), o.id, res && res.error); }
    for (const k of jeu.kits) { const res = await SS.deleteKit(k.id); note(!echec(res), k.id, res && res.error); }
    return bilan;
  }

  window.SSBacASable = { PREFIXE: PREFIXE, cleMarque: cleMarque, construire: construire, verifier: verifier, remplir: remplir, vider: vider };
})();
