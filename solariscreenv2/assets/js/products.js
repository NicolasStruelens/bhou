// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Catalogue produits (données partagées)
// Source unique pour simulateur.html (desktop) et terrain.html (mobile) :
// toute mise à jour catalogue (nouveaux RAL, nouveaux moteurs…) se fait ici.
// Script classique (file:// OK). Global : window.SSProducts
// ═══════════════════════════════════════════════════════════
(function () {
  // 4 familles de produits uniquement (demande explicite Nicolas)
  const ITEM_TYPES = {
    screen: 'Screen', volet_roulant: 'Volet', tablier_volet: 'Tablier de volet', tente_solaire: 'Tente solaire',
  };
  // Libellés conservés pour compat d'affichage sur d'anciens devis (plus proposés à la création)
  const ITEM_TYPES_LEGACY = { store_banne: 'Store banne', pergola: 'Pergola' };
  const MOTEURS = ['', 'Manuel', 'Somfy IO', 'Somfy RTS', 'Somfy Solaire', 'Filaire'];
  // Références réelles du catalogue Harol (autocomplétion — champ libre, pas une liste fermée)
  const MODELES_CATALOGUE = ['Coolscreen 8', 'VR150', 'BX270', 'LUX'];
  // 24 coloris "populaires" confirmés (nuancier Harol BR_Coloris 2026, page 5) — champ libre, autres RAL possibles
  const COULEURS_RAL = [
    '9016 — Blanc trafic', '9010 — Blanc pur', '9001 — Blanc crème (Sunny snow)', '1015 — Blanc ivoire',
    '1013 — Blanc perle ivoire', '7038 — Gris agate', '7030 — Gris pierre', '9007 — Gris aluminium',
    '7039 — Gris quartz', '9008 — Gris anthracite', '7012 — Gris basalte', '7016 — Gris nuit',
    '7021 — Gris anthracite foncé', '8016 — Gris noisette', '8028 — Brun acajou', '8014 — Brun terre',
    '8019 — Brun sépia', '8022 — Brun noir', '9004 — Noir signalisation', '9005 — Noir profond',
    '3005 — Rouge violet', '6009 — Vert sapin', '5011 — Bleu acier',
  ];
  // Gamme restreinte "Pure" (2025) — 10 RAL, classe 2 uniquement
  const COULEURS_RAL_PURE = ['7016', '7021', '7039', '8019', '9001', '9004', '9005', '9006', '9010', '9016'];
  // Toiles génériques (Volet/Tente solaire — en attendant les détails Nicolas)
  const TOILES_CATALOGUE = [
    'Soltis Horizon 86', 'Soltis Perform 92', 'Soltis Opaque B92', 'Sergé 600', 'Sergé 1%',
    'Dickson Orchestra', 'Sattler Urban Design', 'Swela', 'Sattler', 'Dickson',
  ];
  // ── Configurateur Coolscreen 8 (reproduit le portail Harol — Screen) ──
  const CS8_VARIANTES = ['Standard', 'Solar', 'Led', 'Plus'];
  const CS8_COMBINAISONS = [
    { v: 'Simple', l: 'Simple' },
    { v: 'DVC2', l: 'DVC2 — porte-fenêtre 2 parties, 1 caisson' },
    { v: 'DVC3', l: 'DVC3 — porte-fenêtre 3 parties, 1 caisson' },
  ];
  // Toiles vues sur ton portail (libellés exacts conservés) + confirmées par le catalogue Harol (codes article)
  const CS8_COLLECTIONS = [
    'Collectie copaco serge 5%', 'Collectie soltis 86', 'Collectie soltis 92',
    'Collectie soltis b92 - blackout', 'Collectie copaco serge 1%', 'Collectie blockout serge 600 lunar',
    'Collectie stam 6002', 'Collectie Soltis 7635', 'Collectie Satiné 5500',
    'Flexlight Lodge 6002 (occultant)', 'Cristal Clear (transparent, imperméable)',
  ];
  // Moteurs — tes réf. portail + réf. confirmées par le catalogue Harol (codes article)
  const CS8_MOTEURS = [
    '4114: Sunea 40 RTS', '4118: RS100 Solar IO', 'A1677: Harol Solar 50 ZS-ES-E-Z', 'A1871: Somfy Altea 50 Solar io',
    'A1380: Maestria+ 50 io 17 tr/min', 'A1872: Altea 50 Solar io 15 Nm', 'A4119: RS100 Solar io 15/20 Nm',
    'A1675: Harol Master 50-10/17-ZS-E-Z', 'A1676: Harol Optima 50-10/17-ZS',
  ];
  // Dimensions caisson — dépendent de la variante (Standard = petit caisson, Plus/Led/Solar = grand caisson)
  const CS8_CAISSON_MESURES_STANDARD = ['90x95', '110x115', '135x140'];
  const CS8_CAISSON_MESURES_GRAND    = ['90x123', '110x143', '135x168'];
  const CS8_CAISSON_FORMES = ['Carré', 'Rond']; // Rond = Standard uniquement (confirmé catalogue)
  const CS8_COLMATAGE = ["A125: Joint d'étanchéité", 'A947: Brosse (lame finale)', 'Pas'];

  // Dimensions caisson selon variante (confirmé catalogue : Standard = petit caisson, Solar/Led/Plus = grand caisson)
  function caissonMesuresFor(variante) {
    return variante === 'Standard' ? CS8_CAISSON_MESURES_STANDARD : CS8_CAISSON_MESURES_GRAND;
  }

  // ── Configurateur Tente solaire (fiches produit Harol_TS_FP_BX270/LUX, réf. 03/2026) ──
  // Toile standard/options déjà couverte par TOILES_CATALOGUE (Dickson Orchestra / Sattler
  // Urban Design en standard, Swela/Sattler/Dickson en option — confirmé identique sur les 2 fiches).
  const TS_SPECS = {
    BX270: {
      caisson: '162 mm profondeur × 227 mm hauteur', largeur_max: 7000, projection_max: 3500,
      inclinaison: '10° à 35°', manivelle: true, lambrequin_vario: false, eclairage_bras: false,
    },
    LUX: {
      caisson: '240 mm profondeur × 250 mm hauteur', largeur_max: 7000, projection_max: 4000,
      inclinaison: '10° à 30°', manivelle: false, lambrequin_vario: true, eclairage_bras: true,
    },
  };
  // Commande — IO de série sur les 2 modèles ; la manivelle manuelle n'existe qu'en option sur BX270 (s.o. sur LUX)
  const TS_MOTEURS = ['IO (standard)', 'RTS', 'Câblé', 'Manuel (manivelle)'];
  // Éclairage LED — les emplacements "bras" ne sont proposés que sur LUX (s.o. sur BX270)
  const TS_ECLAIRAGE_BX270 = ['Direct — caisson'];
  const TS_ECLAIRAGE_LUX = ['Direct — caisson', 'Direct — bras', 'Direct — bras et caisson', 'Indirect — caisson et barre de charge'];

  function tsMoteursFor(modele) {
    return modele === 'LUX' ? TS_MOTEURS.filter(m => m !== 'Manuel (manivelle)') : TS_MOTEURS;
  }
  function tsEclairageFor(modele) {
    return modele === 'LUX' ? TS_ECLAIRAGE_LUX : TS_ECLAIRAGE_BX270;
  }

  // ── Configurateur VR150 Pure (Volet roulant extérieur, fiche prix Harol 06/2026) ──
  // Toujours en commande électrique, une seule lame (ALU242) — pas de variantes produit
  // comme Coolscreen 8. Couleur caisson/glissières : même palette "Pure" 10 RAL que
  // Coolscreen 8 (COULEURS_RAL_PURE) — confirmé identique par la fiche VR150 Pure.
  const VR_CAISSONS = [
    { taille: '137', hauteur_max: 1110 },
    { taille: '150', hauteur_max: 1370 },
    { taille: '165', hauteur_max: 1870 },
    { taille: '180', hauteur_max: 2140 },
    { taille: '205', hauteur_max: 3000 },
  ]; // hauteur max donnée pour l'axe d'enroulement Ø60mm (le plus courant)
  const VR_MOTEURS = ['Secure (RF, standard)', 'Primo (filaire, sans télécommande)', 'Solar Pure (solaire)'];
  // 9 coloris standard de lame ALU242 (RAL ± indicatif, code Harol officiel)
  const VR_COULEURS_LAMES = [
    '01 — 9016 Blanc trafic', '03 — 8028 Brun acajou', '07 — 9006 Alu-métallic',
    '23 — 7038 Gris clair', '27 — 9001 Blanc crème', '38 — 7016 Gris anthracite',
    '43 — 7039 Gris quartz', '85 — 9007 Gris aluminium', '90 — 9005 Noir profond',
  ];
  function vrHauteurMaxFor(taille) {
    const c = VR_CAISSONS.find(x => x.taille === taille);
    return c ? c.hauteur_max : null;
  }

  // ── Catalogue d'accessoires à prix connu (pour les Suppléments) ──
  // Prix réels extraits des fiches prix Harol lues cette session (VR150 Pure 06/2026,
  // catalogue Protection Solaire 03/2026). Liste volontairement partielle et honnête :
  // uniquement les accessoires dont le prix est FIXE/à la pièce (pas les postes au mètre
  // ou par tranche de largeur, qui varient trop pour un prix "sur étagère"). Le champ
  // libre (bouton "+ Ajouter un supplément") reste toujours disponible pour tout le reste.
  const CATALOG_OPTIONS = [
    { label: 'Interrupteur Inis saillie (position fixe)', price: 7.54, cat: 'Domotique' },
    { label: 'Interrupteur Inis saillie (position momentanée)', price: 8.31, cat: 'Domotique' },
    { label: 'Interrupteur Inis encastré 80×80 (position fixe)', price: 9.56, cat: 'Domotique' },
    { label: 'Interrupteur Inis encastré 80×80 (position momentanée)', price: 10.36, cat: 'Domotique' },
    { label: 'Télécommande murale Lumo (1 canal)', price: 22.10, cat: 'Domotique' },
    { label: 'Télécommande portable Flowi 1 (1 canal)', price: 23.07, cat: 'Domotique' },
    { label: 'Télécommande portable Flowi 6 (6 canaux)', price: 26.06, cat: 'Domotique' },
    { label: 'Capteur vent/soleil Suno 230V', price: 137.88, cat: 'Domotique' },
    { label: 'Panneau solaire 5W (moteur solaire)', price: 30.62, cat: 'Domotique' },
    { label: 'Chargeur panneau solaire', price: 31.93, cat: 'Domotique' },
    { label: 'Console murale extra 300 mm', price: 37.90, cat: 'Fixation (Tente solaire)' },
    { label: 'Console murale extra 500 mm', price: 53.20, cat: 'Fixation (Tente solaire)' },
    { label: 'Console murale extra 1000 mm', price: 101.20, cat: 'Fixation (Tente solaire)' },
    { label: 'Console plafond complète 300 mm', price: 59.90, cat: 'Fixation (Tente solaire)' },
    { label: 'Console plafond complète 500 mm', price: 97.70, cat: 'Fixation (Tente solaire)' },
  ];

  window.SSProducts = {
    ITEM_TYPES, ITEM_TYPES_LEGACY, MOTEURS, MODELES_CATALOGUE,
    COULEURS_RAL, COULEURS_RAL_PURE, TOILES_CATALOGUE,
    CS8_VARIANTES, CS8_COMBINAISONS, CS8_COLLECTIONS, CS8_MOTEURS,
    CS8_CAISSON_MESURES_STANDARD, CS8_CAISSON_MESURES_GRAND, CS8_CAISSON_FORMES, CS8_COLMATAGE,
    caissonMesuresFor,
    TS_SPECS, TS_MOTEURS, TS_ECLAIRAGE_BX270, TS_ECLAIRAGE_LUX, tsMoteursFor, tsEclairageFor,
    VR_CAISSONS, VR_MOTEURS, VR_COULEURS_LAMES, vrHauteurMaxFor,
    CATALOG_OPTIONS,
  };
})();
