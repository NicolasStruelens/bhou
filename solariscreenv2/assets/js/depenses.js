/* ═══════════════════════════════════════════════════════════════════════════════════════════
   NOTES DE FRAIS (window.SSDepenses) — l'argent que j'ai avancé pour la société.

   À QUOI SERT CE MODULE, EXACTEMENT
   Nicolas achète du matériel de chantier dans un magasin de bricolage ou chez un pro, avec son
   argent, et SolariScreen doit le lui rembourser. Le ticket finit dans une poche, la poche finit
   à la machine. Ses mots, le 10/10/2026 : « c'est une sécurité pour moi de pouvoir être
   remboursé et ne pas tomber dans l'oubli ».
   C'est donc un REGISTRE, pas un outil de comptabilité : il dit ce qui a été avancé, ce qui est
   parti au bureau, et ce qui est revenu.

   ⚠️ CET OUTIL EST VOLONTAIREMENT À PART — demandé explicitement par Nicolas.
   Il n'est lié NI aux statistiques, NI à la rémunération, NI au paiement. Un remboursement de
   matériel et une paie de pose ne sont pas la même nature d'argent : les additionner donnerait
   un chiffre que personne ne pourrait défendre en face de Yannick. Ne pas « intégrer » ce module
   à `remuneration.js` en croyant bien faire.
   Pour la même raison il ne porte ni TVA, ni catégorie, ni moyen de paiement, ni référence
   comptable : « c'est juste du remboursement matériel acheté dans des magasins de bricolage ou
   des magasins pro pour les chantiers ». La pièce officielle reste chez SysCore / Falco.

   LES TROIS ÉTATS, et c'est tout le modèle :
     à remettre   — le ticket est chez moi, personne d'autre ne sait qu'il existe ;
     au bureau    — je l'ai donné, la balle est chez Yannick ;
     remboursé    — l'argent est revenu.
   Les deux dates sont posées PAR CELUI QUI SAIT : je coche « remis » quand je dépose le ticket,
   et « remboursé » quand je vois l'argent. Aucune validation qui bloque — une file d'attente qui
   dépend de quelqu'un d'autre, c'est exactement ce qui fait tomber les choses dans l'oubli.

   Fonctions pures : elles reçoivent des dépenses, elles renvoient des nombres et des états.
   Protégé par `tests/depenses.test.html`.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  const num = function (v) { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const jour = function (v) { return String(v == null ? '' : v).slice(0, 10); };

  const GENS = ['nicolas', 'yannick'];
  const ETATS = ['a_remettre', 'au_bureau', 'rembourse'];
  const ETAT_LABEL = {
    a_remettre: 'À remettre au bureau',
    au_bureau: 'Chez le bureau',
    rembourse: 'Remboursé',
  };

  /* Les seuils au-delà desquels un ticket se met à crier. Ils ne bloquent rien : ils trient et
     ils colorent. Un ticket qui dort depuis trois semaines dans une poche est exactement le cas
     que cet outil existe pour empêcher. */
  const SEUILS = { remettre: 14, rembourser: 30 };

  /**
   * L'état d'une dépense.
   * ⚠️ « Remboursé » l'emporte sur tout : il arrive qu'on soit remboursé de la main à la main,
   * sans être jamais passé par le bureau. Exiger « remis » avant « remboursé » laisserait ces
   * tickets-là coincés dans un état faux, et c'est une ligne d'argent qu'on croirait encore due.
   */
  function etatDe(d) {
    if (!d) return 'a_remettre';
    if (jour(d.rembourse_le)) return 'rembourse';
    if (jour(d.remis_le)) return 'au_bureau';
    return 'a_remettre';
  }

  /** Tant que ce n'est pas remboursé, la société me doit cet argent. */
  function estDu(d) { return etatDe(d) !== 'rembourse'; }

  /**
   * Depuis combien de jours ce ticket attend-il ?
   * La date de référence est celle du DERNIER geste : la date d'achat tant qu'il est chez moi,
   * la date de remise une fois qu'il est au bureau. Compter depuis l'achat dans les deux cas
   * ferait passer pour urgent un ticket déposé hier.
   * ⚠️ Dates en chaînes « YYYY-MM-DD », comparées telles quelles : la comparaison
   * lexicographique EST la comparaison chronologique, et aucun fuseau ne s'en mêle (règle 18).
   */
  function ageJours(d, aujourdhui) {
    const etat = etatDe(d);
    if (etat === 'rembourse') return 0;
    const depuis = etat === 'au_bureau' ? jour(d.remis_le) : jour(d && d.date);
    const auj = jour(aujourdhui || (window.SSUI && window.SSUI.aujourdhui ? window.SSUI.aujourdhui() : ''));
    if (!depuis || !auj) return 0;
    const ms = Date.parse(auj + 'T00:00:00Z') - Date.parse(depuis + 'T00:00:00Z');
    if (!isFinite(ms)) return 0;
    return Math.max(0, Math.round(ms / 86400000));
  }

  /** Ce ticket traîne-t-il ? `null` quand tout va bien — pour que l'écran n'ait rien à décider. */
  function retard(d, aujourdhui, seuils) {
    const s = Object.assign({}, SEUILS, seuils || {});
    const etat = etatDe(d);
    if (etat === 'rembourse') return null;
    const age = ageJours(d, aujourdhui);
    const limite = etat === 'au_bureau' ? s.rembourser : s.remettre;
    return age > limite ? { etat: etat, jours: age, limite: limite } : null;
  }

  /**
   * Ce qui empêche d'enregistrer. On REFUSE plutôt que d'accepter une ligne molle : un registre
   * d'argent qui contient des montants à zéro ou des dates vides, on cesse de s'y fier — et un
   * registre dont on se méfie ne sert plus à rien.
   * @returns [{ k, l }] — vide = c'est bon.
   */
  function problemes(d) {
    const out = [];
    const x = d || {};
    if (GENS.indexOf(String(x.qui || '')) < 0) out.push({ k: 'qui', l: 'Qui a avancé l’argent' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour(x.date))) out.push({ k: 'date', l: 'Date de l’achat' });
    if (!(num(x.montant) > 0)) out.push({ k: 'montant', l: 'Montant payé' });
    /* ⚠️ Une incohérence de dates se SIGNALE. Remboursé avant d'avoir acheté, ou remis avant
       d'avoir acheté : c'est presque toujours une faute de frappe sur l'année, et elle fausse
       l'ancienneté — donc le tri, donc ce qu'on va réclamer en premier. */
    if (jour(x.remis_le) && jour(x.date) && jour(x.remis_le) < jour(x.date)) {
      out.push({ k: 'remis_le', l: 'Remis au bureau avant l’achat' });
    }
    if (jour(x.rembourse_le) && jour(x.date) && jour(x.rembourse_le) < jour(x.date)) {
      out.push({ k: 'rembourse_le', l: 'Remboursé avant l’achat' });
    }
    return out;
  }

  /** Les totaux, par état. `qui` restreint à une personne ('' = tout le monde). */
  function totaux(liste, qui) {
    const out = { a_remettre: 0, au_bureau: 0, rembourse: 0, du: 0, tout: 0, nb: 0, nb_du: 0 };
    (liste || []).forEach(function (d) {
      if (!d) return;
      if (qui && String(d.qui || '') !== qui) return;
      const m = r2(num(d.montant));
      const e = etatDe(d);
      out[e] = r2(out[e] + m);
      out.tout = r2(out.tout + m);
      out.nb++;
      if (e !== 'rembourse') { out.du = r2(out.du + m); out.nb_du++; }
    });
    return out;
  }

  /**
   * L'ordre de lecture : ce qui attend depuis le plus longtemps passe devant, et ce qui est
   * remboursé ferme la marche. C'est l'ordre dans lequel on veut REGLER les choses, pas l'ordre
   * chronologique — un registre trié par date d'achat enterre le vieux ticket au fond.
   */
  function trier(liste, aujourdhui) {
    const rang = { a_remettre: 0, au_bureau: 1, rembourse: 2 };
    return (liste || []).filter(Boolean).slice().sort(function (a, b) {
      const ea = etatDe(a), eb = etatDe(b);
      if (rang[ea] !== rang[eb]) return rang[ea] - rang[eb];
      if (ea === 'rembourse') return jour(b.rembourse_le).localeCompare(jour(a.rembourse_le));
      const da = ageJours(a, aujourdhui), db = ageJours(b, aujourdhui);
      if (da !== db) return db - da;                       // le plus vieux d'abord
      return jour(b.date).localeCompare(jour(a.date));
    });
  }

  /** Le filtre de l'écran. Une valeur vide ne filtre pas — jamais de « tous » magique à gérer. */
  function filtrer(liste, f) {
    const o = f || {};
    const q = String(o.recherche || '').trim().toLowerCase();
    return (liste || []).filter(function (d) {
      if (!d) return false;
      if (o.qui && String(d.qui || '') !== o.qui) return false;
      if (o.etat && etatDe(d) !== o.etat) return false;
      if (o.annee && jour(d.date).slice(0, 4) !== String(o.annee)) return false;
      if (!q) return true;
      const texte = [d.detail, d.client_nom, d.montant, d.date].join(' ').toLowerCase();
      return texte.indexOf(q) >= 0;
    });
  }

  /** Les années présentes dans le registre, la plus récente d'abord — pour le sélecteur. */
  function annees(liste) {
    const vues = {};
    (liste || []).forEach(function (d) { const a = jour(d && d.date).slice(0, 4); if (a) vues[a] = 1; });
    return Object.keys(vues).sort().reverse();
  }

  /** Le récapitulatif d'une année : ce que j'ai avancé, ce qui est revenu, ce qui reste. */
  function bilanAnnee(liste, qui, annee) {
    return totaux(filtrer(liste, { qui: qui, annee: annee }), '');
  }

  window.SSDepenses = {
    GENS: GENS, ETATS: ETATS, ETAT_LABEL: ETAT_LABEL, SEUILS: SEUILS,
    etatDe: etatDe, estDu: estDu, ageJours: ageJours, retard: retard,
    problemes: problemes, totaux: totaux, trier: trier, filtrer: filtrer,
    annees: annees, bilanAnnee: bilanAnnee,
  };
})();
