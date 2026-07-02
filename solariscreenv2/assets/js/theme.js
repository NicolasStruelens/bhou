// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Thèmes (Néon / Pro) + persistance
// Script classique (compatible double-clic file://). Global : window.SSTheme
// ═══════════════════════════════════════════════════════════
(function () {
  const THEME_KEY = 'ss_theme';
  const THEMES = ['dark', 'light'];

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    const t = THEMES.includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.themeBtn === t ? 'true' : 'false');
    });
    return t;
  }

  function toggleTheme() {
    return applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  // Icônes autonomes (pas de dépendance à ui.js, chargé plus tard)
  var ICO_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICO_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  function mountThemeToggle(container) {
    if (!container) return;
    container.classList.add('theme-toggle');
    container.innerHTML =
      '<button data-theme-btn="dark"  title="Thème Néon (sombre)" aria-label="Activer le thème sombre" aria-pressed="false">' + ICO_MOON + '</button>' +
      '<button data-theme-btn="light" title="Thème Pro (clair)"   aria-label="Activer le thème clair"  aria-pressed="false">' + ICO_SUN + '</button>';
    container.querySelectorAll('[data-theme-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyTheme(btn.dataset.themeBtn); });
    });
    applyTheme(getTheme());
  }

  window.SSTheme = { getTheme: getTheme, applyTheme: applyTheme, toggleTheme: toggleTheme, mountThemeToggle: mountThemeToggle };

  // Appliqué immédiatement pour éviter le flash
  applyTheme(getTheme());
})();
