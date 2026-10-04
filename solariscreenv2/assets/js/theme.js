// ═══════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — THÈMES (window.SSTheme)
// Script classique (compatible double-clic file://), chargé dans le <head> de chaque page.
//
// LA TABLE `THEMES` EST LA SOURCE UNIQUE. Le sélecteur des Paramètres, le bouton lune/soleil
// du bandeau, les décors de fête et la suite de tests la lisent tous. Ajouter un thème, c'est
// ajouter UNE entrée ici et son bloc de variables dans une feuille `theme-<id>.css`.
//
// ⚠️ UN THÈME N'EST PAS QU'UNE AFFAIRE DE GOÛT. Dans cet ERP la couleur PORTE DU SENS : le
// liseré d'une ligne dit l'ACTION à faire, la pastille dit le CLIENT, le badge dit le STATUT.
// Un thème dont les teintes se ressemblent trop ferait lire un devis perdu comme un devis
// gagné. D'où `tests/themes.test.html`, qui mesure pour CHAQUE thème de cette table le
// contraste des textes et l'écart entre les familles d'action. Un thème qui n'y passe pas ne
// se publie pas — même s'il est beau.
//
// `clair: true` ne décrit pas une préférence, c'est une INFORMATION TECHNIQUE : elle dit sur
// quel fond le thème pose son contenu. Les décors de fête s'en servent pour choisir leurs
// teintes, et le bouton lune/soleil pour savoir dans quelle famille basculer.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function () {
  const CLE = 'ss_theme';
  const CLE_CLAIR = 'ss_theme_clair';     // dernier thème CLAIR choisi
  const CLE_SOMBRE = 'ss_theme_sombre';   // dernier thème SOMBRE choisi

  const THEMES = [
    { id: 'dark',  nom: 'Néon', clair: false,
      aide: 'Sombre, bleu et or — l’identité SolariScreen.' },
    { id: 'light', nom: 'Pro', clair: true,
      aide: 'Clair et sobre, lisible en plein jour.' },
    { id: 'cyberpunk', nom: 'Cyberpunk', clair: false,
      aide: 'Cyan et magenta sur noir violacé. Le plus contrasté des cinq.' },
    { id: 'ardoise', nom: 'Ardoise', clair: false,
      aide: 'Sombre et désaturé, sans halo ni scanline — pour le soir.' },
    { id: 'zen', nom: 'Zen', clair: true,
      aide: 'Blanc cassé chaud et teal profond. Rien ne hausse la voix.' },
  ];

  const IDS = THEMES.map(function (t) { return t.id; });
  const parId = function (id) { return THEMES.find(function (t) { return t.id === id; }) || null; };
  const clairs = function () { return THEMES.filter(function (t) { return t.clair; }); };
  const sombres = function () { return THEMES.filter(function (t) { return !t.clair; }); };

  function lire(cle, defaut) {
    try { const v = localStorage.getItem(cle); return IDS.indexOf(v) !== -1 ? v : defaut; }
    catch (e) { return defaut; }
  }

  function getTheme() {
    const enregistre = lire(CLE, null);
    if (enregistre) return enregistre;
    // Aucune préférence : on suit le système, et on retombe sur le premier thème de la famille.
    const prefereClair = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const famille = prefereClair ? clairs() : sombres();
    return (famille[0] || THEMES[0]).id;
  }

  function applyTheme(theme) {
    const t = parId(theme) || parId(THEMES[0].id);
    document.documentElement.setAttribute('data-theme', t.id);
    try {
      localStorage.setItem(CLE, t.id);
      // On retient le dernier choix DE CHAQUE FAMILLE : c'est ce qui permet au bouton
      // lune/soleil de rester un aller-retour d'un clic même avec dix thèmes.
      localStorage.setItem(t.clair ? CLE_CLAIR : CLE_SOMBRE, t.id);
    } catch (e) {}
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      const vise = b.dataset.themeBtn === 'light';
      b.setAttribute('aria-pressed', vise === t.clair ? 'true' : 'false');
    });
    document.querySelectorAll('[data-theme-select]').forEach(function (s) { s.value = t.id; });
    return t.id;
  }

  /* Bascule CLAIR ↔ SOMBRE, en revenant sur le dernier thème choisi dans la famille d'arrivée.
     Avec deux thèmes, c'est exactement l'ancien comportement ; avec dix, le bouton garde son
     sens — il n'essaie pas de faire défiler toute la liste, ce qui serait inutilisable. */
  function familleDefaut(versClair) {
    const memoire = lire(versClair ? CLE_CLAIR : CLE_SOMBRE, null);
    const t = memoire && parId(memoire);
    if (t && t.clair === versClair) return t.id;
    const famille = versClair ? clairs() : sombres();
    return (famille[0] || THEMES[0]).id;
  }

  function appliquerFamille(versClair) { return applyTheme(familleDefaut(versClair)); }

  function toggleTheme() {
    const t = parId(getTheme()) || THEMES[0];
    return appliquerFamille(!t.clair);
  }

  // Icônes autonomes (pas de dépendance à ui.js, chargé plus tard)
  var ICO_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICO_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  /* Le bandeau garde DEUX boutons, pas une liste : jour/nuit est le geste qu'on fait vingt fois
     par jour, le choix du thème se fait une fois dans les Paramètres. Les deux boutons visent
     donc une FAMILLE, pas un thème précis. */
  function mountThemeToggle(container) {
    if (!container) return;
    container.classList.add('theme-toggle');
    container.innerHTML =
      '<button data-theme-btn="dark"  title="Thème sombre" aria-label="Passer au thème sombre" aria-pressed="false">' + ICO_MOON + '</button>' +
      '<button data-theme-btn="light" title="Thème clair"  aria-label="Passer au thème clair"  aria-pressed="false">' + ICO_SUN + '</button>';
    container.querySelectorAll('[data-theme-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () { appliquerFamille(btn.dataset.themeBtn === 'light'); });
    });
    applyTheme(getTheme());
  }

  /* Remplit un <select> avec tous les thèmes et le branche. Posé ici et pas dans la page des
     Paramètres : la liste doit venir de la table, sinon elle se met à diverger au premier
     thème ajouté — c'est exactement ce qui est arrivé aux types de produit (13 copies). */
  function monterSelecteur(select) {
    if (!select) return;
    select.setAttribute('data-theme-select', '');
    select.innerHTML = THEMES.map(function (t) {
      return '<option value="' + t.id + '">' + t.nom + (t.clair ? ' — clair' : ' — sombre') + '</option>';
    }).join('');
    select.value = getTheme();
    select.addEventListener('change', function () { applyTheme(select.value); });
  }

  window.SSTheme = {
    THEMES: THEMES,
    getTheme: getTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    mountThemeToggle: mountThemeToggle,
    monterSelecteur: monterSelecteur,
    estClair: function (id) { const t = parId(id || getTheme()); return !!(t && t.clair); },
    idsClairs: function () { return clairs().map(function (t) { return t.id; }); },
  };

  // Appliqué immédiatement pour éviter le flash
  applyTheme(getTheme());
})();
