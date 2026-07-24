// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Coordonnées société (partagé devis + factures)
// À modifier ici une seule fois.
// ═══════════════════════════════════════════════════════════
window.SS_COMPANY = {
  name:    'SolariScreen',
  legal:   'SYSCORE SRL',
  admin:   'Yannick Van Schooten',
  tagline: 'Gérez la lumière, vivez votre confort',
  address: 'Avenue de la Gare 60, 1401 Baulers',
  phone:   '',
  email:   'info@solariscreen.be',
  email2:  'service@solariscreen.be',
  web:     'www.solariscreen.be',
  tva:     'BE 1016.367.186',
  iban:    'BE82 7320 7855 2368',
  court:   'Nivelles',
};

// ── Points de départ des deux vendeurs (pour suggérer qui est le plus proche d'un RDV) ──
// On ne stocke QUE les coordonnées de la zone (code postal géocodé une fois), jamais l'adresse
// de maison précise. Pour changer de base : géocode le nouveau code postal (api.zippopotam.us/BE/XXXX)
// et remplace lat/lon ici.
window.SS_VENDEURS = {
  nicolas: { label: 'Nicolas', ville: 'Braine-le-Château', cp: '1440', lat: 50.6339, lon: 4.4021 },
  yannick: { label: 'Yannick', ville: 'Grez-Doiceau',      cp: '1390', lat: 50.7333, lon: 4.7000 },
};
