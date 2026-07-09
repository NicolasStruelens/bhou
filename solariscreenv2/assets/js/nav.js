// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Menu de navigation rapide (présent sur toutes les pages)
// Script classique (file:// OK). Global : window.SSNav
// ═══════════════════════════════════════════════════════════
(function () {
  // Styles injectés ici (pas dans base.css) car nav.js tourne sur des pages qui ne
  // définissent pas toutes ".status-menu" — le popover doit être autonome partout.
  if (!document.getElementById('ssnav-injected-styles')) {
    const style = document.createElement('style');
    style.id = 'ssnav-injected-styles';
    style.textContent = `
      .ssnav-who { margin: 0; line-height: 1; }
      .conn-log { position: fixed; z-index: 5000; display: none; min-width: 300px; max-width: 340px;
        background: var(--surface, #141d3d); border: 1px solid var(--border-strong, #324273);
        border-radius: var(--r-md, 3px); box-shadow: var(--shadow, 0 10px 34px rgba(0,0,0,0.5));
        max-height: 360px; overflow-y: auto; }
      .conn-log.open { display: block; }
      .conn-log-head { padding: 0.6rem 0.9rem; font-family: var(--font-mono, monospace); font-size: 0.68rem;
        text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-subtle, #6675a0);
        border-bottom: 1px solid var(--border, #243056); }
      .conn-log-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem;
        font-size: 0.78rem; border-bottom: 1px solid var(--border, #243056); }
      .conn-log-row:last-child { border-bottom: none; }
      .conn-log-who { font-weight: 700; flex: none; min-width: 58px; color: var(--text, #e9eefb); }
      .conn-log-when { flex: 1; color: var(--text-muted, #97a4cc); font-family: var(--font-mono, monospace); font-size: 0.72rem; }
      .conn-log-dur { flex: none; font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--accent-2, #ffd23f); }
      /* ── Palette de recherche globale (Ctrl+K) ── */
      .cmdk-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 6000; display: none; align-items: flex-start; justify-content: center; padding: 12vh 1rem 1rem; }
      .cmdk-ov.open { display: flex; }
      .cmdk { width: 560px; max-width: 100%; background: var(--surface,#141d3d); border: 1px solid var(--border-strong,#324273); border-radius: var(--r-md,4px); box-shadow: var(--shadow,0 10px 34px rgba(0,0,0,.5)); overflow: hidden; display: flex; flex-direction: column; max-height: 70vh; }
      .cmdk-input { display: flex; align-items: center; gap: 0.6rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--border,#243056); }
      .cmdk-input svg { color: var(--text-subtle,#6675a0); flex: none; }
      .cmdk-input input { flex: 1; background: none; border: none; outline: none; color: var(--text,#e9eefb); font-size: 1rem; font-family: inherit; }
      .cmdk-kbd { font-family: var(--font-mono, monospace); font-size: 0.6rem; color: var(--text-subtle,#6675a0); border: 1px solid var(--border,#243056); border-radius: 3px; padding: 0.1rem 0.35rem; flex: none; }
      .cmdk-results { overflow-y: auto; padding: 0.35rem; }
      .cmdk-group { font-family: var(--font-mono, monospace); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-subtle,#6675a0); padding: 0.5rem 0.6rem 0.25rem; }
      .cmdk-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border-radius: 3px; cursor: pointer; text-decoration: none; color: var(--text,#e9eefb); }
      .cmdk-item:hover, .cmdk-item.sel { background: color-mix(in srgb, var(--accent,#4d7cff) 16%, transparent); }
      .cmdk-item .ci-ic { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-mono, monospace); font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, var(--accent,#4d7cff) 16%, transparent); color: var(--accent,#4d7cff); }
      .cmdk-item .ci-ic.F { background: color-mix(in srgb, var(--accent-2,#ffd23f) 16%, transparent); color: var(--accent-2,#ffd23f); }
      .cmdk-item .ci-ic.R { background: color-mix(in srgb, var(--accent-3,#a78bfa) 16%, transparent); color: var(--accent-3,#a78bfa); }
      .cmdk-item .ci-t { flex: 1; min-width: 0; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cmdk-item .ci-s { font-size: 0.62rem; color: var(--text-subtle,#6675a0); font-family: var(--font-mono, monospace); flex: none; }
      .cmdk-empty { padding: 1.4rem; text-align: center; color: var(--text-subtle,#6675a0); font-size: 0.85rem; }
    `;
    document.head.appendChild(style);
  }

  const PAGES = [
    { href: 'dashboard.html', label: 'Tableau de bord', icon: 'grid' },
    { href: 'rdv.html', label: 'Demandes de RDV', icon: 'calendar' },
    { href: 'clients.html', label: 'Clients (CRM)', icon: 'users' },
    { href: 'factures.html', label: 'Facturation', icon: 'filetext' },
    { href: 'portfolio.html', label: 'Portfolio', icon: 'image' },
    { href: 'agenda.html', label: 'Agenda de pose', icon: 'calendar' },
    { href: 'carte.html', label: 'Carte des chantiers', icon: 'pin' },
    { href: 'sav.html', label: 'SAV', icon: 'warning' },
    { href: 'stats.html', label: 'Statistiques', icon: 'sliders' },
    { href: 'terrain.html', label: 'Mode Terrain', icon: 'phone' },
    { href: 'simulateur.html', label: 'Nouveau devis', icon: 'plus' },
  ];

  // Identité Cloudflare Access → affichage cosmétique ("connecté en tant que…") ET
  // pré-remplissage de l'auteur des notes internes. Jamais utilisée pour une décision
  // de sécurité (l'application réelle se fait par la politique Access sur le domaine).
  const IDENTITIES = {
    'info@solariscreen.be': { key: 'yannick', name: 'Yannick', colorVar: '--accent-2' },
    'nicolas.struelens@me.com': { key: 'nicolas', name: 'Nicolas', colorVar: '--accent' },
  };

  let identityPromise = null;
  // Résout une fois par page : { email, key: 'nicolas'|'yannick'|null, name, colorVar }
  function getIdentity() {
    if (identityPromise) return identityPromise;
    identityPromise = (window.SS && typeof window.SS.whoAmI === 'function' ? window.SS.whoAmI() : Promise.resolve({ email: null }))
      .then(function (res) {
        const email = res && res.email;
        const id = email ? IDENTITIES[email.toLowerCase()] : null;
        return { email: email || null, key: id ? id.key : null, name: id ? id.name : null, colorVar: id ? id.colorVar : '--text-subtle' };
      })
      .catch(function () { return { email: null, key: null, name: null, colorVar: '--text-subtle' }; });
    return identityPromise;
  }

  function mountWhoAmI(anchor) {
    if (!anchor) return;
    getIdentity().then(function (identity) {
      if (!identity.email) return; // pas derrière Cloudflare Access (dev local) → rien à afficher
      const label = identity.name || identity.email;
      const colorVar = 'var(' + identity.colorVar + ')';
      const span = document.createElement('button');
      span.type = 'button';
      span.className = 'badge ssnav-who';
      span.style.cursor = 'pointer';
      span.title = 'Connecté : ' + identity.email + ' — cliquer pour voir l\'historique de connexion';
      span.style.color = colorVar;
      span.style.borderColor = 'color-mix(in srgb, ' + colorVar + ' 45%, transparent)';
      span.style.background = 'color-mix(in srgb, ' + colorVar + ' 9%, transparent)';
      span.innerHTML = window.SSUI.icon('user', 11) + ' ' + label;
      span.addEventListener('click', function (e) { toggleConnLog(e); });
      anchor.parentNode.insertBefore(span, anchor);
    });
  }

  // ── Historique de connexion (popover ouvert en cliquant sur le badge d'identité) ──
  const IDENTITY_LABEL = { nicolas: 'Nicolas', yannick: 'Yannick' };
  function fmtDuration(ms) {
    const min = Math.round(ms / 60000);
    if (min < 1) return '< 1 min';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' +
      d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  }
  let connLogEl = null;
  window.toggleConnLog = async function (e) {
    e.stopPropagation();
    if (!connLogEl) {
      connLogEl = document.createElement('div');
      connLogEl.className = 'conn-log';
      document.body.appendChild(connLogEl);
      document.addEventListener('click', function (ev) {
        if (connLogEl.classList.contains('open') && !connLogEl.contains(ev.target) && !ev.target.closest('.ssnav-who')) connLogEl.classList.remove('open');
      }, true);
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') connLogEl.classList.remove('open'); });
    }
    if (connLogEl.classList.contains('open')) { connLogEl.classList.remove('open'); return; }
    connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Chargement…</div>';
    const r = e.currentTarget.getBoundingClientRect();
    connLogEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 340)) + 'px';
    connLogEl.style.top = Math.min(r.bottom + 6, window.innerHeight - 380) + 'px';
    connLogEl.classList.add('open');
    try {
      const res = await fetch('/api/connections', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
      const rows = (res && res.data) || [];
      if (!rows.length) { connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Aucune connexion enregistrée.</div>'; return; }
      connLogEl.innerHTML = '<div class="conn-log-head">Historique de connexion</div>' + rows.slice(0, 30).map(function (c) {
        // Durée d'une plage d'utilisation ACTIVE : une pause (navigateur réduit / onglet en
        // arrière-plan / PC laissé ouvert > SESSION_GAP) coupe la session et en démarre une
        // nouvelle, donc cet écart début→fin ne reflète que du temps réellement actif.
        const dur = fmtDuration(new Date(c.last_seen) - new Date(c.start_time));
        const label = IDENTITY_LABEL[c.identity] || c.email || 'Inconnu';
        return '<div class="conn-log-row"><span class="conn-log-who">' + label + '</span><span class="conn-log-when">' + fmtDateTime(c.start_time) + '</span><span class="conn-log-dur" title="Temps actif (onglet visible + interactions)">' + dur + '</span></div>';
      }).join('');
    } catch (e2) {
      connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Historique indisponible hors-ligne.</div>';
    }
  };

  // ── Heartbeat : approxime le temps réellement passé sur l'appli (voir schéma D1 "connections") ──
  (function trackSession() {
    const HEARTBEAT_MS = 30000;
    const IDLE_LIMIT_MS = 2 * 60000;   // au-delà de 2 min sans interaction, on ne compte plus (lecture tolérée)
    const SESSION_GAP_MS = 90000;      // un trou > 90 s (réduit / arrière-plan / inactif) démarre une NOUVELLE session
    let lastActivity = Date.now();
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
    });
    // Identifiant de session qui se RENOUVELLE après une longue pause : si le dernier battement
    // remonte à plus de SESSION_GAP (navigateur réduit, autre onglet/appli au premier plan, PC
    // laissé ouvert…), on ouvre une nouvelle session. Chaque ligne d'historique = une vraie plage
    // d'utilisation active, au lieu d'un seul long créneau qui engloberait les temps morts.
    function sessionId() {
      const now = Date.now();
      const lastBeat = parseInt(sessionStorage.getItem('ss_last_beat') || '0', 10);
      let id = sessionStorage.getItem('ss_session_id');
      if (!id || (lastBeat && now - lastBeat > SESSION_GAP_MS)) {
        id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : now + '-' + Math.random().toString(36).slice(2));
        sessionStorage.setItem('ss_session_id', id);
      }
      return id;
    }
    function sendHeartbeat() {
      if (Date.now() - lastActivity > IDLE_LIMIT_MS) return;   // inactif depuis trop longtemps → ne compte pas
      const sid = sessionId();
      sessionStorage.setItem('ss_last_beat', String(Date.now()));
      const body = JSON.stringify({ session_id: sid });
      fetch('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin', keepalive: true }).catch(function () {});
    }
    sendHeartbeat();
    // Ne bat QUE lorsque l'onglet est réellement visible (réduit / arrière-plan → pas de battement,
    // donc le temps mort n'est jamais compté et coupera la session au retour).
    setInterval(function () { if (document.visibilityState === 'visible') sendHeartbeat(); }, HEARTBEAT_MS);
  })();

  function mount(container) {
    if (!container) return;
    const icon = window.SSUI.icon;
    const cur = location.pathname.split('/').pop();
    container.innerHTML = `
      <div class="ssnav">
        <button class="btn btn-ghost btn-sm ssnav-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Naviguer vers une autre page">${icon('grid9', 14)}</button>
        <div class="ssnav-menu" role="menu">
          <button class="ssnav-item ssnav-search" type="button" role="menuitem" style="width:100%;text-align:left;background:none;cursor:pointer;">${icon('search', 14)} Recherche<span style="margin-left:auto;font-family:var(--font-mono);font-size:0.58rem;opacity:0.7;border:1px solid var(--border);border-radius:3px;padding:0.05rem 0.3rem;">Ctrl&nbsp;K</span></button>
          ${PAGES.map(p => `<a class="ssnav-item ${p.href === cur ? 'active' : ''}" href="${p.href}" role="menuitem">${icon(p.icon, 14)} ${p.label}</a>`).join('')}
        </div>
      </div>`;
    const root = container.querySelector('.ssnav');
    const btn = root.querySelector('.ssnav-toggle');
    const menu = root.querySelector('.ssnav-menu');
    function close() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    function toggle(e) {
      e.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      menu.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    }
    btn.addEventListener('click', toggle);
    const searchItem = root.querySelector('.ssnav-search');
    if (searchItem) searchItem.addEventListener('click', function (e) { e.preventDefault(); close(); if (window.ssCommandPalette) window.ssCommandPalette(); });
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    mountWhoAmI(container);
  }

  // ── Palette de recherche globale (Ctrl+K / ⌘K) — devis, clients, factures, RDV ──
  (function commandPalette() {
    let ov = null, input = null, resultsEl = null, DATA = null, dataAt = 0, sel = 0, flat = [];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function ensure() {
      if (ov) return;
      ov = document.createElement('div'); ov.className = 'cmdk-ov';
      ov.innerHTML = '<div class="cmdk" role="dialog" aria-label="Recherche globale">' +
        '<div class="cmdk-input">' + window.SSUI.icon('search', 16) +
        '<input type="text" placeholder="Rechercher un devis, client, facture, RDV…" aria-label="Recherche" autocomplete="off">' +
        '<span class="cmdk-kbd">Échap</span></div><div class="cmdk-results"></div></div>';
      document.body.appendChild(ov);
      input = ov.querySelector('input'); resultsEl = ov.querySelector('.cmdk-results');
      ov.addEventListener('click', e => { if (e.target === ov) closeP(); });
      input.addEventListener('input', renderP);
      input.addEventListener('keydown', onKey);
    }
    async function loadData() {
      if (DATA && Date.now() - dataAt < 60000) return DATA;
      const SS = window.SS;
      const [devis, clients, factures, rdv] = await Promise.all([
        SS.listDevis().catch(() => []), SS.listClients().catch(() => []), SS.listFactures().catch(() => []),
        (SS.listRdv ? SS.listRdv().catch(() => []) : Promise.resolve([])),
      ]);
      DATA = { devis: devis || [], clients: clients || [], factures: factures || [], rdv: rdv || [] };
      dataAt = Date.now(); return DATA;
    }
    function openP() {
      ensure(); ov.classList.add('open'); input.value = '';
      resultsEl.innerHTML = '<div class="cmdk-empty">Chargement…</div>';
      setTimeout(() => input.focus(), 30);
      loadData().then(renderP).catch(() => { resultsEl.innerHTML = '<div class="cmdk-empty">Recherche indisponible hors-ligne.</div>'; });
    }
    function closeP() { if (ov) ov.classList.remove('open'); }
    function renderP() {
      if (!DATA) return;
      const q = input.value.trim().toLowerCase();
      flat = [];
      if (!q) { resultsEl.innerHTML = '<div class="cmdk-empty">Tape pour chercher un devis, un client, une facture ou une demande de RDV.</div>'; return; }
      const groups = [];
      const dv = DATA.devis.map(d => {
        const prenom = d.client_prenom || (d.client && d.client.prenom) || '', nom = d.client_nom || (d.client && d.client.nom) || '';
        const ville = (d.client && d.client.adresse && d.client.adresse.ville) || '';
        return { label: (prenom + ' ' + nom).trim() || 'Sans nom', sub: '#' + d.id, hay: (prenom + ' ' + nom + ' ' + d.id + ' ' + ville).toLowerCase(), href: 'vue.html?id=' + encodeURIComponent(d.id), ic: 'D' };
      }).filter(x => x.hay.includes(q)).slice(0, 6);
      if (dv.length) groups.push({ title: 'Devis', items: dv });
      const cl = DATA.clients.map(c => {
        const full = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
        return { label: full || 'Client', sub: c.telephone || c.email || '', hay: (full + ' ' + (c.telephone || '') + ' ' + (c.email || '') + ' ' + ((c.adresse && c.adresse.ville) || '')).toLowerCase(), href: 'clients.html?q=' + encodeURIComponent(full), ic: 'C' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (cl.length) groups.push({ title: 'Clients', items: cl });
      const fa = DATA.factures.map(f => {
        const full = (((f.client && f.client.prenom) || '') + ' ' + ((f.client && f.client.nom) || '')).trim();
        return { label: f.id + (full ? ' — ' + full : ''), sub: '', hay: (f.id + ' ' + full).toLowerCase(), href: 'facture.html?id=' + encodeURIComponent(f.id), ic: 'F' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (fa.length) groups.push({ title: 'Factures', items: fa });
      const rv = DATA.rdv.map(r => {
        const full = (((r.client && r.client.prenom) || '') + ' ' + ((r.client && r.client.nom) || '')).trim();
        return { label: full || 'Demande', sub: r.source || '', hay: (full + ' ' + (r.source || '') + ' ' + ((r.client && r.client.adresse && r.client.adresse.ville) || '')).toLowerCase(), href: 'rdv.html?open=' + encodeURIComponent(r.id), ic: 'R' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (rv.length) groups.push({ title: 'Demandes de RDV', items: rv });
      if (!groups.length) { resultsEl.innerHTML = '<div class="cmdk-empty">Aucun résultat pour « ' + esc(input.value) + ' ».</div>'; return; }
      let html = '', idx = 0;
      groups.forEach(g => {
        html += '<div class="cmdk-group">' + esc(g.title) + '</div>';
        g.items.forEach(it => { flat.push(it); html += '<a class="cmdk-item" data-i="' + idx + '" href="' + it.href + '"><span class="ci-ic ' + it.ic + '">' + it.ic + '</span><span class="ci-t">' + esc(it.label) + '</span><span class="ci-s">' + esc(it.sub) + '</span></a>'; idx++; });
      });
      resultsEl.innerHTML = html; sel = 0; highlight();
    }
    function highlight() {
      resultsEl.querySelectorAll('.cmdk-item').forEach((e, i) => e.classList.toggle('sel', i === sel));
      const s = resultsEl.querySelector('.cmdk-item.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
    }
    function onKey(e) {
      if (e.key === 'Escape') { closeP(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) { sel = (sel + 1) % flat.length; highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) { sel = (sel - 1 + flat.length) % flat.length; highlight(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (flat[sel]) location.href = flat[sel].href; }
    }
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (ov && ov.classList.contains('open')) closeP(); else openP();
      }
    });
    window.ssCommandPalette = openP;
  })();

  // ── PWA : manifest + icônes iOS + enregistrement du service worker (un seul endroit) ──
  (function pwa() {
    // Base = racine du site. Les pages sont dans /app/ → remonter d'un cran ; sinon on est à la racine.
    const base = location.pathname.indexOf('/app/') !== -1 ? '../' : './';
    function addOnce(sel, make) { if (!document.querySelector(sel)) document.head.appendChild(make()); }
    addOnce('link[rel="manifest"]', function () { const l = document.createElement('link'); l.rel = 'manifest'; l.href = base + 'manifest.webmanifest'; return l; });
    addOnce('link[rel="apple-touch-icon"]', function () { const l = document.createElement('link'); l.rel = 'apple-touch-icon'; l.href = base + 'assets/img/logo-solariscreen.png'; return l; });
    addOnce('meta[name="theme-color"]', function () { const m = document.createElement('meta'); m.name = 'theme-color'; m.content = '#0b1224'; return m; });
    addOnce('meta[name="apple-mobile-web-app-capable"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-capable'; m.content = 'yes'; return m; });
    addOnce('meta[name="apple-mobile-web-app-title"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; m.content = 'SolariScreen'; return m; });
    addOnce('meta[name="apple-mobile-web-app-status-bar-style"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-status-bar-style'; m.content = 'black-translucent'; return m; });
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () { navigator.serviceWorker.register(base + 'sw.js').catch(function () {}); });
    }
  })();

  window.SSNav = { mount: mount, getIdentity: getIdentity };
})();
