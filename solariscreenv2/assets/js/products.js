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
  // ── CATALOGUE DE COLORIS HAROL ────────────────────────────────────────────
  // Les 522 références de la « Brochure des couleurs 2026 » (BR_Coloris_2026_01.pdf),
  // tableau principal + Premium/Colour Selector + gamme Pure + Pratic, réunies telles
  // qu'elles figurent au document. Un RAL n'a pas UNE référence mais plusieurs : la même
  // couleur existe en satiné, mat et laque texturée, en classe 1 ou 2, avec des codes de
  // commande différents (7016 : 7016, 7016-2, 7M16-2, 7T16, X7016, A7016…). C'est LE code
  // de commande qu'on tape chez Harol — il fallait donc pouvoir le chercher directement.
  // Format compact : [code couleur, [codes de commande], description, finition,
  //                   classe, code de poudre, sections]
  //   finition : S = Satiné · M = Mat · T = Laque texturée
  //   sections : P = Premium/Colour Selector · U = gamme Pure · R = Pratic
  //              (vide = tableau principal uniquement)
  const HAROL_COLORIS = [
    ['1000',['1M00-2'],'1000 - Mat','M',2,'SD300C1100020'],
    ['1001',['1001'],'Beige','S',1,'AE70011960425'],
    ['1001',['1M01-2'],'1001 - Mat','M',2,'SD300C1100120'],
    ['1001',['1001-2'],'1001 - Satiné','S',2,'SD700C1100120'],
    ['1002',['1M02-2'],'1002 - Mat','M',2,'SD300C1100220'],
    ['1011',['1011'],'Beige brun','S',1,'AE70018260125'],
    ['1011',['1M11-2'],'1011 - Mat','M',2,'SD300C1101120'],
    ['1013',['1T13'],'Reynaers coatex 1T13','T',1,'AE03051101320','P'],
    ['1013',['1013M'],'Blanc perlé','M',1,'AE30011101320'],
    ['1013',['PR1013'],'Pratic 1013','S',1,'73976 PE/P/Q 75GL','R'],
    ['1013',['1013'],'Blanc perlé','S',1,'AE70019420225'],
    ['1013',['PR1013S'],'Pratic 1013 sablé','T',2,'YD313F','R'],
    ['1013',['1M13-2'],'1013 - Mat','M',2,'SD300C1101320'],
    ['1013',['1013-2'],'1013 - Satiné','S',2,'SD800C1101320'],
    ['1014',['1014-2'],'1014 - Satiné','S',2,'SD700C1101420'],
    ['1015',['1T15'],'Reynaers coatex 1T15','T',1,'AE03051101520','P'],
    ['1015',['A1013','S1015'],'Aliplast 1013 st métallisé','T',1,'029/15508'],
    ['1015',['1015M'],'Ivoire clair','M',1,'DS542H8219'],
    ['1015',['1015'],'Ivoire clair','S',1,'DS312H8036'],
    ['1015',['1T15-2'],'1015 - Laque texturée (Coatex)','T',2,'YD315F'],
    ['1015',['1M15-2'],'1015 - Mat','M',2,'SD300C1101520 couleurs 2026 7'],
    ['1015',['1015-2'],'1015 - Satiné','S',2,'SD700C1101520'],
    ['1018',['1018-2'],'1018 - Satiné','S',2,'SD700C1101820'],
    ['1019',['1T19'],'Reynaers coatex 1T19','T',1,'AE03051101920'],
    ['1019',['1019M'],'Beige gris','M',1,'AE30011101920'],
    ['1019',['1019'],'Beige gris','S',1,'AE70018360425'],
    ['1019',['1T19-2'],'1019 - Laque texturée (Coatex)','T',2,'YD319F'],
    ['1019',['1M19-2'],'1019 - Mat','M',2,'SD300C1101920'],
    ['1019',['1019-2'],'1019 - Satiné','S',2,'SD700C1101920'],
    ['1035',['1035M'],'Beige perlé','M',1,'AE20311031721'],
    ['1035',['1M35-2'],'1035 - Mat','M',2,'SD201C1103520'],
    ['1035',['1035-2'],'1035 - Satiné','S',2,'SD801C8222121'],
    ['3000',['3000-2'],'3000 - Satiné','S',2,'SD700C3300020'],
    ['3004',['3T04'],'Reynaers coatex 3T04','T',1,'AE03053300420'],
    ['3004',['3004'],'Rouge pourpre','S',1,'AE70013720125'],
    ['3004',['3T04-2'],'3004 - Laque texturée (Coatex)','T',2,'YG304F'],
    ['3004',['3M04-2'],'3004 - Mat','M',2,'SD300C3300420'],
    ['3005',['3005M'],'Rouge vin','M',1,'AE30013300520'],
    ['3005',['3005'],'Rouge vin','S',1,'PE50/ TR3005HR/73/180','P'],
    ['3005',['3T05-2'],'3005 - Laque texturée (Coatex)','T',2,'YG305F'],
    ['3005',['3M05-2'],'3005 - Mat','M',2,'SD300C3300520'],
    ['3009',['3T09-2'],'3009 - Laque texturée (Coatex)','T',2,'YG309G'],
    ['3009',['3M09-2'],'3009 - Mat','M',2,'SD300C3300920'],
    ['3011',['3M11-2'],'3011 - Mat','M',2,'SD300C3301120'],
    ['3012',['3012'],'Rouge beige','S',1,'AE70013301220'],
    ['3012',['3M12-2'],'3012 - Mat','M',2,'SD300C3301220'],
    ['3013',['3M13-2'],'3013 - Mat','M',2,'SD300C3301320'],
    ['5003',['5003'],'Bleu saphir','S',1,'AE70015870225'],
    ['5003',['5T03-2'],'5003 - Laque texturée (Coatex)','T',2,'YJ303F'],
    ['5003',['5M03-2'],'5003 - Mat','M',2,'SD300C5500320'],
    ['5003',['5003-2'],'5003 - Satiné','S',2,'SD700C5500320'],
    ['5004',['5004M'],'Bleu noir','M',1,'AE30015500420'],
    ['5004',['5004'],'Bleu noir','S',1,'PE50/ TR5004HR/73/180'],
    ['5004',['5T04-2'],'5004 - Laque texturée (Coatex)','T',2,'YJ304G'],
    ['5004',['5M04-2'],'5004 - Mat','M',2,'SD300C5500420'],
    ['5004',['5004-2'],'5004 - Satiné','S',2,'SD700C5500420'],
    ['5008',['5008M'],'Bleu gris','M',1,'AE300C5500820'],
    ['5008',['5008'],'Bleu gris','S',1,'DS311B8225'],
    ['5008',['5T08-2'],'5008 - Laque texturée (Coatex)','T',2,'YJ375F'],
    ['5008',['5M08-2'],'5008 - Mat','M',2,'SD300C5500820'],
    ['5008',['5008-2'],'5008 - Satiné','S',2,'SD700C5500820'],
    ['5009',['5T09-2'],'5009 - Laque texturée (Coatex)','T',2,'YJ309F'],
    ['5009',['5M09-2'],'5009 - Mat','M',2,'SD300C5500920'],
    ['5010',['5M10-2'],'5010 - Mat','M',2,'SD300C5501020'],
    ['5010',['5010-2'],'5010 - Satiné','S',2,'SD700C5501020'],
    ['5011',['A5011','S5011'],'Aliplast 5011 st métallisé','T',1,'029/40782'],
    ['5011',['5011M'],'Bleu acier','M',1,'AE300C5501120'],
    ['5011',['5011'],'Bleu acier','S',1,'AE70015950125','P'],
    ['5011',['5T11-2'],'5011 - Laque texturée (Coatex)','T',2,'YJ383F'],
    ['5011',['5M11-2'],'5011 - Mat','M',2,'SD300C5501120'],
    ['5011',['5011-2'],'5011 - Satiné','S',2,'SD700C5501120'],
    ['5013',['5013'],'Bleu cobalt','S',1,'AE70015810225'],
    ['5014',['5T14-2'],'5014 - Laque texturée (Coatex)','T',2,'YJ352F'],
    ['5021',['5M21-2'],'5021 - Mat','M',2,'SD300C5502120'],
    ['6003',['6T03-2'],'6003 - Laque texturée (Coatex)','T',2,'YK303F'],
    ['6005',['6005M'],'Vert mousse','M',1,'AE300C6600520'],
    ['6005',['6005'],'Vert mousse','S',1,'AE70016830125'],
    ['6005',['6T05-2'],'6005 - Laque texturée (Coatex)','T',2,'YK305F'],
    ['6005',['6M05-2'],'6005 - Mat','M',2,'SD300C6600520'],
    ['6007',['6T07-2'],'6007 - Laque texturée (Coatex)','T',2,'YK307G'],
    ['6009',['6T09'],'Reynaers coatex 6T09','T',1,'AE03056600920','P'],
    ['6009',['A6009','S6009'],'Aliplast 6009 st métallisé','T',1,'029/50704'],
    ['6009',['6009M'],'Vert sapin','M',1,'AE 30016600920'],
    ['6009',['6009'],'Vert sapin','S',1,'AE70016970425'],
    ['6009',['6T09-2'],'6009 - Laque texturée (Coatex)','T',2,'YK309F'],
    ['6009',['6M09-2'],'6009 - Mat','M',2,'SD300C6600920'],
    ['6009',['6009-2'],'6009 - Satiné','S',2,'SD700C6600920'],
    ['6011',['6M11-2'],'6011 - Mat','M',2,'SD300C6601120'],
    ['6012',['6012M'],'Vert noir','M',1,'AE30016601220'],
    ['6012',['6012'],'Vert noir','S',1,'PE50/ TR6012HR/73/180'],
    ['6012',['6T12-2'],'6012 - Laque texturée (Coatex)','T',2,'YK312F'],
    ['6012',['6M12-2'],'6012 - Mat','M',2,'SD300C6601220'],
    ['6012',['6012-2'],'6012 - Satiné','S',2,'SD700C6601220'],
    ['6013',['6M13-2'],'6013 - Mat','M',2,'SD300C6601320'],
    ['6014',['6T14-2'],'6014 - Laque texturée (Coatex)','T',2,'1K314G'],
    ['6015',['6M15-2'],'6015 - Mat','M',2,'SD300C6601520'],
    ['6016',['6M16-2'],'6016 - Mat','M',2,'SD300C6601620'],
    ['6020',['6M20-2'],'6020 - Mat','M',2,'SD300C6602020'],
    ['6021',['6021'],'Vert pâle','S',1,'AE70016170725'],
    ['6021',['6T21-2'],'6021 - Laque texturée (Coatex)','T',2,'YK321F'],
    ['6021',['6M21-2'],'6021 - Mat','M',2,'SD300C6602120'],
    ['6022',['6M22-2'],'6022 - Mat','M',2,'SD300C6602220'],
    ['6033',['6M33-2'],'6033 - Mat','M',2,'SD300C6603320'],
    ['7000',['7T00-2'],'7000 - Laque texturée (Coatex)','T',2,'YL300F'],
    ['7001',['7001M'],'Gris argent','M',1,'AE30017700120'],
    ['7001',['7001'],'Gris argent','S',1,'AE70017200225'],
    ['7001',['7T01-2'],'7001 - Laque texturée (Coatex)','T',2,'YP301F'],
    ['7001',['7M01-2'],'7001 - Mat','M',2,'SD300C7700120 couleurs 2026 9'],
    ['7001',['7001-2'],'7001 - Satiné','S',2,'SD700C7700120'],
    ['7002',['7002'],'Gris olive','S',1,'AE70017420425'],
    ['7002',['7T02-2'],'7002 - Laque texturée (Coatex)','T',2,'YL302G'],
    ['7002',['7M02-2'],'7002 - Mat','M',2,'SD300C7700220'],
    ['7002',['7002-2'],'7002 - Satiné','S',2,'SD700C7700220'],
    ['7003',['7003M'],'Gris mousse','M',1,'AE30017700320'],
    ['7003',['7003'],'Gris mousse','S',1,'AE70017520125'],
    ['7003',['7T03-2'],'7003 - Laque texturée (Coatex)','T',2,'YL303F'],
    ['7003',['7M03-2'],'7003 - Mat','M',2,'SD300C7700320'],
    ['7003',['7003-2'],'7003 - Satiné','S',2,'SD700C7700320'],
    ['7004',['7004M'],'Gris de sécurité','M',1,'AE30017700420'],
    ['7004',['7004'],'Gris de sécurité','S',1,'AE70017260325'],
    ['7004',['7T04-2'],'7004 - Laque texturée (Coatex)','T',2,'YL304F'],
    ['7004',['7M04-2'],'7004 - Mat','M',2,'SD300C7700420'],
    ['7004',['7004-2'],'7004 - Satiné','S',2,'SD700C7700420'],
    ['7005',['7005M'],'Gris souris','M',1,'AE30017700520'],
    ['7005',['7005'],'Gris souris','S',1,'AE70017420525'],
    ['7005',['7T05-2'],'7005 - Laque texturée (Coatex)','T',2,'YL305F'],
    ['7005',['7M05-2'],'7005 - Mat','M',2,'SD300C7700520'],
    ['7005',['7005-2'],'7005 - Satiné','S',2,'SD700C7700520'],
    ['7006',['7T06'],'Reynaers coatex 7T06','T',1,'AE03057700620'],
    ['7006',['7M06ST'],'Belisol 7M06ST','T',1,'029/73223'],
    ['7006',['7006M'],'Gris beige','M',1,'AE30017700620'],
    ['7006',['7006'],'Gris beige','S',1,'AE70018170125'],
    ['7006',['7T06-2'],'7006 - Laque texturée (Coatex)','T',2,'YL306F'],
    ['7006',['7M06-2'],'7006 - Mat','M',2,'SD300C7700620'],
    ['7006',['7006-2'],'7006 - Satiné','S',2,'SD700C7700620'],
    ['7008',['7T08-2'],'7008 - Laque texturée (Coatex)','T',2,'YL308G'],
    ['7008',['7008-2'],'7008 - Satiné','S',2,'SD700C7700820'],
    ['7009',['7009M'],'Gris vert','M',1,'AE30017700920'],
    ['7009',['7T09-2'],'7009 - Laque texturée (Coatex)','T',2,'YL309F'],
    ['7009',['7M09-2'],'7009 - Mat','M',2,'SD300C7700920'],
    ['7010',['7010'],'Gris tente','S',1,'AE70017650325'],
    ['7010',['7M10-2'],'7010 - Mat','M',2,'SD300C7701020'],
    ['7010',['7010-2'],'7010 - Satiné','S',2,'SD700C7701020'],
    ['7011',['7011M'],'Gris fer','M',1,'AE300C7701120'],
    ['7011',['7011'],'Gris fer','S',1,'AE70017620325'],
    ['7011',['7T11-2'],'7011 - Laque texturée (Coatex)','T',2,'YP311F'],
    ['7011',['7M11-2'],'7011 - Mat','M',2,'SD300C7701120'],
    ['7011',['7011-2'],'7011 - Satiné','S',2,'SD700C7701120'],
    ['7012',['7T12'],'Reynaers coatex 7T12','T',1,'AE03057701220','P'],
    ['7012',['7012M'],'Gris basalte','M',1,'DS542A8302'],
    ['7012',['7012'],'Gris basalte','S',1,'AE70017650125'],
    ['7012',['7T12-2'],'7012 - Laque texturée (Coatex)','T',2,'YL312F'],
    ['7012',['7M12-2'],'7012 - Mat','M',2,'SD300C7701220'],
    ['7012',['7012-2'],'7012 - Satiné','S',2,'SD700C7701220'],
    ['7013',['7013'],'Gris brun','S',1,'AE70018650125'],
    ['7013',['7T13-2'],'7013 - Laque texturée (Coatex)','T',2,'YL313F'],
    ['7013',['7M13-2'],'7013 - Mat','M',2,'SD300C7701320'],
    ['7013',['7013-2'],'7013 - Satiné','S',2,'SD700C7701320'],
    ['7015',['7T15'],'Reynaers coatex 7T15','T',1,'AE03057701520'],
    ['7015',['G7015'],'Group alural 7015 s','T',1,'029/71719'],
    ['7015',['7015M'],'Gris ardoise','M',1,'AE30017701520'],
    ['7015',['7015'],'Gris ardoise','S',1,'PE50/TR7015/73/180'],
    ['7015',['7T15-2'],'7015 - Laque texturée (Coatex)','T',2,'YL315F'],
    ['7015',['7M15-2'],'7015 - Mat','M',2,'SD300C7701520'],
    ['7015',['7015-2'],'7015 - Satiné','S',2,'SD700C7701520'],
    ['7016',['7m16st','7T16','F716','G7016','L7016','MADGR','R7016','TC7016','MAD-','GR'],'Gris anthracite','T',1,'029/71289, AE03057701620','P'],
    ['7016',['A7016','S7016'],'Aliplast 7016 st métallisé','T',1,'029/71334'],
    ['7016',['P716','RM'],'Profel P716 rm','T',1,'AE03007458427'],
    ['7016',['X7016'],'Reynaers 7016 mat','M',1,'AE30007005023'],
    ['7016',['RIV7016'],'gris anthracite','M',1,'AE30017701620'],
    ['7016',['7016M'],'Gris anthracite','M',1,'DS542A8304'],
    ['7016',['7016','HLGR'],'Gris anthracite','S',1,'AE70017620225'],
    ['7016',['7T16-2'],'7016 - Laque texturée (Coatex)','T',2,'YL316F','U'],
    ['7016',['7M16-2'],'7016 - Mat','M',2,'SD300C7701620','U'],
    ['7016',['7016-2'],'7016 - Brillant','S',2,'SD800C7701620','U'],
    ['7021',['7S21','7T21','R7021'],'Reynaers coatex 7S21','T',1,'AE03057702120','P'],
    ['7021',['7m21st','G7021'],'Pierret 7M21ST','T',1,'029/71263'],
    ['7021',['P721','RM'],'Profel P721 rm','T',1,'029/71283'],
    ['7021',['A7021','S7021'],'Aliplast 7021 st métallisé','T',1,'029/71335'],
    ['7021',['R721M'],'Reynaers 7021 mat','M',1,'AE30007005123'],
    ['7021',['7021M'],'Gris noir','M',1,'DS542A8305 (P52TRM7021HR/30/200)'],
    ['7021',['7021'],'Gris noir','S',1,'DS311A8260'],
    ['7021',['7T21-2'],'7021 - Laque texturée (Coatex)','T',2,'YL321F','U'],
    ['7021',['7021SD'],'Gris nois','M',2,'SD300C7702120','U'],
    ['7021',['7M21-2'],'Gris nois','M',2,'SD300C7702120','U'],
    ['7021',['7021-2'],'7021 - Satiné','S',2,'SD700C7702120','U'],
    ['7022',['7SM22'],'Laque texturée fine 7022 mat','T',1,'029/71740'],
    ['7022',['7T22'],'Reynaers coatex 7T22','T',1,'AE03057702220','P'],
    ['7022',['7022M'],'Gris terre d’ombre','M',1,'AE30017702220'],
    ['7022',['7022'],'Gris terre d’ombre','S',1,'AE70017750225'],
    ['7022',['7T22-2'],'7022 - Laque texturée (Coatex)','T',2,'YL322F'],
    ['7022',['7M22-2'],'7022 - Mat','M',2,'SD300C7702220'],
    ['7022',['7022-2'],'7022 - Satiné','S',2,'SD700C7702220'],
    ['7023',['7T23'],'Reynaers coatex 7T23','T',1,'AE03057702320'],
    ['7023',['7m23st','A7023','P723','RM'],'Pierret 7M23ST','T',1,'029/72362'],
    ['7023',['7023A'],'Gris béton','T',1,'029/7B297'],
    ['7023',['7023M'],'Gris béton','M',1,'AE30017702320 couleurs 2026 11'],
    ['7023',['7023'],'Gris béton','S',1,'AE70017320625'],
    ['7023',['7T23-2'],'7023 - Laque texturée (Coatex)','T',2,'YL323F'],
    ['7023',['7M23-2'],'7023 - Mat','M',2,'SD300C7702320'],
    ['7023',['7023-2'],'7023 - Satiné','S',2,'SD700C7702320'],
    ['7024',['7T24'],'Reynaers coatex 7T24','T',1,'AE03057702420'],
    ['7024',['7024M'],'Gris graphite','M',1,'AE30017702420'],
    ['7024',['7024'],'Gris graphite','S',1,'AE70017710125'],
    ['7024',['7T24-2'],'7024 - Laque texturée (Coatex)','T',2,'YL324F'],
    ['7024',['7M24-2'],'7024 - Mat','M',2,'SD300C7702420'],
    ['7024',['7024-2'],'7024 - Satiné','S',2,'SD700C7702420'],
    ['7026',['7026-2'],'7026 - Satiné','S',2,'SD700C7702620'],
    ['7030',['7T30','P730','RM'],'Reynaers coatex 7T30','T',1,'AE03057703020','P'],
    ['7030',['7m30st','L7030'],'Pierret 7M30ST','T',1,'029/71715'],
    ['7030',['7030M'],'Gris pierre','M',1,'AE30017703020'],
    ['7030',['7030'],'Gris pierre','S',1,'AE70017320325'],
    ['7030',['7T30-2'],'7030 - Laque texturée (Coatex)','T',2,'YP330F'],
    ['7030',['7M30-2'],'7030 - Mat','M',2,'SD300C7703020'],
    ['7030',['7030-2'],'7030 - Satiné','S',2,'SD700C7703020'],
    ['7031',['7031'],'Gris bleu','S',1,'AE70017530125'],
    ['7031',['7T31-2'],'7031 - Laque texturée (Coatex)','T',2,'YL374F'],
    ['7031',['7M31-2'],'7031 - Mat','M',2,'SD300C7703120'],
    ['7031',['7031-2'],'7031 - Satiné','S',2,'SD700C7703120'],
    ['7032',['7T32'],'Reynaers coatex 7T32','T',1,'AE03057703220'],
    ['7032',['L7032','P732','RM'],'Aliplast 7032 lc','T',1,'029/72364'],
    ['7032',['7032M'],'Gris silex','M',1,'AE30017703220'],
    ['7032',['7032'],'Gris silex','S',1,'AE70017120425'],
    ['7032',['7T32-2'],'7032 - Laque texturée (Coatex)','T',2,'YL332F'],
    ['7032',['7M32-2'],'7032 - Mat','M',2,'SD300C7703220'],
    ['7033',['PR7033S'],'Vert sauge','T',1,'- 1 068/72014','R'],
    ['7033',['7033M'],'Gris ciment','M',1,'AE30017703320'],
    ['7033',['7033'],'Gris ciment','S',1,'AE70017420325'],
    ['7033',['7T33-2'],'7033 - Laque texturée (Coatex)','T',2,'YL375F'],
    ['7033',['7M33-2'],'7033 - Mat','M',2,'SD300C7703320'],
    ['7034',['7034'],'Gris jaune','S',1,'AE70017320525'],
    ['7034',['7T34-2'],'7034 - Laque texturée (Coatex)','T',2,'YL334F'],
    ['7034',['7M34-2'],'7034 - Mat','M',2,'SD300C7703420'],
    ['7034',['7034-2'],'7034 - Satiné','S',2,'SD700C7703420'],
    ['7035',['7T35'],'Reynaers coatex 7T35','T',1,'AE03057703520'],
    ['7035',['7035M','MALGR'],'Gris clair','M',1,'AE30017703520'],
    ['7035',['7035'],'Gris clair','S',1,'AE70019870225'],
    ['7035',['7T35-2'],'7035 - Laque texturée (Coatex)','T',2,'YL335F'],
    ['7035',['7M35-2'],'7035 - Mat','M',2,'SD300C7703520'],
    ['7035',['7035-2'],'7035 - Satiné','S',2,'SD700C7703520'],
    ['7036',['7T36'],'Reynaers coatex 7T36','T',1,'AE03057703620'],
    ['7036',['7036M'],'Gris platine','M',1,'AE30017703620'],
    ['7036',['7036'],'Gris platine','S',1,'AE70017210125'],
    ['7036',['7T36-2'],'7036 - Laque texturée (Coatex)','T',2,'YL357F'],
    ['7036',['7M36-2'],'7036 - Mat','M',2,'SD300C7703620'],
    ['7036',['7036-2'],'7036 - Satiné','S',2,'SD700C7703620'],
    ['7037',['7T37'],'Reynaers coatex 7T37','T',1,'AE03057703720'],
    ['7037',['B737','L7037','TC7037'],'Belisol B737','T',1,'029/72184'],
    ['7037',['P737','RM'],'Profel P737 rm','T',1,'AE03057356927'],
    ['7037',['7037M'],'Gris poussière','M',1,'AE30017703720'],
    ['7037',['7037'],'Gris poussière','S',1,'DS312A8156'],
    ['7037',['7T37-2'],'7037 - Laque texturée (Coatex)','T',2,'YL337F'],
    ['7037',['7M37-2'],'7037 - Mat','M',2,'SD300C7703720'],
    ['7037',['7037-2'],'7037 - Satiné','S',2,'SD700C7703720'],
    ['7038',['7T38'],'Reynaers coatex 7T38','T',1,'AE03057703820','P'],
    ['7038',['7038M'],'Gris agate','M',1,'AE30017703820'],
    ['7038',['7038'],'Gris agate','S',1,'AE70017120925'],
    ['7038',['7T38-2'],'7038 - Laque texturée (Coatex)','T',2,'YP338F'],
    ['7038',['7M38-2'],'7038 - Mat','M',2,'SD300C7703820'],
    ['7038',['7038-2'],'7038 - Satiné','S',2,'SD700C7703820'],
    ['7039',['7T39','F739','R7039'],'Reynaers coatex 7T39','T',1,'AE03057703920','P'],
    ['7039',['G7039'],'Group alural 7039 s','T',1,'029/71716'],
    ['7039',['A7039'],'Aliplast 7039 st métallisé','T',1,'029/71721'],
    ['7039',['7m39st','L7039','TC7039'],'Pierret 7M39ST','T',1,'029/72881'],
    ['7039',['7039M'],'Gris quartz','M',1,'AE30017703920'],
    ['7039',['7039'],'Gris quartz','S',1,'AE70017580225'],
    ['7039',['7T39-2'],'7039 - Laque texturée (Coatex)','T',2,'YL339F','U'],
    ['7039',['7M39-2'],'7039 - Mat','M',2,'SD300C7703920','U'],
    ['7039',['7039-2'],'7039 - Satiné','S',2,'SD700C7703920','U'],
    ['7040',['7040M'],'Gris fenêtre','M',1,'AE30017704020'],
    ['7040',['7040'],'Gris fenêtre','S',1,'AE70017130525'],
    ['7040',['7T40-2'],'7040 - Laque texturée (Coatex)','T',2,'YL340F'],
    ['7040',['7M40-2'],'7040 - Mat','M',2,'SD300C7704020'],
    ['7040',['7040-2'],'7040 - Satiné','S',2,'SD700C7704020'],
    ['7042',['7T42','F742'],'Reynaers coatex 7T42','T',1,'AE03057704220'],
    ['7042',['7042M'],'Gris signalisation A','M',1,'AE30017704220'],
    ['7042',['7042'],'Gris signalisation A','S',1,'AE70017320925'],
    ['7042',['7T42-2'],'7042 - Laque texturée (Coatex)','T',2,'YL342F'],
    ['7042',['7M42-2'],'7042 - Mat','M',2,'SD300C7704220'],
    ['7042',['7042-2'],'7042 - Satiné','S',2,'SD700C7704220'],
    ['7043',['R7043'],'Reynaers coatex 7S43','T',1,'AE03057704320'],
    ['7043',['7043M'],'Gris signalisation B','M',1,'AE300C7704320'],
    ['7043',['7043'],'Gris signalisation B','S',1,'AE70017720325'],
    ['7043',['7T43-2'],'7043 - Laque texturée (Coatex)','T',2,'YP343F couleurs 2026 13'],
    ['7043',['7M43-2'],'7043 - Mat','M',2,'SD300C7704320'],
    ['7043',['7043-2'],'7043 - Satiné','S',2,'SD700C7704320'],
    ['7044',['7T44'],'Reynaers coatex 7T44','T',1,'AE03057704420'],
    ['7044',['7m44st','G7044'],'Pierret 7M44ST','T',1,'029/71718'],
    ['7044',['7044M'],'Gris soie','M',1,'AE30017704420'],
    ['7044',['7044'],'Gris soie','S',1,'AE70019820325'],
    ['7044',['7T44-2'],'7044 - Laque texturée (Coatex)','T',2,'YP344F'],
    ['7044',['7M44-2'],'7044 - Mat','M',2,'SD300C7704420'],
    ['7044',['7044-2'],'7044 - Satiné','S',2,'SD700C7704420'],
    ['7045',['7M45-2'],'7045 - Mat','M',2,'SD300C7704520'],
    ['7046',['7046'],'Telegris 2','S',1,'AE70017370125'],
    ['7046',['7M46-2'],'7046 - Mat','M',2,'SD300C7704620'],
    ['7047',['7T47'],'Reynaers coatex 7T47','T',1,'AE03057704720'],
    ['7047',['7047M'],'Telegris 4','M',1,'AE30017704720'],
    ['7047',['7047'],'Telegris 4','S',1,'AE70019900225'],
    ['7047',['7T47-2'],'7047 - Laque texturée (Coatex)','T',2,'YL347F'],
    ['7047',['7M47-2'],'7047 - Mat','M',2,'SD300C7704720'],
    ['7047',['7047-2'],'7047 - Satiné','S',2,'SD700C7704720'],
    ['7048',['CH25-2'],'Champagne 2525 - Metallic','M',2,'YW281F'],
    ['7048',['7M48-2'],'Supranod Mink','M',2,'SD201C7704820'],
    ['7048',['7048SD'],'Supranod Mink','S',2,'SD201C7704820'],
    ['8000',['8T00-2'],'8000 - Laque texturée (Coatex)','T',2,'YM300G'],
    ['8000',['8M00-2'],'8000 - Mat','M',2,'SD300C8800020'],
    ['8000',['8000-2'],'8000 - Satiné','S',2,'SD700C8800020'],
    ['8002',['8T02-2'],'8002 - Laque texturée (Coatex)','T',2,'YM302G'],
    ['8003',['8003M'],'Brun argile','M',1,'AE30018800320'],
    ['8003',['8003'],'Brun argile','S',1,'AE70018100325'],
    ['8003',['8T03-2'],'8003 - Laque texturée (Coatex)','T',2,'YM362F'],
    ['8003',['8M03-2'],'Clay Brun','M',2,'SD300C8800320'],
    ['8004',['8004'],'Brun cuivré','S',1,'AE70018210125'],
    ['8004',['8T04-2'],'8004 - Laque texturée (Coatex)','T',2,'YM304G'],
    ['8004',['8M04-2'],'8004 - Mat','M',2,'SD300C8800420'],
    ['8004',['8004-2'],'8004 - Satiné','S',2,'SD700C8800420'],
    ['8007',['8007'],'Brun fauve','S',1,'AE70018300125'],
    ['8007',['8M07-2'],'8007 - Mat','M',2,'SD300C8800720'],
    ['8011',['8011M'],'Brun noisette','M',1,'AE30018801120'],
    ['8011',['8011'],'Brun noisette','S',1,'AE70018510125'],
    ['8011',['8T11-2'],'8011 - Laque texturée (Coatex)','T',2,'YM311F'],
    ['8011',['8M11-2'],'8011 - Mat','M',2,'SD300C8801120'],
    ['8012',['8012'],'Brun rouge','S',1,'AE70018610225'],
    ['8012',['8T12-2'],'8012 - Laque texturée (Coatex)','T',2,'YM312G'],
    ['8012',['8M12-2'],'8012 - Mat','M',2,'SD300C8801220'],
    ['8014',['8T14'],'Reynaers coatex 8T14','T',1,'AE03058801420','P'],
    ['8014',['A8014'],'Aliplast 8014 st métallisé','T',1,'029/60740'],
    ['8014',['8014M'],'Brun sépia','M',1,'AE30018801420'],
    ['8014',['8014'],'Brun sépia','S',1,'AE70018720125'],
    ['8014',['8T14-2'],'8014 - Laque texturée (Coatex)','T',2,'YM314F'],
    ['8014',['8M14-2'],'8014 - Mat','M',2,'SD300C8801420'],
    ['8014',['8014-2'],'8014 - Satiné','S',2,'SD700C8801420'],
    ['8015',['8015'],'Marron','S',1,'AE70018710325'],
    ['8015',['8T15-2'],'8015 - Laque texturée (Coatex)','T',2,'YM315G'],
    ['8015',['8M15-2'],'8015 - Mat','M',2,'SD300C8801520'],
    ['8016',['L8016'],'Aliplast 8016 lc','T',1,'029/61311','P'],
    ['8016',['8016M'],'Brun acajou','M',1,'AE300C8801620'],
    ['8016',['8016'],'Brun acajou','S',1,'AE70018915025'],
    ['8016',['8T16-2'],'8016 - Laque texturée (Coatex)','T',2,'YM316F'],
    ['8016',['8M16-2'],'8016 - Mat','M',2,'SD300C8801620'],
    ['8016',['8016-2'],'8016 - Satiné','S',2,'SD700C8801620'],
    ['8017',['8T17'],'Reynaers coatex 8T17','T',1,'AE03058801720'],
    ['8017',['8m17st','L8017'],'Pierret 8M17ST','T',1,'029/61333'],
    ['8017',['8017M'],'Brun chocolat','M',1,'AE300C8801720'],
    ['8017',['8017'],'Brun chocolat','S',1,'AE70018910325'],
    ['8017',['8T17-2'],'8017 - Laque texturée (Coatex)','T',2,'YM352F'],
    ['8017',['8M17-2'],'8017 - Mat','M',2,'SD300C8801720'],
    ['8017',['8017-2'],'8017 - Satiné','S',2,'SD700C8801720'],
    ['8019',['8T19'],'Reynaers coatex 8T19','T',1,'AE03058801920','P'],
    ['8019',['A8019'],'Aliplast 8019 st métallisé','T',1,'029/60674'],
    ['8019',['S8019'],'Harol 8019 prestige','T',1,'029/60812'],
    ['8019',['L8019','LC8019'],'Aliplast 8019 lc','T',1,'029/70795'],
    ['8019',['8M19'],'Reynaers brun gris mat','M',1,'AE300C8801920'],
    ['8019',['8019M'],'Brun gris','M',1,'PE52/ TRM8019HR/30/20'],
    ['8019',['8019B'],'Brun gris Belgique','S',1,'AE70018870925'],
    ['8019',['8019'],'Brun gris','S',1,'QG710121SG'],
    ['8019',['8T19-2'],'8019 - Laque texturée (Coatex)','T',2,'YM319F','U'],
    ['8019',['8M19-2'],'8019 - Mat','M',2,'SD300C8801920','U'],
    ['8019',['8019-2'],'8019 - Satiné','S',2,'SD700C8801920','U'],
    ['8022',['8T22'],'Reynaers coatex 8T22','T',1,'AE03058802220','P'],
    ['8022',['8m22st'],'Pierret 8M22ST','T',1,'029/60861'],
    ['8022',['P822','RM'],'Profel P692 RM','T',1,'ZX641M8010'],
    ['8022',['8022M'],'Brun noir','M',1,'AE30018802220'],
    ['8022',['8022'],'Brun noir','S',1,'AE70014910125'],
    ['8022',['8T22-2'],'8022 - Laque texturée (Coatex)','T',2,'YM322G'],
    ['8022',['8M22-2'],'8022 - Mat','M',2,'SD300C8802220'],
    ['8022',['8022-2'],'8022 - Satiné','S',2,'SD700C8802220'],
    ['8023',['8023'],'Brun orangé','S',1,'AE70018140625'],
    ['8023',['8M23-2'],'8023 - Mat','M',2,'SD300C8802320'],
    ['8024',['8024'],'Brun beige','S',1,'AE70018100425'],
    ['8025',['8025'],'Brun pâle','S',1,'AE70018360525'],
    ['8025',['8T25-2'],'8025 - Laque texturée (Coatex)','T',2,'YM325F'],
    ['8025',['8M25-2'],'8025 - Mat','M',2,'SD300C8802520'],
    ['8027',['8M27-2'],'8027 - Mat','M',2,'SD300C8802720'],
    ['8028',['8T28'],'Reynaers coatex 8T28','T',1,'AE03058802820','P'],
    ['8028',['8028M'],'Brun terre','M',1,'AE30018802820'],
    ['8028',['8028'],'Brun terre','S',1,'AE70018620125'],
    ['8028',['8T28-2'],'8028 - Laque texturée (Coatex)','T',2,'YM363F'],
    ['8028',['8M28-2'],'8028 - Mat','M',2,'SD300C8802820'],
    ['8028',['8028-2'],'8028 - Satiné','S',2,'SD700C8802820 couleurs 2026 15'],
    ['8090',['P890','RM'],'Profel P890 rm','T',1,'AE03058076027'],
    ['9001',['9T01'],'Reynaers coatex 9T01','T',1,'AE03059900120','P'],
    ['9001',['9m01st','9ST01'],'Pierret 9M01ST','T',1,'029/10553'],
    ['9001',['A9001','S9001'],'Aliplast 9001','T',1,'029/10933'],
    ['9001',['9001m'],'Blanc crème','M',1,'DS542W8221'],
    ['9001',['9001'],'Blanc crème','S',1,'DS312W8061'],
    ['9001',['9T01-2'],'9001 - Laque texturée (Coatex)','T',2,'YU301F','U'],
    ['9001',['9M01-2'],'9001 - Mat','M',2,'SD300C9900120','U'],
    ['9001',['9001-2'],'9001 - Satiné','S',2,'SD700C9900120','U'],
    ['9002',['9T02'],'Reynaers coatex 9T02','T',1,'AE03059900220'],
    ['9002',['9002M'],'Blanc gris','M',1,'AE300C9900220'],
    ['9002',['9002'],'Blanc gris','S',1,'AE70019570225'],
    ['9002',['9T02-2'],'9002 - Laque texturée (Coatex)','T',2,'YU302F'],
    ['9002',['9M02-2'],'9002 - Mat','M',2,'SD300C9900220'],
    ['9002',['9002-2'],'9002 - Satiné','S',2,'SD700C9900220'],
    ['9003',['9003M'],'Blanc de sécurité','M',1,'AE300C9900320'],
    ['9003',['9003'],'Blanc de sécurité','S',1,'AE70019171025'],
    ['9003',['9T03-2'],'9003 - Laque texturée (Coatex)','T',2,'YB303F'],
    ['9003',['SD9003'],'Blanc de sécurité','M',2,'SD300C9900320'],
    ['9003',['9M03-2'],'Blanc de sécurité','M',2,'SD300C9900320'],
    ['9003',['9003-2'],'9003 - Satiné','S',2,'SD700C9900320'],
    ['9004',['9T04','D1921'],'Reynaers coatex 9T04','T',1,'AE03054900420','P'],
    ['9004',['L9004'],'Aliplast 9004 lc','T',1,'029/80271'],
    ['9004',['9004M'],'Noir de sécurité','M',1,'AE300C4900420'],
    ['9004',['9004'],'Noir de sécurité','S',1,'AE70014902425'],
    ['9004',['9T04-2'],'9004 - Laque texturée (Coatex)','T',2,'YN304F','U'],
    ['9004',['TC9004'],'Noir de sécurité','T',2,'068/80057'],
    ['9004',['9M04-2'],'Noir de sécurité','M',2,'SD300C4900420','U'],
    ['9004',['9004-2'],'9004 - Satiné','S',2,'SD700C4900420','U'],
    ['9005',['9T05','P905','RM','R9005','RIV9005'],'Reynaers coatex 9T05','T',1,'NBT1E0001 (AE03054900520)','PR'],
    ['9005',['L9005'],'Aliplast 9005 lc','T',1,'029/80070'],
    ['9005',['A9005','S9005'],'Aliplast 9005 st métallisé','T',1,'029/80081'],
    ['9005',['9005s'],'Laque texturée fine 9005','T',1,'029/80303'],
    ['9005',['A905PT'],'Aliplast 905','T',1,'RWMXD-0454'],
    ['9005',['9005M','9005Mv1','MAZW','P905','EM'],'Noir foncé','M',1,'AE30014900520'],
    ['9005',['9005'],'Noir foncé','S',1,'DS311N8206'],
    ['9005',['9T05-2'],'9005 - Laque texturée (Coatex)','T',2,'YN305F','U'],
    ['9005',['TC9005'],'Noir','T',2,'068/80381'],
    ['9005',['9M05-2'],'9005 - Mat','M',2,'SD300C4900520','U'],
    ['9005',['9005-2'],'9005 - Satiné','S',2,'SD700C4900520','U'],
    ['9006',['9T06'],'Reynaers coatex 9T06','T',1,'AE03257900620','P'],
    ['9006',['A9006','S9006'],'Aliplast 9006 st métallisé','T',1,'029/90146'],
    ['9006',['PR9006S'],'Pratic 9006 sablé','T',1,'S2306G','R'],
    ['9006',['9006M'],'Aluminium blanc','M',1,'AE30217900620'],
    ['9006',['PR9006'],'Pratic Silver métallisé mat','M',1,'SW206JR','R'],
    ['9006',['AS9006','RIV9006'],'Aluminium blanc','S',1,'AE70107900620'],
    ['9006',['9T06-2'],'9006 - Laque texturée (Coatex)','T',2,'Y2328F','U'],
    ['9006',['9M06-2'],'9006 - Mat','M',2,'SD301C7900621','U'],
    ['9006',['9H06-2'],'Aluminium blanc métallisé','S',2,'SD701C7900620','U'],
    ['9007',['9T07'],'Reynaers coatex 9T07','T',1,'AE03257900720','P'],
    ['9007',['907SN','9m07st'],'Laque texturée fine 907sn','T',1,'029/72004'],
    ['9007',['A9007','S9007'],'Aliplast 9007 st métallisé','T',1,'029/90147'],
    ['9007',['9007M','9M07'],'Aluminium gris','M',1,'AE30217900720'],
    ['9007',['9007'],'Aluminium gris','S',1,'DM312AS8208'],
    ['9007',['9T07-2'],'9007 - Laque texturée (Coatex)','T',2,'Y2329F'],
    ['9007',['9M07-2'],'9007 - Mat','M',2,'SD301C7900721'],
    ['9007',['9H07-2'],'Aluminium gris métallisé','S',2,'SD801C7900720'],
    ['9008',['9T08'],'Reynaers coatex 9T08','T',1,'AE03257900820','P'],
    ['9008',['A9008','S9008'],'Aliplast 9008 st métallisé','T',1,'029/70786'],
    ['9008',['9T08-2'],'9008 - Laque texturée (Coatex)','T',2,'Y2355F'],
    ['9009',['A9009','S9009'],'Aliplast 9009 st métallisé','T',1,'029/80077'],
    ['9010',['9T10'],'Reynaers coatex 9T10','T',1,'AE03059901020','P'],
    ['9010',['A9010'],'Aliplast 9010 st','T',1,'NWT1T0009-C20 (029/10797)'],
    ['9010',['910M','9M10'],'Reynaers 9010M','M',1,'AE30009002323'],
    ['9010',['9010M'],'Blanc pur','M',1,'PE52/TRM9010/30/200'],
    ['9010',['9010'],'Blanc pur','S',1,'AE70019100125'],
    ['9010',['RIV9010'],'Blanc pur','S',1,'AE70019901020'],
    ['9010',['R9010'],'Reynaers 9010','S',1,'AE90019148021'],
    ['9010',['9T10-2'],'9010 - Laque texturée (Coatex)','T',2,'YA310F','U'],
    ['9010',['PR9010S','TC9010'],'Blanc pur','T',2,'068/10259'],
    ['9010',['9M10-2'],'9010 - Mat','M',2,'SD300C9901020','U'],
    ['9010',['9010-2'],'9010 - Brillant (FR - 71)','S',2,'SD800C9901020','U'],
    ['9011',['9T11'],'Reynaers coatex 9T1','T',1,'AE03054901120'],
    ['9011',['9011M'],'Noir graphite','M',1,'AE30014901120'],
    ['9011',['9011'],'Noir graphite','S',1,'AE70014960125'],
    ['9011',['9T11-2'],'Noir SD','T',2,'YN311F'],
    ['9011',['TC9011'],'Noir de sécurité','T',2,'068/80296'],
    ['9011',['9M11-2'],'9011 - Mat','M',2,'SD300C4901120'],
    ['9011',['9011-2'],'9011 - Satiné','S',2,'SD700C4901120'],
    ['9016',['9T16'],'Reynaers coatex 9T16','T',1,'AE03059901620','P'],
    ['9016',['9m16st','A9016','S9016','TC9016'],'Pierret 9M61ST','T',1,'029/10246'],
    ['9016',['9016M'],'Blanc signalisation','M',1,'AE300C9901620'],
    ['9016',['9016','9016P','HLWI','MAWI','PR9010'],'Blanc signalisation','S',1,'AE70019101525','R'],
    ['9016',['9010K'],'RAL9010 Kingspan','S',1,'AE80019901620'],
    ['9016',['9T16-2','PR9016S'],'Pratic 9016 sablé','T',2,'YA316F','RU'],
    ['9016',['9M16-2'],'9016 - Mat','M',2,'SD300C9901620','U'],
    ['9016',['9016-2'],'9016 - Brillant','S',2,'SD800C9901620','U'],
    ['9017',['9T17'],'Reynaers coatex 9T17','T',1,'AE03054901720'],
    ['9017',['P917RM'],'Profel P917RM','T',1,'ZX641N8013'],
    ['9017',['9017'],'Noir signalisation','S',1,'AE70014900725'],
    ['9017',['9T17-2'],'9017 - Laque texturée (Coatex)','T',2,'YN358F'],
    ['9017',['9M17-2'],'9017 - Mat','M',2,'SD300C4901720'],
    ['9017',['9017-2'],'9017 - Satiné','S',2,'SD700C4901720'],
    ['9018',['9T18-2'],'9018 - Laque texturée (Coatex)','T',2,'YL318F'],
    ['9018',['9M18-2'],'9018 - Mat','M',2,'SD300C9901820'],
    ['Anod',['ABLA-2'],'Anodic Look Black - Metallic','M',2,'SD201C4000720'],
    ['Anod',['ABNZ-2'],'Bronze','M',2,'SD201C8000320'],
    ['Anod',['ABWN-2'],'Metallic eloxal (+-8019)','M',2,'SD201C8210621'],
    ['Anod',['ACHA-2'],'Anodic Look Champagne - Metallic','M',2,'SD201C1000220'],
    ['Anod',['AGLD-2'],'Anodic Look Gold - Metallic','M',2,'SD201C1000820'],
    ['Anod',['ANAT-2'],'Supranodic nature','M',2,'SD201C7333721'],
    ['Bleu',['BL26-2'],'Bleu 2600 sablé','T',2,'YW361F'],
    ['Brun',['BR26-2'],'Brun 2650 sablé','T',2,'YW366F'],
    ['DB703',['DB703'],'Metallic DB703 Grey','T',1,'AE03107070320','P'],
    ['Gris',['GR29-2'],'Gris 2900 sablé','T',2,'YW355F'],
    ['Gris',['GR28-2'],'Gris 2800 sablé','T',2,'YW356F'],
    ['Gris',['GR25-2'],'Gris 2500 sablé','T',2,'YW358F'],
    ['Mars',['MARS-2'],'Mars 2525 sablé','T',2,'YX355F'],
    ['Noir',['NO21-2'],'Noir 2100 sablé','T',2,'YW359F'],
    ['Special',['bl961'],'Texture fine métallique sable BL961','T',1,'AE03441031921','P'],
    ['Special',['black','2100','Black'],'Texture fine métallique noir 2100','T',1,'AE03204126121','P'],
    ['Special',['feb1'],'Métallique février 1','T',1,'AE03207050121'],
    ['Special',['JAN9'],'Metallic janvier 9','T',1,'AE03418017920'],
    ['Special',['AKZ07'],'Noir 100 sablé','T',1,'SW303G=SW303F il existe une nuance de différence entre ces deux poudres'],
    ['Special',['PRIRGR','SW305'],'Pratic Ferro Gris','T',1,'SW305I','R'],
    ['Special',['AKZ23','PRCORT'],'Pratic Corten','T',1,'SX350F','R'],
    ['Special',['AKZ16'],'Noir 2200 sablé','T',1,'YW360F'],
    ['Special',['ANZWA'],'Anodic noir','M',1,'AE20104000720'],
    ['Special',['ANGOLD'],'Anodic gold','M',1,'AE20111000820'],
    ['Special',['C32'],'Anoline bronze metallic','S',1,'029/15400'],
    ['Special',['ANCHA'],'Anodic champagne','S',1,'AE20101000220'],
    ['Special',['ANNAT'],'Anodic natura','S',1,'AE20107000120'],
    ['Special',['ANBRO'],'Anodic bronze','S',1,'AE20108000320'],
    ['Special',['ANBRN'],'Anodic brun','S',1,'AE20108000420'],
    ['Special',['1247'],'Brun','S',1,'AE70018875725'],
    ['Special',['9006'],'Aluminium blanc','S',1,'NSL8E0001-C20'],
    ['Special',['sunsnow'],'Texture fine métallique Sunny Snow','T',2,'SD031C9901020','P'],
    ['Special',['nightgrey'],'Texture fine métallique night grey','T',2,'SD031C7701620','P'],
    ['Special',['metasp'],'Texture fine métallique asphalte','T',2,'SD031C4020020'],
    ['Special',['casir'],'Texture fine métallique fonte','T',2,'SD031C4900520'],
    ['Special',['grmoon'],'Texture fine métallique gris lune','T',2,'SD031C7703920'],
    ['Special',['AKZ15'],'Gris 2900 sablé','T',2,'YW355F'],
    ['Special',['AKZ22'],'Gris 2800 sablé','T',2,'YW356F'],
    ['Special',['AKZ24'],'Gris 2500 sablé','T',2,'YW358F'],
    ['Special',['AKZ11'],'Noir 2100 sablé','T',2,'YW359F'],
    ['Special',['AKZ25'],'Bleu 2600 sablé','T',2,'YW361F'],
    ['Special',['AKZ12'],'Brun 2650 sablé','T',2,'YW366F'],
    ['Special',['AKZ30'],'Mars 2525 sablé','T',2,'YX355F couleurs 2026 19'],
    ['Special',['nature'],'supranodic nature','M',2,'SD201C7333721'],
    ['Special',['SDBRONZE'],'Bronze','M',2,'SD201C8000320'],
    ['Special',['C34A'],'Metallic eloxal mat brun','M',2,'SD201C8210621'],
  ];
  const FINITION_L = { S: 'Satiné', M: 'Mat', T: 'Laque texturée', R: 'Structuré', B: 'Brillant', E: 'Métallisé' };
  const SECTION_L = { P: 'Premium / Colour Selector', U: 'Gamme Pure', R: 'Pratic' };

  /** Une référence, sous forme d'objet lisible. */
  function coloris(i) {
    const r = HAROL_COLORIS[i];
    if (!r) return null;
    return {
      i: i, code: r[0], cmds: r[1], desc: r[2],
      finition: FINITION_L[r[3]] || r[3], finCode: r[3],
      classe: r[4], poudre: r[5], sections: (r[6] || '').split('').filter(Boolean),
      // Nom RAL normalisé quand le code en est un — le libellé du document est parfois
      // une référence fournisseur (« Reynaers coatex 9T07 ») plutôt qu'un nom de couleur.
      nom: (RAL_TABLE[r[0]] && RAL_TABLE[r[0]][0]) || r[2],
      hex: (RAL_TABLE[r[0]] && RAL_TABLE[r[0]][1]) || null,
    };
  }
  /** Toutes les références d'un code couleur donné. */
  function colorisDuCode(code) {
    const out = [];
    for (let i = 0; i < HAROL_COLORIS.length; i++) if (HAROL_COLORIS[i][0] === code) out.push(coloris(i));
    return out;
  }
  /** Codes couleur présents au catalogue Harol, dans l'ordre du document. */
  function colorisCodes() {
    const vus = new Set(), out = [];
    HAROL_COLORIS.forEach(r => { if (!vus.has(r[0])) { vus.add(r[0]); out.push(r[0]); } });
    return out;
  }
  /**
   * Recherche libre : code couleur (7016), code de commande (9T07), nom (anthracite),
   * finition (mat), classe (classe 2) ou code de poudre. Tous les mots doivent matcher.
   */
  function chercheColoris(q) {
    const mots = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    const res = [];
    for (let i = 0; i < HAROL_COLORIS.length; i++) {
      const r = HAROL_COLORIS[i];
      const foin = (r[0] + ' ' + r[1].join(' ') + ' ' + r[2] + ' ' + (FINITION_L[r[3]] || '') +
        ' classe' + r[4] + ' classe ' + r[4] + ' ' + r[5] + ' ' +
        ((RAL_TABLE[r[0]] && RAL_TABLE[r[0]][0]) || '')).toLowerCase();
      if (mots.every(m => foin.includes(m))) res.push(coloris(i));
      if (res.length >= 400) break;
    }
    return res;
  }
  /** Libellé retenu sur le devis : lisible pour le client, exploitable pour la commande. */
  function colorisLabel(c) {
    const base = /^\d{4}$/.test(c.code) ? c.code + ' — ' + c.nom : c.desc;
    return base + ' · réf. ' + c.cmds[0] + ' (' + c.finition.toLowerCase() + ')';
  }

  // Liste complète du nuancier Harol, fréquents en tête
  function ralListeHarol() {
    // Source unique : le catalogue Harol ci-dessus (et non plus un drapeau recopié à la main).
    // On ne garde que les codes qui sont de vrais RAL — les familles maison (Special, Anod,
    // Bleu, Gris…) n'ont pas de teinte affichable et vivent dans le nuancier détaillé.
    const auCatalogue = colorisCodes().filter(c => RAL_TABLE[c]);
    const freq = RAL_FREQUENTS.filter(c => auCatalogue.indexOf(c) >= 0);
    const rest = auCatalogue.filter(c => freq.indexOf(c) < 0).sort();
    return freq.concat(rest);
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
    HAROL_COLORIS, FINITION_L, SECTION_L, coloris, colorisDuCode, colorisCodes,
    chercheColoris, colorisLabel,
    RAL_HEX, hexForRalLabel,
  };
})();
