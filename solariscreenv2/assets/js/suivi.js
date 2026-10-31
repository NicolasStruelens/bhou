// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LE SUIVI CLIENT (la page que le client ouvre par son lien : `track.html`)
// Script classique (file:// OK). Global : window.SSSuivi
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (31/10/2026, demande de Nicolas : « amélioration complète du lien
// client, thèmes selon les saisons, photos du chantier en cours ou terminé »)
// La page racontait l'avancement en cinq pastilles et s'arrêtait là, même une fois le chantier
// posé. Elle dit maintenant QUAND (dates des étapes, rendez-vous de pose), MONTRE le chantier
// (photos par phase, avant / après) et s'habille de la saison. Les règles vivent ici, en fonctions
// PURES, pour être testables (`tests/suivi.test.html`) ; la page ne fait que dessiner.
// ⚠️ CE QUE LE CLIENT A LE DROIT DE VOIR NE SE DÉCIDE PAS ICI : c'est le serveur (`/api/track`,
// liste blanche) qui choisit ce qui sort. Ce fichier ne trie que ce qu'on lui a déjà donné.
(function () {
  'use strict';

  const S = function () { return window.SSUI; };
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const jourDe = function (v) { const s = String(v == null ? '' : v).slice(0, 10); return ISO.test(s) ? s : ''; };

  // ── LES SAISONS ───────────────────────────────────────────────────────────────────────────────
  // ⚠️ UNE SAISON N'EST PAS UNE FÊTE (règle 28). Les fêtes (`fetes.js`) restent INTERDITES sur
  // cette page : une araignée sur le suivi d'une école, c'est un chantier qu'on ne prend pas au
  // sérieux. Une saison parle de LUMIÈRE et de temps qu'il fait — le métier même de SolariScreen —
  // et elle est sobre : un emblème à côté du logo, une phrase, quelques flocons ou feuilles qui
  // passent DERRIÈRE les cartes (jamais sur le texte), immobiles si le visiteur a demandé moins
  // d'animations. Comme les fêtes : bornes en `MM-JJ` (rien à tenir à jour d'une année sur
  // l'autre), teintes `{ sombre, clair }` (calibrées pour les deux familles de thèmes).
  const SVG = {
    flocon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.6 4.2 12 6.4l2.4-2.2M9.6 19.8 12 17.6l2.4 2.2M4.4 10.6l3-.9-.6-3.1M19.6 13.4l-3 .9.6 3.1M4.4 13.4l3 .9-.6 3.1M19.6 10.6l-3-.9.6-3.1"/></svg>',
    fleur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.3" fill="currentColor"/><path d="M12 9.7C10 7.6 10.3 4 12 2.8c1.7 1.2 2 4.8 0 6.9zM14.2 11.3c1.4-2.6 4.9-3.4 6.5-2.1-.4 2-3.6 3.6-6.5 2.1zM13.4 14c2.8.6 4.3 3.9 3.4 5.7-2 .2-4.4-2.5-3.4-5.7zM10.6 14c1 3.2-1.4 5.9-3.4 5.7-.9-1.8.6-5.1 3.4-5.7zM9.8 11.3C6.9 12.8 3.7 11.2 3.3 9.2c1.6-1.3 5.1-.5 6.5 2.1z"/></svg>',
    petale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c4 3 5.5 8.5 0 18C6.5 11.5 8 6 12 3z"/></svg>',
    soleil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M5.2 18.8l1.7-1.7M17.1 6.9l1.7-1.7"/></svg>',
    eclat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.7 5.6 3.4 8.3 10 10-6.6 1.7-9.3 4.4-10 10-.7-5.6-3.4-8.3-10-10 6.6-1.7 9.3-4.4 10-10z"/></svg>',
    feuille: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 3.6c-8.3.1-13.7 3.4-14.9 9.2-.5 2.6.1 4.9 1.6 6.4 1.5 1.4 3.8 2 6.4 1.5C18.9 19.5 20.2 11.8 20 3.6z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 20.5 15.5 8.5"/></svg>',
  };
  /** `debut` = premier jour de la saison (MM-JJ). `mouvement` : « tombe » (de haut en bas) ou
   *  « scintille » (sur place) — un éclat de soleil ne tombe pas. */
  const SAISONS = [
    { k: 'printemps', l: 'Printemps', debut: '03-20', phrase: 'Le printemps est là : place à la lumière.',
      teinte: { sombre: '#86d7a0', clair: '#2f8a52' }, embleme: SVG.fleur, motif: SVG.petale, mouvement: 'tombe' },
    { k: 'ete', l: 'Été', debut: '06-21', phrase: 'Bel été, à l’ombre comme au soleil.',
      teinte: { sombre: '#ffd166', clair: '#b97c00' }, embleme: SVG.soleil, motif: SVG.eclat, mouvement: 'scintille' },
    { k: 'automne', l: 'Automne', debut: '09-22', phrase: 'Les jours raccourcissent, votre confort reste.',
      teinte: { sombre: '#f2a066', clair: '#b4541c' }, embleme: SVG.feuille, motif: SVG.feuille, mouvement: 'tombe' },
    { k: 'hiver', l: 'Hiver', debut: '12-21', phrase: 'Bien au chaud cet hiver.',
      teinte: { sombre: '#a8cff7', clair: '#2f6aa8' }, embleme: SVG.flocon, motif: SVG.flocon, mouvement: 'tombe' },
  ];
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  /** « MM-JJ » d'une date (objet Date, ou « AAAA-MM-JJ »). Une valeur illisible vaut aujourd'hui. */
  function mmjj(x) {
    if (x instanceof Date && !isNaN(x)) return pad(x.getMonth() + 1) + '-' + pad(x.getDate());
    const j = jourDe(x);
    if (j) return j.slice(5);
    const n = new Date();
    return pad(n.getMonth() + 1) + '-' + pad(n.getDate());
  }
  /** La saison d'un jour. L'hiver enjambe le Nouvel An : il gagne avant le 20 mars ET dès le 21 décembre. */
  function saisonDu(x) {
    const md = mmjj(x);
    const par = function (k) { return SAISONS.find(function (s) { return s.k === k; }); };
    if (md >= '12-21' || md < '03-20') return par('hiver');
    if (md < '06-21') return par('printemps');
    if (md < '09-22') return par('ete');
    return par('automne');
  }
  /** Les teintes de la saison en variables CSS : SOMBRE par défaut, CLAIRE sur tous les thèmes
   *  clairs que `SSTheme` connaît (même raison que les fêtes : sur fond blanc, la teinte du sombre
   *  ne se voit presque plus — et le thème clair est celui qu'on utilise vraiment). */
  function styleSaison(s) {
    const clairs = (window.SSTheme && window.SSTheme.idsClairs ? window.SSTheme.idsClairs() : ['light'])
      .map(function (id) { return '[data-theme="' + id + '"]'; }).join(', ');
    return ':root { --saison: ' + s.teinte.sombre + '; --saison-o: 0.3; }\n' +
      clairs + ' { --saison: ' + s.teinte.clair + '; --saison-o: 0.26; }';
  }
  /** Les motifs qui passent en fond : positions DÉTERMINISTES (les mêmes à chaque visite, et un test
   *  peut les compter), délais NÉGATIFS (déjà en route au chargement : pas de pluie qui « démarre »). */
  function motifs(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = function (k) { const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      out.push({
        x: Math.round(2 + r(1) * 94), y: Math.round(4 + r(7) * 88),
        delai: -Math.round(r(2) * 180) / 10, duree: Math.round(140 + r(3) * 120) / 10,
        taille: Math.round(10 + r(4) * 10), derive: Math.round((r(5) - 0.5) * 120), tour: Math.round((r(6) - 0.5) * 540),
      });
    }
    return out;
  }

  // ── LES DATES, DITES COMME À UN CLIENT ────────────────────────────────────────────────────────
  const midi = function (iso) { return new Date(iso + 'T12:00:00'); };
  /** « 3 novembre 2026 », ou « mardi 3 novembre 2026 » avec le jour. Rien si la date est illisible. */
  function dateLongue(v, avecJour) {
    const j = jourDe(v);
    if (!j) return '';
    const o = { day: 'numeric', month: 'long', year: 'numeric' };
    if (avecJour) o.weekday = 'long';
    return midi(j).toLocaleDateString('fr-BE', o);
  }
  /** Jours entiers de `de` à `a` (« AAAA-MM-JJ »), à midi : un changement d'heure ne décale rien. */
  function joursEntre(de, a) { return Math.round((midi(a) - midi(de)) / 86400000); }
  /** « Aujourd'hui », « Demain », « Dans 5 jours ». */
  function quand(jours) {
    if (jours === 0) return 'Aujourd’hui';
    if (jours === 1) return 'Demain';
    return 'Dans ' + jours + ' jours';
  }
  /** 1.5 → « 1 h 30 ». Personne ne lit « 1.5 h ». Rien si la durée n'est pas un nombre positif. */
  function duree(h) {
    const n = Number(h);
    if (!isFinite(n) || n <= 0) return '';
    const hh = Math.floor(n), mm = Math.round((n - hh) * 60);
    if (mm === 60) return (hh + 1) + ' h';
    return hh ? hh + ' h' + (mm ? ' ' + pad(mm) : '') : mm + ' min';
  }

  // ── L'AVANCEMENT ──────────────────────────────────────────────────────────────────────────────
  // Micro-statut sous l'étape en cours. « Reçu » et la pose dépendent d'une date : voir `avancement`.
  const SOUS = {
    a_commander: 'Votre commande est en préparation',
    commande: 'Commande transmise au fournisseur',
    fabrication: 'Vos produits sont en fabrication',
  };
  /** Ce que la page raconte, à partir de la réponse de `/api/track`. Les règles du métier sont
   *  CELLES DE L'ERP (`SSUI.etatCommande`, `isPoseDone`, `livraisonEstimee`) : le client ne doit
   *  jamais lire autre chose que ce que Nicolas voit sur la fiche.
   *  ⚠️ POSÉ EN DEUX FOIS : la pose est faite ET une date de pose reste à venir — c'est la règle de
   *  l'ERP (`poseAVenir`, « Seconde pose le … »). Le client lisait « Installation terminée » au-dessus
   *  d'une moitié de chantier pas encore posée. */
  function avancement(d, auj) {
    const U = S();
    const jour = jourDe(auj) || U.aujourdhui();
    const x = d || {};
    const rec = x.reception || {};
    // La forme que les règles de l'ERP attendent — rien de plus que ce que le serveur a laissé sortir.
    const dv = { commande: x.commande || {}, chantier: x.chantier || {}, reception_date: x.reception_date || '',
      reception: rec.signe ? { image: true, date: rec.date || '' } : null };
    const cc = dv.commande;
    const etat = U.etatCommande(dv);
    const poseFaite = U.isPoseDone(dv);
    const datePose = jourDe(dv.chantier.date_pose);
    const poseAVenir = !!datePose && datePose >= jour;
    const partielle = poseFaite && poseAVenir;
    const termine = poseFaite && !poseAVenir;
    const ETAPES = U.COMMANDE_ETAPES;
    const idx = poseFaite ? ETAPES.length - 1 : Math.max(0, ETAPES.indexOf(etat));
    // Date de pose RÉELLE : le PV, sinon la date de réception notée, sinon la date prévue si elle est passée.
    const posee = jourDe(rec.date) || jourDe(dv.reception_date) || (datePose && datePose <= jour ? datePose : '');
    const dates = { commande: jourDe(cc.date_commande), recu: jourDe(cc.recu_le), pose: poseFaite ? posee : '' };
    const etapes = ETAPES.map(function (k, i) {
      const fait = i < idx || (termine && i === idx);
      const encours = !fait && i === idx;
      let sous = '';
      if (encours) {
        if (k === 'recu') sous = poseAVenir ? 'Matériel réceptionné — pose prévue le ' + dateLongue(datePose) : 'Matériel réceptionné — pose à planifier';
        else if (k === 'pose') sous = 'Première partie posée — la suite le ' + dateLongue(datePose);
        else sous = SOUS[k] || 'En cours';
      }
      // Une date dit qu'une étape a eu LIEU : jamais sous une étape à venir.
      return { k: k, l: U.COMMANDE_LABEL[k], etat: fait ? 'fait' : (encours ? 'encours' : 'avenir'),
        date: (fait || encours) ? (dates[k] || '') : '', sous: sous };
    });

    // La ligne sous la frise. Segments [texte, en gras ?] : la page les écrit en texte, jamais en HTML.
    let eta;
    if (termine) eta = [['Installation terminée — merci de votre confiance !']];
    else if (partielle) eta = [['Une première partie est posée — la suite est prévue le '], [dateLongue(datePose, true), true], ['.']];
    else if (etat === 'recu') eta = poseAVenir ? [['Matériel reçu — pose prévue le '], [dateLongue(datePose, true), true], ['.']] : [['Matériel reçu, la pose sera bientôt planifiée.']];
    else {
      // Sans délai annoncé, pas d'estimation (même règle que la fiche, `SSUI.livraisonEstimee`).
      const liv = U.livraisonEstimee(dv);
      eta = liv ? [['Livraison estimée : '], [dateLongue(liv), true]] : [["L'installateur planifiera prochainement la suite de votre commande."]];
    }

    // Le rendez-vous : seulement s'il est à VENIR. Une date passée sans pose enregistrée ne dit rien
    // de sûr (reportée ? faite sans PV ?) : on se tait plutôt que d'annoncer un passage révolu.
    let rdv = null;
    if (poseAVenir) {
      const h = /^(\d{1,2}):(\d{2})$/.exec(String(dv.chantier.heure || ''));
      rdv = {
        titre: partielle ? 'Suite de votre installation' : 'Pose de votre installation',
        date: datePose, jour: dateLongue(datePose, true), quand: quand(joursEntre(jour, datePose)),
        // « 8 h », « 8 h 30 » — jamais « 08:30 », qui se lit comme un horaire de train.
        heure: (h && Number(h[1]) < 24) ? 'Arrivée prévue vers ' + Number(h[1]) + ' h' + (h[2] !== '00' ? ' ' + h[2] : '') : '',
        duree: duree(dv.chantier.duree_h) ? 'Durée estimée : ' + duree(dv.chantier.duree_h) : '',
      };
    }
    const intro = termine ? 'Votre installation est terminée.'
      : (partielle ? 'Une première partie de votre installation est posée.' : 'Voici où en est votre commande SolariScreen.');
    return { etapes: etapes, termine: termine, partielle: partielle, eta: eta, rdv: rdv, intro: intro, posee: termine ? posee : '' };
  }

  // ── LES PHOTOS ────────────────────────────────────────────────────────────────────────────────
  /** Une adresse d'image que la page accepte d'écrire : celle que le serveur fabrique pour CE lien
   *  (`/api/track?t=…&photo=…`), ou une image embarquée (`data:image/…`, les anciennes photos).
   *  Rien d'autre — pas de `javascript:`, pas d'adresse externe. */
  function srcSure(u) {
    return typeof u === 'string' && (/^\/api\/track\?t=[^\s"'<>]+$/.test(u) || /^data:image\/[a-z0-9.+-]+[;,]/i.test(u));
  }
  /** Le plus parlant d'abord : « Terminé », puis « Pendant les travaux », puis « Avant ». */
  const PHASES = [
    { k: 'apres', l: 'Terminé' },
    { k: 'pendant', l: 'Pendant les travaux' },
    { k: 'avant', l: 'Avant' },
  ];
  /** Les photos du journal rangées par phase, et la comparaison avant / après — seulement si les DEUX
   *  existent (une moitié vide ne compare rien), la première de chaque, comme au portfolio (règle 45). */
  function galerie(photos) {
    const ok = (photos || []).filter(function (p) {
      return p && srcSure(p.src) && PHASES.some(function (x) { return x.k === p.phase; });
    });
    const groupes = PHASES.map(function (ph) {
      return { k: ph.k, l: ph.l, photos: ok.filter(function (p) { return p.phase === ph.k; }) };
    }).filter(function (g) { return g.photos.length; });
    const av = ok.find(function (p) { return p.phase === 'avant'; });
    const ap = ok.find(function (p) { return p.phase === 'apres'; });
    const toutes = [];
    groupes.forEach(function (g) { g.photos.forEach(function (p) { toutes.push(Object.assign({ libelle: g.l }, p)); }); });
    return { groupes: groupes, paire: (av && ap) ? { avant: av, apres: ap } : null, toutes: toutes };
  }

  // ── LA COMMANDE ───────────────────────────────────────────────────────────────────────────────
  /** Une ligne par produit, en mots de client : « Screen — SC 110 », l'emplacement, les couleurs
   *  lisibles (`SSVitrine` : « 7016 Gris anthracite », jamais une référence de commande). */
  function produits(items) {
    const V = window.SSVitrine, U = S();
    const coul = function (v) { return V ? V.couleurLisible(v) : String(v || ''); };
    const toile = function (v) { return V ? V.toileLisible(v) : String(v || ''); };
    return (items || []).map(function (it) {
      const t = (U.TYPE_LABEL && U.TYPE_LABEL[it.type]) || it.type || 'Produit';
      const n = Math.max(1, Math.round(Number(it.quantite) || 1));
      const details = [];
      if (it.toile) details.push('Toile ' + toile(it.toile));
      if (it.couleur) details.push('Coloris ' + coul(it.couleur));
      return {
        titre: (n > 1 ? n + ' × ' : '') + t + (it.modele ? ' — ' + it.modele : ''), emplacement: String(it.emplacement || ''),
        details: details, photos: (it.photos || []).filter(srcSure),
      };
    });
  }

  window.SSSuivi = {
    SAISONS: SAISONS, saisonDu: saisonDu, styleSaison: styleSaison, motifs: motifs,
    dateLongue: dateLongue, joursEntre: joursEntre, quand: quand, duree: duree,
    avancement: avancement, PHASES: PHASES, galerie: galerie, srcSure: srcSure, produits: produits,
  };
})();
