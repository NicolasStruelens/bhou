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
    `;
    document.head.appendChild(style);
  }

  const PAGES = [
    { href: 'dashboard.html', label: 'Tableau de bord', icon: 'grid' },
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
        const dur = fmtDuration(new Date(c.last_seen) - new Date(c.start_time));
        const label = IDENTITY_LABEL[c.identity] || c.email || 'Inconnu';
        return '<div class="conn-log-row"><span class="conn-log-who">' + label + '</span><span class="conn-log-when">' + fmtDateTime(c.start_time) + '</span><span class="conn-log-dur">' + dur + '</span></div>';
      }).join('');
    } catch (e2) {
      connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Historique indisponible hors-ligne.</div>';
    }
  };

  // ── Heartbeat : approxime le temps réellement passé sur l'appli (voir schéma D1 "connections") ──
  (function trackSession() {
    const HEARTBEAT_MS = 30000;
    const IDLE_LIMIT_MS = 5 * 60000;
    let lastActivity = Date.now();
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
    });
    function sessionId() {
      let id = sessionStorage.getItem('ss_session_id');
      if (!id) { id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); sessionStorage.setItem('ss_session_id', id); }
      return id;
    }
    function sendHeartbeat(useBeacon) {
      if (Date.now() - lastActivity > IDLE_LIMIT_MS) return; // inactif depuis trop longtemps, ne compte pas
      const body = JSON.stringify({ session_id: sessionId() });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/heartbeat', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin', keepalive: true }).catch(function () {});
      }
    }
    sendHeartbeat();
    setInterval(function () { if (document.visibilityState === 'visible') sendHeartbeat(); }, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendHeartbeat(true); });
    window.addEventListener('beforeunload', function () { sendHeartbeat(true); });
  })();

  function mount(container) {
    if (!container) return;
    const icon = window.SSUI.icon;
    const cur = location.pathname.split('/').pop();
    container.innerHTML = `
      <div class="ssnav">
        <button class="btn btn-ghost btn-sm ssnav-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Naviguer vers une autre page">${icon('grid9', 14)}</button>
        <div class="ssnav-menu" role="menu">
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
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    mountWhoAmI(container);
  }

  window.SSNav = { mount: mount, getIdentity: getIdentity };
})();
