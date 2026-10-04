// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — RÉGLAGES DE L'ERP
// Script classique (file:// OK). Global : window.SSConf
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// CE FICHIER EST LA SEULE SOURCE DES VALEURS PAR DÉFAUT. Le serveur ne connaît aucun défaut : il
// stocke ce qu'on lui donne et renvoie `{}` s'il n'a rien. Une valeur de référence dupliquée des
// deux côtés finit toujours par diverger — ici, il n'y a qu'un endroit à lire et à corriger.
//
// ⚠️ RÈGLE ABSOLUE — LES RÉGLAGES NE SONT JAMAIS RÉTROACTIFS.
// Changer une marge ne doit RIEN changer à un devis déjà établi : un devis signé doit continuer
// de correspondre à la facture émise. Concrètement :
//   • un devis enregistre les taux avec lesquels il a été calculé (`pricing_v2.rates`) ;
//   • à la réouverture, on relit CES taux-là, jamais les réglages du jour ;
//   • un devis ancien, qui n'a pas de taux stockés, retombe sur les valeurs HISTORIQUES
//     (voir TAUX_HISTORIQUES ci-dessous) — surtout pas sur les réglages actuels.
// Les réglages ne servent donc qu'à préparer les devis À VENIR.
(function () {
  'use strict';

  // Taux en vigueur depuis l'origine de l'ERP. Un devis sans taux stockés a forcément été calculé
  // avec ceux-là : c'est ce qui permet de rouvrir un vieux dossier sans en changer un centime.
  // NE JAMAIS MODIFIER ces trois valeurs — elles décrivent le passé, pas une préférence.
  const TAUX_HISTORIQUES = { supplier_rate: 0.77, material_margin: 0.23, net_divisor: 2.5 };

  const DEFAUTS = {
    prix: {
      supplier_rate: 0.77,        // part du catalogue partant chez le fournisseur
      material_margin: 0.23,      // marge matériel brute (le complément de la ligne ci-dessus)
      net_divisor: 2.5,           // brut → net (charges et impôts)
      commission_principal: 18,   // % du catalogue pour celui qui a vendu
      commission_second: 5,       // % du catalogue pour l'autre
      install_gross: 280,         // pose facturée au client, par ouverture
      tech1_gross: 125,
      tech2_gross: 125,
      tools_gross: 30,
      deplacement: 45,          // dépannage : forfait de déplacement, par intervention
      taux_horaire: 55,         // dépannage : main-d'œuvre facturée à l'heure
      garantie_mois: 12,        // dépannage : garantie donnée sur pièces et main-d'œuvre
      tva_pct: 6,
      acompte_pct: 50,
    },
    usage: {
      seuil_lead_chaud: 5,              // nombre de vues à partir duquel un client est « chaud »
      relance_visite: [4, 9, 21],       // jours après envoi, devis établi après visite
      relance_informatif: [5, 12, 21],  // idem, devis informatif
      echeance_facture: 15,             // jours accordés par défaut sur une facture
      vue_defaut: 'actifs',             // vue du tableau de bord au premier chargement
      densite: 'confort',               // densité des lignes par défaut
      kpi_replies: false,               // chiffres du haut repliés par défaut
    },
    affichage: {
      theme_defaut: 'systeme',   // 'clair' | 'sombre' | 'systeme'
      mantra: true,              // pensée du jour dans le bandeau
      meteo: true,               // météo chez le client
    },
    // ── PLANNING ──────────────────────────────────────────────────────────────────────────────
    // La TRAME décrit une semaine ORDINAIRE : ce que chacun peut prendre, en temps normal.
    // On ne saisit jamais ses créneaux libres — un planning qu'il faut nourrir chaque semaine est
    // abandonné en trois semaines. On pose cette trame UNE FOIS, l'ERP soustrait tout seul ce qui
    // est déjà planifié (poses, visites, dépannages), et on n'ajoute à la main que les exceptions
    // (congé, « pas dispo jeudi », « exceptionnellement ce samedi-là »).
    // Valeurs d'un jour : 'non' | 'matin' | 'apresmidi' | 'journee'.
    planning: {
      heures: { debut: '08:00', midi: '12:00', reprise: '13:00', fin: '17:00' },
      trame: {
        nicolas: { lun: 'journee', mar: 'journee', mer: 'journee', jeu: 'journee', ven: 'journee', sam: 'non', dim: 'non' },
        yannick: { lun: 'journee', mar: 'journee', mer: 'journee', jeu: 'journee', ven: 'journee', sam: 'non', dim: 'non' },
      },
      // Durées retenues quand le dossier n'en porte pas. Elles ne changent AUCUN prix : elles ne
      // servent qu'à occuper la bonne place dans la journée et à repérer les chevauchements.
      duree_visite_h: 1,
      duree_pose_h: 4,
      duree_depannage_h: 2,
    },
    // ── RÉMUNÉRATION ───────────────────────────────────────────────────────────
    // CIBLE : ce que l'on veut toucher EN NET par ouverture posée. Ce ne sont PAS des primes à
    // verser en plus — cet argent est déjà dans le devis, à la ligne « Tech 1 » (125 € brut
    // ÷ 2,5 = 50 € net). La cible sert à MESURER : « ce devis te paie-t-il bien 50 € par
    // screen ? ». Une tente chiffrée comme un screen sort à 50 € au lieu de 100, et l'écran de
    // rémunération le signale pour qu'on chiffre la suivante à 250 € brut.
    // ⚠️ Ces trois valeurs doivent rester identiques à SSRemu.CIBLE_DEFAUT, qui les porte pour
    // le moteur appelé sans réglages. Un test de remuneration.test.html compare les deux : il
    // échouera si l'une des deux bouge seule.
    remu: {
      cible: { screen: 50, volet_roulant: 50, tente_solaire: 100 },
    },
  };

  const CLE_CACHE = 'ss_reglages';
  let charge = null;   // promesse de chargement, une seule par page

  const estObjet = (v) => v && typeof v === 'object' && !Array.isArray(v);

  /** Fusion en profondeur SUR LES DÉFAUTS : une clé absente ou d'un type inattendu retombe sur sa
   *  valeur de référence. Un réglage corrompu ne peut donc pas casser un calcul. */
  function fusionner(defauts, recu) {
    const out = {};
    Object.keys(defauts).forEach(function (k) {
      const d = defauts[k], r = recu ? recu[k] : undefined;
      if (estObjet(d)) { out[k] = fusionner(d, estObjet(r) ? r : {}); return; }
      if (Array.isArray(d)) {
        out[k] = (Array.isArray(r) && r.length === d.length && r.every(function (x) { return typeof x === 'number' && isFinite(x); }))
          ? r.slice() : d.slice();
        return;
      }
      if (typeof d === 'number') { out[k] = (typeof r === 'number' && isFinite(r)) ? r : d; return; }
      if (typeof d === 'boolean') { out[k] = (typeof r === 'boolean') ? r : d; return; }
      out[k] = (typeof r === 'string' && r) ? r : d;
    });
    return out;
  }

  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CLE_CACHE) || 'null'); } catch (e) { return null; }
  }
  function ecrireCache(o) {
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(o)); } catch (e) {}
  }

  /** Réglages utilisables TOUT DE SUITE, sans attendre le réseau (cache local, sinon défauts).
   *  Suffisant pour l'affichage ; pour un CALCUL DE PRIX, préférer `charger()` afin d'être sûr
   *  de travailler sur la version du serveur et pas sur un cache d'un autre appareil. */
  function get() { return fusionner(DEFAUTS, lireCache()); }

  /** Va chercher les réglages sur le serveur (une seule fois par page) et rafraîchit le cache. */
  function charger() {
    if (charge) return charge;
    charge = (window.SS && window.SS.getSettings ? window.SS.getSettings() : Promise.resolve(null))
      .then(function (recu) {
        if (recu && estObjet(recu)) ecrireCache(recu);
        return get();
      })
      .catch(function () { return get(); });   // hors-ligne : le cache (ou les défauts) font l'affaire
    return charge;
  }

  /** Enregistre et met le cache à jour. `resume` alimente le journal d'activité. */
  async function enregistrer(reglages, resume) {
    const propre = fusionner(DEFAUTS, reglages);
    const res = await window.SS.saveSettings(Object.assign({}, propre, resume ? { _resume: resume } : {}));
    if (res && res.ok !== false) { ecrireCache(propre); charge = Promise.resolve(propre); }
    return res;
  }

  /** Taux à utiliser pour CALCULER un devis.
   *  @param devis  devis existant (facultatif). S'il en a, ce sont les SIENS qui gagnent.
   *  Un devis ancien sans taux stockés retombe sur les taux historiques — jamais sur les réglages
   *  du jour, sinon rouvrir un vieux dossier en changerait les montants. */
  function tauxPour(devis) {
    const stockes = devis && devis.pricing_v2 && devis.pricing_v2.rates;
    if (estObjet(stockes)) return fusionner(TAUX_HISTORIQUES, stockes);
    if (devis && devis.id) return Object.assign({}, TAUX_HISTORIQUES);   // devis existant, taux d'époque
    const p = get().prix;                                                // devis NEUF : réglages du jour
    return { supplier_rate: p.supplier_rate, material_margin: p.material_margin, net_divisor: p.net_divisor };
  }

  window.SSConf = {
    DEFAUTS: DEFAUTS, TAUX_HISTORIQUES: TAUX_HISTORIQUES,
    get: get, charger: charger, enregistrer: enregistrer, tauxPour: tauxPour, fusionner: fusionner,
  };
})();
