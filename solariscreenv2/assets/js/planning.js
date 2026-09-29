// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — PLANNING : la source unique du TEMPS
// Script classique (file:// OK). Global : window.SSPlanning
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
// L'ERP connaissait déjà trois choses qui prennent du temps — une POSE (devis signé), une VISITE
// client (demande de RDV) et un DÉPANNAGE — mais chacune vivait dans son coin : les dépannages
// n'apparaissaient dans AUCUN agenda alors qu'ils portent date, heure, durée et intervenants.
// Résultat : rien n'empêchait de caler une pose et une intervention à la même heure.
// Ici, les trois deviennent des ÉVÉNEMENTS de même nature. Toute page qui parle de temps lit ce
// module — comme tout écran qui parle d'argent lit SSUI.duFacture.
//
// PRINCIPE : LA DISPONIBILITÉ PAR SOUSTRACTION
// On ne saisit JAMAIS ses créneaux libres — un planning qu'il faut nourrir chaque semaine meurt en
// trois semaines. On déclare UNE FOIS une trame hebdomadaire (réglages), le module soustrait ce qui
// est déjà planifié dans l'ERP, et on n'ajoute à la main que les EXCEPTIONS (congé, indisponible,
// ou au contraire « ce samedi-là je peux »). Ce qui reste est libre, par construction.
//
// Fonctions PURES (sauf `charger()`, qui va chercher les données) : c'est ce qui les rend testables
// — voir `tests/planning.test.html`.
(function () {
  'use strict';

  const SSUI = window.SSUI || {};

  // ── Vocabulaire (règle : les libellés vivent à UN endroit, jamais en copie locale) ────────────
  const JOURS = [
    { k: 'lun', court: 'Lun', long: 'Lundi' },
    { k: 'mar', court: 'Mar', long: 'Mardi' },
    { k: 'mer', court: 'Mer', long: 'Mercredi' },
    { k: 'jeu', court: 'Jeu', long: 'Jeudi' },
    { k: 'ven', court: 'Ven', long: 'Vendredi' },
    { k: 'sam', court: 'Sam', long: 'Samedi' },
    { k: 'dim', court: 'Dim', long: 'Dimanche' },
  ];

  // Natures d'événement. `couleur` désigne une variable de tokens.css : jamais de couleur en dur,
  // le thème clair et le thème sombre doivent tous les deux tenir.
  const NATURES = {
    visite:    { label: 'Visite',    pluriel: 'Visites',     icone: 'calendar', couleur: 'var(--accent)' },
    pose:      { label: 'Pose',      pluriel: 'Poses',       icone: 'hammer',   couleur: 'var(--accent-2)' },
    depannage: { label: 'Dépannage', pluriel: 'Dépannages',  icone: 'wrench',   couleur: 'var(--danger)' },
    indispo:   { label: 'Indispo',   pluriel: 'Indispos',    icone: 'lock',     couleur: 'var(--text-subtle)' },
  };

  // Formes d'une journée dans la trame hebdomadaire.
  const FORMES_JOUR = {
    non:       'Pas disponible',
    matin:     'Matin',
    apresmidi: 'Après-midi',
    journee:   'Journée',
  };

  // Équipe d'un chantier → personnes réellement mobilisées. `sous_traitant` n'occupe NI Nicolas NI
  // Yannick : c'est justement l'intérêt d'y faire appel, et le compter bloquerait leur planning.
  const EQUIPE_QUI = {
    nicolas: ['nicolas'],
    yannick: ['yannick'],
    nicolas_yannick: ['nicolas', 'yannick'],
    sous_traitant: [],
  };

  // ── Dates ─────────────────────────────────────────────────────────────────────────────────────
  // ⚠️ Tout se manipule en chaînes « YYYY-MM-DD » : la comparaison lexicographique EST la
  // comparaison chronologique, et aucun fuseau horaire ne vient s'en mêler.
  // On n'utilise JAMAIS toISOString().slice(0,10) pour « aujourd'hui » : cette date est en UTC, donc
  // entre minuit et 2 h du matin (heure d'été belge) elle renvoie LA VEILLE.

  /** Date locale d'un objet Date au format YYYY-MM-DD. */
  function ymd(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + j;
  }
  function aujourdhui() { return ymd(new Date()); }
  /** « YYYY-MM-DD » → Date locale à minuit (jamais parsée par le constructeur, qui lirait de l'UTC). */
  function dateDe(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function plusJours(iso, n) { const d = dateDe(iso); d.setDate(d.getDate() + n); return ymd(d); }
  /** 0 = lundi … 6 = dimanche (getDay() renvoie 0 pour dimanche : d'où le décalage). */
  function indexJour(iso) { return (dateDe(iso).getDay() + 6) % 7; }
  function cleJour(iso) { return JOURS[indexJour(iso)].k; }
  function lundiDe(iso) { return plusJours(iso, -indexJour(iso)); }
  function estWeekend(iso) { return indexJour(iso) >= 5; }
  /** Nombre de jours entre deux dates (positif si `b` est après `a`). */
  function ecartJours(a, b) { return Math.round((dateDe(b) - dateDe(a)) / 86400000); }

  /** Suite de dates de `du` à `au` inclus. */
  function jours(du, au) {
    const out = [];
    let cur = du;
    let garde = 0;
    while (cur <= au && garde++ < 800) { out.push(cur); cur = plusJours(cur, 1); }
    return out;
  }

  // ── Heures (en minutes depuis minuit : une seule unité, aucune conversion oubliée) ────────────
  function hhmmMin(h, defaut) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '').trim());
    if (!m) return defaut == null ? null : defaut;
    const v = Number(m[1]) * 60 + Number(m[2]);
    return (v >= 0 && v <= 1440) ? v : (defaut == null ? null : defaut);
  }
  function minHhmm(min) {
    const v = Math.max(0, Math.min(1440, Math.round(min)));
    return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  }
  /** « 1.5 » → « 1 h 30 ». Utilisé partout où une durée s'affiche. */
  function fmtDuree(h) {
    const n = Number(h) || 0;
    if (!n) return '';
    const heures = Math.floor(n), min = Math.round((n - heures) * 60);
    if (!heures) return min + ' min';
    return heures + ' h' + (min ? ' ' + String(min).padStart(2, '0') : '');
  }

  // ── Réglages ──────────────────────────────────────────────────────────────────────────────────
  /** Bloc `planning` des réglages, toujours complet (config.js fusionne sur les défauts). */
  function conf(reglages) {
    const r = reglages || (window.SSConf ? window.SSConf.get() : null) || {};
    return (r.planning) || {};
  }

  /** Trame d'une personne : { lun:'journee', …, dim:'non' }. Inconnue → aucune disponibilité,
   *  jamais « toujours libre » : mieux vaut un planning vide qu'un planning qui ment. */
  function trameDe(qui, reglages) {
    const c = conf(reglages);
    return (c.trame && c.trame[qui]) || {};
  }

  // ── Normalisation des acteurs ─────────────────────────────────────────────────────────────────
  /** Les techniciens d'un dépannage sont saisis en clair (« Nicolas », « Yannick », « Jean »).
   *  On ne garde que les deux identités de l'ERP : un tiers ne bloque pas leur planning. */
  function quiDeTechniciens(techs) {
    const out = [];
    (techs || []).forEach(function (t) {
      const k = String(t || '').trim().toLowerCase();
      if (k === 'nicolas' && out.indexOf('nicolas') < 0) out.push('nicolas');
      if (k === 'yannick' && out.indexOf('yannick') < 0) out.push('yannick');
    });
    return out;
  }
  function quiDeEquipe(equipe) {
    const e = String(equipe || 'nicolas');
    return EQUIPE_QUI[e] || [];
  }

  // ── Construction des événements ───────────────────────────────────────────────────────────────
  //
  // Un ÉVÉNEMENT normalisé :
  //   { id, source, date, heure, duree_h, qui[], titre, detail, ville, cp, adresse, href, ref }
  //   • `heure` vide = pas d'heure fixée (une pose se cale en début de journée).
  //   • `qui` vide = personne d'assignée → c'est justement ce qu'on veut voir signalé.

  function adresseDe(client) {
    const a = (client && client.adresse) || {};
    const rue = ((a.rue || '') + ' ' + (a.numero || '')).trim();
    const ville = ((a.code_postal || '') + ' ' + (a.ville || '')).trim();
    return {
      texte: [rue, ville].filter(Boolean).join(', '),
      ville: a.ville || '',
      cp: a.code_postal || '',
    };
  }
  function nomClient(client) {
    const c = client || {};
    return ((c.prenom || '') + ' ' + (c.nom || '')).trim() || 'Sans nom';
  }

  /** POSES : un devis signé/terminé dont la pose n'est pas faite et qui porte une date. */
  function evenementsPoses(devis, reglages) {
    const c = conf(reglages);
    const out = [];
    (devis || []).forEach(function (d) {
      if (!d || d.archive) return;
      if (String(d.type_document || '') === 'depannage') return;   // le dépannage a sa propre entrée
      if (['signe', 'termine'].indexOf(d.statut) < 0) return;
      if (SSUI.isPoseDone && SSUI.isPoseDone(d)) return;           // déjà posé : sort du planning
      const ch = d.chantier || {};
      if (!ch.date_pose) return;
      const adr = adresseDe(d.client);
      out.push({
        id: 'pose:' + d.id,
        source: 'pose',
        date: String(ch.date_pose).slice(0, 10),
        heure: String(ch.heure_pose || '').slice(0, 5),
        duree_h: Number(ch.duree_h) || Number(c.duree_pose_h) || 4,
        qui: quiDeEquipe(ch.equipe),
        titre: nomClient(d.client),
        detail: (SSUI.resumeDevis && SSUI.resumeDevis(d)) || '',
        adresse: adr.texte, ville: adr.ville, cp: adr.cp,
        href: 'vue.html?id=' + encodeURIComponent(d.id),
        ref: d.id,
        // Un devis marqué « Terminé » alors que la pose n'est pas enregistrée est incohérent :
        // l'écran doit le dire plutôt que le cacher.
        alerte: d.statut === 'termine' ? 'Marqué terminé sans pose enregistrée' : '',
      });
    });
    return out;
  }

  /** DÉPANNAGES : ils portent leur propre date, heure, durée et intervenants — et n'apparaissaient
   *  jusqu'ici dans aucun agenda, ce qui rendait tout conflit invisible. */
  function evenementsDepannages(devis, reglages) {
    const c = conf(reglages);
    const out = [];
    (devis || []).forEach(function (d) {
      if (!d || d.archive) return;
      if (String(d.type_document || '') !== 'depannage') return;
      // `depannage_plan` est la projection légère renvoyée par la LISTE ; sur un devis complet
      // (fiche ouverte) c'est `depannage` qui porte l'information. On accepte les deux.
      const p = d.depannage_plan || d.depannage || {};
      if (!p.date_intervention) return;
      // Un bon d'intervention (travaux DÉJÀ faits) est un compte rendu, pas un rendez-vous : il ne
      // doit pas occuper une case du futur. Seule une intervention à réaliser se planifie.
      if (String(d.depannage_mode || '') === 'realise' && String(p.date_intervention).slice(0, 10) < aujourdhui()) return;
      const adr = adresseDe(d.client);
      out.push({
        id: 'dep:' + d.id,
        source: 'depannage',
        date: String(p.date_intervention).slice(0, 10),
        heure: String(p.heure || '').slice(0, 5),
        duree_h: Number(p.duree_h) || Number(c.duree_depannage_h) || 2,
        qui: quiDeTechniciens(p.techniciens),
        titre: nomClient(d.client),
        detail: String(p.motif || '').slice(0, 120),
        adresse: adr.texte, ville: adr.ville, cp: adr.cp,
        href: 'vue.html?id=' + encodeURIComponent(d.id),
        ref: d.id,
        alerte: '',
      });
    });
    return out;
  }

  /** VISITES : une demande de RDV dont la visite est fixée et pas encore faite. */
  function evenementsVisites(rdvs, reglages) {
    const c = conf(reglages);
    const out = [];
    (rdvs || []).forEach(function (r) {
      if (!r || r.statut !== 'rdv_fixe' || !r.date_rdv) return;
      const adr = adresseDe(r.client);
      out.push({
        id: 'rdv:' + r.id,
        source: 'visite',
        date: String(r.date_rdv).slice(0, 10),
        heure: String(r.date_rdv).slice(11, 16),
        duree_h: Number(r.duree_h) || Number(c.duree_visite_h) || 1,
        qui: r.assigned_to ? [r.assigned_to] : [],
        titre: nomClient(r.client),
        detail: String(r.projet || '').slice(0, 120),
        adresse: adr.texte, ville: adr.ville, cp: adr.cp,
        href: 'rdv.html?open=' + encodeURIComponent(r.id),
        ref: r.id,
        alerte: r.assigned_to ? '' : 'Visite non attribuée',
      });
    });
    return out;
  }

  /** INDISPOS : les exceptions saisies à la main. Une période de plusieurs jours devient un
   *  événement PAR JOUR — la grille n'a pas à savoir qu'ils viennent de la même ligne. */
  function evenementsIndispos(dispos, bornes, reglages) {
    const c = conf(reglages);
    const hDebut = hhmmMin((c.heures || {}).debut, 8 * 60);
    const hFin = hhmmMin((c.heures || {}).fin, 17 * 60);
    const out = [];
    (dispos || []).forEach(function (x) {
      if (!x || x.kind !== 'indispo') return;   // une dispo EXCEPTIONNELLE ajoute du temps, elle n'en prend pas
      const du = String(x.du || '').slice(0, 10);
      const au = String(x.au || du).slice(0, 10);
      if (!du) return;
      const debut = bornes && bornes.du && du < bornes.du ? bornes.du : du;
      const fin = bornes && bornes.au && au > bornes.au ? bornes.au : au;
      if (debut > fin) return;
      jours(debut, fin).forEach(function (j) {
        const h1 = x.journee === false ? hhmmMin(x.debut, hDebut) : hDebut;
        const h2 = x.journee === false ? hhmmMin(x.fin, hFin) : hFin;
        out.push({
          id: 'indispo:' + x.id + ':' + j,
          source: 'indispo',
          date: j,
          heure: x.journee === false ? minHhmm(h1) : '',
          duree_h: Math.max(0, (h2 - h1) / 60),
          qui: x.qui ? [x.qui] : [],
          titre: x.motif || 'Indisponible',
          // Pas de répétition de l'horaire : les écrans affichent déjà l'heure de début et la durée,
          // on lisait « 09:00 · Médecin · 09:00 → 11:00 ».
          detail: x.journee === false ? '' : 'Toute la journée',
          adresse: '', ville: '', cp: '',
          href: '',
          ref: x.id,
          alerte: '',
        });
      });
    });
    return out;
  }

  /** Tous les événements, triés. `bornes` (facultatif) limite la fenêtre : { du, au }. */
  function construire(sources, bornes, reglages) {
    const s = sources || {};
    let evs = []
      .concat(evenementsVisites(s.rdvs, reglages))
      .concat(evenementsPoses(s.devis, reglages))
      .concat(evenementsDepannages(s.devis, reglages))
      .concat(evenementsIndispos(s.dispos, bornes, reglages));
    if (bornes && bornes.du) evs = evs.filter(function (e) { return e.date >= bornes.du; });
    if (bornes && bornes.au) evs = evs.filter(function (e) { return e.date <= bornes.au; });
    return trier(evs, reglages);
  }

  function trier(evs, reglages) {
    return evs.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return occupation(a, reglages).debut - occupation(b, reglages).debut;
    });
  }

  /** Place occupée dans la journée, en minutes. Une pose sans heure démarre au début de journée :
   *  c'est ce qui permet de comparer des rendez-vous horodatés et des chantiers qui ne le sont pas. */
  function occupation(ev, reglages) {
    const c = conf(reglages);
    const hDebut = hhmmMin((c.heures || {}).debut, 8 * 60);
    const debut = hhmmMin(ev.heure, hDebut);
    const duree = Math.max(0, Number(ev.duree_h) || 0);
    return { debut: debut, fin: Math.min(1440, debut + Math.round(duree * 60)) };
  }

  // ── Créneaux : trame, exceptions, soustraction ────────────────────────────────────────────────

  /** Blocs théoriques d'une journée pour une personne, AVANT soustraction du planning.
   *  La trame donne la forme du jour ; les dispos exceptionnelles peuvent en ouvrir un de plus. */
  function blocsTheoriques(qui, date, dispos, reglages) {
    const c = conf(reglages);
    const h = c.heures || {};
    const hDebut = hhmmMin(h.debut, 8 * 60);
    const hMidi = hhmmMin(h.midi, 12 * 60);
    const hReprise = hhmmMin(h.reprise, 13 * 60);
    const hFin = hhmmMin(h.fin, 17 * 60);
    const matin = { debut: hDebut, fin: hMidi };
    const aprem = { debut: hReprise, fin: hFin };

    const forme = trameDe(qui, reglages)[cleJour(date)] || 'non';
    let blocs = [];
    if (forme === 'journee') blocs = [matin, aprem];
    else if (forme === 'matin') blocs = [matin];
    else if (forme === 'apresmidi') blocs = [aprem];

    // Dispo EXCEPTIONNELLE : « ce samedi-là je peux ». Elle s'ajoute même si la trame dit non.
    (dispos || []).forEach(function (x) {
      if (!x || x.kind !== 'dispo' || x.qui !== qui) return;
      const du = String(x.du || '').slice(0, 10);
      const au = String(x.au || du).slice(0, 10);
      if (!du || date < du || date > au) return;
      if (x.journee === false) blocs.push({ debut: hhmmMin(x.debut, hDebut), fin: hhmmMin(x.fin, hFin) });
      else blocs = blocs.concat([matin, aprem]);
    });
    return fusionnerBlocs(blocs);
  }

  /** Réunit les blocs qui se touchent ou se chevauchent (sinon un même créneau compterait double). */
  function fusionnerBlocs(blocs) {
    const tri = (blocs || []).filter(function (b) { return b && b.fin > b.debut; })
      .sort(function (a, b) { return a.debut - b.debut; });
    const out = [];
    tri.forEach(function (b) {
      const last = out[out.length - 1];
      if (last && b.debut <= last.fin) last.fin = Math.max(last.fin, b.fin);
      else out.push({ debut: b.debut, fin: b.fin });
    });
    return out;
  }

  /** Retire `occupes` de `blocs`. C'est l'opération qui fabrique la disponibilité : on ne la
   *  saisit pas, on l'obtient en enlevant ce qui est déjà pris. */
  function soustraire(blocs, occupes) {
    let out = (blocs || []).map(function (b) { return { debut: b.debut, fin: b.fin }; });
    fusionnerBlocs(occupes).forEach(function (o) {
      const suivant = [];
      out.forEach(function (b) {
        if (o.fin <= b.debut || o.debut >= b.fin) { suivant.push(b); return; }   // aucun recouvrement
        if (o.debut > b.debut) suivant.push({ debut: b.debut, fin: o.debut });   // reste avant
        if (o.fin < b.fin) suivant.push({ debut: o.fin, fin: b.fin });           // reste après
      });
      out = suivant;
    });
    return out;
  }

  /** Créneaux réellement libres d'une personne un jour donné.
   *  @param duree_h  durée minimale utile (un trou de 20 min n'est pas un créneau de visite). */
  function libres(qui, date, evs, dispos, duree_h, reglages) {
    const theoriques = blocsTheoriques(qui, date, dispos, reglages);
    if (!theoriques.length) return [];
    const occupes = (evs || [])
      .filter(function (e) { return e.date === date && e.qui.indexOf(qui) >= 0; })
      .map(function (e) { return occupation(e, reglages); });
    const mini = Math.max(1, Math.round((Number(duree_h) || 0) * 60));
    return soustraire(theoriques, occupes).filter(function (b) { return (b.fin - b.debut) >= mini; });
  }

  /** Les prochains créneaux libres, tous jours confondus — le moteur de « quand peut-on venir ? ».
   *  @return [{ date, debut, fin, qui }] */
  function prochainsCreneaux(qui, evs, dispos, options, reglages) {
    const o = options || {};
    const duree = Number(o.duree_h) || Number(conf(reglages).duree_visite_h) || 1;
    const depuis = o.depuis || plusJours(aujourdhui(), 1);   // jamais aujourd'hui : on ne propose pas « dans 2 h »
    const horizon = Number(o.horizon_jours) || 21;
    const limite = Number(o.limite) || 3;
    const out = [];
    for (let i = 0; i < horizon && out.length < limite; i++) {
      const date = plusJours(depuis, i);
      libres(qui, date, evs, dispos, duree, reglages).forEach(function (b) {
        if (out.length >= limite) return;
        out.push({ date: date, debut: minHhmm(b.debut), fin: minHhmm(b.fin), qui: qui });
      });
    }
    return out;
  }

  // ── Conflits ──────────────────────────────────────────────────────────────────────────────────
  /** Deux événements qui se chevauchent pour la MÊME personne. C'est le garde-fou qui manquait :
   *  on pouvait caler une pose et un dépannage à la même heure sans qu'un écran ne dise rien.
   *  Deux indisponibilités qui se recouvrent ne sont pas un conflit (des congés peuvent se suivre) ;
   *  une indisponibilité qui recouvre un rendez-vous, si — c'est même le cas le plus utile. */
  function conflits(evs, reglages) {
    const out = [];
    const parCle = new Map();
    (evs || []).forEach(function (e) {
      (e.qui || []).forEach(function (q) {
        const cle = q + '|' + e.date;
        if (!parCle.has(cle)) parCle.set(cle, []);
        parCle.get(cle).push(e);
      });
    });
    parCle.forEach(function (liste, cle) {
      const parts = cle.split('|');
      for (let i = 0; i < liste.length; i++) {
        for (let j = i + 1; j < liste.length; j++) {
          const a = liste[i], b = liste[j];
          if (a.source === 'indispo' && b.source === 'indispo') continue;
          const oa = occupation(a, reglages), ob = occupation(b, reglages);
          if (oa.debut < ob.fin && ob.debut < oa.fin) {
            out.push({ qui: parts[0], date: parts[1], a: a, b: b });
          }
        }
      }
    });
    return out.sort(function (x, y) { return x.date < y.date ? -1 : (x.date > y.date ? 1 : 0); });
  }

  /** Les conflits que provoquerait un événement AVANT de l'enregistrer. `candidat` est un événement
   *  normalisé (au minimum : date, heure, duree_h, qui). `ignorerId` exclut l'événement qu'on est en
   *  train de modifier, sinon il entrerait en conflit avec lui-même. */
  function conflitsDe(candidat, evs, reglages) {
    const autres = (evs || []).filter(function (e) { return e.id !== candidat.id; });
    return conflits(autres.concat([candidat]), reglages)
      .filter(function (c) { return c.a.id === candidat.id || c.b.id === candidat.id; })
      .map(function (c) { return { qui: c.qui, date: c.date, autre: c.a.id === candidat.id ? c.b : c.a }; });
  }

  // ── Charge ────────────────────────────────────────────────────────────────────────────────────
  /** Heures occupées / heures disponibles sur une période. Le taux de remplissage dit d'un coup
   *  d'œil si une semaine peut encore accueillir un chantier. */
  function charge(qui, du, au, evs, dispos, reglages) {
    let occupe = 0, capacite = 0;
    jours(du, au).forEach(function (j) {
      blocsTheoriques(qui, j, dispos, reglages).forEach(function (b) { capacite += (b.fin - b.debut) / 60; });
      (evs || []).forEach(function (e) {
        if (e.date !== j || e.source === 'indispo' || (e.qui || []).indexOf(qui) < 0) return;
        occupe += Math.max(0, Number(e.duree_h) || 0);
      });
    });
    return {
      occupe: Math.round(occupe * 10) / 10,
      capacite: Math.round(capacite * 10) / 10,
      pct: capacite > 0 ? Math.min(999, Math.round((occupe / capacite) * 100)) : 0,
    };
  }

  // ── Chargement des données (seule fonction non pure) ──────────────────────────────────────────
  /** Va chercher devis, demandes de RDV et exceptions, et renvoie les événements construits.
   *  Chaque source tombe silencieusement à vide si elle échoue : un planning amputé reste plus
   *  utile qu'une page blanche — et la liste des devis suffit déjà à afficher les poses. */
  async function charger(bornes) {
    const SS = window.SS || {};
    const [devis, rdvs, dispos, reglages] = await Promise.all([
      SS.listDevis ? SS.listDevis().catch(function () { return []; }) : [],
      SS.listRdv ? SS.listRdv().catch(function () { return []; }) : [],
      SS.listDispos ? SS.listDispos().catch(function () { return []; }) : [],
      window.SSConf ? window.SSConf.charger().catch(function () { return null; }) : null,
    ]);
    const sources = { devis: devis || [], rdvs: rdvs || [], dispos: dispos || [] };
    return {
      sources: sources,
      reglages: reglages,
      evenements: construire(sources, bornes, reglages),
      // Le planning ne montre que ce qui a une date : les chantiers signés SANS date de pose
      // n'apparaîtraient nulle part. Ce sont pourtant eux qui demandent une décision.
      aPlanifier: (devis || []).filter(function (d) {
        return d && !d.archive && ['signe', 'termine'].indexOf(d.statut) >= 0
          && String(d.type_document || '') !== 'depannage'
          && !(d.chantier && d.chantier.date_pose)
          && !(SSUI.isPoseDone && SSUI.isPoseDone(d));
      }),
    };
  }

  window.SSPlanning = {
    JOURS: JOURS, NATURES: NATURES, FORMES_JOUR: FORMES_JOUR,
    ymd: ymd, aujourdhui: aujourdhui, dateDe: dateDe, plusJours: plusJours,
    indexJour: indexJour, cleJour: cleJour, lundiDe: lundiDe, estWeekend: estWeekend,
    ecartJours: ecartJours, jours: jours,
    hhmmMin: hhmmMin, minHhmm: minHhmm, fmtDuree: fmtDuree,
    conf: conf, trameDe: trameDe,
    quiDeEquipe: quiDeEquipe, quiDeTechniciens: quiDeTechniciens,
    construire: construire, trier: trier, occupation: occupation,
    blocsTheoriques: blocsTheoriques, fusionnerBlocs: fusionnerBlocs, soustraire: soustraire,
    libres: libres, prochainsCreneaux: prochainsCreneaux,
    conflits: conflits, conflitsDe: conflitsDe, charge: charge,
    charger: charger,
  };
})();
