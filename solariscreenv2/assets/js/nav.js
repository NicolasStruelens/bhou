// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Menu de navigation rapide (présent sur toutes les pages)
// Script classique (file:// OK). Global : window.SSNav
// ═══════════════════════════════════════════════════════════
(function () {
  const PAGES = [
    { href: 'dashboard.html', label: 'Tableau de bord', icon: 'grid' },
    { href: 'clients.html', label: 'Clients (CRM)', icon: 'users' },
    { href: 'factures.html', label: 'Facturation', icon: 'filetext' },
    { href: 'portfolio.html', label: 'Portfolio', icon: 'image' },
    { href: 'agenda.html', label: 'Agenda de pose', icon: 'calendar' },
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
      const span = document.createElement('span');
      span.className = 'badge ssnav-who';
      span.title = 'Connecté : ' + identity.email;
      span.style.color = colorVar;
      span.style.borderColor = 'color-mix(in srgb, ' + colorVar + ' 45%, transparent)';
      span.style.background = 'color-mix(in srgb, ' + colorVar + ' 9%, transparent)';
      span.innerHTML = window.SSUI.icon('user', 11) + ' ' + label;
      anchor.parentNode.insertBefore(span, anchor);
    });
  }

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
