/* ═══════════════════════════════════════════════════════════════════════════════════════════
   LE MODE TERRAIN (règle 55) — fonctions pures, `window.SSTerrain`.
   ─────────────────────────────────────────────────────────────────────────────────────────────
   La page `app/terrain.html` sert CHEZ LE CLIENT : un téléphone, une main, un mètre ruban dans
   l'autre, souvent sans réseau. Ce qui décide de ce qu'elle montre vit ici, sans DOM, pour être
   tenu par `tests/terrain.test.html` :
   • retrouver un client (sans accents, téléphone tapé d'un bloc) et signaler un doublon ;
   • les saisies pas encore enregistrées, gardées PAR VISITE (une nouvelle n'écrase plus l'autre) ;
   • les identifiants des ouvertures, uniques même après une reprise ;
   • les mesures qui sortent de l'ordinaire (centimètres tapés pour des millimètres, zéro de trop,
     maximum du produit) — on AVERTIT, on ne bloque jamais (règle 13) ;
   • les visites du jour (Demandes de RDV) et le devis déjà lié à une demande ;
   • ce qu'un devis existant permet ici : un devis CHIFFRÉ ne se modifie pas sur le terrain (règle 1).
   ⚠️ « Qui doit agir » reste dans `attente.js`, les doublons dans `ui.js` (`SSUI.raisonDoublon`),
   les champs qui bloquent une commande dans `products.js` (`CHAMPS_REQUIS`) : on les LIT.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const P = function () { return window.SSProducts || {}; };
  const U = function () { return window.SSUI || {}; };

  function sansAccents(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function chiffres(t) { return String(t == null ? '' : t).replace(/\D/g, ''); }
  /** 2500 → « 2 500 » (espace insécable : un nombre ne se coupe pas en fin de ligne). */
  function nombre(v) {
    const n = Math.round(Number(v) * 10) / 10;
    const [e, d] = String(n).split('.');
    return e.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (d ? ',' + d : '');
  }

  /* ── RETROUVER UN CLIENT ────────────────────────────────────────────────────────────────────
     Chaque mot tapé doit se trouver, sans accents (« helene » trouve « Hélène »). Un bloc de trois
     chiffres ou plus se cherche AUSSI dans le téléphone sans espaces : on tape « 0475123456 »,
     la fiche porte « 0475 12 34 56 ». */
  function correspond(c, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!c || !mots.length) return false;
    const a = c.adresse || {};
    const foin = sansAccents([c.prenom, c.nom, c.telephone, c.email, a.rue, a.ville].join(' '));
    const tel = chiffres(c.telephone);
    return mots.every(function (m) { return foin.indexOf(m) >= 0 || (/^\d{3,}$/.test(m) && tel.indexOf(m) >= 0); });
  }

  /* ── LES DOUBLONS À LA SAISIE ───────────────────────────────────────────────────────────────
     Même règle que la page Clients et les Demandes de RDV (`SSUI.raisonDoublon`) : même téléphone
     (jamais un bouche-trou), même e-mail, prénom et nom inversés, nom proche. Rien n'est fusionné.
     ⚠️ La fiche de MÊME clé n'est pas un doublon : c'est elle que l'enregistrement complétera. */
  function doublons(saisie, annuaire) {
    const s = saisie || {};
    if (!s.nom && !s.prenom && !s.telephone && !s.email) return [];
    const u = U();
    if (!u.raisonDoublon || !u.clientKeyOf) return [];
    const cle = u.clientKeyOf(s.prenom, s.nom);
    const out = [];
    (annuaire || []).forEach(function (c) {
      if (!c || c.key === cle) return;
      const raison = u.raisonDoublon(s, c);
      if (raison) {
        out.push({ key: c.key, raison: raison, nom: [c.prenom, c.nom].filter(Boolean).join(' '),
          telephone: c.telephone || '', ville: (c.adresse && c.adresse.ville) || '' });
      }
    });
    return out.slice(0, 3);
  }

  /* ── LES IDENTIFIANTS DES OUVERTURES ────────────────────────────────────────────────────────
     ⚠️ Un compteur qui repart de zéro à chaque chargement donnait « it1 » à la nouvelle ouverture
     d'une saisie REPRISE, qui en avait déjà une : la tuile de type et la photo de la nouvelle
     carte modifiaient l'ouverture 1 (vérifié : le volet du salon devenait une tente). Un
     identifiant se tire donc au hasard et se vérifie contre ceux qui existent. */
  function nouvelId(items) {
    const pris = {};
    (items || []).forEach(function (it) { if (it && it._id) pris[it._id] = 1; });
    let id;
    do { id = 'it' + Math.random().toString(36).slice(2, 9); } while (pris[id]);
    return id;
  }
  /** Des ouvertures venues d'ailleurs (base, saisie gardée) reçoivent TOUTES un identifiant neuf. */
  function identifier(items) {
    const out = [];
    (items || []).forEach(function (it) {
      const copie = Object.assign({ photos: [] }, it);
      copie._id = nouvelId(out);
      if (!Array.isArray(copie.photos)) copie.photos = [];
      out.push(copie);
    });
    return out;
  }

  /* ── LES SAISIES GARDÉES ────────────────────────────────────────────────────────────────────
     Sur iPhone, aller prendre une photo suffit parfois à faire recharger l'onglet : la saisie vit
     donc dans le téléphone. ⚠️ Elle vivait dans UN seul emplacement : commencer un autre client
     sans répondre au bandeau « Saisie retrouvée » remplaçait, dès la première lettre, une visite
     jamais enregistrée. Une saisie par devis désormais, la plus récente d'abord. */
  const MAX_SAISIES = 6;

  /** Une ouverture où l'on a écrit quelque chose (le type seul, choisi par défaut, ne compte pas). */
  function ouvertureEntamee(it) {
    if (!it) return false;
    if (Number(it.largeur) > 0 || Number(it.hauteur) > 0 || Number(it.projection) > 0) return true;
    if (String(it.emplacement || '').trim() || String(it.etage || '').trim() || String(it.notes || '').trim()) return true;
    if (Array.isArray(it.photos) && it.photos.length) return true;
    const requis = (P().CHAMPS_REQUIS || {})[it.type] || [];
    const manque = P().champsManquants ? P().champsManquants(it).length : requis.length;
    return manque < requis.length;
  }
  /** ⚠️ Taper dans la recherche ne fait pas une visite : sans nom ni ouverture entamée, on ne garde
      rien — sinon le passage suivant propose « Saisie retrouvée · 0 ouverture », pour rien. */
  function significatif(b) {
    if (!b || !b.state) return false;
    const c = b.client || {};
    if (String(c.nom || '').trim() || String(c.prenom || '').trim()) return true;
    return (b.state.items || []).some(ouvertureEntamee);
  }
  /** Lit la liste gardée (et l'ancien emplacement unique, repris une fois). */
  function lireSaisies(texteListe, texteAncien) {
    let liste = [];
    try { const l = JSON.parse(texteListe || '[]'); if (Array.isArray(l)) liste = l; } catch (e) { liste = []; }
    if (texteAncien) {
      try { const a = JSON.parse(texteAncien); if (a && a.state && a.state.id) liste = avecSaisie(liste, a); } catch (e) {}
    }
    return liste.filter(function (b) { return b && b.state && b.state.id; })
      .sort(function (a, b) { return String(b.quand || '').localeCompare(String(a.quand || '')); });
  }
  /** Pose (ou remplace) la saisie de CE devis, sans toucher aux autres. */
  function avecSaisie(liste, b) {
    if (!b || !b.state || !b.state.id) return (liste || []).slice();
    const autres = (liste || []).filter(function (x) { return x && x.state && x.state.id !== b.state.id; });
    return [b].concat(autres)
      .sort(function (x, y) { return String(y.quand || '').localeCompare(String(x.quand || '')); })
      .slice(0, MAX_SAISIES);
  }
  function sansSaisie(liste, id) {
    return (liste || []).filter(function (x) { return x && x.state && x.state.id !== id; });
  }
  /** Celles à proposer : arrivé sur un devis précis (`?id=`), seulement la sienne. */
  function saisiesAProposer(liste, idUrl) {
    return (liste || []).filter(function (b) { return !idUrl || b.state.id === idUrl; });
  }
  /** « Charlier · 3 ouvertures » — ce qui permet de reconnaître une saisie sans l'ouvrir. */
  function resumeSaisie(b) {
    const c = (b && b.client) || {};
    const qui = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || 'Client sans nom';
    const n = ((b && b.state && b.state.items) || []).filter(ouvertureEntamee).length;
    return qui + ' · ' + n + ' ouverture' + (n > 1 ? 's' : '');
  }

  /* ── LES MESURES QUI SORTENT DE L'ORDINAIRE ─────────────────────────────────────────────────
     Les mesures se tapent en MILLIMÈTRES, debout, au doigt : « 250 » pour 25 cm au lieu de 2 500,
     un zéro de trop, et l'erreur ne se voit qu'à la commande. On AVERTIT (règle 13) et on propose
     la correction d'un appui ; on ne bloque jamais : une baie de 280 mm existe. */
  const MESURE_MIN = 300;
  const MESURE_MAX = { largeur: 7000, hauteur: 4000, projection: 4000 };
  function avisMesure(item, champ) {
    const it = item || {};
    const v = Number(it[champ]);
    if (!(v > 0)) return null;
    let max = MESURE_MAX[champ] || 7000, source = '';
    if (it.type === 'tente_solaire') {
      const s = (P().TS_SPECS || {})[it.modele];
      if (s && champ === 'largeur' && s.largeur_max) { max = s.largeur_max; source = it.modele; }
      if (s && champ === 'projection' && s.projection_max) { max = s.projection_max; source = it.modele; }
    }
    if (it.type === 'volet_roulant' && champ === 'hauteur' && it.caisson_mesure && P().vrHauteurMaxFor) {
      const h = P().vrHauteurMaxFor(it.caisson_mesure);
      if (h) { max = h; source = 'caisson ' + it.caisson_mesure; }
    }
    if (v < MESURE_MIN) {
      const propose = v * 10 >= MESURE_MIN ? v * 10 : v * 100;
      return { champ: champ, niveau: 'petit', texte: nombre(v) + ' mm, c’est ' + nombre(v / 10) + ' cm.',
        propose: propose <= max ? propose : null };
    }
    if (v > max) {
      if (source) {
        return { champ: champ, niveau: 'max', propose: null,
          texte: nombre(v) + ' mm : au-delà du maximum ' + (it.type === 'tente_solaire' ? 'de la ' : 'du ') + source + ' (' + nombre(max) + ' mm).' };
      }
      const p = Math.round(v / 10);
      return { champ: champ, niveau: 'grand', texte: nombre(v) + ' mm, c’est ' + nombre(v / 1000) + ' m.',
        propose: p >= MESURE_MIN ? p : null };
    }
    return null;
  }
  /** Les deux mesures d'une ouverture (la hauteur, ou la projection pour une tente). */
  function avisOuverture(item) {
    const it = item || {};
    return ['largeur', it.type === 'tente_solaire' ? 'projection' : 'hauteur']
      .map(function (k) { return avisMesure(it, k); }).filter(Boolean);
  }

  /* ── CE QUI MANQUE, POUR Y ALLER ────────────────────────────────────────────────────────────
     Le récap NOMMAIT ce qui manquait sans y mener (règle 36) : chaque manque porte maintenant son
     ouverture et son champ, pour être un bouton. */
  function manques(items) {
    const out = [];
    (items || []).forEach(function (it, i) {
      (P().champsManquants ? P().champsManquants(it) : []).forEach(function (x) {
        out.push({ i: i, k: x.k, l: x.l, ou: (it && it.emplacement) || '' });
      });
    });
    return out;
  }

  /* ── LES VISITES DU JOUR ────────────────────────────────────────────────────────────────────
     Les demandes au statut « RDV fixé » (ou déjà « Visité ») d'aujourd'hui, à l'heure ; puis
     celles des deux jours d'avant, qui n'ont pas encore leur devis — la visite est faite, il
     reste à l'encoder. Une demande « Converti » n'y revient que si son devis est encore VIDE
     (créé depuis la demande, sans ouverture ni prix) : c'est lui qu'on complète, pas un second.
     Une demande annulée n'y est jamais. */
  function jour(iso) { return String(iso || '').slice(0, 10); }
  function heure(iso) { const m = /T(\d\d:\d\d)/.exec(String(iso || '')); return m ? m[1] : ''; }
  function ecartJours(de, a) {
    const x = Date.parse(jour(de) + 'T00:00:00Z'), y = Date.parse(jour(a) + 'T00:00:00Z');
    return (isNaN(x) || isNaN(y)) ? NaN : Math.round((y - x) / 86400000);
  }
  /** Le devis RATTACHÉ à une demande (règle 17, lien explicite seulement) et qui existe encore. */
  function devisLie(rdv, devisListe) {
    if (!rdv) return null;
    const liste = devisListe || [];
    const parLien = liste.find(function (d) { return d && String(d.rdv_id || '') === String(rdv.id); });
    if (parLien) return parLien;
    if (rdv.devis_id) return liste.find(function (d) { return d && String(d.id) === String(rdv.devis_id); }) || null;
    return null;
  }
  /** Le devis porte-t-il déjà des ouvertures ? La liste n'a que leurs types (`item_types_json`). */
  function aDesOuvertures(d) {
    if (!d) return false;
    if (Array.isArray(d.items)) return d.items.length > 0;
    if (Array.isArray(d.item_types)) return d.item_types.length > 0;
    try { const t = JSON.parse(d.item_types_json || '[]'); return Array.isArray(t) && t.length > 0; } catch (e) { return false; }
  }
  /** « à compléter » (vide), « commencé » (des ouvertures, pas de prix), « chiffré » (il se modifie au bureau). */
  function etatDevisLie(d) {
    if (!d) return '';
    if (!modifiableIci(d).ok) return 'chiffre';
    return aDesOuvertures(d) ? 'commence' : 'vide';
  }
  function visites(rdvs, devisListe, auj) {
    const out = [];
    (rdvs || []).forEach(function (r) {
      if (!r || !r.date_rdv || ['rdv_fixe', 'visite', 'converti'].indexOf(r.statut) < 0) return;
      const e = ecartJours(auj, r.date_rdv);
      if (!(e === 0 || e === -1 || e === -2)) return;
      const lie = devisLie(r, devisListe);
      const etat = etatDevisLie(lie);
      if (r.statut === 'converti' && etat !== 'vide') return;
      // Avant aujourd'hui, une demande qui a déjà un vrai devis n'attend plus rien d'ici.
      if (e < 0 && lie && etat !== 'vide') return;
      out.push({ rdv: r, ecart: e, heure: heure(r.date_rdv), quand: e === 0 ? 'aujourd’hui' : (e === -1 ? 'hier' : 'avant-hier'),
        devis: lie, etat: etat });
    });
    return out.sort(function (a, b) {
      if (a.ecart !== b.ecart) return b.ecart - a.ecart;          // aujourd'hui d'abord
      return String(a.rdv.date_rdv).localeCompare(String(b.rdv.date_rdv));
    });
  }

  /* ── CE QU'UN DEVIS EXISTANT PERMET ICI ─────────────────────────────────────────────────────
     ⚠️ RÈGLE 1. La page reconstruisait le chiffrage d'un devis rouvert avec les réglages DU JOUR,
     Nicolas en vendeur, sans les lignes ajoutées au bureau : un devis chiffré changeait de montant
     en l'enregistrant d'ici. Le terrain RELÈVE (client, mesures, photos) ; il ne chiffre pas. Un
     devis déjà chiffré, envoyé ou signé — ou un dépannage, qui n'a pas d'ouvertures — se modifie
     au simulateur ou sur sa fiche. */
  function estChiffre(d) {
    if (!d) return false;
    if ((d.items || []).some(function (i) { return Number(i && i.prix_catalogue_ht) > 0; })) return true;
    // Une ligne ajoutée au bureau (main-d'œuvre, déplacement) est une décision de prix, même à 0 €.
    if (d.pricing_v2 && Array.isArray(d.pricing_v2.extras) && d.pricing_v2.extras.length) return true;
    // La liste des devis ne porte que le total, à plat (`total_ttc`) ; un devis complet le porte dans `calculs`.
    return Number((d.calculs && d.calculs.total_ttc) || d.total_ttc) > 0;
  }
  function modifiableIci(d) {
    if (!d) return { ok: true };
    if (d.type_document === 'depannage') return { ok: false, raison: 'depannage' };
    const st = d.statut || 'brouillon';
    if (st !== 'brouillon') return { ok: false, raison: 'statut', statut: st };
    if (estChiffre(d)) return { ok: false, raison: 'chiffre', total: Number(d.calculs && d.calculs.total_ttc) || 0 };
    return { ok: true };
  }

  /** Le vendeur d'un devis fait sur le terrain : celui qui fait la visite. Sans identité connue,
      le défaut du simulateur (Nicolas) — modifiable au récap comme au simulateur. */
  function vendeurDe(identite) {
    const k = identite && identite.key;
    return k === 'nicolas' || k === 'yannick' ? k : 'nicolas';
  }

  window.SSTerrain = {
    sansAccents: sansAccents, nombre: nombre, correspond: correspond, doublons: doublons,
    nouvelId: nouvelId, identifier: identifier,
    MAX_SAISIES: MAX_SAISIES, ouvertureEntamee: ouvertureEntamee, significatif: significatif, lireSaisies: lireSaisies,
    avecSaisie: avecSaisie, sansSaisie: sansSaisie, saisiesAProposer: saisiesAProposer, resumeSaisie: resumeSaisie,
    MESURE_MIN: MESURE_MIN, MESURE_MAX: MESURE_MAX, avisMesure: avisMesure, avisOuverture: avisOuverture,
    manques: manques, heure: heure, ecartJours: ecartJours, devisLie: devisLie, aDesOuvertures: aDesOuvertures,
    etatDevisLie: etatDevisLie, visites: visites,
    estChiffre: estChiffre, modifiableIci: modifiableIci, vendeurDe: vendeurDe,
  };
})();
