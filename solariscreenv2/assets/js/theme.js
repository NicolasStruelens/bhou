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

  function mountThemeToggle(container) {
    if (!container) return;
    container.classList.add('theme-toggle');
    container.innerHTML =
      '<button data-theme-btn="dark"  title="Thème Néon (sombre)" aria-pressed="false">🌙</button>' +
      '<button data-theme-btn="light" title="Thème Pro (clair)"   aria-pressed="false">☀️</button>';
    container.querySelectorAll('[data-theme-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyTheme(btn.dataset.themeBtn); });
    });
    applyTheme(getTheme());
  }

  window.SSTheme = { getTheme: getTheme, applyTheme: applyTheme, toggleTheme: toggleTheme, mountThemeToggle: mountThemeToggle };

  // Appliqué immédiatement pour éviter le flash
  applyTheme(getTheme());
})();
