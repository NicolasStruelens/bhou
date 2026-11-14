// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LES OUTILS DE L'AUDIT (window.SSAudit)
// Pas du code de l'ERP : seules `tests/audit.html` et `tests/audit-clics.html` le chargent.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// `ouvrir`  : une page de l'ERP ÉCRITE dans un cadre branché sur le banc (comme SSBanc.cadre), avec ses
//             témoins posés AVANT le premier script — erreurs, rejets, console.error, requêtes refusées,
//             fichiers introuvables, boîtes de dialogue, fenêtres ouvertes, téléchargements, impressions.
// `poser`   : attendre que la page se pose (plus aucune requête au banc).
// `relever` : ce qui ne va pas À L'ÉCRAN, mesuré dans la page (débordements, coupures, chevauchements,
//             fenêtres dont on ne sort pas, « undefined » affiché, gestionnaires qui ne compilent pas…).
// `existe`  : une page ou un fichier existe-t-il au serveur de test (qui répond 404) ?
(function () {
  'use strict';
  const BANC = () => window.SSBanc;
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  /* EN VRAI (`opts.reel`, sur un aperçu Cloudflare) : pas de banc, la page parle à la vraie API — la
     base d'ESSAI de l'aperçu (règle 46) — et l'audit ne fait que REGARDER. Les requêtes se comptent
     ici, dans les deux cas, pour savoir quand la page s'est posée. */
  const A = { appels: 0, reel: false };

  /**
   * @param opts.gardes  pour le robot qui clique : rien ne doit quitter le cadre ni ouvrir une boîte du
   *                     SYSTÈME (choix de fichier, impression, plein écran, position, partage, téléchargement,
   *                     « Quitter la page ? ») — l'onglet de l'audit en resterait bloqué.
   */
  async function ouvrir(url, largeur, hauteur, opts) {
    const o = opts || {};
    A.reel = !!o.reel;
    const adresse = new URL(url, location.href).href;
    const reseau = o.reel ? window.fetch.bind(window) : BANC().vraiFetch;
    const html = await (await reseau(adresse.replace(/#.*$/, ''), { cache: 'no-store' })).text();
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:-10000px;top:0;border:0;';
    f.width = largeur; f.height = hauteur;
    document.body.appendChild(f);
    const w = f.contentWindow, doc = f.contentDocument;
    const t = { erreurs: [], api: [], fichiers: [], alertes: [], ouvertes: [], systeme: [] };
    f.temoins = t;
    const charge = new Promise((r) => f.addEventListener('load', r, { once: true }));
    // ⚠️ Après `document.open()` et pas avant : l'ouverture efface les écouteurs de la fenêtre.
    doc.open();
    w.history.replaceState(null, '', adresse);
    const api = o.reel ? w.fetch.bind(w) : BANC().fetch;
    w.fetch = async function (u, op) {
      A.appels++;
      const r = await api(u, op);
      try {
        const p = new URL(String(u), adresse);
        if (r.status >= 400) t.api.push(((op && op.method) || 'GET') + ' ' + p.pathname + p.search + ' → ' + r.status);
      } catch (e) {}
      return r;
    };
    w.onerror = (m, src, l) => { t.erreurs.push(String(m) + (src ? ' @' + String(src).replace(/^.*\//, '') + ':' + l : '')); };
    w.addEventListener('unhandledrejection', (e) => { t.erreurs.push('Promesse rejetée : ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });
    w.addEventListener('error', (e) => {
      const el = e.target;
      if (el && el !== w && el.tagName) t.fichiers.push(el.tagName + ' ' + (el.src || el.href || ''));
    }, true);
    const ce = w.console.error.bind(w.console);
    w.console.error = function () { t.erreurs.push('console.error : ' + [].map.call(arguments, (a) => (a && a.stack) || String(a)).join(' ').slice(0, 300)); ce.apply(null, arguments); };
    w.alert = (m) => { t.alertes.push('alert : ' + String(m).slice(0, 160)); };
    w.confirm = (m) => { t.alertes.push('confirm : ' + String(m).slice(0, 160)); return o.confirmer !== undefined ? o.confirmer : false; };
    w.prompt = (m) => { t.alertes.push('prompt : ' + String(m).slice(0, 160)); return null; };
    w.open = (u) => { t.ouvertes.push(String(u)); return null; };
    if (o.gardes) {
      w.print = () => { t.systeme.push('impression'); };
      w.HTMLInputElement.prototype.click = function () { if (this.type === 'file') t.systeme.push('choix de fichier'); else w.HTMLElement.prototype.click.call(this); };
      w.HTMLInputElement.prototype.showPicker = function () { t.systeme.push('sélecteur ' + this.type); };
      w.HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download') || /^blob:|^data:/.test(this.href)) { t.systeme.push('téléchargement ' + (this.getAttribute('download') || '')); return; }
        w.HTMLElement.prototype.click.call(this);
      };
      w.Element.prototype.requestFullscreen = function () { t.systeme.push('plein écran'); return Promise.resolve(); };
      try { Object.defineProperty(w.navigator, 'share', { value: () => { t.systeme.push('partage'); return Promise.resolve(); }, configurable: true }); } catch (e) {}
      try {
        Object.defineProperty(w.navigator, 'geolocation', { value: {
          getCurrentPosition: (ok, ko) => { t.systeme.push('position'); if (ko) setTimeout(() => ko({ code: 1, message: 'refusé (audit)' }), 0); },
          watchPosition: () => 0, clearWatch() {} }, configurable: true });
      } catch (e) {}
      // « Quitter la page ? » : jamais dans un audit.
      const ael = w.addEventListener.bind(w);
      w.addEventListener = function (type, fn, op) { if (type === 'beforeunload') return; return ael(type, fn, op); };
      try { Object.defineProperty(w, 'onbeforeunload', { set() {}, get() { return null; }, configurable: true }); } catch (e) {}
    }
    /* L'ENCOCHE D'UN IPHONE (règle 61) : lancée depuis l'écran d'accueil, une page en `viewport-fit=cover` passe SOUS
       l'heure (59 px) et la barre de gestes (34 px). Un cadre n'a pas d'encoche : on la simule par les jetons
       `--encoche-*` (tokens.css) — toute barre qui s'en écarte par eux s'en écarte ici ; celle qui l'ignore se
       retrouve dessous, et `relever` le dit. Seulement sur les pages qui s'étendent sous l'encoche : le lien
       client (`devis-review`, `track`) s'ouvre dans Safari, sous la barre d'état et jamais derrière.
       ⚠️ Posée dans le HTML, AVANT le premier script, comme sur un vrai téléphone où elle existe dès le premier rendu :
       posée après coup, nav.js avait déjà mesuré le bandeau (et un cadre hors écran ne prévient pas son
       ResizeObserver) — 54 faux « sous le bandeau » au premier essai. `html:root` bat le `:root` de tokens.css. */
    let page = html;
    if (o.encoche && /<meta[^>]+name=["']viewport["'][^>]*viewport-fit\s*=\s*cover/i.test(html)) {
      page = html.replace(/<head[^>]*>/i, (m) => m + '<style>html:root{--encoche-haut:' + o.encoche.haut + 'px;--encoche-bas:' + o.encoche.bas + 'px}</style>');
      f.encoche = o.encoche;
    }
    doc.write(page);
    doc.close();
    await charge;
    f.doc = doc;
    if (o.gardes) {
      // Un lien qui quitte la page (ou appelle, écrit, ouvre un onglet) : noté, jamais suivi.
      w.document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        const h = a.getAttribute('href') || '';
        if (h === '#' || h.indexOf('javascript:') === 0) return;
        if (h.charAt(0) === '#') return;
        e.preventDefault();
        t.liensSuivis = (t.liensSuivis || []).concat([a.href]);
      }, true);
    }
    return f;
  }

  /** Attendre que la page se pose : plus aucune requête au banc depuis `calme` ms (au plus `max` ms). */
  async function poser(f, calmeMs, maxMs) {
    const calmeV = calmeMs || 500, max = maxMs || 8000;
    const t0 = Date.now(); let n = A.appels, calme = Date.now();
    await attendre(Math.min(400, calmeV));
    while (Date.now() - t0 < max) {
      await attendre(100);
      if (A.appels !== n) { n = A.appels; calme = Date.now(); }
      else if (Date.now() - calme > calmeV) break;
    }
    try { await f.contentDocument.fonts.ready; } catch (e) {}
    await attendre(120);
  }

  const EXISTE = new Map();
  /** L'existence d'une page ou d'un fichier, demandée UNE fois au serveur de test (qui répond 404). */
  function existe(href) {
    const u = new URL(href, location.href);
    // En vrai, Cloudflare Pages ne répond PAS 404 sur une adresse inexistante (CLAUDE.md, règle 46) :
    // on ne peut pas y vérifier un lien. Les liens se vérifient au serveur de test.
    if (u.origin !== location.origin || A.reel) return Promise.resolve(true);
    const p = u.pathname;
    if (!EXISTE.has(p)) EXISTE.set(p, BANC().vraiFetch(p, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false));
    return EXISTE.get(p);
  }

  /** Ce qu'on relève DANS la page (exécuté sur le document du cadre). */
  function relever(w) {
    const d = w.document, W = w.innerWidth, H = w.innerHeight, out = [];
    // Une page qui part ailleurs au moment de la relève n'a plus de <body> : rien à relever (deux « audit interrompu » le 11/11/2026).
    if (!d || !d.body) return { defauts: [], liens: [], calques: 0 };
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      // ⚠️ Le contenu d'un <details> FERMÉ garde une boîte (Chrome le masque par « content-visibility ») :
      // sans ce test, les champs d'une section repliée « se chevauchaient » avec ceux de la suivante.
      if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
      const s = w.getComputedStyle(e);
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const nom = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 3).join('.') : ''));
    const chemin = (e) => { const p = []; let x = e; for (let i = 0; x && x !== d.body && i < 3; i++) { p.unshift(nom(x)); x = x.parentElement; } return p.join(' > '); };
    const texte = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    // Un ancêtre qui défile dans ce sens : ce qui dépasse y est atteignable.
    const defile = (e, axe) => { for (let x = e.parentElement; x && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); const o = axe === 'x' ? s.overflowX : s.overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
    // Un ancêtre rangé hors écran (volet replié, tiroir) : ce n'est pas un débordement.
    const fixeHors = (e) => { for (let x = e; x && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); if ((s.position === 'fixed' || s.position === 'absolute') && x.getBoundingClientRect().left >= W - 1) return true; if (s.transform && s.transform !== 'none' && x.getBoundingClientRect().right <= 1) return true; } return false; };
    // Une boîte qui ROGNE (overflow hidden / clip) et finit dans l'écran : ce qui la dépasse est coupé par ELLE, pas par
    // le bord de l'écran — les tuiles d'une carte Leaflet dépassent exprès leur cadre (relevées à tort le 01/11/2026).
    // ⚠️ Jamais le <body> (11/11/2026) : son `overflow-x: hidden` (base.css) est celui de la FENÊTRE — ce qu'il coupe est coupé
    // par le bord de l'écran, c'est exactement ce qu'on cherche. Compté comme une boîte, il rendait ce contrôle muet.
    const rogneDedans = (e) => { for (let x = e.parentElement; x && x !== d.body && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && x.getBoundingClientRect().right <= W + 1) return true; } return false; };
    const rogneDedansG = (e) => { for (let x = e.parentElement; x && x !== d.body && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && x.getBoundingClientRect().left >= -1) return true; } return false; };
    // Un décor (filigrane, toile de fête) : posé exprès par-dessus ou au-delà, il ne se clique pas.
    // ⚠️ Le décor, PAS SON HÔTE (14/11/2026) : « \bfiligrane » attrapait aussi `.filigrane-hote`, la section qui PORTE le filigrane
    // du tableau de bord — c'est-à-dire toute la liste des devis. Elle échappait depuis toujours aux contrôles « coupé au bord »,
    // « rogné » et à la commande posée sur du texte (le ⋯ sur le nom du client, règle 40 bis). On lit les classes une à une.
    const decor = (e) => { for (let x = e; x && x !== d.body; x = x.parentElement) { if (x.getAttribute('aria-hidden') === 'true' || [...(x.classList || [])].some((c) => /^(watermark|ssfete|filigrane)/.test(c) && !/-hote$/.test(c))) return true; } return false; };

    // 1. La page déborde de côté.
    const sw = Math.max(d.documentElement.scrollWidth, d.body ? d.body.scrollWidth : 0);
    if (sw > W + 1) {
      // Le relevé NOMME ce qui dépasse (hors boîte qui rogne, hors calque fixe) : « 400 px pour 390 » seul a demandé
      // une demi-heure de recherche le 01/11/2026.
      const enFixe = (e) => { for (let x = e; x && x !== d.documentElement; x = x.parentElement) if (w.getComputedStyle(x).position === 'fixed') return true; return false; };
      const qui = [...d.body.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > W + 1 && e.getBoundingClientRect().width > 0 && !rogneDedans(e) && !enFixe(e))
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      out.push(['débordement', 'la page fait ' + sw + ' px de large pour ' + W + (qui ? ' — ' + chemin(qui) + ' finit à ' + Math.round(qui.getBoundingClientRect().right) + ' px' : '')]);
    }

    const tous = [...d.body.querySelectorAll('*')].filter((e) => !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|BR|OPTION)$/.test(e.tagName));
    const visibles = tous.filter(vis);
    for (const e of visibles) {
      const r = e.getBoundingClientRect(), s = w.getComputedStyle(e);
      // 2. Coupé au bord droit de l'écran (en partie dedans, en partie dehors), sans ancêtre qui défile.
      if (r.right > W + 1 && r.left < W - 1 && r.width < W * 3 && !defile(e, 'x') && !fixeHors(e) && s.position !== 'fixed' && !decor(e) && !rogneDedans(e))
        out.push(['coupé au bord', chemin(e) + ' : ' + Math.round(r.left) + '→' + Math.round(r.right) + ' px « ' + texte(e) + ' »']);
      // 2 bis. Coupé au bord GAUCHE (11/11/2026, règle 61) : le volet du menu s'ouvrait aligné sur un bouton passé à
      //    gauche de l'écran. Ce qui sort à gauche d'une page ne se rattrape JAMAIS en faisant défiler. Seul le bord droit
      //    était regardé. (Un volet rangé hors écran par `transform` finit avant 1 px : il n'est pas compté.)
      //    Comme à droite, une boîte qui ROGNE et commence dans l'écran coupe elle-même ce qui la dépasse (le calque SVG d'une
      //    carte Leaflet déborde de sa carte exprès : six faux relevés au premier passage du robot).
      else if (r.left < -1 && r.right > 1 && r.width < W * 3 && !defile(e, 'x') && !fixeHors(e) && !decor(e) && !rogneDedansG(e))
        out.push(['coupé au bord', chemin(e) + ' : ' + Math.round(r.left) + '→' + Math.round(r.right) + ' px, à gauche de l’écran « ' + texte(e) + ' »']);
      // 3. Du TEXTE rogné par sa boîte : un descendant dans le flux (pas un décor, pas un absolu) qui
      //    dépasse, alors que la boîte ne défile pas et n'a pas de points de suspension.
      const ox = s.overflowX;
      // (Une boîte de 1 px est le libellé réservé aux lecteurs d'écran, `.sr-only` : rognée exprès.)
      if ((ox === 'hidden' || ox === 'clip') && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 4 && s.textOverflow !== 'ellipsis' && e.children.length < 60) {
        const bord = r.right - (parseFloat(s.borderRightWidth) || 0);
        // Un descendant qui défile lui-même (un tableau large dans sa boîte à défilement) rogne son propre
        // contenu : ce n'est pas la boîte auditée qui le coupe.
        const dansUnDefilant = (x) => { for (let y = x.parentElement; y && y !== e; y = y.parentElement) { const o = w.getComputedStyle(y).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
        const fautif = [e, ...e.querySelectorAll('*')].find((x) => {
          if (decor(x)) return false;
          if (x !== e && dansUnDefilant(x)) return false;
          const sx = w.getComputedStyle(x);
          if (x !== e && (sx.position === 'absolute' || sx.position === 'fixed')) return false;
          return [...x.childNodes].some((n) => {
            if (n.nodeType !== 3 || !n.textContent.trim()) return false;
            const rg = d.createRange(); rg.selectNodeContents(n);
            return [...rg.getClientRects()].some((q) => q.right > bord + 2 && q.left < bord);
          });
        });
        if (fautif) out.push(['rogné', chemin(e) + ' : contenu ' + e.scrollWidth + ' px dans ' + e.clientWidth + ' « ' + texte(fautif) + ' »']);
      }
      // 4. Points de suspension sur une boîte écrasée (le nom à 8 px).
      if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && r.width < 40 && texte(e).length > 3)
        out.push(['écrasé', chemin(e) + ' : ' + Math.round(r.width) + ' px pour « ' + texte(e) + ' »']);
      // 5. Texte cassé lettre par lettre.
      const propre = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (propre.length > 6 && r.width < 30 && r.height > 3 * (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3))
        out.push(['lettre par lettre', chemin(e) + ' : ' + Math.round(r.width) + ' × ' + Math.round(r.height) + ' px « ' + propre.slice(0, 30) + ' »']);
    }

    // 6. Ce qui ne devrait jamais s'afficher.
    const corps = d.body.innerText || '';
    const re = /(\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\bnull\b|\$\{)/g;
    let m; const vus = new Set();
    while ((m = re.exec(corps)) && vus.size < 6) {
      const ctx = corps.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, ' ');
      if (!vus.has(ctx)) { vus.add(ctx); out.push(['texte suspect', '« ' + ctx + ' »']); }
    }

    // 7. Les gestionnaires générés qui ne compilent pas (CLAUDE.md, « vérifier » n° 2).
    for (const e of d.querySelectorAll('*')) for (const a of e.attributes) {
      if (a.name.indexOf('on') === 0 && a.name.length > 2) { try { new w.Function(a.value); } catch (err) { out.push(['gestionnaire', nom(e) + ' ' + a.name + ' : ' + err.message + ' — ' + a.value.slice(0, 90)]); } }
    }

    // 8. Les fenêtres ouvertes (un calque fixe qui couvre l'écran) : elles tiennent dans l'écran, elles
    //    défilent si elles sont plus hautes, et on peut en SORTIR — « pas d'emprisonnement dans un menu ».
    const racineFixe = (e) => { for (let x = e; x && x !== d.documentElement; x = x.parentElement) if (w.getComputedStyle(x).position === 'fixed') return x; return null; };
    // Le CALQUE d'un élément : une barre fixe, ou un menu déroulant posé par-dessus la page (absolu, au-dessus
    // du contenu). Un menu ouvert recouvre la page EXPRÈS : on ne compare un élément qu'à ceux de son calque.
    // ⚠️ Un élément COLLANT (`sticky`) est un calque lui aussi (08/11/2026, en-tête de la fiche du simulateur, règle 60 bis) :
    // le contenu qui défile SOUS lui le croise exprès, comme sous le bandeau fixe. Ses éléments restent comparés entre eux.
    const calqueDe = (e) => { for (let x = e; x && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); if (s.position === 'fixed' || s.position === 'sticky' || (s.position === 'absolute' && (parseInt(s.zIndex, 10) || 0) >= 5)) return x; } return null; };
    const calque = (x) => { const r = x.getBoundingClientRect(); return r.width >= W * 0.85 && r.height >= H * 0.85; };
    const calques = visibles.filter((e) => w.getComputedStyle(e).position === 'fixed' && calque(e) && e.querySelector('button, a[href], input, select, textarea'));
    for (const c of calques) {
      const boite = [...c.querySelectorAll('*')].filter(vis).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })
        .find((x) => { const r = x.getBoundingClientRect(); return r.width < W * 0.999 || r.height < H * 0.999; }) || c;
      const rb = boite.getBoundingClientRect();
      if (rb.left < -1 || rb.right > W + 1) out.push(['fenêtre trop large', nom(c) + ' > ' + nom(boite) + ' : ' + Math.round(rb.left) + '→' + Math.round(rb.right) + ' px pour ' + W]);
      const tropHaute = [c, ...c.querySelectorAll('*')].some((x) => x.getBoundingClientRect().bottom > H + 2 && vis(x));
      const defileQuelqueChose = [c, ...c.querySelectorAll('*')].some((x) => { const s = w.getComputedStyle(x); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && x.scrollHeight > x.clientHeight + 1; });
      if (tropHaute && !defileQuelqueChose) out.push(['fenêtre sans défilement', nom(c) + ' : le bas de la fenêtre est sous l’écran et rien ne défile']);
      const sortie = [...c.querySelectorAll('button, a[href], [role=button]')].filter(vis).some((x) => /fermer|annuler|✕|×|close|retour|terminé|quitter|ok\b/i.test(((x.innerText || '') + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || ''))));
      if (!sortie) out.push(['fenêtre sans sortie', nom(c) + ' : aucun bouton visible pour fermer']);
    }

    // 9. Les commandes : sans nom, ou qui se chevauchent.
    let cmd = visibles.filter((e) => e.matches('a[href], button, input:not([type=hidden]), select, textarea, [onclick], [role=button]'));
    // Une fenêtre ouverte : la page derrière est couverte exprès, on ne compare que ce qui est dans la fenêtre.
    if (calques.length) cmd = cmd.filter((e) => calques.some((c) => c.contains(e)));
    for (const e of cmd) {
      if (e.matches('button, a[href], [role=button]')) {
        const n = (e.innerText || e.textContent || '').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || (e.querySelector('img[alt]') || {}).alt || (e.querySelector('svg title') || {}).textContent || '';
        if (!String(n).trim()) out.push(['sans nom', chemin(e) + ' — ' + e.outerHTML.slice(0, 140)]);
      }
    }
    // Les boîtes LIGNE PAR LIGNE (un lien qui passe à la ligne a une boîte englobante large de toute la
    // colonne), rognées par les ancêtres qui rognent : un champ défilé hors du corps d'une fenêtre est caché
    // par ce corps, il ne passe pas « sous » le pied.
    const rogner = (e, r) => {
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (let x = e.parentElement; x && x !== d.documentElement; x = x.parentElement) {
        const s = w.getComputedStyle(x);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const c = x.getBoundingClientRect();
          if (s.overflowX !== 'visible') { x0 = Math.max(x0, c.left); x1 = Math.min(x1, c.right); }
          if (s.overflowY !== 'visible') { y0 = Math.max(y0, c.top); y1 = Math.min(y1, c.bottom); }
        }
        if (s.position === 'fixed') break;
      }
      return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
    };
    const boites = cmd.filter((e) => !cmd.some((x) => x !== e && x.contains(e)))
      .map((e) => [e, [...e.getClientRects()].map((r) => rogner(e, r)).filter((r) => r.width > 0 && r.height > 0), calqueDe(e)]);
    for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
      const [a, la, fa] = boites[i], [b, lb, fb] = boites[j];
      if (a.contains(b) || b.contains(a)) continue;
      // Deux calques différents : seulement deux BARRES fixes (une barre du bas sur le rail, par exemple) ;
      // le contenu qui passe sous le bandeau en défilant, c'est normal.
      if (fa !== fb && (!fa || !fb)) continue;
      if (fa !== fb && (w.getComputedStyle(fa).position !== 'fixed' || w.getComputedStyle(fb).position !== 'fixed')) continue;   // un menu ouvert recouvre exprès
      // Un bouton posé DANS son champ (copier, effacer), ou SUR la vignette voisine (le simulateur dans l'angle
      // d'une photo de la fiche devis) : un recouvrement voulu. Seulement entre frères d'un même conteneur, et
      // seulement si c'est le bouton qui est en absolu — deux éléments du flux qui se recouvrent restent un défaut.
      const abs = (x) => w.getComputedStyle(x).position === 'absolute';
      const champ = (x) => x.matches('input, textarea, select') || (x.matches('button') && !abs(x));
      const posé = (x, y) => champ(x) && y.matches('button') && abs(y) && x.parentElement === y.parentElement;
      if (posé(a, b) || posé(b, a)) continue;
      let pire = null;
      for (const ra of la) for (const rb of lb) {
        const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ix > 3 && iy > 3 && (!pire || ix * iy > pire[0] * pire[1])) pire = [ix, iy, Math.max(ra.left, rb.left) + ix / 2, Math.max(ra.top, rb.top) + iy / 2];
      }
      // Un menu déroulant OUVERT (`.status-menu`) recouvre exprès ce qui est dessous — la fenêtre de Soli comprise :
      // il se referme au clic suivant (audit du 01/11/2026). Seulement s'il est bien DESSUS, là où ils se touchent :
      // un menu passé SOUS une fenêtre, lui, serait un piège.
      const menu = fa !== fb && [fa, fb].find((x) => x && x.classList.contains('status-menu'));
      if (pire && menu) { const t = d.elementFromPoint(pire[2], pire[3]); if (t && menu.contains(t)) continue; }
      if (pire) out.push(['chevauchement', chemin(a) + ' « ' + texte(a) + ' » ✕ ' + chemin(b) + ' « ' + texte(b) + ' » (' + Math.round(pire[0]) + '×' + Math.round(pire[1]) + ' px)']);
    }

    // 9 bis. Une commande posée sur du TEXTE (14/11/2026, règle 40 bis). Au téléphone, le « ⋯ » d'une ligne de devis s'écrivait
    //    sur la fin du nom du client (« Brigitte Essai-Waut… ») et l'audit disait 0 : le contrôle 9 ne compare que des commandes
    //    ENTRE ELLES, et le nom est du texte. Chaque commande visible est donc comparée aux morceaux de texte de la page — leurs
    //    boîtes LIGNE PAR LIGNE (`Range`), rognées par leur propre boîte et ses ancêtres (un nom en points de suspension ne
    //    s'étend pas au-delà de sa boîte) —, dans le même calque, hors son propre libellé. Le texte d'une AUTRE commande est
    //    laissé au contrôle 9 (sauf celle qui contient les deux : une ligne cliquable n'excuse pas ce qui s'y recouvre).
    //    POSÉ EXPRÈS, comme le bouton dans son champ du contrôle 9 : le texte vit dans un élément en ABSOLU, frère de la commande
    //    (même conteneur) — l'unité « € » ou « % » dans son champ (`.input-unit .unit`, ~500 relevés au premier passage), les
    //    badges « 2 » et « avant / après » sur la photo-bouton d'une carte du portfolio. Ce qui est dans le FLUX n'est jamais excusé.
    const poseSur = (c, p) => { const o = c.parentElement && [...c.parentElement.children].find((x) => x !== c && x.contains(p)); return !!o && /^(absolute|fixed)$/.test(w.getComputedStyle(o).position); };
    const SEL_CMD = 'a[href], button, input:not([type=hidden]), select, textarea, [onclick], [role=button]';
    const textes = [];
    const tw = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|OPTION|SELECT|TEXTAREA)$/.test(p.tagName) || !vis(p) || decor(p)) continue;
      if (calques.length && !calques.some((c) => c.contains(p))) continue;
      const rg = d.createRange(); rg.selectNodeContents(n);
      const rs = [...rg.getClientRects()].map((q) => rogner({ parentElement: p }, q)).filter((q) => q.width > 3 && q.height > 3);
      if (rs.length) textes.push({ n, p, rs, calque: calqueDe(p), cmd: p.closest(SEL_CMD) });
    }
    for (const c of cmd) {
      const rc = [...c.getClientRects()].map((r) => rogner(c, r)).filter((r) => r.width > 0 && r.height > 0);
      if (!rc.length) continue;
      const fc = calqueDe(c);
      const vus = new Set();
      for (const t of textes) {
        if (c.contains(t.p) || t.calque !== fc || vus.has(t.p)) continue;
        if (t.cmd && !t.cmd.contains(c)) continue;   // le texte d'une autre commande : contrôle 9
        if (poseSur(c, t.p)) continue;
        let pire = null;
        for (const ra of rc) for (const rb of t.rs) {
          const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ix > 3 && iy > 3 && (!pire || ix * iy > pire[0] * pire[1])) pire = [ix, iy];
        }
        if (!pire) continue;
        vus.add(t.p);
        out.push(['commande sur du texte', chemin(c) + ' « ' + (texte(c) || c.getAttribute('aria-label') || c.getAttribute('title') || '') + ' » sur ' + chemin(t.p) + ' « ' + t.n.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) + ' » (' + Math.round(pire[0]) + '×' + Math.round(pire[1]) + ' px)']);
      }
    }

    // 10. Au repos (rien défilé), le contenu ne commence pas SOUS le bandeau collé en haut.
    if (w.scrollY === 0 && !calques.length) {
      const bandeau = visibles.find((e) => w.getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top <= 1 && e.getBoundingClientRect().width >= W * 0.5 && e.getBoundingClientRect().height < 200);
      const premier = bandeau && [...d.body.children].filter((e) => vis(e) && !racineFixe(e) && !e.contains(bandeau))[0];
      if (premier && premier.getBoundingClientRect().top < bandeau.getBoundingClientRect().bottom - 2)
        out.push(['sous le bandeau', nom(premier) + ' commence à ' + Math.round(premier.getBoundingClientRect().top) + ' px, le bandeau finit à ' + Math.round(bandeau.getBoundingClientRect().bottom)]);
    }

    // 10 bis. SOUS L'ENCOCHE (règle 61) : une commande dont tout le visible est sous l'heure, ou une commande d'une barre
    //    fixe posée sur la barre de gestes, ne se touche pas — toucher l'heure fait remonter la page, la barre de gestes
    //    change d'appli. Au repos pour ce qui défile (on ne remonte pas plus haut que le haut), toujours pour ce qui est fixe.
    //    Une fenêtre ouverte couvre la page : on ne regarde que ce qui est dedans (comme les chevauchements).
    const enc = { haut: parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue('--encoche-haut')) || 0,
      bas: parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue('--encoche-bas')) || 0 };
    if (enc.haut || enc.bas) {
      const colle = (e) => { for (let x = e; x && x !== d.documentElement; x = x.parentElement) { const p = w.getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
      // Un ancêtre qui défile ENCORE dans ce sens : on éloigne l'élément du bord en faisant défiler, il n'y est pas posé
      // (le pied d'une fenêtre plus haute que l'écran, au bas d'une fenêtre qui défile : faux relevés du 11/11/2026).
      const defileVers = (e, bas) => { for (let x = e.parentElement; x && x !== d.documentElement; x = x.parentElement) { const s = w.getComputedStyle(x); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && x.scrollHeight > x.clientHeight + 1 && (bas ? x.scrollTop < x.scrollHeight - x.clientHeight - 1 : x.scrollTop > 1)) return true; } return false; };
      const sous = [], gestes = [];
      for (const e of cmd) {
        // La partie VISIBLE : un bouton défilé hors du corps d'une fenêtre est caché par ce corps, pas posé sur la barre.
        const r = rogner(e, e.getBoundingClientRect());
        if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
        const fixe = colle(e), libelle = texte(e) || e.getAttribute('aria-label') || e.getAttribute('title') || nom(e);
        if (enc.haut && Math.min(r.bottom, H) <= enc.haut + 4 && (fixe || w.scrollY === 0) && !defileVers(e, false)) sous.push(libelle);
        if (enc.bas && fixe && r.top >= H - enc.bas - 2 && !defileVers(e, true)) gestes.push(libelle);
      }
      if (sous.length) out.push(['sous l’encoche', 'intouchable sous l’heure (' + enc.haut + ' px) : « ' + [...new Set(sous)].slice(0, 5).join(' », « ') + ' »']);
      if (gestes.length) out.push(['sous la barre de gestes', 'barre fixe sur les ' + enc.bas + ' px du bas : « ' + [...new Set(gestes)].slice(0, 5).join(' », « ') + ' »']);
    }

    // 11. Les images cassées (déjà chargées, sans pixel).
    for (const im of d.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0 && vis(im) && !im.classList.contains('ss-photo-ko')) out.push(['image cassée', (im.getAttribute('src') || '').slice(0, 90)]);

    // 12. Les liens et les gestes qui mènent à une autre page : relevés ici, vérifiés au serveur.
    const liens = new Set();
    for (const a of d.querySelectorAll('a[href]')) { const h = a.getAttribute('href'); if (h && !/^(#|javascript:|tel:|mailto:|sms:|https?:\/\/(?!127\.0\.0\.1|localhost))/i.test(h)) liens.add(a.href); }
    for (const e of d.querySelectorAll('[onclick]')) {
      const v = e.getAttribute('onclick');
      const mm = v.match(/['"`]([^'"`]*?\.html(?:[?#][^'"`]*)?)['"`]/g) || [];
      mm.forEach((x) => { const p = x.slice(1, -1); if (!/\$\{/.test(p)) { try { liens.add(new URL(p, w.location.href).href); } catch (er) {} } });
    }
    return { defauts: out, liens: [...liens], calques: calques.length };
  }

  window.SSAudit = { ouvrir: ouvrir, poser: poser, existe: existe, relever: relever, attendre: attendre, etat: A };
})();
