// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LE BANC SERVEUR DES TESTS (window.SSBanc)
// Pas du code de l'ERP : seules les suites de tests/ le chargent.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// Le VRAI fichier du serveur (`functions/api/[[catchall]].js`) branché sur une VRAIE base SQLite en
// mémoire (sql.js 1.10.3, chargé depuis cdnjs, fonctions JSON comprises), derrière un faux réseau qui
// pose l'en-tête Cloudflare Access. C'est le seul banc qui rejoue des écritures de bout en bout sans
// Cloudflare (CLAUDE.md, règle 46). Il vivait dans `bac-a-sable.test.html` ; la page SAV en a eu
// besoin à son tour (règle 47), et deux copies d'un banc finissent par ne plus tester la même chose.
//
// Usage :
//   await SSBanc.demarrer();          // sql.js + schéma + serveur
//   SSBanc.nouvelleBase(true);        // base neuve, schéma posé
//   SSBanc.installer(window);         // ce cadre (ou un autre) parle au banc au lieu du réseau
//   SSBanc.ident = 'info@solariscreen.be';   // l'identité Access des requêtes suivantes (null = aucune)
//   SSBanc.retirer();                 // rend le vrai réseau à cette page
(function () {
  'use strict';

  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  // Les chemins se résolvent depuis CE fichier, pas depuis la page qui le charge.
  const ICI = new URL('.', document.currentScript.src).href;
  const vraiFetch = window.fetch.bind(window);

  const B = {
    NICOLAS: 'nicolas.struelens@me.com', YANNICK: 'info@solariscreen.be',
    SQL: null, SERVEUR: null, SCHEMA: '', DB: null, ENV: null,
    ident: 'nicolas.struelens@me.com', appels: 0, vraiFetch: vraiFetch,
  };

  function charger(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ko(new Error('chargement ' + src));
      document.head.appendChild(s);
    });
  }

  /* La même surface que D1 (prepare/bind/first/all/run), sur sql.js. Un `undefined` lié lève une
     erreur, exactement comme D1 (« Type 'undefined' not supported ») : le banc ne doit pas être plus
     tolérant que la vraie base. */
  function d1(db) {
    const lignes = (sql, p) => { const st = db.prepare(sql); try { st.bind(p); const out = []; while (st.step()) out.push(st.getAsObject()); return out; } finally { st.free(); } };
    const stmt = (sql, p) => ({
      bind: (...a) => stmt(sql, a),
      first: async (col) => { const r = lignes(sql, p)[0] || null; return col ? (r ? r[col] : null) : r; },
      all: async () => ({ results: lignes(sql, p), success: true, meta: {} }),
      run: async () => { const st = db.prepare(sql); try { st.bind(p); while (st.step()) {} } finally { st.free(); } return { success: true, meta: { changes: db.getRowsModified() } }; },
    });
    return { prepare: (sql) => stmt(sql, []), batch: async (l) => { const o = []; for (const s of l) o.push(await s.run()); return o; } };
  }

  B.demarrer = async function () {
    if (!window.initSqlJs) await charger(CDN + 'sql-wasm.js');
    B.SQL = await window.initSqlJs({ locateFile: (f) => CDN + f });
    B.SCHEMA = await (await vraiFetch(ICI + '../schema.sql?v=' + Date.now())).text();
    B.SERVEUR = await import(ICI + '../functions/api/%5B%5Bcatchall%5D%5D.js?v=' + Date.now());
    return B;
  };
  B.nouvelleBase = function (avecSchema) {
    B.DB = new B.SQL.Database();
    if (avecSchema) B.DB.exec(B.SCHEMA);
    B.ENV = { DB: d1(B.DB) };
    return B.DB;
  };
  B.sql1 = (q) => { const r = B.DB.exec(q); return r.length ? r[0].values[0][0] : null; };
  B.sqlL = (q) => { const r = B.DB.exec(q); return r.length ? r[0].values : []; };
  /** Le blob JSON d'une ligne, relu dans la base (pas dans un cache du navigateur). */
  B.donnee = (table, cle, id) => JSON.parse(B.sql1('SELECT data FROM ' + table + ' WHERE ' + cle + " = '" + String(id).replace(/'/g, "''") + "'") || 'null');

  const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  /** Le faux réseau : /api/* part au vrai serveur avec l'identité Access du moment, le reste au vrai réseau. */
  B.fetch = async function (url, opts) {
    const u = new URL(String(url), location.href);
    if (u.origin === location.origin && u.pathname.indexOf('/api/') === 0) {
      B.appels++;
      const o = opts || {};
      const h = new Headers(o.headers || {});
      if (B.ident) h.set('Cf-Access-Jwt-Assertion', 'x.' + b64u(JSON.stringify({ email: B.ident })) + '.y');
      const req = new Request(u.href, { method: o.method || 'GET', headers: h, body: o.body });
      return B.SERVEUR.onRequest({ request: req, env: B.ENV, params: {}, waitUntil() {}, next() {} });
    }
    return vraiFetch(url, opts);
  };
  B.installer = (w) => { (w || window).fetch = B.fetch; };
  B.retirer = () => { window.fetch = vraiFetch; };

  /** Ouvre une page dans un cadre hors écran, BRANCHÉE sur le banc dès sa première requête.
   *  On ÉCRIT la page dans le cadre (document.open / write) au lieu d'y naviguer : la fenêtre reste
   *  la même, donc le `fetch` posé avant l'écriture est celui que ses scripts trouvent. L'adresse du
   *  document est remise à celle de la page AVANT l'écriture : ses liens relatifs et `?nouveau=1` se
   *  comportent comme en vrai.
   *  ⚠️ PAS l'historique : un document écrit n'a pas d'entrée à lui, et « retour » y change l'état
   *  sans déclencher `popstate`. Pour tester « retour », ouvrir la page par une VRAIE navigation.
   *  ⚠️ Deux essais écartés le 27/10/2026, et pourquoi :
   *  - régler le `fetch` du cadre vide puis naviguer : Chrome donne au document une fenêtre NEUVE ;
   *  - naviguer et GUETTER le nouveau document par minuterie : juste quand on regarde, mais quand le
   *    panneau du navigateur est masqué, ses minuteries sont ralenties à une par seconde et la page
   *    avait déjà fait ses requêtes au vrai réseau (retombée sur le cache, test faux une fois sur deux).
   *  `cadre.branche` le confirme, et le test qui le lit échoue si ça n'a pas pris. */
  B.cadre = async function (url, largeur, hauteur) {
    const adresse = new URL(url, location.href).href;
    const html = await (await vraiFetch(adresse, { cache: 'no-store' })).text();
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:-10000px;top:0;border:0;';
    f.width = largeur || 1500; f.height = hauteur || 900;
    document.body.appendChild(f);
    const w = f.contentWindow, doc = f.contentDocument;
    const charge = new Promise((r) => f.addEventListener('load', r, { once: true }));
    doc.open();
    w.history.replaceState(null, '', adresse);
    w.fetch = B.fetch;
    doc.write(html);
    doc.close();
    await charge;
    f.branche = f.contentWindow.fetch === B.fetch && f.contentWindow.location.href === adresse;
    return f;
  };

  // Les caches locaux qu'api.js écrit : sauvés au chargement, rendus tels quels à la fin (même
  // origine que les autres tests et que l'ERP ouvert dans un autre onglet).
  B.CLES = ['ss_devis_cache', 'ss_clients_cache', 'ss_factures_cache', 'ss_rdv_cache', 'ss_dispos_cache', 'ss_sujets_cache', 'ss_outbox', 'ss_identite'];
  const SAUVE = {};
  B.CLES.forEach((k) => { try { SAUVE[k] = localStorage.getItem(k); } catch (e) {} });
  B.remettre = () => B.CLES.forEach((k) => { try { if (SAUVE[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, SAUVE[k]); } catch (e) {} });
  B.viderCaches = () => B.CLES.forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });

  window.SSBanc = B;
})();
