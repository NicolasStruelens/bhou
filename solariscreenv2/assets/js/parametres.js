// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LA PAGE PARAMÈTRES
// Script classique (file:// OK). Global : window.SSParam
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// Ce qu'on enregistre, ce qu'on a le droit d'écrire, comment se lit une valeur et ce qu'un réglage
// change sur un cas concret : des fonctions PURES testées (`tests/parametres.test.html`). Les
// valeurs par défaut restent dans `config.js` (la seule source), les prix dans `calc.js`.
// Règle 53 de CLAUDE.md.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  /** C — Chercher un réglage : sans accents, mot à mot. */
  function correspond(texte, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    const foin = sansAccents(texte);
    return mots.every(function (m) { return foin.indexOf(m) >= 0; });
  }
  function lire(o, chemin) { return chemin.reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  const egal = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* ── CE QUI A CHANGÉ ─────────────────────────────────────────────────────────────────────────
     Enregistrer renvoyait TOUS les réglages tels qu'ils étaient à l'ouverture de la page : ce que
     Yannick avait changé entre-temps (ou la trame du planning, enregistrée depuis le Planning)
     revenait à l'ancienne valeur, sans un mot. On n'envoie plus que les CHANGEMENTS, chacun avec
     la valeur qu'on avait sous les yeux (`avant`) : le serveur les pose sur la version du moment,
     et refuse celui que l'autre a modifié entre-temps (la règle vit au serveur, et là seulement).
     `brut` : la valeur telle que le serveur l'a rendue lors d'un conflit, pour les chemins où elle
     diffère de celle qu'on affiche (une valeur abîmée que `fusionner` a remplacée par son défaut) :
     sans elle, le second essai repartirait en conflit, et ainsi de suite. */
  function changements(avant, apres, chemins, brut) {
    return (chemins || []).map(function (c) {
      const k = c.join('.');
      return { chemin: c, avant: brut && Object.prototype.hasOwnProperty.call(brut, k) ? brut[k] : lire(avant, c), apres: lire(apres, c) };
    }).filter(function (x) { return !egal(lire(avant, x.chemin), x.apres); });
  }

  /* ── UNE VALEUR SAISIE ───────────────────────────────────────────────────────────────────────
     Un champ vidé était remplacé EN SILENCE par la valeur par défaut (l'écran le montrait vide), et
     rien n'empêchait un acompte de 500 % ou une commission négative. On refuse d'enregistrer, et on
     dit pourquoi, sur la ligne. Les bornes sont celles du champ (min / max). */
  function controle(texte, min, max) {
    const t = String(texte == null ? '' : texte).trim().replace(',', '.');
    if (t === '') return 'Indique une valeur (0 si rien).';
    const n = Number(t);
    if (!isFinite(n)) return 'Ce n’est pas un nombre.';
    const a = min === '' || min == null ? null : Number(min), b = max === '' || max == null ? null : Number(max);
    if (a !== null && b !== null && (n < a || n > b)) return 'Entre ' + fr(a) + ' et ' + fr(b) + '.';
    if (a !== null && n < a) return 'Au moins ' + fr(a) + '.';
    if (b !== null && n > b) return 'Au plus ' + fr(b) + '.';
    return null;
  }
  function fr(n) { return (Math.round(Number(n) * 100) / 100).toLocaleString('fr-BE'); }

  /* ── COMMENT SE LIT UNE VALEUR (origine, historique) ─────────────────────────────────────────
     Avec son unité, comme à l'écran : « 23 % » (et non 0,23), « 55,00 € », « 4 · 9 · 21 j ». */
  const POURCENT_FRACTION = ['prix.material_margin', 'prix.supplier_rate'];
  const POURCENT = ['prix.commission_principal', 'prix.commission_second', 'prix.acompte_pct', 'prix.tva_pct'];
  const EUROS = ['prix.install_gross', 'prix.tech1_gross', 'prix.tech2_gross', 'prix.tools_gross', 'prix.deplacement', 'prix.taux_horaire', 'usage.objectif_mensuel'];
  function format(chemin, v) {
    const c = Array.isArray(chemin) ? chemin.join('.') : String(chemin);
    if (v === undefined || v === null) return '—';
    if (typeof v === 'boolean') return v ? 'oui' : 'non';
    if (Array.isArray(v)) return v.join(' · ') + ' j';
    if (typeof v !== 'number') return v === '' ? '(vide)' : String(v);
    if (POURCENT_FRACTION.indexOf(c) >= 0) return fr(v * 100) + ' %';
    if (POURCENT.indexOf(c) >= 0) return fr(v) + ' %';
    if (EUROS.indexOf(c) >= 0 || /^remu\.pose\./.test(c)) return U().fmtEur(v);
    if (c === 'prix.garantie_mois') return fr(v) + ' mois';
    if (c === 'usage.echeance_facture') return fr(v) + ' j';
    if (c === 'usage.seuil_lead_chaud') return fr(v) + ' vues';
    if (c === 'prix.net_divisor') return '÷ ' + fr(v);
    return fr(v);
  }

  /* ── D — CE QU'UN RÉGLAGE CHANGE, SUR UN CAS CONCRET ─────────────────────────────────────────
     L'aperçu du devis type vivait à droite au bureau… et à 7 889 px sur téléphone, à 5 000 px du
     réglage qu'on touchait. La conséquence s'écrit désormais SOUS le réglage, dans ses mots :
     « 1 h 30 sur place : 82,50 € → 90,00 € HTVA ». Les prix passent par le VRAI moteur (`calc.js`). */
  function devisType(conf) {
    const p = conf.prix;
    return window.SSCalc.computeDevis({
      items: [{ quantite: 2, prix_catalogue_ht: 1500 }],
      sellers: { principal: 'nicolas' },
      seller_parts: { principal: p.commission_principal, second: p.commission_second },
      rates: { supplier_rate: p.supplier_rate, material_margin: p.material_margin, net_divisor: p.net_divisor },
      installation: { install_gross: p.install_gross, tech1_gross: p.tech1_gross, tech2_gross: p.tech2_gross,
                      tools_gross: p.tools_gross, install_qty: 2, tech1_qty: 2, tech2_qty: 2, tools_qty: 2 },
      extras: [], tva_pct: p.tva_pct, acompte_pct: p.acompte_pct, surplus_difficulte: 0,
    });
  }
  const POSES = { screen: 'screens', volet_roulant: 'volets roulants', tablier_volet: 'tabliers de volet', tente_solaire: 'tentes solaires', store_banne: 'stores bannes', pergola: 'pergolas' };
  function plusJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return U().isoDate(d); }
  function effet(chemin, conf, avant, auj) {
    const c = Array.isArray(chemin) ? chemin.join('.') : String(chemin);
    const v = lire(conf, c.split('.')), w = lire(avant, c.split('.'));
    const E = U().fmtEur, jour = auj || U().aujourdhui();
    const fleche = function (x, y) { return E(x) + ' → ' + E(y); };
    const surDevis = { 'prix.material_margin': ['total_material_gross', 'marge matériel'],
      'prix.commission_principal': ['nicolas_net', 'commission nette du vendeur'], 'prix.net_divisor': ['nicolas_net', 'commission nette du vendeur'],
      'prix.commission_second': ['yannick_net', 'commission nette de l’autre'], 'prix.install_gross': ['install_total', 'pose facturée'],
      'prix.tva_pct': ['total_ttc', 'total TVAC'], 'prix.acompte_pct': ['acompte_montant', 'acompte demandé'] };
    if (surDevis[c]) {
      const a = devisType(avant), b = devisType(conf), k = surDevis[c][0];
      const prixPareil = Math.abs(a.total_ttc - b.total_ttc) < 0.005;
      return '2 screens à 1 500 € : ' + surDevis[c][1] + ' ' + fleche(a[k], b[k]) +
        (k !== 'total_ttc' && k !== 'acompte_montant' ? (prixPareil ? ' — le client paie pareil' : ' — le client paie ' + fleche(a.total_ttc, b.total_ttc)) : '');
    }
    if (c === 'prix.tech1_gross' || c === 'prix.tech2_gross' || c === 'prix.tools_gross') {
      const div = conf.prix.net_divisor > 0 ? conf.prix.net_divisor : 2.5;
      return c === 'prix.tools_gross' ? 'par ouverture, fondu dans la pose : ' + fleche(w, v)
        : 'par ouverture : ' + fleche(w / div, v / div) + ' nets';
    }
    if (c === 'prix.deplacement') return 'chaque dépannage commence par ' + fleche(w, v) + ' HTVA de déplacement';
    if (c === 'prix.taux_horaire') return '1 h 30 sur place : ' + fleche(w * 1.5, v * 1.5) + ' HTVA';
    if (c === 'prix.garantie_mois') return v > 0 ? 'le bon d’intervention annonce « pièces et main-d’œuvre garanties ' + fr(v) + ' mois »' : 'le bon d’intervention n’annonce plus de garantie';
    const pose = /^remu\.pose\.(.+)$/.exec(c);
    if (pose) return '10 ' + (POSES[pose[1]] || pose[1]) + ' posés : ' + fleche(w * 10, v * 10) + ' pour Nicolas';
    if (c === 'usage.relance_visite' || c === 'usage.relance_informatif') {
      if (!Array.isArray(v)) return '';
      return 'un devis envoyé aujourd’hui se relance le ' + v.map(function (n) { return U().fmtDate(plusJours(jour, n)).slice(0, 5); }).join(', le ').replace(/, le ([^,]+)$/, ' puis le $1');
    }
    if (c === 'usage.echeance_facture') return 'une facture émise aujourd’hui échoit le ' + U().fmtDate(plusJours(jour, v));
    if (c === 'usage.seuil_lead_chaud') return 'un client devient « très intéressé » à sa ' + fr(v) + (v === 1 ? 're' : 'e') + ' consultation';
    if (c === 'usage.objectif_mensuel') return v > 0 ? 'le tableau de bord mesure chaque mois contre ' + E(v) : 'pas d’objectif : le tableau de bord montre le signé du mois, sans anneau';
    return '';
  }

  window.SSParam = {
    sansAccents: sansAccents, correspond: correspond, lire: lire, changements: changements,
    controle: controle, format: format, effet: effet, devisType: devisType,
  };
})();
