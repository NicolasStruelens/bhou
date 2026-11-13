// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — L'HORLOGE DU SERVEUR (et de l'écran : `SSHorloge.ecran`) DANS LES TESTS (window.SSHorloge)
// Pas du code de l'ERP : seules les suites de tests/ le chargent.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// Le serveur (`functions/api/[[catchall]].js`) tourne sur Cloudflare, EN UTC. Les suites le font tourner dans la page, à
// l'heure de la machine — belge chez Nicolas. Deux défauts s'y cachaient (règle 18, 13/11/2026) :
//   • un « aujourd'hui » coupé en UTC (`toISOString().slice(0, 10)`) ne rend la veille qu'ENTRE MINUIT ET 1 H / 2 H : un test
//     joué de jour ne le voit jamais ;
//   • `getFullYear()`, `getDate()`… lisent l'heure LOCALE : dans un navigateur réglé sur Bruxelles, ils ont l'air justes, et
//     sur Cloudflare ils rendent l'UTC (une facture du 1er janvier à 0 h 30 numérotée dans l'année close).
// `SSHorloge.serveur(instant, fn)` joue `fn` avec une `Date` FIGÉE à cet instant et dont l'heure locale EST l'UTC, comme sur
// Cloudflare ; la vraie horloge revient ensuite, même en cas d'erreur. Elle remplace `window.Date` de CETTE fenêtre : le
// serveur du banc y vit, alors que les cadres (`SSBanc.cadre`) gardent leur propre horloge. Donner l'instant en UTC explicite
// (« 2026-11-16T23:30:00Z » = le 17 à 0 h 30 heure belge, en hiver) : le cas se joue à toute heure, sur n'importe quelle machine.
// ⚠️ Le temps de `fn`, tout le code de la fenêtre lit cette horloge : calculer ce qu'on attend AVANT ou APRÈS, pas dedans.
// ⚠️ `Intl` et `toLocale…` sans fuseau restent ceux de la machine (UTC sur Cloudflare) : le serveur NOMME toujours son fuseau.
(function () {
  'use strict';

  // Getters et setters LOCAUX → leur version UTC : c'est tout ce qui distingue Cloudflare d'un navigateur belge.
  const EN_UTC = ['FullYear', 'Month', 'Date', 'Day', 'Hours', 'Minutes', 'Seconds', 'Milliseconds'];

  function fabriquer(Base, t) {
    function DateServeur(...a) {
      if (!new.target) return new DateServeur().toString();
      let d;
      if (a.length === 0) d = new Base(t);
      // Une chaîne d'heure SANS fuseau (« 2026-11-17T00:30 ») se lit en UTC sur Cloudflare, en heure locale ici.
      else if (a.length === 1 && typeof a[0] === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(a[0])) d = new Base(a[0] + 'Z');
      else if (a.length === 1) d = new Base(a[0]);
      else d = new Base(Base.UTC(...a));   // new Date(a, m, j, …) : composantes UTC sur le serveur
      Object.setPrototypeOf(d, DateServeur.prototype);
      return d;
    }
    const P = Base.prototype;
    DateServeur.prototype = Object.create(P, { constructor: { value: DateServeur, writable: true, configurable: true } });
    EN_UTC.forEach((k) => {
      DateServeur.prototype['get' + k] = function () { return P['getUTC' + k].call(this); };
      if (k !== 'Day') DateServeur.prototype['set' + k] = function (...x) { return P['setUTC' + k].apply(this, x); };
    });
    DateServeur.prototype.getTimezoneOffset = function () { return 0; };
    DateServeur.prototype.toString = function () { return P.toUTCString.call(this); };
    DateServeur.now = () => t;
    DateServeur.parse = (s) => new DateServeur(s).getTime();
    DateServeur.UTC = Base.UTC;
    return DateServeur;
  }

  window.SSHorloge = {
    /** Joue `fn` (synchrone ou non) avec le serveur à `instant`, en UTC comme sur Cloudflare. Rend son résultat. */
    async serveur(instant, fn) {
      const avant = window.Date;
      const t = new avant(instant).getTime();
      if (isNaN(t)) throw new Error('SSHorloge.serveur : instant illisible (' + instant + ')');
      window.Date = fabriquer(avant, t);
      try { return await fn(); } finally { window.Date = avant; }
    },
    /** L'ÉCRAN, lui, tourne dans le navigateur, à l'heure LOCALE (belge chez Nicolas et Yannick ; les relevés sous horloge
     *  simulée règlent le fuseau sur Europe/Brussels). `ecran(instant, fn, fenetre)` joue `fn` avec `new Date()` et
     *  `Date.now()` de `fenetre` (cette page par défaut, ou le contentWindow d'un cadre) FIGÉS à `instant` ; le fuseau reste
     *  celui du navigateur. Synchrone ou non, la vraie horloge revient ensuite, même en cas d'erreur. Donner l'instant en
     *  composantes LOCALES (`new Date(2026, 10, 17, 0, 30)`) : le cas dit la même chose sur toute machine, et ne PROUVE
     *  quelque chose (la veille en UTC) que sur un navigateur à l'est de Greenwich — c'est le cas de l'ERP. Règle 18. */
    ecran(instant, fn, fenetre) {
      const W = fenetre || window, V = W.Date;
      const t = new V(instant).getTime();
      if (isNaN(t)) throw new Error('SSHorloge.ecran : instant illisible (' + instant + ')');
      function DateEcran(...a) { if (!new.target) return new V(t).toString(); return a.length ? new V(...a) : new V(t); }
      DateEcran.prototype = V.prototype; DateEcran.now = () => t; DateEcran.parse = V.parse; DateEcran.UTC = V.UTC;
      W.Date = DateEcran;
      let r;
      try { r = fn(); } catch (e) { W.Date = V; throw e; }
      if (r && typeof r.then === 'function') return r.finally(() => { W.Date = V; });
      W.Date = V;
      return r;
    },
    /** Un INSTANT écrit par l'ERP (`toISOString()`) à l'heure LOCALE donnée : `SSHorloge.instantLocal(2026, 11, 17, 0, 30)`
     *  = « 2026-11-16T23:30:00.000Z » sur un navigateur belge en hiver. Le mois se donne de 1 à 12. */
    instantLocal(a, m, j, h, mi) { return new window.Date(a, m - 1, j, h || 0, mi || 0).toISOString(); },
    /** Les quatre nuits de la règle 18, en UTC explicite : 0 h 30 et 23 h 30 heure belge, en hiver (UTC+1) et en été (UTC+2).
     *  `jour` = le jour BELGE à cet instant, celui que le serveur doit écrire ou comparer. */
    NUITS: [
      { nom: 'hiver 0 h 30', instant: '2026-11-16T23:30:00Z', jour: '2026-11-17' },
      { nom: 'hiver 23 h 30', instant: '2026-11-17T22:30:00Z', jour: '2026-11-17' },
      { nom: 'été 0 h 30', instant: '2027-04-15T22:30:00Z', jour: '2027-04-16' },
      { nom: 'été 23 h 30', instant: '2027-04-16T21:30:00Z', jour: '2027-04-16' },
    ],
    /** Le jour qui suit (ou précède) une date nue, compté en jours de calendrier (règle 18), jamais en 24 h. */
    plusJours(jour, n) {
      const x = new window.Date(jour + 'T12:00:00Z');
      x.setUTCDate(x.getUTCDate() + n);
      return x.toISOString().slice(0, 10);
    },
  };
})();
