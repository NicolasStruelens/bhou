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
  // Suggestions pour Emplacement / Étage (autocomplétion — champs libres, pas des listes fermées).
  // Gain de temps demandé par Nicolas : les valeurs les plus fréquentes reviennent devis après devis.
  const EMPLACEMENTS_SUGGESTIONS = [
    'Terrasse', 'Terrasse avant', 'Terrasse arrière', 'Façade avant', 'Façade arrière', 'Façade latérale',
    'Salon', 'Salle à manger', 'Cuisine', 'Chambre', 'Chambre enfant', 'Bureau', 'Véranda', 'Garage',
    "Porte d'entrée", 'Porte de garage', 'Fenêtre', 'Fenêtre salon', 'Fenêtre chambre', 'Fenêtre enfant',
    'Côté gauche', 'Côté droit', 'Maison', 'Appartement',
  ];
  const ETAGES_SUGGESTIONS = ['Sous-sol', 'RDC', '1er', '2e', '3e', '4e', 'Combles'];
  const MOTEURS = ['', 'Manuel', 'Somfy IO', 'Somfy RTS', 'Somfy Solaire', 'Filaire'];
  // Références réelles du catalogue Harol (autocomplétion — champ libre, pas une liste fermée)
  const MODELES_CATALOGUE = ['Coolscreen 8', 'VR150', 'BX270', 'LUX'];
  // ── NUANCIER RAL ──────────────────────────────────────────────────────────
  // code -> [nom FR, teinte écran, dispo Harol]. La teinte est une approximation
  // sRGB destinée à l'aperçu commercial : elle ne remplace pas un vrai nuancier
  // physique (l'écran et l'éclairage font déjà varier le rendu bien plus).
  // Le drapeau « dispo Harol » = 1 pour les 111 codes du nuancier Harol
  // (BR_Coloris_2026_01.pdf, peinture poudre) ; les autres RAL Classic restent
  // saisissables — Nicolas doit pouvoir demander un RAL hors nuancier.
  const RAL_TABLE = {
    '1000':['Vert beige','#CDBA88',1], '1001':['Beige','#D0B084',1], '1002':['Jaune sable','#D2AA6D',1], '1003':['Jaune de sécurité','#F9A800'],
    '1004':['Jaune or','#E49E00'], '1005':['Jaune miel','#CB8E00'], '1006':['Jaune maïs','#E29000'], '1007':['Jaune narcisse','#E88C00'],
    '1011':['Beige brun','#AF804F',1], '1012':['Jaune citron','#DDAF27'], '1013':['Blanc perlé','#E3D9C6',1], '1014':['Ivoire','#DDC49A',1],
    '1015':['Ivoire clair','#E6D2B5',1], '1016':['Jaune soufre','#F1DD38'], '1017':['Jaune safran','#F6A950'], '1018':['Jaune zinc','#FACA30',1],
    '1019':['Beige gris','#A48F7A',1], '1020':['Jaune olive','#A08F65'], '1021':['Jaune colza','#F6B600'], '1023':['Jaune signalisation','#F7B500'],
    '1024':['Jaune ocre','#BA8F4C'], '1026':['Jaune brillant','#FFFF00'], '1027':['Jaune curry','#A77F0E'], '1028':['Jaune melon','#FF9B00'],
    '1032':['Jaune genêt','#E2A300'], '1033':['Jaune dahlia','#F99A1C'], '1034':['Jaune pastel','#EB9C52'], '1035':['Beige nacré','#908070',1],
    '1036':['Or nacré','#80643F'], '1037':['Jaune soleil','#F09200'], '2000':['Orangé jaune','#DA6E00'], '2001':['Orangé rouge','#BA481B'],
    '2002':['Orangé sang','#BF3922'], '2003':['Orangé pastel','#F67828'], '2004':['Orangé pur','#E25303'], '2005':['Orangé brillant','#FF4D06'],
    '2007':['Orangé clair brillant','#FFB200'], '2008':['Orangé rouge clair','#F44611'], '2009':['Orangé signalisation','#D84B20'], '2010':['Orangé de sécurité','#C63927'],
    '2011':['Orangé foncé','#E55137'], '2012':['Orangé saumon','#D35C37'], '2013':['Orangé nacré','#954527'], '3000':['Rouge feu','#A72920',1],
    '3001':['Rouge de sécurité','#9B2423'], '3002':['Rouge carmin','#9B2321'], '3003':['Rouge rubis','#861A22'], '3004':['Rouge pourpre','#6B1C23',1],
    '3005':['Rouge vin','#59191F',1], '3007':['Rouge noir','#3E3B32'], '3009':['Rouge oxyde','#6D342D',1], '3011':['Rouge brun','#792423',1],
    '3012':['Rouge beige','#C6846D',1], '3013':['Rouge tomate','#972E25',1], '3014':['Vieux rose','#CB7375'], '3015':['Rose clair','#D8A0A6'],
    '3016':['Rouge corail','#A63D2F'], '3017':['Rosé','#CD545B'], '3018':['Rouge fraise','#C6363C'], '3020':['Rouge signalisation','#BB1E10'],
    '3022':['Rouge saumon','#CF6955'], '3024':['Rouge brillant','#FF2D21'], '3026':['Rouge clair brillant','#FF2A1C'], '3027':['Rouge framboise','#AB273C'],
    '3028':['Rouge pur','#CC2C24'], '3031':['Rouge orient','#A63437'], '3032':['Rouge rubis nacré','#701D24'], '3033':['Rouge clair nacré','#A53A2E'],
    '4001':['Lilas rouge','#816183'], '4002':['Violet rouge','#8D3C4B'], '4003':['Violet bruyère','#C4618C'], '4004':['Violet bordeaux','#651E38'],
    '4005':['Lilas bleu','#76689A'], '4006':['Pourpre signalisation','#903373'], '4007':['Violet pourpre','#47243C'], '4008':['Violet de sécurité','#814E7D'],
    '4009':['Violet pastel','#A38995'], '4010':['Magenta télé','#BC4077'], '4011':['Violet nacré','#6E6387'], '4012':['Mûre nacrée','#6B6B7F'],
    '5000':['Bleu violet','#304F6E'], '5001':['Bleu vert','#0E4243'], '5002':['Bleu outremer','#12437F'], '5003':['Bleu saphir','#232D53',1],
    '5004':['Bleu noir','#1B1F2A',1], '5005':['Bleu de sécurité','#154889'], '5007':['Bleu brillant','#3E75A7'], '5008':['Bleu gris','#26353F',1],
    '5009':['Bleu azur','#1F4E5F',1], '5010':['Bleu gentiane','#0E4C8E',1], '5011':['Bleu acier','#1A2B3C',1], '5012':['Bleu clair','#3481B8'],
    '5013':['Bleu cobalt','#193153',1], '5014':['Bleu pigeon','#637D96',1], '5015':['Bleu ciel','#2874B2'], '5017':['Bleu signalisation','#0E518D'],
    '5018':['Bleu turquoise','#21888F'], '5019':['Bleu capri','#1A5784'], '5020':['Bleu océan','#0B4151'], '5021':['Bleu d\'eau','#07737A',1],
    '5022':['Bleu nocturne','#2F2A5A'], '5023':['Bleu distant','#4D668E'], '5024':['Bleu pastel','#6A93B0'], '5025':['Bleu gentiane nacré','#296478'],
    '5026':['Bleu nuit nacré','#102C54'], '6000':['Vert patine','#327662'], '6001':['Vert émeraude','#28713E'], '6002':['Vert feuillage','#276235'],
    '6003':['Vert olive','#4B573E',1], '6004':['Vert bleu','#0E4243'], '6005':['Vert mousse','#0F4336',1], '6006':['Olive gris','#40412E'],
    '6007':['Vert bouteille','#283424',1], '6008':['Vert brun','#35382E'], '6009':['Vert sapin','#26392F',1], '6010':['Vert herbe','#3E753B'],
    '6011':['Vert réséda','#67836C',1], '6012':['Vert noir','#31403B',1], '6013':['Vert jonc','#7C7B52',1], '6014':['Olive jaune','#474135',1],
    '6015':['Olive noir','#3D3D36',1], '6016':['Vert turquoise','#00694C',1], '6017':['Vert mai','#587F40'], '6018':['Vert jaune','#61993B'],
    '6019':['Vert blanc','#B9CEAC'], '6020':['Vert oxyde chromique','#37422F',1], '6021':['Vert pâle','#8A9977',1], '6022':['Olive brun','#3A3327',1],
    '6024':['Vert signalisation','#187B45'], '6025':['Vert fougère','#5E6E3B'], '6026':['Vert opale','#01694D'], '6027':['Vert clair','#81C0BB'],
    '6028':['Vert pin','#2D5546'], '6029':['Vert menthe','#007243'], '6032':['Vert de sécurité','#0F8558'], '6033':['Turquoise menthe','#478A84',1],
    '6034':['Turquoise pastel','#7FB0B2'], '6035':['Vert nacré','#1B542C'], '6036':['Vert opale nacré','#005D4C'], '6037':['Vert pur','#007F0E'],
    '6038':['Vert brillant','#00B81A'], '7000':['Gris petit-gris','#7E8B92',1], '7001':['Gris argent','#8F999F',1], '7002':['Gris olive','#817F68',1],
    '7003':['Gris mousse','#7A7B6D',1], '7004':['Gris de sécurité','#9EA0A1',1], '7005':['Gris souris','#6B716F',1], '7006':['Gris beige','#756F61',1],
    '7008':['Gris kaki','#746643',1], '7009':['Gris vert','#5B6259',1], '7010':['Gris tente','#575D57',1], '7011':['Gris fer','#555D61',1],
    '7012':['Gris basalte','#596163',1], '7013':['Gris brun','#555548',1], '7015':['Gris ardoise','#51565C',1], '7016':['Gris anthracite','#373F43',1],
    '7021':['Gris noir','#2E3234',1], '7022':['Gris terre d\'ombre','#4B4D46',1], '7023':['Gris béton','#818479',1], '7024':['Gris graphite','#474A51',1],
    '7026':['Gris granit','#374447',1], '7030':['Gris pierre','#939388',1], '7031':['Gris bleu','#5D6970',1], '7032':['Gris silex','#B9B9A8',1],
    '7033':['Gris ciment','#818979',1], '7034':['Gris jaune','#939176',1], '7035':['Gris clair','#CBD0CC',1], '7036':['Gris platine','#9A8F88',1],
    '7037':['Gris poussière','#7C7F7E',1], '7038':['Gris agate','#B4B8B0',1], '7039':['Gris quartz','#6B695F',1], '7040':['Gris fenêtre','#9DA3A6',1],
    '7042':['Gris signalisation A','#8F9695',1], '7043':['Gris signalisation B','#4E5451',1], '7044':['Gris soie','#BDBDB2',1], '7045':['Telegris 1','#91969A',1],
    '7046':['Telegris 2','#82898E',1], '7047':['Telegris 4','#CFD0CF',1], '7048':['Gris souris nacré','#888175',1], '8000':['Brun vert','#887142',1],
    '8001':['Brun terre de Sienne','#9C6B30'], '8002':['Brun de sécurité','#7B5141',1], '8003':['Brun argile','#80542F',1], '8004':['Brun cuivré','#8F4E35',1],
    '8007':['Brun fauve','#6F4A2F',1], '8008':['Brun olive','#6F4F28'], '8011':['Brun noisette','#5A3A29',1], '8012':['Brun rouge','#673831',1],
    '8014':['Brun sépia','#49392D',1], '8015':['Marron','#633A34',1], '8016':['Brun acajou','#4C2F26',1], '8017':['Brun chocolat','#44322D',1],
    '8019':['Brun gris','#3D3635',1], '8022':['Brun noir','#1A1A1A',1], '8023':['Brun orangé','#A45729',1], '8024':['Brun beige','#795038',1],
    '8025':['Brun pâle','#755C48',1], '8028':['Brun terre','#4E3B31',1], '8029':['Cuivre nacré','#7F4031'], '9001':['Blanc crème','#E9E0D2',1],
    '9002':['Blanc gris','#D7D5CB',1], '9003':['Blanc de sécurité','#ECECE7',1], '9004':['Noir de sécurité','#2B2B2C',1], '9005':['Noir foncé','#0E0E10',1],
    '9006':['Aluminium blanc','#A5A5A5',1], '9007':['Aluminium gris','#8F8F8C',1], '9010':['Blanc pur','#F1ECE1',1], '9011':['Noir graphite','#27292B',1],
    '9016':['Blanc signalisation','#F1F0EA',1], '9017':['Noir signalisation','#2A292A',1], '9018':['Blanc papyrus','#CFD3CD',1], '9022':['Gris nacré clair','#9C9C9C'],
    '9023':['Gris nacré foncé','#828282'], '8027':['Brun (laque Harol)','',1], '8090':['Profel P890 (laque texturée)','',1], '9008':['Coatex 9T08 (laque texturée)','',1],
    '9009':['Aliplast 9009 (laque texturée)','',1],
  };
  // Les plus posés — remontés en tête du nuancier pour aller vite sur chantier.
  const RAL_FREQUENTS = ['9016', '9010', '9001', '1015', '1013', '7038', '7030', '9007', '7039', '7012', '7016', '7021', '8016', '8028', '8014', '8019', '8022', '9004', '9005', '3005', '6009', '5011'];

  // « 7016 — Gris anthracite », « 38 — 7016 Gris anthracite », « 7016 » → '7016'
  function ralCode(v) {
    if (!v) return null;
    const m = String(v).match(/\b(\d{4})\b/g);
    if (!m) return null;
    for (const c of m) if (RAL_TABLE[c]) return c;   // ex. « 38 — 7016 » : 0038 n'existe pas, 7016 oui
    return null;
  }
  function ralNom(v) { const c = ralCode(v); return c ? RAL_TABLE[c][0] : ''; }
  function ralHex(v) { const c = ralCode(v); return (c && RAL_TABLE[c][1]) || null; }
  function ralHarol(v) { const c = ralCode(v); return !!(c && RAL_TABLE[c][2]); }
  function ralLabel(code) { const e = RAL_TABLE[code]; return e ? code + ' — ' + e[0] : code; }
  // Liste complète du nuancier Harol, fréquents en tête
  function ralListeHarol() {
    const rest = Object.keys(RAL_TABLE).filter(c => RAL_TABLE[c][2] && RAL_FREQUENTS.indexOf(c) < 0).sort();
    return RAL_FREQUENTS.concat(rest);
  }

  // Libellés prêts à afficher (« 7016 — Gris anthracite ») pour les datalists.
  const COULEURS_RAL = ralListeHarol().map(ralLabel);

  // Gamme restreinte "Pure" (2025) — 10 RAL, classe 2 uniquement
  const COULEURS_RAL_PURE = ['7016', '7021', '7039', '8019', '9001', '9004', '9005', '9006', '9010', '9016'];
  // Toiles génériques (Volet/Tente solaire — en attendant les détails Nicolas)
  const TOILES_CATALOGUE = [
    'Soltis Horizon 86', 'Soltis Perform 92', 'Soltis Opaque B92', 'Sergé 600', 'Sergé 1%',
    'Dickson Orchestra', 'Sattler Urban Design', 'Swela', 'Sattler', 'Dickson',
  ];
  // ── Configurateur Coolscreen 8 (reproduit le portail Harol — Screen) ──
  const CS8_VARIANTES = ['Standard', 'Solar', 'Led', 'Plus'];
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
  // Options exactes du portail Harol (BX270) — fournies par Nicolas :
  const TS_MANOEUVRES = ['Treuil', 'Moteur', 'Moteur avec manœuvre de secours']; // Type de manœuvre (31/51/52)
  const TS_MOTEUR_SORTES = ['Sunea io', 'Orea wt'];                               // Sorte de moteur (1281/2619)
  const CABLE_LONGUEURS = ['5 m', '10 m'];        // câble tente solaire (A288) + panneau solaire déporté
  const TS_CABLE_LONGUEURS = CABLE_LONGUEURS;     // alias historique (tente solaire)
  const TS_CABLE_COULEURS = ['Blanc', 'Noir'];                                    // Couleur du câble
  const TS_COLLECTIONS = [                                                        // Toiles disponibles (écran « Toile »)
    'Sattler Lumera', 'Sattler Elements Urban Design', 'Sattler Lumera Landscape',
    'Dickson Orchestra', 'Dickson Orchestra Max', 'Sattler Elements', 'Dickson R&H — Jacquards',
    'Swela Chique', 'Swela Elegance', 'Sattler Lumera 3D', 'Dickson Spark FR (brandvertragend)',
    'Sattler Elements Cross Fiber', 'Harol Premium Acrylic',
  ];

  function tsMoteursFor(modele) {
    return modele === 'LUX' ? TS_MOTEURS.filter(m => m !== 'Manuel (manivelle)') : TS_MOTEURS;
  }
  function tsEclairageFor(modele) {
    return modele === 'LUX' ? TS_ECLAIRAGE_LUX : TS_ECLAIRAGE_BX270;
  }

  // ── Configurateur VR150 Pure (Volet roulant extérieur, fiche prix Harol 06/2026) ──
  // Toujours en commande électrique. Couleur caisson/glissières : même palette "Pure" 10 RAL
  // que Coolscreen 8 (COULEURS_RAL_PURE) — confirmé identique par la fiche VR150 Pure.
  // Type de lame : plusieurs profils possibles (vu sur le vrai portail de commande Harol de
  // Nicolas, pas seulement ALU242 comme supposé initialement) — liste exacte de son portail.
  const VR_LAMES = ['PVC37', 'Midi', 'alu35', 'alu237', 'alu242', 'alu242s'];
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

  // ── Catalogue d'accessoires (Suppléments) ─────────────────────────────────
  // 149 références extraites du tarif Harol « Protection Solaire » 03/2026, section
  // DOMOTIQUE (pages 174-192) + les consoles de tente solaire. Ce sont les accessoires
  // SOMFY tels que Nicolas les commande RÉELLEMENT — c'est-à-dire via Harol : d'où le
  // numéro d'article Harol (`ref`), qui est ce qu'on tape sur le portail de commande,
  // et le prix d'achat HTVA réel.
  // Les libellés en double au tarif (« VVF (blanc) - 10 mètre » existe en 2 et 3 fils,
  // à 4 prix différents) ont été préfixés par leur sous-titre : sans ça, impossible de
  // savoir laquelle des références commander.
  // Le champ libre (« + Ajouter un supplément ») reste là pour tout le reste.
  const CATALOG_OPTIONS = [
    { label: 'Capteur Eolis 3D Wirefree io - blanc', price: 126.25, ref: '048808', cat: 'Capteur' },
    { label: 'Capteur Eolis 3D Wirefree io - bronze', price: 126.25, ref: '048809', cat: 'Capteur' },
    { label: 'Capteur Eolis 3D Wirefree io - noir', price: 126.25, ref: '048810', cat: 'Capteur' },
    { label: 'Capteur Eolis Wirefree io', price: 123.85, ref: '047555', cat: 'Capteur' },
    { label: 'Capteur Eolis io', price: 133.24, ref: '063939', cat: 'Capteur' },
    { label: 'Capteur Soliris 230 V io', price: 162.64, ref: '066039', cat: 'Capteur' },
    { label: 'Capteur de pluie Ondeis 230 V', price: 246.39, ref: '060703', cat: 'Capteur' },
    { label: 'Capteur de pluie Ondeis 24 VDC', price: 246.39, ref: '060704', cat: 'Capteur' },
    { label: 'Eolis Box 2', price: 98.62, ref: '026089', cat: 'Capteur' },
    { label: 'Eolis Box 2 avec capteur Eolis', price: 139.44, ref: '062668', cat: 'Capteur' },
    { label: 'Eolis capteur', price: 47.56, ref: '026088', cat: 'Capteur' },
    { label: 'Soliris Smoove IB+ avec cadre', price: 174.79, ref: '051354', cat: 'Capteur' },
    { label: 'Soliris Smoove Uno avec cadre', price: 168.25, ref: '051353', cat: 'Capteur' },
    { label: 'Soliris cellule solaire', price: 43.26, ref: '049460', cat: 'Capteur' },
    { label: 'Soliris sensor (capteur vent-soleil combiné)', price: 62.52, ref: '024771', cat: 'Capteur' },
    { label: 'Suno Capteur de vent et soleil 230V', price: 137.88, ref: '068557', cat: 'Capteur' },
    { label: 'Support coin pour Eolis et Soliris', price: 56.38, ref: '029648', cat: 'Capteur' },
    { label: 'Thermostat', price: 68.62, ref: '008886', cat: 'Capteur' },
    { label: 'Câble 3 veines - 5 mètres - Pure', price: 8.69, ref: '068602', cat: 'Câble' },
    { label: 'Câble 4 veines - 5 mètres - Pure', price: 9.78, ref: '068603', cat: 'Câble' },
    { label: 'Câble d\'accord LS/LT/WT/RTS/io', price: 59.39, ref: '062953', cat: 'Câble' },
    { label: 'Câble d\'extension - 1 mètre', price: 6.47, ref: '066451', cat: 'Câble' },
    { label: 'Câble d\'extension - 5 mètre', price: 15.89, ref: '066452', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 2 fils io (RS100) — VVF (blanc) - 10 mètre', price: 16.90, ref: '050530', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 3 fils io/RTS — RRF (noir) - 3 mètre', price: 6.36, ref: '063976', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 3 fils io/RTS — RRF (noir) - 5 mètre', price: 10.46, ref: '063977', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 3 fils io/RTS — VVF (blanc) - 10 mètre', price: 12.84, ref: '027496', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 3 fils io/RTS — VVF (blanc) - 5 mètre', price: 10.10, ref: '035678', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils CSI — RRF (noir) - 10 mètre', price: 31.93, ref: '064053', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils CSI — VVF (blanc) - 10 mètre', price: 24.77, ref: '020865', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils CSI — VVF (blanc) - 5 mètre', price: 14.84, ref: '020864', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils LT/WT — RRF (noir) - 10 mètre', price: 29.26, ref: '063980', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils LT/WT — RRF (noir) - 3 mètre', price: 12.99, ref: '063978', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils LT/WT — RRF (noir) - 5 mètre', price: 15.19, ref: '063979', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils LT/WT — VVF (blanc) - 10 mètre', price: 17.73, ref: '012834', cat: 'Câble' },
    { label: 'Câble pour moteur avec fiche à 4 fils LT/WT — VVF (blanc) - 5 mètre', price: 12.01, ref: '012833', cat: 'Câble' },
    { label: 'Ethernet câble Tahoma Switch', price: 40.97, ref: '068145', cat: 'Câble' },
    { label: 'Boîte à appliquer Centralis 2 RTS intérieur', price: 8.12, ref: '022665', cat: 'Divers' },
    { label: 'Boîtier en saillie simple complet Original', price: 7.55, ref: '060059', cat: 'Divers' },
    { label: 'Détecteur d\'ouverture - porte/fenêtre', price: 154.22, ref: '051366', cat: 'Divers' },
    { label: 'Fiche', price: 2.48, ref: '001257', cat: 'Divers' },
    { label: 'Noir - 10 mètre', price: 21.98, ref: '063922', cat: 'Divers' },
    { label: 'Noir - 5 mètre', price: 10.32, ref: '063921', cat: 'Divers' },
    { label: 'Petite boîte à appliquer blanc pour Centralis', price: 3.75, ref: '046208', cat: 'Divers' },
    { label: 'Petite boîte à appliquer gris pour Centralis', price: 4.25, ref: '026073', cat: 'Divers' },
    { label: 'Quick Copy tool', price: 106.47, ref: '066466', cat: 'Divers' },
    { label: 'RNF (noir) - 10 mètre', price: 20.23, ref: '064052', cat: 'Divers' },
    { label: 'Solar alimentation', price: 72.55, ref: '068146', cat: 'Divers' },
    { label: 'Solar panel 2,5 W 3 to 10Nm (9028154)', price: 53.20, ref: '068147', cat: 'Divers' },
    { label: 'Solar panel 5,8 W 15 to 20Nm (9028189)', price: 106.40, ref: '068148', cat: 'Divers' },
    { label: 'Somfy Connectivity kit', price: 86.94, ref: '067801', cat: 'Divers' },
    { label: 'Thermis Wirefree io', price: 111.34, ref: '062641', cat: 'Divers' },
    { label: 'VVF (blanc) - 3 mètre', price: 9.14, ref: '012382', cat: 'Divers' },
    { label: 'Version LT/WT Belux - RRF (noir) - 0,5 mètre', price: 27.10, ref: '006330', cat: 'Divers' },
    { label: 'Version LT/WT Pays-bas - RRF (noir) - 0,3', price: 27.10, ref: '048123', cat: 'Divers' },
    { label: 'Version io/RTS - RRF (noir) - 0,5 mètre', price: 37.50, ref: '060787', cat: 'Divers' },
    { label: 'Console murale extra 1000 mm', price: 101.20, ref: '', cat: 'Fixation' },
    { label: 'Console murale extra 300 mm', price: 37.90, ref: '', cat: 'Fixation' },
    { label: 'Console murale extra 500 mm', price: 53.20, ref: '', cat: 'Fixation' },
    { label: 'Console plafond complète 300 mm', price: 59.90, ref: '', cat: 'Fixation' },
    { label: 'Console plafond complète 500 mm', price: 97.70, ref: '', cat: 'Fixation' },
    { label: 'Support pour panneau solaire <15Nm', price: 10.05, ref: '068300', cat: 'Fixation' },
    { label: 'Support pour panneau solaire >=15Nm', price: 7.75, ref: '068359', cat: 'Fixation' },
    { label: 'Chronis Easy UNO (horloge journalière)', price: 89.97, ref: '042491', cat: 'Horloge' },
    { label: 'Chronis io', price: 159.12, ref: '062554', cat: 'Horloge' },
    { label: 'Amy 1 Canal A/M Modes io - carré', price: 55.22, ref: '068590', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal A/M Modes io - rond', price: 55.22, ref: '068589', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal Modes io - carré', price: 47.89, ref: '068588', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal Modes io - rond', price: 47.89, ref: '068587', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal RS100 io - carré', price: 52.60, ref: '068592', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal RS100 io - rond', price: 52.60, ref: '068591', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal io - carré', price: 37.48, ref: '068584', cat: 'Interrupteur' },
    { label: 'Amy 1 Canal io - rond', price: 37.48, ref: '068583', cat: 'Interrupteur' },
    { label: 'Amy 4 Canaux Modes io - carré', price: 71.63, ref: '068594', cat: 'Interrupteur' },
    { label: 'Amy 4 Canaux Modes io - rond', price: 71.63, ref: '068593', cat: 'Interrupteur' },
    { label: 'Amy Scene Player io - carré', price: 43.07, ref: '068586', cat: 'Interrupteur' },
    { label: 'Amy Scene Player io - rond', price: 43.07, ref: '068585', cat: 'Interrupteur' },
    { label: 'Amy cadre - carré', price: 3.25, ref: '068598', cat: 'Interrupteur' },
    { label: 'Amy cadre - rond', price: 3.25, ref: '068597', cat: 'Interrupteur' },
    { label: 'Black Smoove', price: 9.56, ref: '048827', cat: 'Interrupteur' },
    { label: 'Boîte saillie Smoove', price: 4.69, ref: '066042', cat: 'Interrupteur' },
    { label: 'Dubbel Pure Smoove', price: 5.90, ref: '048824', cat: 'Interrupteur' },
    { label: 'Inis 80x80 encastré - position fixe', price: 9.56, ref: '027541', cat: 'Interrupteur' },
    { label: 'Inis 80x80 encastré - position momentanée', price: 10.36, ref: '027542', cat: 'Interrupteur' },
    { label: 'Inis en saillie - position fixe', price: 7.54, ref: '026063', cat: 'Interrupteur' },
    { label: 'Inis en saillie - position momentanée', price: 8.31, ref: '026065', cat: 'Interrupteur' },
    { label: 'Interrupteur de réglage moteur selve sez', price: 39.32, ref: '062795', cat: 'Interrupteur' },
    { label: 'Interrupteur mural io : 3-canals et résistant', price: 47.46, ref: '066044', cat: 'Interrupteur' },
    { label: 'Interrupteur à appliquer bipolaire', price: 25.81, ref: '001247', cat: 'Interrupteur' },
    { label: 'Interrupteur à appliquer — Interrupteur unipolaire', price: 10.13, ref: '001233', cat: 'Interrupteur' },
    { label: 'Interrupteur à bouton poussoir à pulsion 6a', price: 25.01, ref: '060060', cat: 'Interrupteur' },
    { label: 'Interrupteur à encastrer à rotation — Interrupteur unipolaire', price: 9.84, ref: '001229', cat: 'Interrupteur' },
    { label: 'Interrupteurs à clé en applique - position fixe', price: 47.58, ref: '001241', cat: 'Interrupteur' },
    { label: 'Interrupteurs à clé en applique - position mo­', price: 47.58, ref: '001239', cat: 'Interrupteur' },
    { label: 'Interrupteurs à clé à encastrer - position fixe', price: 47.58, ref: '001238', cat: 'Interrupteur' },
    { label: 'Interrupteurs à clé à encastrer - position mo­', price: 47.58, ref: '001235', cat: 'Interrupteur' },
    { label: 'Lumo (Commande mural mono canal AC159-01)', price: 22.10, ref: '068558', cat: 'Interrupteur' },
    { label: 'Pure Smoove', price: 2.94, ref: '048823', cat: 'Interrupteur' },
    { label: 'Smoove 1 A/M io Black', price: 62.64, ref: '048883', cat: 'Interrupteur' },
    { label: 'Smoove 1 A/M io Pure', price: 62.64, ref: '048882', cat: 'Interrupteur' },
    { label: 'Smoove 1 O/C io Black', price: 48.72, ref: '048892', cat: 'Interrupteur' },
    { label: 'Smoove 1 io Black', price: 47.27, ref: '048834', cat: 'Interrupteur' },
    { label: 'Smoove 1 io Pure', price: 47.27, ref: '048833', cat: 'Interrupteur' },
    { label: 'Smoove 1 io Silver', price: 62.02, ref: '048835', cat: 'Interrupteur' },
    { label: 'Smoove DUO WT - 5 positions', price: 22.73, ref: '066041', cat: 'Interrupteur' },
    { label: 'Smoove DUO WT - position fixe', price: 20.30, ref: '064033', cat: 'Interrupteur' },
    { label: 'Smoove DUO WT - zéro automatique', price: 20.30, ref: '064035', cat: 'Interrupteur' },
    { label: 'Smoove Origin IB', price: 43.52, ref: '063012', cat: 'Interrupteur' },
    { label: 'Smoove Origin RS100 io Pure (cadre incl.)', price: 41.73, ref: '067703', cat: 'Interrupteur' },
    { label: 'Smoove Origin io', price: 38.18, ref: '048832', cat: 'Interrupteur' },
    { label: 'Smoove UNO WT - 5 positions', price: 17.29, ref: '066040', cat: 'Interrupteur' },
    { label: 'Smoove UNO WT - zéro automatique', price: 13.16, ref: '064032', cat: 'Interrupteur' },
    { label: 'Smoove Uno io - moteur câblé existant por', price: 168.13, ref: '051361', cat: 'Interrupteur' },
    { label: 'Batterie 16,8V NiMH pour Solar RS100 15', price: 145.28, ref: '068150', cat: 'Moteur' },
    { label: 'Batterie 9,6V NiMH pour Solar RS100 3 jusq\'à', price: 77.74, ref: '068149', cat: 'Moteur' },
    { label: 'CD 1x4 IB Contrôleur de moteur', price: 175.45, ref: '033085', cat: 'Moteur' },
    { label: 'CD 2x1 IB Contrôleur de moteur', price: 160.81, ref: '033084', cat: 'Moteur' },
    { label: 'Oximo Wirefree batterie sans couverture', price: 81.11, ref: '066306', cat: 'Moteur' },
    { label: 'Caisson relais mini pour 1 motor tubulaire', price: 44.27, ref: '067780', cat: 'Récepteur / box' },
    { label: 'Lanceur de scénarios pour TaHoma', price: 60.81, ref: '062640', cat: 'Récepteur / box' },
    { label: 'Repeater Box io', price: 296.27, ref: '046518', cat: 'Récepteur / box' },
    { label: 'Récepteur Heating SLIM io on/off', price: 198.61, ref: '063888', cat: 'Récepteur / box' },
    { label: 'Récepteur Izymo lumière io dimmable', price: 88.94, ref: '068103', cat: 'Récepteur / box' },
    { label: 'Récepteur Izymo lumière io on/off', price: 50.72, ref: '066214', cat: 'Récepteur / box' },
    { label: 'Récepteur SLIM io pour screens', price: 169.19, ref: '063940', cat: 'Récepteur / box' },
    { label: 'Récepteur io (alimentation 12 ou 24 VDC)', price: 149.37, ref: '063883', cat: 'Récepteur / box' },
    { label: 'Récepteur io (alimentation 230 V) dimmable', price: 160.05, ref: '062680', cat: 'Récepteur / box' },
    { label: 'Somfy TaHoma Toolkit', price: 396.93, ref: '067742', cat: 'Récepteur / box' },
    { label: 'TaHoma Switch', price: 204.60, ref: '064240', cat: 'Récepteur / box' },
    { label: '3.2 W panneau solaire', price: 55.70, ref: '063094', cat: 'Solaire' },
    { label: 'Batterie 16,8V NiMH boîtier en Alu', price: 156.57, ref: '068152', cat: 'Solaire' },
    { label: 'Batterie 9,6V NiMH boîtier en Alu pour Solar', price: 92.42, ref: '068151', cat: 'Solaire' },
    { label: 'Chargeur 3-0699041', price: 31.93, ref: '068601', cat: 'Solaire' },
    { label: 'Panneau solaire de 5W (AC605-03)', price: 30.62, ref: '068600', cat: 'Solaire' },
    { label: 'Flowi 1 (Emetteur portable mono canal AC157-01)', price: 23.07, ref: '068559', cat: 'Télécommande' },
    { label: 'Flowi 6 (Emetteur portable 6 canaux AC157-06)', price: 26.06, ref: '068566', cat: 'Télécommande' },
    { label: 'Nina Timer io', price: 251.64, ref: '051356', cat: 'Télécommande' },
    { label: 'Nina io', price: 230.87, ref: '050412', cat: 'Télécommande' },
    { label: 'Situo 1 A/M io Pure II', price: 66.64, ref: '066468', cat: 'Télécommande' },
    { label: 'Situo 1 VAR io Iron II', price: 87.42, ref: '065709', cat: 'Télécommande' },
    { label: 'Situo 1 VAR io Pure II', price: 74.93, ref: '065708', cat: 'Télécommande' },
    { label: 'Situo 1 io Pure II', price: 48.72, ref: '066018', cat: 'Télécommande' },
    { label: 'Situo 5 VAR A/M io Iron II', price: 112.40, ref: '065711', cat: 'Télécommande' },
    { label: 'Situo 5 VAR A/M io Pure II', price: 99.95, ref: '065710', cat: 'Télécommande' },
    { label: 'Situo 5 io Pure II', price: 76.54, ref: '066023', cat: 'Télécommande' },
    { label: 'Situo 5 io/RTS Pure', price: 95.70, ref: '066467', cat: 'Télécommande' },
    { label: 'Ysia Patio io Anthracite', price: 123.44, ref: '068579', cat: 'Télécommande' },
    { label: 'Ysia Patio io Pure', price: 123.44, ref: '068578', cat: 'Télécommande' },
    { label: 'Émetteur Izymo io', price: 44.40, ref: '066215', cat: 'Télécommande' },
  ];
  // ── CE QU'IL FAUT SAVOIR POUR COMMANDER ────────────────────────────────────
  // Un devis dont il manque la toile ou le RAL ne peut pas partir chez Harol, et
  // l'oubli ne se voit qu'au moment de commander — trop tard. On liste donc, par
  // famille, les champs SANS LESQUELS la commande est bloquée. Volontairement
  // limité à ça : signaler du confort ferait du bruit et on n'y prêterait plus
  // attention. Le PRIX n'y est pas — il se remplit au bureau, pas sur le terrain.
  const CHAMPS_REQUIS = {
    screen: [
      ['largeur', 'Largeur'], ['hauteur', 'Hauteur'], ['variante', 'Variante'],
      ['collection', 'Collection toile'], ['couleur', 'Couleur caisson (RAL)'],
      ['caisson_mesure', 'Mesure du caisson'], ['moteur_ref', 'Moteur'],
    ],
    volet_roulant: [
      ['largeur', 'Largeur'], ['hauteur', 'Hauteur'], ['lame_type', 'Type de lame'],
      ['caisson_mesure', 'Caisson'], ['moteur', 'Moteur'], ['couleur_lame', 'Couleur des lames'],
    ],
    tente_solaire: [
      ['modele', 'Modèle'], ['largeur', 'Largeur'], ['projection', 'Projection'],
      ['manoeuvre', 'Manœuvre'], ['collection', 'Collection toile'], ['toile_couleur', 'Couleur de toile'],
    ],
    tablier_volet: [
      ['largeur', 'Largeur'], ['hauteur', 'Hauteur'], ['couleur', 'Couleur (RAL)'],
    ],
  };
  /** @returns [{ k, l }] — les champs bloquants encore vides sur cette ouverture. */
  function champsManquants(item) {
    if (!item) return [];
    return (CHAMPS_REQUIS[item.type] || [])
      .filter(([k]) => { const v = item[k]; return v === undefined || v === null || v === '' || v === 0; })
      .map(([k, l]) => ({ k: k, l: l }));
  }

  const CATALOG_CATS = [...new Set(CATALOG_OPTIONS.map(o => o.cat))].sort();
  /**
   * Recherche tolérante : code article, marque, ou mots du libellé, dans n'importe quel ordre.
   * Le numéro d'article n'est comparé QU'À une suite d'au moins 3 chiffres — sinon « situo 5 »
   * remontait « Situo 1 » parce que sa référence 065709 contient un 5.
   */
  function chercheAccessoires(q, cat) {
    const mots = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return CATALOG_OPTIONS.filter(o => {
      if (cat && o.cat !== cat) return false;
      if (!mots.length) return true;
      const texte = (o.label + ' ' + o.cat).toLowerCase();
      return mots.every(m => texte.includes(m) || (/^\d{3,}$/.test(m) && o.ref.includes(m)));
    });
  }

  // Compat : ancienne table de teintes (utilisée par le simulateur visuel avant/après).
  // Dérivée du nuancier ci-dessus pour qu'il n'y ait qu'une seule source de vérité.
  const RAL_HEX = {};
  Object.keys(RAL_TABLE).forEach(c => { if (RAL_TABLE[c][1]) RAL_HEX[c] = RAL_TABLE[c][1]; });
  const hexForRalLabel = ralHex;   // même logique, nom historique conservé

  window.SSProducts = {
    ITEM_TYPES, ITEM_TYPES_LEGACY, EMPLACEMENTS_SUGGESTIONS, ETAGES_SUGGESTIONS, MOTEURS, MODELES_CATALOGUE,
    COULEURS_RAL, COULEURS_RAL_PURE, TOILES_CATALOGUE,
    CS8_VARIANTES, CS8_COLLECTIONS, CS8_MOTEURS, CABLE_LONGUEURS,
    CS8_CAISSON_MESURES_STANDARD, CS8_CAISSON_MESURES_GRAND, CS8_COLMATAGE,
    caissonMesuresFor,
    TS_SPECS, TS_MOTEURS, TS_ECLAIRAGE_BX270, TS_ECLAIRAGE_LUX, tsMoteursFor, tsEclairageFor,
    TS_MANOEUVRES, TS_MOTEUR_SORTES, TS_CABLE_LONGUEURS, TS_CABLE_COULEURS, TS_COLLECTIONS,
    VR_CAISSONS, VR_MOTEURS, VR_COULEURS_LAMES, VR_LAMES, vrHauteurMaxFor,
    CATALOG_OPTIONS, CATALOG_CATS, chercheAccessoires,
    CHAMPS_REQUIS, champsManquants,
    RAL_TABLE, RAL_FREQUENTS, ralCode, ralNom, ralHex, ralHarol, ralLabel, ralListeHarol,
    RAL_HEX, hexForRalLabel,
  };
})();
