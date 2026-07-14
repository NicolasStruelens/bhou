// Racine — état partagé, gestion des espaces/couleurs, coquille de l'app (session, toast, thème, onglets)
// Ce fichier doit être chargé en premier : il définit `state`, `toast`, `switchTab`, etc. utilisés par les autres.
  var state = {
    notes: [],
    clips: [],
    recipes: [],
    kind: 'idee',
    pinned: false,
    filterKind: 'all',
    filterPinned: false,
    searchTerm: '',
    searchQuery: { tag: null, space: null, energy: null, kind: null, before: null, after: null, someday: null, pinned: null, text: '' },
    dragId: null,
    lastAddedId: null,
    collapsed: new Set(),
    activeSpace: localStorage.getItem('racine_active_space') || 'Général',
    filterTag: null,
    energy: '',
    someday: false,
    filterEnergy: '',
    filterSomeday: false,
  };

  var ENERGY_LABELS = {
    '2min': { icon: 'bolt', text: '2min' },
    facile: { icon: 'leaf', text: 'facile' },
    profond: { icon: 'node3', text: 'profond' },
    urgent: { icon: 'flame', text: 'urgent' },
    attente: { icon: 'hourglass', text: 'attente' },
  };

  // icônes SVG (jamais d'emoji dans l'app) : référence le sprite <symbol id="i-xxx"> défini en tête de app.html
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#i-' + name);
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }
  // badge icône + texte (ex. énergie d'une note) — retourne un <span> prêt à insérer
  function iconLabel(name, text) {
    var span = document.createElement('span');
    span.className = 'icon-label';
    span.appendChild(icon(name));
    span.appendChild(document.createTextNode(text));
    return span;
  }

  var OVERVIEW = '__overview__';

  function knownSpaces() {
    var stored = [];
    try { stored = JSON.parse(localStorage.getItem('racine_spaces') || '[]'); } catch (e) {}
    return stored;
  }
  function saveKnownSpace(name) {
    var list = knownSpaces();
    if (list.indexOf(name) === -1) {
      list.push(name);
      localStorage.setItem('racine_spaces', JSON.stringify(list));
      pushPreference('racine_spaces', JSON.stringify(list));
    }
  }
  function removeKnownSpace(name) {
    var list = knownSpaces().filter(function (s) { return s !== name; });
    localStorage.setItem('racine_spaces', JSON.stringify(list));
    pushPreference('racine_spaces', JSON.stringify(list));
  }

  function renameSpace(oldName) {
    var newName = prompt('Renommer l\'espace « ' + oldName + ' » :', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    newName = newName.trim().slice(0, 60);
    var rootsInSpace = state.notes.filter(function (n) { return !n.parent_id && (n.space || 'Général') === oldName; });
    var updates = rootsInSpace.map(function (n) { return RA.updateNote(n.id, { space: newName }); });
    Promise.all(updates).then(function () {
      removeKnownSpace(oldName);
      saveKnownSpace(newName);
      var colors = spaceColors();
      if (colors[oldName]) { colors[newName] = colors[oldName]; delete colors[oldName]; saveSpaceColors(colors); }
      if (state.activeSpace === oldName) {
        state.activeSpace = newName;
        localStorage.setItem('racine_active_space', newName);
      }
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ---------- couleurs d'espace ----------
  var SPACE_PALETTE = [
    '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8',
    '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#f87171',
    '#fb923c', '#fbbf24', '#facc15', '#a3e635',
  ];

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return '52,211,153';
    return parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16);
  }

  function spaceColors() {
    try { return JSON.parse(localStorage.getItem('racine_space_colors') || '{}'); } catch (e) { return {}; }
  }
  function saveSpaceColors(map) {
    localStorage.setItem('racine_space_colors', JSON.stringify(map));
    pushPreference('racine_space_colors', JSON.stringify(map));
  }

  function getSpaceColor(name) {
    var colors = spaceColors();
    if (colors[name]) return colors[name];
    // couleur automatique stable basée sur le nom, tant que l'utilisateur n'en choisit pas une
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return SPACE_PALETTE[hash % SPACE_PALETTE.length];
  }

  function applySpaceColorVars(el, name) {
    var hex = getSpaceColor(name);
    el.style.setProperty('--sc', hex);
    el.style.setProperty('--sc-rgb', hexToRgb(hex));
  }

  var colorModal = document.getElementById('colorModal');
  var colorGrid = document.getElementById('colorGrid');
  var colorModalTitle = document.getElementById('colorModalTitle');
  document.getElementById('colorClose').addEventListener('click', function () { colorModal.classList.remove('show'); });
  colorModal.addEventListener('click', function (e) { if (e.target === colorModal) colorModal.classList.remove('show'); });

  function openColorPicker(name) {
    colorModalTitle.textContent = 'Couleur de « ' + name + ' »';
    colorGrid.innerHTML = '';
    var current = getSpaceColor(name);
    SPACE_PALETTE.forEach(function (hex) {
      var swatch = document.createElement('button');
      swatch.className = 'color-swatch' + (hex === current ? ' selected' : '');
      swatch.style.background = hex;
      swatch.title = hex;
      swatch.setAttribute('aria-label', 'Choisir la couleur ' + hex);
      swatch.addEventListener('click', function () {
        var colors = spaceColors();
        colors[name] = hex;
        saveSpaceColors(colors);
        colorModal.classList.remove('show');
        renderSpaceBar();
        renderNotesView();
      });
      colorGrid.appendChild(swatch);
    });
  }

  function deleteSpace(name) {
    var rootsInSpace = state.notes.filter(function (n) { return !n.parent_id && (n.space || 'Général') === name; });
    var msg = rootsInSpace.length
      ? 'Supprimer l\'espace « ' + name + ' » ? ' + rootsInSpace.length + ' note(s) racine seront déplacées vers « Général » (rien n\'est perdu).'
      : 'Supprimer l\'espace « ' + name + ' » ?';
    if (!confirm(msg)) return;
    var updates = rootsInSpace.map(function (n) { return RA.updateNote(n.id, { space: 'Général' }); });
    Promise.all(updates).then(function () {
      removeKnownSpace(name);
      if (state.activeSpace === name) state.activeSpace = 'Général';
      localStorage.setItem('racine_active_space', state.activeSpace);
      document.getElementById('captureBar').style.display = state.activeSpace === OVERVIEW ? 'none' : '';
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ---------- garde-fou session ----------
  RA.me().catch(function () { location.href = 'login.html'; });

  // ---------- service worker (PWA) ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // ---------- toast ----------
  var toastEl = document.getElementById('toast');
  var toastMsgEl = document.getElementById('toastMsg');
  var toastActionEl = document.getElementById('toastAction');
  var toastTimer;
  function toast(msg, actionLabel, actionFn) {
    toastMsgEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    var duration = actionFn ? 5000 : 2200;
    if (actionLabel && actionFn) {
      toastActionEl.textContent = actionLabel;
      toastActionEl.style.display = '';
      toastActionEl.onclick = function () {
        clearTimeout(toastTimer);
        toastEl.classList.remove('show');
        actionFn();
      };
    } else {
      toastActionEl.style.display = 'none';
      toastActionEl.onclick = null;
    }
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, duration);
  }

  // ---------- thème jour/nuit ----------
  var themeToggle = document.getElementById('themeToggle');
  function applyThemeIcon() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    themeToggle.innerHTML = '';
    themeToggle.appendChild(icon(isLight ? 'sun' : 'moon'));
  }
  applyThemeIcon();
  themeToggle.addEventListener('click', function () {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var next = isLight ? 'dark' : 'light';
    if (next === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('racine_theme', next === 'dark' ? '' : 'light');
    applyThemeIcon();
    if (window.RAStarfield) window.RAStarfield.setTheme(next);
  });

  // ---------- tabs ----------
  var captureInput = document.getElementById('captureInput');

  var ATELIER_VIEWS = ['clips', 'recipes', 'reminders', 'trash'];
  var atelierToggle = document.getElementById('atelierToggle');
  var atelierDropdown = document.getElementById('atelierDropdown');

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    atelierToggle.classList.toggle('active', ATELIER_VIEWS.indexOf(name) !== -1);
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'trash') loadTrash();
    if (name === 'reminders') renderReminders();
    if (name === 'today') renderToday();
    if (name === 'graph') window.renderGraph();
    if (name === 'recipes') loadRecipes();
  }
  document.querySelectorAll('.tab:not(.atelier-toggle)').forEach(function (tab) {
    tab.addEventListener('click', function () { switchTab(tab.dataset.view); });
  });

  function closeAtelier() {
    atelierDropdown.classList.add('hidden');
    atelierToggle.setAttribute('aria-expanded', 'false');
  }
  atelierToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    var willOpen = atelierDropdown.classList.contains('hidden');
    atelierDropdown.classList.toggle('hidden', !willOpen);
    atelierToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  atelierDropdown.querySelectorAll('.atelier-item').forEach(function (item) {
    item.addEventListener('click', closeAtelier);
  });
  [
    ['mobileReminderAction', 'reminderToggle'],
    ['mobileImportAction', 'importBtn'],
    ['mobileExportAction', 'exportBtn'],
    ['mobileSystemAction', 'systemBtn'],
  ].forEach(function (pair) {
    var mobileAction = document.getElementById(pair[0]);
    mobileAction.addEventListener('click', function () {
      closeAtelier();
      document.getElementById(pair[1]).click();
    });
  });
  document.addEventListener('click', function (e) {
    if (!atelierDropdown.classList.contains('hidden') && !e.target.closest('.atelier-wrap')) closeAtelier();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !atelierDropdown.classList.contains('hidden')) closeAtelier();
    if (e.key === 'Escape') {
      var openModals = Array.prototype.slice.call(document.querySelectorAll('.modal-backdrop.show'));
      if (openModals.length) openModals[openModals.length - 1].classList.remove('show');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    RA.logout().then(function () { location.href = 'login.html'; });
  });

  // ---------- trois modes mentaux : Déposer / Déplier / Agir ----------
  // pas de nouvel écran chacun : un raccourci direct vers ce que Racine sait déjà faire,
  // pour ne pas avoir à choisir "où aller" avant de pouvoir penser
  document.getElementById('modeDeposer').addEventListener('click', function () {
    openDepositModal();
  });
  document.getElementById('modeDeplier').addEventListener('click', function () {
    switchTab('graph');
  });
  document.getElementById('modeAgir').addEventListener('click', function () {
    document.getElementById('focusModeBtn').click();
  });

  // ---------- raccourci clavier : "/" focus la capture ----------
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    switchTab('notes');
    captureInput.focus();
  });
