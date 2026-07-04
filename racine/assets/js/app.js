(function () {
  var state = {
    notes: [],
    clips: [],
    kind: 'idee',
    pinned: false,
    filterKind: 'all',
    filterPinned: false,
    searchTerm: '',
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

  var ENERGY_LABELS = { '2min': '⚡ 2min', facile: '🙂 facile', profond: '🧠 profond', urgent: '🔥 urgent', attente: '⏳ attente' };

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
    }
  }
  function removeKnownSpace(name) {
    var list = knownSpaces().filter(function (s) { return s !== name; });
    localStorage.setItem('racine_spaces', JSON.stringify(list));
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
    });
  }

  // ---------- couleurs d'espace ----------
  var SPACE_PALETTE = ['#34d399', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#fb7185', '#60a5fa', '#a3e635'];

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return '52,211,153';
    return parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16);
  }

  function spaceColors() {
    try { return JSON.parse(localStorage.getItem('racine_space_colors') || '{}'); } catch (e) { return {}; }
  }
  function saveSpaceColors(map) { localStorage.setItem('racine_space_colors', JSON.stringify(map)); }

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
    });
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
    themeToggle.textContent = isLight ? '☀️' : '🌙';
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

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'trash') loadTrash();
    if (name === 'reminders') renderReminders();
    if (name === 'today') renderToday();
    if (name === 'graph') renderGraph();
  }
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { switchTab(tab.dataset.view); });
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    RA.logout().then(function () { location.href = 'login.html'; });
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

  // ================= NOTES =================

  var kindSelect = document.getElementById('kindSelect');
  kindSelect.addEventListener('click', function (e) {
    var btn = e.target.closest('.kind-btn');
    if (!btn) return;
    state.kind = btn.dataset.kind;
    kindSelect.querySelectorAll('.kind-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });

  var pinToggle = document.getElementById('pinToggle');
  pinToggle.addEventListener('click', function () {
    state.pinned = !state.pinned;
    pinToggle.classList.toggle('active', state.pinned);
  });

  var energySelect = document.getElementById('energySelect');
  energySelect.addEventListener('click', function (e) {
    var btn = e.target.closest('.energy-btn');
    if (!btn) return;
    state.energy = state.energy === btn.dataset.energy ? '' : btn.dataset.energy;
    energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.energy === state.energy); });
  });

  var somedayToggle = document.getElementById('somedayToggle');
  somedayToggle.addEventListener('click', function () {
    state.someday = !state.someday;
    somedayToggle.classList.toggle('active', state.someday);
  });

  var TEMPLATES = {
    appel: { kind: 'todo', title: 'Appeler ', tags: '#appel', energy: 'facile' },
    bug: { kind: 'todo', title: 'Bug : ', tags: '#bug', energy: 'urgent' },
    business: { kind: 'idee', title: '', tags: '#business', energy: 'profond' },
    maison: { kind: 'todo', title: '', tags: '#maison', energy: '2min' },
    transfert: { kind: 'note', title: 'Commande à transférer : ', tags: '#transfert', energy: '' },
  };
  document.getElementById('templateRow').addEventListener('click', function (e) {
    var btn = e.target.closest('.template-btn');
    if (!btn) return;
    var t = TEMPLATES[btn.dataset.template];
    if (!t) return;
    state.kind = t.kind;
    kindSelect.querySelectorAll('.kind-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.kind === t.kind); });
    captureTags.value = t.tags;
    state.energy = t.energy;
    energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.energy === t.energy); });
    captureInput.value = t.title;
    captureBar.classList.toggle('has-value', !!t.title);
    captureInput.focus();
    captureInput.setSelectionRange(t.title.length, t.title.length);
  });

  var captureBar = document.getElementById('captureBar');
  var captureDetails = document.getElementById('captureDetails');
  var detailToggle = document.getElementById('detailToggle');
  var captureAdd = document.getElementById('captureAdd');

  detailToggle.addEventListener('click', function () {
    var open = captureDetails.classList.toggle('open');
    detailToggle.classList.toggle('active', open);
    detailToggle.textContent = open ? '− masquer les détails' : '+ ajouter des détails';
    if (open) captureDetails.focus();
  });

  captureInput.addEventListener('input', function () {
    captureBar.classList.toggle('has-value', !!captureInput.value.trim());
  });

  var captureTags = document.getElementById('captureTags');

  // ---------- analyseur de date en langage naturel (FR) ----------
  // utilisé par la commande /rappel et par la détection passive de mots de date dans la capture
  function parseNaturalDate(str) {
    var s = (str || '').toLowerCase();
    var now = new Date();
    var target = null;
    var m;
    if (/\bapr[eè]s[\s-]?demain\b/.test(s)) {
      target = new Date(now); target.setDate(target.getDate() + 2);
    } else if (/\bdemain\b/.test(s)) {
      target = new Date(now); target.setDate(target.getDate() + 1);
    } else if (/\baujourd'?hui\b/.test(s)) {
      target = new Date(now);
    } else if ((m = /\bdans\s+(\d+)\s*jours?\b/.exec(s))) {
      target = new Date(now); target.setDate(target.getDate() + Number(m[1]));
    } else {
      var days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      for (var i = 0; i < days.length; i++) {
        if (new RegExp('\\b' + days[i] + '\\b').test(s)) {
          target = new Date(now);
          var delta = (i - now.getDay() + 7) % 7;
          if (delta === 0) delta = 7;
          target.setDate(target.getDate() + delta);
          break;
        }
      }
    }
    if (!target) return null;
    var timeMatch = /\b(\d{1,2})h(\d{2})?\b/.exec(s);
    var hour = 9, min = 0;
    if (timeMatch) { hour = Math.min(23, Number(timeMatch[1])); min = timeMatch[2] ? Number(timeMatch[2]) : 0; }
    target.setHours(hour, min, 0, 0);
    return target.getTime();
  }

  // ---------- palette de commandes : /todo /idee /note /rappel <date> /espace X /tag X ----------
  function parseCaptureCommand(raw) {
    var result = { kind: null, remind_at: null, space: null, tags: [] };
    var text = raw;
    text = text.replace(/\/espace\s+([^\/]+)/i, function (_, g) { result.space = g.trim(); return ' '; });
    text = text.replace(/\/tag\s+([^\/]+)/i, function (_, g) { result.tags.push('#' + g.trim().replace(/^#/, '').split(/\s+/)[0]); return ' '; });
    text = text.replace(/\/rappel\s+([^\/]+)/i, function (_, g) {
      var ts = parseNaturalDate(g);
      if (ts) result.remind_at = ts;
      return ' ';
    });
    text = text.replace(/\/todo\b/i, function () { result.kind = 'todo'; return ' '; });
    text = text.replace(/\/idee\b/i, function () { result.kind = 'idee'; return ' '; });
    text = text.replace(/\/note\b/i, function () { result.kind = 'note'; return ' '; });
    result.title = text.replace(/\s+/g, ' ').trim();
    return result;
  }

  function submitCapture() {
    var raw = captureInput.value.trim();
    if (!raw) { captureInput.focus(); return; }
    var cmd = parseCaptureCommand(raw);
    var title = cmd.title;
    if (!title) { captureInput.focus(); return; }
    var remindAt = cmd.remind_at;
    if (!remindAt) {
      // détection passive : un mot de date dans le texte pose un rappel automatiquement, sans le retirer du titre
      remindAt = parseNaturalDate(title);
    }
    RA.createNote({
      title: title,
      content: captureDetails.value.trim(),
      kind: cmd.kind || state.kind,
      pinned: state.pinned,
      space: cmd.space || (state.activeSpace === OVERVIEW ? 'Général' : state.activeSpace),
      tags: parseTags(captureTags.value).concat(cmd.tags).join(' '),
      remind_at: remindAt || null,
      energy: state.energy,
      status: state.someday ? 'someday' : 'active',
    }).then(function (res) {
      captureInput.value = '';
      captureDetails.value = '';
      captureTags.value = '';
      captureDetails.classList.remove('open');
      detailToggle.classList.remove('active');
      detailToggle.textContent = '+ ajouter des détails';
      state.pinned = false;
      pinToggle.classList.remove('active');
      state.energy = '';
      energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.remove('active'); });
      state.someday = false;
      somedayToggle.classList.remove('active');
      captureBar.classList.remove('has-value');
      state.lastAddedId = res.id;
      if (cmd.space && knownSpaces().indexOf(cmd.space) === -1 && cmd.space !== 'Général') saveKnownSpace(cmd.space);
      if (remindAt) toast('Rappel posé pour ' + formatRemindAt(remindAt));
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  captureInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitCapture();
  });
  captureDetails.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitCapture();
  });
  captureAdd.addEventListener('click', submitCapture);

  // ---------- recherche / filtre ----------
  var searchInput = document.getElementById('searchInput');
  var filterKindEl = document.getElementById('filterKind');
  var filterPinnedBtn = document.getElementById('filterPinned');
  var searchAllSpacesBtn = document.getElementById('searchAllSpaces');
  var filterEnergyEl = document.getElementById('filterEnergy');
  var filterSomedayBtn = document.getElementById('filterSomeday');

  filterEnergyEl.addEventListener('change', function () {
    state.filterEnergy = filterEnergyEl.value;
    renderNotesView();
  });
  filterSomedayBtn.addEventListener('click', function () {
    state.filterSomeday = !state.filterSomeday;
    filterSomedayBtn.classList.toggle('active', state.filterSomeday);
    renderNotesView();
  });

  searchInput.addEventListener('input', function () {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderNotesView();
  });
  filterKindEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.kind-btn');
    if (!btn) return;
    state.filterKind = btn.dataset.kind;
    filterKindEl.querySelectorAll('.kind-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderNotesView();
  });
  filterPinnedBtn.addEventListener('click', function () {
    state.filterPinned = !state.filterPinned;
    filterPinnedBtn.classList.toggle('active', state.filterPinned);
    renderNotesView();
  });
  state.searchAllSpaces = false;
  searchAllSpacesBtn.addEventListener('click', function () {
    state.searchAllSpaces = !state.searchAllSpaces;
    searchAllSpacesBtn.classList.toggle('active', state.searchAllSpaces);
    renderNotesView();
  });

  function parseTags(str) {
    return (str || '').split(/\s+/).map(function (t) { return t.trim(); }).filter(function (t) { return t.indexOf('#') === 0 && t.length > 1; });
  }

  // ---------- liens entre notes ("voir aussi") ----------
  function parseLinks(str) {
    return (str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function addLink(aId, bId) {
    if (aId === bId) return;
    var a = state.notes.find(function (n) { return n.id === aId; });
    var b = state.notes.find(function (n) { return n.id === bId; });
    if (!a || !b) return;
    var aLinks = parseLinks(a.links);
    var bLinks = parseLinks(b.links);
    if (aLinks.indexOf(bId) === -1) aLinks.push(bId);
    if (bLinks.indexOf(aId) === -1) bLinks.push(aId);
    Promise.all([
      RA.updateNote(aId, { links: aLinks.join(',') }),
      RA.updateNote(bId, { links: bLinks.join(',') }),
    ]).then(function () { loadNotes(); toast('Notes liées'); });
  }

  function removeLink(aId, bId) {
    var a = state.notes.find(function (n) { return n.id === aId; });
    var b = state.notes.find(function (n) { return n.id === bId; });
    var updates = [];
    if (a) updates.push(RA.updateNote(aId, { links: parseLinks(a.links).filter(function (x) { return x !== bId; }).join(',') }));
    if (b) updates.push(RA.updateNote(bId, { links: parseLinks(b.links).filter(function (x) { return x !== aId; }).join(',') }));
    Promise.all(updates).then(loadNotes);
  }

  function jumpToNote(id) {
    var n = state.notes.find(function (x) { return x.id === id; });
    if (!n) { toast('Note introuvable (peut-être supprimée)'); return; }
    switchTab('notes');
    setActiveSpace(effectiveSpace(n));
    state.searchTerm = '';
    searchInput.value = '';
    state.filterKind = 'all';
    state.filterPinned = false;
    state.filterTag = null;
    setTimeout(function () {
      var el = document.querySelector('[data-id="' + id + '"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('just-added');
        setTimeout(function () { el.classList.remove('just-added'); }, 1200);
      }
    }, 150);
  }

  var linkModal = document.getElementById('linkModal');
  var linkSourceTitle = document.getElementById('linkSourceTitle');
  var linkSearch = document.getElementById('linkSearch');
  var linkResults = document.getElementById('linkResults');
  var linkSourceId = null;

  function renderLinkResults() {
    var term = linkSearch.value.trim().toLowerCase();
    var source = state.notes.find(function (n) { return n.id === linkSourceId; });
    var already = source ? parseLinks(source.links) : [];
    var results = state.notes.filter(function (n) {
      if (n.id === linkSourceId || already.indexOf(n.id) !== -1) return false;
      if (!term) return true;
      return n.title.toLowerCase().indexOf(term) !== -1;
    }).slice(0, 30);
    linkResults.innerHTML = '';
    results.forEach(function (n) {
      var item = document.createElement('button');
      item.className = 'link-result-item';
      item.textContent = n.title;
      var spaceEl = document.createElement('span');
      spaceEl.className = 'link-result-space';
      spaceEl.textContent = effectiveSpace(n);
      item.appendChild(spaceEl);
      item.addEventListener('click', function () {
        addLink(linkSourceId, n.id);
        linkModal.classList.remove('show');
      });
      linkResults.appendChild(item);
    });
  }

  function openLinkModal(n) {
    linkSourceId = n.id;
    linkSourceTitle.textContent = n.title;
    linkSearch.value = '';
    renderLinkResults();
    linkModal.classList.add('show');
    linkSearch.focus();
  }

  document.getElementById('linkClose').addEventListener('click', function () { linkModal.classList.remove('show'); });
  linkModal.addEventListener('click', function (e) { if (e.target === linkModal) linkModal.classList.remove('show'); });
  linkSearch.addEventListener('input', renderLinkResults);

  // ---------- édition complète ----------
  var editModal = document.getElementById('editModal');
  var editTitle = document.getElementById('editTitle');
  var editContent = document.getElementById('editContent');
  var editTags = document.getElementById('editTags');
  var editKind = document.getElementById('editKind');
  var editSpace = document.getElementById('editSpace');
  var editEnergy = document.getElementById('editEnergy');
  var editSomeday = document.getElementById('editSomeday');
  var editContext = document.getElementById('editContext');
  var editTargetId = null;

  function openEditModal(n) {
    editTargetId = n.id;
    editTitle.value = n.title;
    editContent.value = n.content || '';
    editTags.value = n.tags || '';
    editKind.value = n.kind;
    editEnergy.value = n.energy || '';
    editSomeday.checked = n.status === 'someday';
    var children = state.notes.filter(function (x) { return x.parent_id === n.id; });
    var links = parseLinks(n.links).map(function (lid) {
      var t = state.notes.find(function (x) { return x.id === lid; });
      return t ? t.title : null;
    }).filter(Boolean);
    var bits = [];
    if (children.length) bits.push(children.length + ' branche(s)');
    if (links.length) bits.push('lié à : ' + links.join(', '));
    editContext.textContent = bits.length ? bits.join(' · ') : '';
    var spaces = allSpaces();
    var curSpace = n.parent_id ? effectiveSpace(n) : (n.space || 'Général');
    if (spaces.indexOf(curSpace) === -1) spaces.push(curSpace);
    editSpace.innerHTML = '';
    spaces.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      editSpace.appendChild(opt);
    });
    editSpace.value = curSpace;
    editSpace.disabled = !!n.parent_id;
    editSpace.title = n.parent_id ? 'Une branche suit l\'espace de sa racine' : '';
    editModal.classList.add('show');
    editTitle.focus();
  }

  document.getElementById('editClose').addEventListener('click', function () { editModal.classList.remove('show'); });
  editModal.addEventListener('click', function (e) { if (e.target === editModal) editModal.classList.remove('show'); });
  document.getElementById('editSave').addEventListener('click', function () {
    var title = editTitle.value.trim();
    if (!title) { toast('Le titre ne peut pas être vide'); return; }
    var patch = {
      title: title,
      content: editContent.value.trim(),
      tags: parseTags(editTags.value).join(' '),
      kind: editKind.value,
      energy: editEnergy.value,
      status: editSomeday.checked ? 'someday' : 'active',
    };
    if (!editSpace.disabled) patch.space = editSpace.value;
    RA.updateNote(editTargetId, patch).then(function () {
      editModal.classList.remove('show');
      loadNotes();
      toast('Note mise à jour');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  function matchesFilter(n) {
    if (state.filterKind !== 'all' && n.kind !== state.filterKind) return false;
    if (state.filterPinned && !n.pinned) return false;
    if (state.filterEnergy && (n.energy || '') !== state.filterEnergy) return false;
    if (state.filterSomeday && n.status !== 'someday') return false;
    if (!state.filterSomeday && n.status === 'someday') return false;
    if (state.filterTag && parseTags(n.tags).map(function (t) { return t.toLowerCase(); }).indexOf(state.filterTag.toLowerCase()) === -1) return false;
    if (state.searchTerm) {
      var hay = (n.title + ' ' + (n.content || '') + ' ' + (n.tags || '')).toLowerCase();
      if (hay.indexOf(state.searchTerm) === -1) return false;
    }
    return true;
  }

  function renderTagBar() {
    var bar = document.getElementById('tagBar');
    bar.innerHTML = '';
    var scoped = state.notes.filter(function (n) { return effectiveSpace(n) === state.activeSpace; });
    var set = {};
    scoped.forEach(function (n) { parseTags(n.tags).forEach(function (t) { set[t] = true; }); });
    var tags = Object.keys(set).sort();
    if (!tags.length) { state.filterTag = null; return; }
    tags.forEach(function (t) {
      var chip = document.createElement('button');
      chip.className = 'tag-chip' + (state.filterTag === t ? ' active' : '');
      chip.textContent = t;
      chip.addEventListener('click', function () {
        state.filterTag = state.filterTag === t ? null : t;
        renderTagBar();
        renderNotesView();
      });
      bar.appendChild(chip);
    });
  }

  function buildTree(notes) {
    var byId = {};
    notes.forEach(function (n) { byId[n.id] = n; n._children = []; });
    var roots = [];
    notes.forEach(function (n) {
      if (n.parent_id && byId[n.parent_id]) byId[n.parent_id]._children.push(n);
      else roots.push(n);
    });
    return roots;
  }

  function noteMeta(n) {
    var d = new Date(n.created_at);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ---------- espaces (multi-projets) ----------
  function effectiveSpace(n) {
    var byId = {};
    state.notes.forEach(function (x) { byId[x.id] = x; });
    var cur = n;
    var seen = {};
    while (cur && cur.parent_id && byId[cur.parent_id] && !seen[cur.id]) {
      seen[cur.id] = true;
      cur = byId[cur.parent_id];
    }
    return (cur && cur.space) || 'Général';
  }

  function allSpaces() {
    var set = { 'Général': true };
    knownSpaces().forEach(function (s) { set[s] = true; });
    state.notes.forEach(function (n) { if (!n.parent_id) set[n.space || 'Général'] = true; });
    var arr = Object.keys(set);
    arr.sort(function (a, b) {
      if (a === 'Général') return -1;
      if (b === 'Général') return 1;
      return a.localeCompare(b);
    });
    return arr;
  }

  function setActiveSpace(name) {
    state.activeSpace = name;
    state.filterTag = null;
    localStorage.setItem('racine_active_space', name);
    document.getElementById('captureBar').style.display = name === OVERVIEW ? 'none' : '';
    renderSpaceBar();
    renderTagBar();
    renderNotesView();
  }

  function renderSpaceBar() {
    var bar = document.getElementById('spaceBar');
    bar.innerHTML = '';

    var overviewBtn = document.createElement('button');
    overviewBtn.className = 'space-pill overview' + (state.activeSpace === OVERVIEW ? ' active' : '');
    var oDot = document.createElement('span'); oDot.className = 'dot';
    overviewBtn.appendChild(oDot);
    overviewBtn.appendChild(document.createTextNode("Vue d'ensemble"));
    overviewBtn.addEventListener('click', function () { setActiveSpace(OVERVIEW); });
    bar.appendChild(overviewBtn);

    allSpaces().forEach(function (name) {
      var btn = document.createElement('button');
      btn.className = 'space-pill' + (state.activeSpace === name ? ' active' : '');
      applySpaceColorVars(btn, name);
      var dot = document.createElement('span'); dot.className = 'dot';
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(name));
      btn.addEventListener('click', function () { setActiveSpace(name); });

      var colorBtn = document.createElement('span');
      colorBtn.className = 'space-pill-color';
      colorBtn.textContent = '🎨';
      colorBtn.title = 'Choisir une couleur';
      colorBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openColorPicker(name);
        colorModal.classList.add('show');
      });
      btn.appendChild(colorBtn);

      if (name !== 'Général') {
        var editBtn = document.createElement('span');
        editBtn.className = 'space-pill-edit';
        editBtn.textContent = '✎';
        editBtn.title = 'Renommer l\'espace « ' + name + ' »';
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          renameSpace(name);
        });
        btn.appendChild(editBtn);

        var delX = document.createElement('span');
        delX.className = 'space-pill-del';
        delX.textContent = '×';
        delX.title = 'Supprimer l\'espace « ' + name + ' »';
        delX.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteSpace(name);
        });
        btn.appendChild(delX);
      }
      bar.appendChild(btn);
    });

    var addBtn = document.createElement('button');
    addBtn.className = 'space-pill-add';
    addBtn.textContent = '+ espace';
    addBtn.addEventListener('click', function () {
      var name = prompt('Nom du nouvel espace (projet, passion…) :');
      if (!name || !name.trim()) return;
      name = name.trim().slice(0, 60);
      saveKnownSpace(name);
      setActiveSpace(name);
    });
    bar.appendChild(addBtn);
  }

  // ---------- glisser-déposer ----------
  function clearDragClasses() {
    document.querySelectorAll('.node, .root-card, .branch-row').forEach(function (n) {
      n.classList.remove('drag-before', 'drag-after', 'drag-nest', 'dragging');
    });
  }

  function isDescendantOf(childId, potentialAncestorId) {
    var byId = {};
    state.notes.forEach(function (n) { byId[n.id] = n; });
    var cur = byId[childId];
    while (cur && cur.parent_id) {
      if (cur.parent_id === potentialAncestorId) return true;
      cur = byId[cur.parent_id];
    }
    return false;
  }

  function wouldCycle(draggedId, newParentId) {
    if (!newParentId) return false;
    if (newParentId === draggedId) return true;
    return isDescendantOf(newParentId, draggedId);
  }

  function handleDrop(draggedId, targetNote, mode) {
    if (!draggedId || draggedId === targetNote.id) return;
    if (mode === 'nest') {
      if (wouldCycle(draggedId, targetNote.id)) { toast('Déplacement impossible (créerait une boucle)'); return; }
      RA.updateNote(draggedId, { parent_id: targetNote.id, position: Date.now() }).then(loadNotes);
    } else {
      var newParent = targetNote.parent_id || null;
      if (wouldCycle(draggedId, newParent)) { toast('Déplacement impossible (créerait une boucle)'); return; }
      var siblings = state.notes
        .filter(function (x) { return (x.parent_id || null) === newParent && x.id !== draggedId; })
        .sort(function (a, b) { return a.position - b.position; });
      var idx = siblings.findIndex(function (s) { return s.id === targetNote.id; });
      var insertAt = mode === 'before' ? idx : idx + 1;
      siblings.splice(insertAt, 0, { id: draggedId });
      var updates = siblings.map(function (s, i) {
        return RA.updateNote(s.id, { position: i * 10, parent_id: newParent });
      });
      Promise.all(updates).then(loadNotes);
    }
  }

  var CHEVRON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  function attachDnD(el, n) {
    el.draggable = true;
    el.addEventListener('dragstart', function (e) {
      state.dragId = n.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', n.id);
    });
    el.addEventListener('dragend', function () { clearDragClasses(); state.dragId = null; });
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (state.dragId === n.id) return;
      var rect = el.getBoundingClientRect();
      var ratio = (e.clientY - rect.top) / rect.height;
      el.classList.remove('drag-before', 'drag-after', 'drag-nest');
      if (ratio < 0.25) el.classList.add('drag-before');
      else if (ratio > 0.75) el.classList.add('drag-after');
      else el.classList.add('drag-nest');
    });
    el.addEventListener('dragleave', function () {
      el.classList.remove('drag-before', 'drag-after', 'drag-nest');
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var mode = el.classList.contains('drag-before') ? 'before' : el.classList.contains('drag-after') ? 'after' : 'nest';
      handleDrop(state.dragId, n, mode);
      clearDragClasses();
    });
  }

  // mise en forme légère et sûre : **gras** et liens https:// cliquables (jamais d'innerHTML)
  function renderRichText(container, text) {
    var regex = /(\*\*[^*\n]+\*\*|https?:\/\/[^\s]+)/g;
    var lastIndex = 0;
    var m;
    while ((m = regex.exec(text))) {
      if (m.index > lastIndex) container.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      var token = m[0];
      if (token.slice(0, 2) === '**') {
        var strong = document.createElement('strong');
        strong.textContent = token.slice(2, -2);
        container.appendChild(strong);
      } else {
        var a = document.createElement('a');
        a.href = token;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = token;
        a.addEventListener('click', function (e) { e.stopPropagation(); });
        container.appendChild(a);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  function formatRemindAt(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function buildBody(n) {
    var body = document.createElement('div');
    body.className = 'node-body';

    var title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = n.title;
    body.appendChild(title);

    if (n.content) {
      var content = document.createElement('div');
      content.className = 'node-content';
      renderRichText(content, n.content);
      body.appendChild(content);
    }

    var meta = document.createElement('div');
    meta.className = 'node-meta';
    var metaText = (n.pinned ? '★ à ne pas oublier · ' : '') + noteMeta(n);
    if (n.remind_at) metaText += ' · ⏰ ' + formatRemindAt(n.remind_at);
    if (n.status === 'someday') metaText += ' · 🗓 someday';
    meta.textContent = metaText;
    if (n.energy) {
      var energyBadge = document.createElement('span');
      energyBadge.className = 'node-energy';
      energyBadge.textContent = ENERGY_LABELS[n.energy] || n.energy;
      meta.appendChild(energyBadge);
    }
    body.appendChild(meta);

    var tags = parseTags(n.tags);
    if (tags.length) {
      var tagsRow = document.createElement('div');
      tagsRow.className = 'node-tags';
      tags.forEach(function (t) {
        var tagEl = document.createElement('span');
        tagEl.className = 'node-tag';
        tagEl.textContent = t;
        tagsRow.appendChild(tagEl);
      });
      body.appendChild(tagsRow);
    }

    var linkIds = parseLinks(n.links);
    if (linkIds.length) {
      var linksRow = document.createElement('div');
      linksRow.className = 'node-links';
      linkIds.forEach(function (lid) {
        var target = state.notes.find(function (x) { return x.id === lid; });
        if (!target) return;
        var chip = document.createElement('span');
        chip.className = 'node-link-chip';
        var label = document.createElement('span');
        label.textContent = '🔗 ' + target.title;
        label.addEventListener('click', function (e) { e.stopPropagation(); jumpToNote(lid); });
        chip.appendChild(label);
        var unlinkX = document.createElement('span');
        unlinkX.className = 'unlink-x';
        unlinkX.textContent = ' ×';
        unlinkX.title = 'Retirer le lien';
        unlinkX.addEventListener('click', function (e) { e.stopPropagation(); removeLink(n.id, lid); });
        chip.appendChild(unlinkX);
        linksRow.appendChild(chip);
      });
      body.appendChild(linksRow);
    }

    return body;
  }

  function siblingsOf(n) {
    var parent = n.parent_id || null;
    var list = state.notes.filter(function (x) { return (x.parent_id || null) === parent; });
    if (!parent) {
      // au niveau racine, ne comparer qu'à l'intérieur du même espace
      var sp = n.space || 'Général';
      list = list.filter(function (x) { return (x.space || 'Général') === sp; });
    }
    return list.sort(function (a, b) { return a.position - b.position; });
  }

  function swapPosition(a, b) {
    var pa = a.position, pb = b.position;
    return Promise.all([
      RA.updateNote(a.id, { position: pb }),
      RA.updateNote(b.id, { position: pa }),
    ]).then(loadNotes);
  }

  function buildActions(n, flat) {
    var actions = document.createElement('div');
    actions.className = 'node-actions';

    var doneBtn = document.createElement('button');
    doneBtn.className = 'icon-btn';
    doneBtn.title = n.done ? 'Marquer non terminé' : 'Marquer terminé';
    doneBtn.textContent = n.done ? '↺' : '✓';
    doneBtn.addEventListener('click', function () {
      RA.updateNote(n.id, { done: !n.done }).then(loadNotes);
    });
    actions.appendChild(doneBtn);

    var pinBtn = document.createElement('button');
    pinBtn.className = 'icon-btn';
    pinBtn.title = 'Épingler';
    pinBtn.textContent = '★';
    pinBtn.addEventListener('click', function () {
      RA.updateNote(n.id, { pinned: !n.pinned }).then(loadNotes);
    });
    actions.appendChild(pinBtn);

    var remindBtn = document.createElement('button');
    remindBtn.className = 'icon-btn';
    remindBtn.title = n.remind_at ? 'Modifier le rappel' : 'Ajouter un rappel daté';
    remindBtn.textContent = '⏰';
    remindBtn.addEventListener('click', function () { openRemindModal(n); });
    actions.appendChild(remindBtn);

    var linkBtn = document.createElement('button');
    linkBtn.className = 'icon-btn';
    linkBtn.title = 'Lier à une autre note ("voir aussi")';
    linkBtn.textContent = '🔗';
    linkBtn.addEventListener('click', function () { openLinkModal(n); });
    actions.appendChild(linkBtn);

    var editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Modifier';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', function () { openEditModal(n); });
    actions.appendChild(editBtn);

    // réorganisation sans glisser-déposer (nécessaire sur iPhone/tactile, où le drag HTML ne marche pas)
    // — pas de sens en liste plate (recherche / vue d'ensemble), et ça garde une largeur d'actions
    // constante là-bas pour un alignement propre des pastilles d'espace
    if (!flat) {
      var siblings = siblingsOf(n);
      var idx = siblings.findIndex(function (s) { return s.id === n.id; });

      if (idx > 0) {
        var upBtn = document.createElement('button');
        upBtn.className = 'icon-btn';
        upBtn.title = 'Monter';
        upBtn.textContent = '▲';
        upBtn.addEventListener('click', function () { swapPosition(n, siblings[idx - 1]); });
        actions.appendChild(upBtn);
      }
      if (idx !== -1 && idx < siblings.length - 1) {
        var downBtn = document.createElement('button');
        downBtn.className = 'icon-btn';
        downBtn.title = 'Descendre';
        downBtn.textContent = '▼';
        downBtn.addEventListener('click', function () { swapPosition(n, siblings[idx + 1]); });
        actions.appendChild(downBtn);
      }
      if (n.parent_id) {
        var detachBtn = document.createElement('button');
        detachBtn.className = 'icon-btn';
        detachBtn.title = 'Détacher (devient une racine)';
        detachBtn.textContent = '⌂';
        detachBtn.addEventListener('click', function () {
          RA.updateNote(n.id, { parent_id: null, position: Date.now(), space: effectiveSpace(n) }).then(loadNotes);
        });
        actions.appendChild(detachBtn);
      }

      var addChildBtn = document.createElement('button');
      addChildBtn.className = 'icon-btn';
      addChildBtn.title = 'Ajouter une branche';
      addChildBtn.textContent = '+';
      addChildBtn.addEventListener('click', function () {
        var title = prompt('Nouvelle branche sous « ' + n.title + ' » :');
        if (!title || !title.trim()) return;
        state.collapsed.delete(n.id);
        RA.createNote({ title: title.trim(), kind: n.kind, parent_id: n.id }).then(function (res) {
          state.lastAddedId = res.id;
          loadNotes();
        });
      });
      actions.appendChild(addChildBtn);
    }

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Mettre à la corbeille';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function () {
      if (!confirm('Mettre « ' + n.title + ' » (et ses branches) à la corbeille ?')) return;
      RA.deleteNote(n.id).then(function () {
        loadNotes();
        toast('Mis à la corbeille', 'Annuler', function () {
          RA.restoreNote(n.id).then(loadNotes);
        });
      });
    });
    actions.appendChild(delBtn);

    return actions;
  }

  // mode liste plate (recherche/filtre actif, ou vue d'ensemble) : cartes autonomes, sans hiérarchie
  function renderFlatNode(n, container, spaceTag, noDrag) {
    var el = document.createElement('div');
    el.className = 'node depth-0';
    el.dataset.kind = n.kind;
    el.dataset.id = n.id;
    if (n.pinned) el.classList.add('pinned');
    if (n.done) el.classList.add('done');
    if (n.status === 'someday') el.classList.add('someday');
    if (noDrag) el.style.cursor = 'default';
    else attachDnD(el, n);
    el.appendChild((function () { var d = document.createElement('div'); d.className = 'node-dot'; return d; })());
    el.appendChild(buildBody(n));
    if (spaceTag) {
      var tag = document.createElement('div');
      tag.className = 'space-tag';
      tag.textContent = spaceTag;
      applySpaceColorVars(tag, spaceTag);
      el.appendChild(tag);
    }
    el.appendChild(buildActions(n, true));
    container.appendChild(el);
  }

  function childSummary(children) {
    var doneCount = children.filter(function (c) { return c.done; }).length;
    return { text: doneCount + '/' + children.length, done: doneCount === children.length };
  }

  // mode arborescence : note racine = carte, enfants imbriqués visuellement dedans
  function renderRootCard(n, container) {
    var card = document.createElement('div');
    card.className = 'root-card';
    card.dataset.kind = n.kind;
    card.dataset.id = n.id;
    if (n.pinned) card.classList.add('pinned');
    if (n.done) card.classList.add('done');
    if (state.collapsed.has(n.id)) card.classList.add('collapsed');

    var header = document.createElement('div');
    header.className = 'root-card-header';
    attachDnD(header, n);

    if (n._children.length) {
      var collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.innerHTML = CHEVRON_SVG;
      collapseBtn.title = 'Replier / déplier';
      collapseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (state.collapsed.has(n.id)) state.collapsed.delete(n.id);
        else state.collapsed.add(n.id);
        card.classList.toggle('collapsed');
      });
      header.appendChild(collapseBtn);
    } else {
      var spacer = document.createElement('div');
      spacer.className = 'collapse-spacer';
      header.appendChild(spacer);
    }

    var dot = document.createElement('div');
    dot.className = 'node-dot-lg';
    header.appendChild(dot);

    header.appendChild(buildBody(n));

    if (n._children.length) {
      var summary = childSummary(n._children);
      var badge = document.createElement('div');
      badge.className = 'child-badge' + (summary.done ? ' all-done' : '');
      badge.textContent = summary.text;
      header.appendChild(badge);
    }

    header.appendChild(buildActions(n));
    card.appendChild(header);

    if (n._children.length) {
      var branches = document.createElement('div');
      branches.className = 'branches';
      n._children.forEach(function (child) { renderBranchRow(child, branches); });
      card.appendChild(branches);
    }

    container.appendChild(card);
  }

  function renderBranchRow(n, container) {
    var row = document.createElement('div');
    row.className = 'branch-row';
    row.dataset.kind = n.kind;
    row.dataset.id = n.id;
    if (n.pinned) row.classList.add('pinned');
    if (n.done) row.classList.add('done');
    attachDnD(row, n);

    var main = document.createElement('div');
    main.className = 'branch-row-main';

    var dot = document.createElement('div');
    dot.className = 'node-dot';
    main.appendChild(dot);

    main.appendChild(buildBody(n));
    main.appendChild(buildActions(n));
    row.appendChild(main);
    container.appendChild(row);

    if (n._children.length) {
      var branches = document.createElement('div');
      branches.className = 'branches';
      n._children.forEach(function (child) { renderBranchRow(child, branches); });
      row.appendChild(branches);
    }
  }

  function renderOverviewSummary(items) {
    var el = document.getElementById('overviewSummary');
    el.innerHTML = '';

    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var createdWeek = state.notes.filter(function (n) { return n.created_at >= weekAgo; }).length;
    var doneWeek = state.notes.filter(function (n) { return n.done && n.updated_at >= weekAgo; }).length;
    if (createdWeek || doneWeek) {
      var statsChip = document.createElement('div');
      statsChip.className = 'overview-stat';
      statsChip.appendChild(document.createTextNode('📈 '));
      var s1 = document.createElement('strong'); s1.textContent = createdWeek;
      statsChip.appendChild(s1);
      statsChip.appendChild(document.createTextNode(' créées · '));
      var s2 = document.createElement('strong'); s2.textContent = doneWeek;
      statsChip.appendChild(s2);
      statsChip.appendChild(document.createTextNode(' terminées cette semaine'));
      el.appendChild(statsChip);
    }

    var counts = {};
    items.forEach(function (n) {
      var sp = effectiveSpace(n);
      counts[sp] = (counts[sp] || 0) + 1;
    });
    Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    }).forEach(function (name) {
      var chip = document.createElement('div');
      chip.className = 'overview-stat';
      applySpaceColorVars(chip, name);
      var dot = document.createElement('span'); dot.className = 'dot';
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(name + ' '));
      var strong = document.createElement('strong');
      strong.textContent = counts[name];
      chip.appendChild(strong);
      el.appendChild(chip);
    });
  }

  function renderNotesView() {
    var treeEl = document.getElementById('tree');
    treeEl.innerHTML = '';
    var emptyMsg = document.querySelector('#emptyState p');
    var searchActive = !!state.searchTerm || state.filterKind !== 'all' || state.filterPinned || !!state.filterTag || !!state.filterEnergy;
    searchAllSpacesBtn.style.display = (searchActive && state.activeSpace !== OVERVIEW) ? '' : 'none';

    if (state.activeSpace === OVERVIEW) {
      // vue d'ensemble = vraiment tout, toutes espaces confondus (les filtres habituels s'appliquent) —
      // avec les urgences (épinglé, tâche en attente) remontées en premier
      var all = state.notes.filter(matchesFilter).sort(function (a, b) {
        function score(n) { return n.pinned ? 0 : (n.kind === 'todo' && !n.done) ? 1 : 2; }
        var sa = score(a), sb = score(b);
        return sa !== sb ? sa - sb : b.created_at - a.created_at;
      });
      document.getElementById('emptyState').style.display = all.length ? 'none' : 'block';
      if (emptyMsg) emptyMsg.textContent = 'Rien pour l\'instant, dans aucun espace.';
      renderOverviewSummary(all);
      all.forEach(function (n) { renderFlatNode(n, treeEl, effectiveSpace(n), true); });
    } else if (searchActive) {
      document.getElementById('overviewSummary').innerHTML = '';
      var pool = state.searchAllSpaces ? state.notes : state.notes.filter(function (n) { return effectiveSpace(n) === state.activeSpace; });
      var filtered = pool.filter(matchesFilter);
      document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';
      if (emptyMsg) emptyMsg.textContent = 'Rien pour l\'instant. Écris ta première idée ci-dessus.';
      filtered.forEach(function (n) {
        if (state.searchAllSpaces) renderFlatNode(n, treeEl, effectiveSpace(n), true);
        else renderFlatNode(n, treeEl);
      });
    } else {
      document.getElementById('overviewSummary').innerHTML = '';
      var poolNotes = state.notes.filter(function (n) { return state.filterSomeday ? n.status === 'someday' : n.status !== 'someday'; });
      var roots = buildTree(poolNotes).filter(function (r) { return (r.space || 'Général') === state.activeSpace; });
      document.getElementById('emptyState').style.display = roots.length ? 'none' : 'block';
      if (emptyMsg) emptyMsg.textContent = 'Rien pour l\'instant dans « ' + state.activeSpace + ' ». Écris ta première idée ci-dessus.';
      roots.forEach(function (n) { renderRootCard(n, treeEl); });
    }
    if (state.lastAddedId) {
      var added = treeEl.querySelector('[data-id="' + state.lastAddedId + '"]');
      if (added) {
        added.classList.add('just-added');
        setTimeout(function () { added.classList.remove('just-added'); }, 900);
      }
      state.lastAddedId = null;
    }
  }

  var treeContainer = document.getElementById('tree');
  treeContainer.addEventListener('dragover', function (e) { e.preventDefault(); });
  treeContainer.addEventListener('drop', function (e) {
    if (e.target !== treeContainer) return;
    if (!state.dragId || state.activeSpace === OVERVIEW) return;
    RA.updateNote(state.dragId, { parent_id: null, position: Date.now(), space: state.activeSpace }).then(loadNotes);
  });

  function loadNotes() {
    return RA.listNotes().then(function (data) {
      state.notes = data.notes;
      renderSpaceBar();
      renderTagBar();
      renderNotesView();
      checkReminders();
      var reminderCount = data.notes.filter(function (n) { return n.remind_at; }).length;
      document.getElementById('reminderCount').textContent = reminderCount ? reminderCount : '';
      if (document.getElementById('view-reminders').classList.contains('active')) renderReminders();
      if (window.RAStarfield) window.RAStarfield.setNodeCount(12 + data.notes.length);
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ================= RAPPELS =================

  var REMINDER_KEY = 'racine_reminders_enabled';
  var REMINDER_DAYS_KEY = 'racine_reminder_days';
  var NOTIFIED_KEY = 'racine_notified_map';
  var reminderToggle = document.getElementById('reminderToggle');

  function reminderDays() { return Number(localStorage.getItem(REMINDER_DAYS_KEY) || 3); }

  function checkReminders() {
    var notifiedMap = {};
    try { notifiedMap = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch (e) {}
    var today = new Date().toDateString();
    var notifiedChanged = false;
    var canNotify = 'Notification' in window && Notification.permission === 'granted';

    // rappels datés précis, sur une note donnée — indépendants du réglage global
    var due = state.notes.filter(function (n) { return n.remind_at && n.remind_at <= Date.now(); });
    var dueToNotify = due.filter(function (n) { return notifiedMap['r:' + n.id] !== today; });
    if (dueToNotify.length) {
      if (canNotify) {
        dueToNotify.forEach(function (n) { new Notification('Racine — rappel', { body: n.title }); });
      }
      dueToNotify.forEach(function (n) { notifiedMap['r:' + n.id] = today; });
      notifiedChanged = true;
      toast(dueToNotify.length === 1 ? 'Rappel : ' + dueToNotify[0].title : dueToNotify.length + ' rappels programmés sont arrivés à échéance');
    }

    // rappel global (épinglés / tâches en attente depuis plus de X jours)
    if (localStorage.getItem(REMINDER_KEY) === '1') {
      var days = reminderDays();
      var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      var overdue = state.notes.filter(function (n) {
        var relevant = n.pinned || (n.kind === 'todo' && !n.done);
        return relevant && n.created_at <= cutoff;
      });
      if (overdue.length) {
        var toNotify = overdue.filter(function (n) { return notifiedMap[n.id] !== today; });
        if (toNotify.length && canNotify) {
          var body = toNotify.slice(0, 3).map(function (n) { return '• ' + n.title; }).join('\n')
            + (toNotify.length > 3 ? '\n… et ' + (toNotify.length - 3) + ' autre(s)' : '');
          new Notification('Racine — ' + toNotify.length + ' chose(s) à ne pas oublier', { body: body });
        }
        toNotify.forEach(function (n) { notifiedMap[n.id] = today; });
        if (toNotify.length) notifiedChanged = true;
        toast(overdue.length + ' élément(s) en attente depuis plus de ' + days + ' jour(s)');
      }
    }

    if (notifiedChanged) localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedMap));
  }

  if (localStorage.getItem(REMINDER_KEY) === '1') reminderToggle.classList.add('active');

  reminderToggle.addEventListener('click', function () {
    var enabled = localStorage.getItem(REMINDER_KEY) === '1';
    if (enabled) {
      localStorage.setItem(REMINDER_KEY, '0');
      reminderToggle.classList.remove('active');
      toast('Rappels désactivés');
      return;
    }
    if (!('Notification' in window)) {
      toast('Notifications non supportées par ce navigateur');
    }
    var input = prompt('Te rappeler après combien de jours si une idée/tâche épinglée n\'est pas traitée ?', String(reminderDays()));
    if (input === null) return;
    var days = Math.max(1, Number(input) || 3);
    localStorage.setItem(REMINDER_DAYS_KEY, String(days));
    localStorage.setItem(REMINDER_KEY, '1');
    reminderToggle.classList.add('active');
    toast('Rappels activés (tous les ' + days + ' jours)');
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(function () { checkReminders(); });
    } else {
      checkReminders();
    }
  });

  setInterval(checkReminders, 30 * 60 * 1000);

  // ================= EXPORT =================

  document.getElementById('exportBtn').addEventListener('click', function () {
    RA.exportAll().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'racine-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Export téléchargé');
    }).catch(function (err) { toast('Erreur export : ' + err.message); });
  });

  // ================= IMPORT =================

  async function runImport(data) {
    var notes = data.notes || [];
    var byId = {};
    notes.forEach(function (n) { byId[n.id] = n; });
    var ordered = [];
    var visited = {};
    function visit(n) {
      if (visited[n.id]) return;
      visited[n.id] = true;
      if (n.parent_id && byId[n.parent_id]) visit(byId[n.parent_id]);
      ordered.push(n);
    }
    notes.forEach(visit);

    var idMap = {};
    for (var i = 0; i < ordered.length; i++) {
      var n = ordered[i];
      var res = await RA.createNote({
        title: n.title,
        content: n.content || '',
        kind: n.kind || 'idee',
        pinned: !!n.pinned,
        position: n.position || 0,
        space: n.space || 'Général',
        tags: n.tags || '',
        parent_id: n.parent_id ? (idMap[n.parent_id] || null) : null,
      });
      idMap[n.id] = res.id;
      if (n.done) await RA.updateNote(res.id, { done: true });
      if (n.remind_at) await RA.updateNote(res.id, { remind_at: n.remind_at });
    }
    for (var j = 0; j < ordered.length; j++) {
      var nn = ordered[j];
      if (nn.links) {
        var newLinkIds = parseLinks(nn.links).map(function (oid) { return idMap[oid]; }).filter(Boolean);
        if (newLinkIds.length) await RA.updateNote(idMap[nn.id], { links: newLinkIds.join(',') });
      }
    }
    var clips = data.clips || [];
    for (var k = 0; k < clips.length; k++) {
      var c = clips[k];
      await RA.createClip({
        label: c.label || '',
        content: c.content,
        kind: c.kind || 'text',
        filename: c.filename,
        mime: c.mime,
        device: c.device,
      });
    }
  }

  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { toast('Fichier JSON invalide'); return; }
      if (!data || !Array.isArray(data.notes)) { toast('Format non reconnu (un export Racine est attendu)'); return; }
      var noteCount = data.notes.length;
      var clipCount = Array.isArray(data.clips) ? data.clips.length : 0;
      if (!confirm('Importer ' + noteCount + ' note(s) et ' + clipCount + ' élément(s) de presse-papier ? Ils seront ajoutés à tes données actuelles (rien n\'est remplacé).')) return;
      toast('Import en cours…');
      runImport(data).then(function () {
        toast('Import terminé');
        loadNotes();
        loadClips();
      }).catch(function (err) { toast('Erreur import : ' + err.message); });
    };
    reader.readAsText(file);
  });

  // ================= ÉTAT SYSTÈME & SAUVEGARDES =================

  var systemModal = document.getElementById('systemModal');
  var systemInfo = document.getElementById('systemInfo');
  var backupList = document.getElementById('backupList');
  var APP_VERSION = '15';

  function statChip(value, label, warn) {
    var div = document.createElement('div');
    div.className = 'system-stat' + (warn ? ' warn' : '');
    var v = document.createElement('div'); v.className = 'value'; v.textContent = value;
    var l = document.createElement('div'); l.className = 'label'; l.textContent = label;
    div.appendChild(v); div.appendChild(l);
    return div;
  }

  function renderBackupList(backups) {
    backupList.innerHTML = '';
    if (!backups.length) {
      var p = document.createElement('p');
      p.className = 'modal-note no-margin-top';
      p.textContent = 'Aucune sauvegarde pour l\'instant.';
      backupList.appendChild(p);
      return;
    }
    backups.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'backup-item';
      var dateEl = document.createElement('div');
      dateEl.className = 'backup-date';
      dateEl.textContent = new Date(b.created_at).toLocaleString('fr-FR') + ' · ' + formatSize(b.size);
      row.appendChild(dateEl);

      var dlBtn = document.createElement('button');
      dlBtn.textContent = 'Télécharger';
      dlBtn.addEventListener('click', function () {
        RA.getBackup(b.id).then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'racine-backup-' + new Date(b.created_at).toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        });
      });
      row.appendChild(dlBtn);

      var restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Restaurer';
      restoreBtn.addEventListener('click', function () {
        if (!confirm('Restaurer cette sauvegarde du ' + new Date(b.created_at).toLocaleString('fr-FR') + ' ? Son contenu sera ajouté à tes données actuelles (rien n\'est remplacé).')) return;
        RA.getBackup(b.id).then(function (data) {
          toast('Restauration en cours…');
          return runImport(data);
        }).then(function () {
          toast('Sauvegarde restaurée');
          loadNotes();
          loadClips();
          systemModal.classList.remove('show');
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(restoreBtn);

      backupList.appendChild(row);
    });
  }

  function refreshSystemModal() {
    systemInfo.innerHTML = '';
    Promise.all([RA.health(), RA.listBackups()]).then(function (results) {
      var h = results[0];
      var backups = results[1].backups;
      systemInfo.appendChild(statChip(h.db ? '✓' : '✗', 'Base de données', !h.db));
      systemInfo.appendChild(statChip('v' + APP_VERSION, 'Version app'));
      systemInfo.appendChild(statChip(h.notes, 'Notes actives'));
      systemInfo.appendChild(statChip(h.clips, 'Clips actifs'));
      systemInfo.appendChild(statChip(h.reminders, 'Rappels programmés'));
      systemInfo.appendChild(statChip(h.last_backup ? new Date(h.last_backup).toLocaleDateString('fr-FR') : 'Aucune', 'Dernière sauvegarde', !h.last_backup));
      renderBackupList(backups);
    }).catch(function (err) {
      systemInfo.textContent = 'Erreur : ' + err.message;
    });
  }

  document.getElementById('systemBtn').addEventListener('click', function () {
    systemModal.classList.add('show');
    refreshSystemModal();
  });
  document.getElementById('systemClose').addEventListener('click', function () { systemModal.classList.remove('show'); });
  systemModal.addEventListener('click', function (e) { if (e.target === systemModal) systemModal.classList.remove('show'); });
  document.getElementById('backupNowBtn').addEventListener('click', function () {
    RA.createBackup().then(function () {
      toast('Sauvegarde créée');
      refreshSystemModal();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  function autoBackupIfNeeded() {
    var today = new Date().toDateString();
    if (localStorage.getItem('racine_last_backup_date') === today) return;
    RA.createBackup().then(function () {
      localStorage.setItem('racine_last_backup_date', today);
    }).catch(function () {});
  }

  // ================= QR (modale) =================

  var qrModal = document.getElementById('qrModal');
  var qrImage = document.getElementById('qrImage');
  document.getElementById('qrClose').addEventListener('click', function () { qrModal.classList.remove('show'); });
  qrModal.addEventListener('click', function (e) { if (e.target === qrModal) qrModal.classList.remove('show'); });

  function openQr(url) {
    qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    qrModal.classList.add('show');
  }

  // ================= RAPPEL DATÉ (par note) =================

  var remindModal = document.getElementById('remindModal');
  var remindNoteTitle = document.getElementById('remindNoteTitle');
  var remindInput = document.getElementById('remindInput');
  var remindTargetId = null;

  function toLocalInputValue(ts) {
    var d = new Date(ts - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function openRemindModal(n) {
    remindTargetId = n.id;
    remindNoteTitle.textContent = '« ' + n.title + ' »';
    remindInput.value = n.remind_at ? toLocalInputValue(n.remind_at) : '';
    remindModal.classList.add('show');
  }

  document.getElementById('remindClose').addEventListener('click', function () { remindModal.classList.remove('show'); });
  remindModal.addEventListener('click', function (e) { if (e.target === remindModal) remindModal.classList.remove('show'); });
  document.getElementById('remindSave').addEventListener('click', function () {
    if (!remindInput.value) { toast('Choisis une date'); return; }
    var ts = new Date(remindInput.value).getTime();
    RA.updateNote(remindTargetId, { remind_at: ts }).then(function () {
      remindModal.classList.remove('show');
      toast('Rappel programmé');
      loadNotes();
    });
  });
  document.getElementById('remindClear').addEventListener('click', function () {
    RA.updateNote(remindTargetId, { remind_at: null }).then(function () {
      remindModal.classList.remove('show');
      loadNotes();
    });
  });

  // ================= MODE FOCUS =================

  var focusModal = document.getElementById('focusModal');
  var focusQueue = [];
  var focusIndex = 0;

  function focusCandidates() {
    return state.notes
      .filter(function (n) { return n.pinned || (n.kind === 'todo' && !n.done); })
      .sort(function (a, b) { return a.created_at - b.created_at; });
  }

  function showFocusCard() {
    if (focusIndex >= focusQueue.length) {
      focusModal.classList.remove('show');
      toast('Rien de plus en attente — bien joué !');
      return;
    }
    var n = focusQueue[focusIndex];
    document.getElementById('focusKind').textContent = n.kind === 'todo' ? 'À faire' : (n.kind === 'idee' ? 'Idée' : 'Note');
    document.getElementById('focusTitle').textContent = n.title;
    var contentEl = document.getElementById('focusContent');
    contentEl.innerHTML = '';
    if (n.content) renderRichText(contentEl, n.content);
    document.getElementById('focusSpace').textContent = effectiveSpace(n);
    document.getElementById('focusProgress').textContent = (focusIndex + 1) + ' / ' + focusQueue.length;
  }

  document.getElementById('focusModeBtn').addEventListener('click', function () {
    focusQueue = focusCandidates();
    focusIndex = 0;
    if (!focusQueue.length) { toast('Rien à traiter — tout est calme.'); return; }
    focusModal.classList.add('show');
    showFocusCard();
  });
  document.getElementById('focusClose').addEventListener('click', function () { focusModal.classList.remove('show'); });
  focusModal.addEventListener('click', function (e) { if (e.target === focusModal) focusModal.classList.remove('show'); });
  document.getElementById('focusSkip').addEventListener('click', function () {
    focusIndex++;
    showFocusCard();
  });
  document.getElementById('focusDone').addEventListener('click', function () {
    var n = focusQueue[focusIndex];
    RA.updateNote(n.id, { done: true }).then(function () {
      loadNotes();
      focusIndex++;
      showFocusCard();
    });
  });

  // ================= CLIPS =================

  var clipFileData = null;

  document.getElementById('clipFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { clipFileData = null; return; }
    if (file.size > 800 * 1024) {
      toast('Fichier trop volumineux (max ~800 Ko)');
      e.target.value = '';
      clipFileData = null;
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      clipFileData = { content: reader.result, filename: file.name, mime: file.type };
      toast('Fichier prêt : ' + file.name);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('clipSend').addEventListener('click', function () {
    var label = document.getElementById('clipLabel').value.trim();
    var ttl = document.getElementById('clipTtl').value;
    var burn = document.getElementById('clipBurn').checked;
    var noExport = document.getElementById('clipNoExport').checked;
    var device = navigator.platform || '';
    var payload;

    if (clipFileData) {
      payload = {
        label: label,
        content: clipFileData.content,
        kind: 'file',
        filename: clipFileData.filename,
        mime: clipFileData.mime,
        device: device,
      };
    } else {
      var text = document.getElementById('clipContent').value;
      if (!text.trim()) { toast('Rien à envoyer'); return; }
      payload = { label: label, content: text, kind: 'text', device: device };
    }
    if (ttl) payload.ttl_ms = Number(ttl);
    payload.burn = burn;
    payload.no_export = noExport;

    RA.createClip(payload).then(function () {
      document.getElementById('clipContent').value = '';
      document.getElementById('clipLabel').value = '';
      document.getElementById('clipFile').value = '';
      document.getElementById('clipBurn').checked = false;
      document.getElementById('clipNoExport').checked = false;
      clipFileData = null;
      loadClips();
      toast('Envoyé — récupérable sur tes autres appareils');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  // ---------- détection automatique du type de contenu ----------
  function detectClipType(text) {
    if (!text) return null;
    var t = text.trim();
    if (/^https?:\/\/\S+$/.test(t)) return { label: 'URL', secret: false };
    if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(t)) { try { JSON.parse(t); return { label: 'JSON', secret: false }; } catch (e) {} }
    if (/^(sudo\s|ssh\s|curl\s|git\s|npm\s|docker\s|powershell|\$\s|>\s)/i.test(t) || /^[A-Za-z0-9_.\/-]+\s+--?[a-z]/.test(t)) return { label: 'commande', secret: false };
    var looksSecret = t.indexOf('\n') === -1 && t.length >= 8 && t.length <= 100
      && /[A-Za-z]/.test(t) && /[0-9]/.test(t) && !/\s/.test(t);
    if (looksSecret) return { label: 'probable secret', secret: true };
    return null;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    return (bytes / 1024).toFixed(1) + ' Ko';
  }

  function renderClip(c) {
    var card = document.createElement('div');
    card.className = 'clip-card' + (c.pinned ? ' pinned' : '');
    card.dataset.clipId = c.id;

    var head = document.createElement('div');
    head.className = 'clip-card-head';

    var headLeft = document.createElement('div');
    headLeft.className = 'clip-card-head-left';
    var pinBtn = document.createElement('button');
    pinBtn.className = 'clip-pin-btn' + (c.pinned ? ' active' : '');
    pinBtn.textContent = '★';
    pinBtn.title = c.pinned ? 'Retirer des favoris' : 'Mettre en favori';
    pinBtn.addEventListener('click', function () {
      RA.updateClip(c.id, { pinned: !c.pinned }).then(loadClips);
    });
    headLeft.appendChild(pinBtn);
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    headLeft.appendChild(label);

    var detected = c.kind === 'file' ? null : detectClipType(c.preview);
    if (detected) {
      var typeBadge = document.createElement('span');
      typeBadge.className = 'clip-badge' + (detected.secret ? ' secret' : '');
      typeBadge.textContent = detected.secret ? '⚠ ' + detected.label : detected.label;
      headLeft.appendChild(typeBadge);
    }
    if (c.burn) {
      var burnBadge = document.createElement('span');
      burnBadge.className = 'clip-badge burn';
      burnBadge.textContent = '🔥 lecture unique';
      headLeft.appendChild(burnBadge);
    }
    if (c.device) {
      var deviceEl = document.createElement('span');
      deviceEl.className = 'clip-device';
      deviceEl.textContent = c.device;
      headLeft.appendChild(deviceEl);
    }
    head.appendChild(headLeft);

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Mettre à la corbeille';
    delBtn.addEventListener('click', function () {
      RA.deleteClip(c.id).then(function () {
        loadClips();
        toast('Mis à la corbeille', 'Annuler', function () {
          RA.restoreClip(c.id).then(loadClips);
        });
      });
    });
    head.appendChild(delBtn);
    card.appendChild(head);

    var preview = document.createElement('div');
    var isLong = c.kind !== 'file' && c.preview && c.preview.length > 280;
    preview.className = 'clip-preview' + (isLong ? '' : ' expanded');
    preview.textContent = c.kind === 'file' ? ('📎 ' + c.filename + ' · ' + formatSize(c.size)) : (c.preview || '');
    if (isLong) preview.addEventListener('click', function () { preview.classList.toggle('expanded'); });
    card.appendChild(preview);

    var meta = document.createElement('div');
    meta.className = 'clip-meta';
    var dateSpan = document.createElement('span');
    dateSpan.textContent = new Date(c.created_at).toLocaleString('fr-FR');
    meta.appendChild(dateSpan);
    var expirySpan = document.createElement('span');
    if (c.expires_at) {
      expirySpan.className = 'clip-countdown';
      expirySpan.dataset.expires = c.expires_at;
    }
    meta.appendChild(expirySpan);
    card.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'clip-actions';
    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary';
    copyBtn.textContent = c.kind === 'file' ? 'Télécharger' : 'Copier';
    copyBtn.addEventListener('click', function () {
      RA.getClip(c.id).then(function (data) {
        if (data.clip.kind === 'file') {
          var a = document.createElement('a');
          a.href = data.clip.content;
          a.download = data.clip.filename || 'fichier';
          a.click();
        } else {
          navigator.clipboard.writeText(data.clip.content).then(function () {
            toast('Copié dans le presse-papier');
          });
        }
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(copyBtn);

    if (c.kind !== 'file') {
      var copyDelBtn = document.createElement('button');
      copyDelBtn.className = 'btn';
      copyDelBtn.textContent = 'Copier puis supprimer';
      copyDelBtn.title = 'Copie le contenu puis met immédiatement l\'entrée à la corbeille';
      copyDelBtn.addEventListener('click', function () {
        RA.getClip(c.id).then(function (data) {
          return navigator.clipboard.writeText(data.clip.content);
        }).then(function () {
          toast('Copié — suppression…');
          return RA.deleteClip(c.id);
        }).then(function () {
          loadClips();
          toast('Copié et mis à la corbeille', 'Annuler', function () { RA.restoreClip(c.id).then(loadClips); });
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      actions.appendChild(copyDelBtn);
    }

    var shareBtn = document.createElement('button');
    shareBtn.className = 'btn';
    shareBtn.textContent = c.share_token && c.share_expires_at > Date.now() ? 'Partagé' : 'Partager';
    shareBtn.title = 'Créer un lien public temporaire (accessible sans mot de passe, 24h max)';
    shareBtn.addEventListener('click', function () {
      if (c.share_token && c.share_expires_at > Date.now()) {
        RA.updateClip(c.id, { share: false }).then(function () { toast('Partage révoqué'); loadClips(); });
        return;
      }
      RA.updateClip(c.id, { share: true, share_ttl_ms: 60 * 60 * 1000 }).then(function (res) {
        var url = location.origin + '/share.html#' + res.share_token;
        navigator.clipboard.writeText(url).catch(function () {});
        toast('Lien public créé et copié (expire dans 1h)');
        loadClips();
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(shareBtn);

    var exportBtn2 = document.createElement('label');
    exportBtn2.className = 'clip-check-label';
    exportBtn2.title = 'Ne jamais inclure dans un export ou une sauvegarde';
    var noExportInput = document.createElement('input');
    noExportInput.type = 'checkbox';
    noExportInput.checked = !!c.no_export;
    noExportInput.addEventListener('change', function () {
      RA.updateClip(c.id, { no_export: noExportInput.checked }).then(function () { toast(noExportInput.checked ? 'Exclu des exports' : 'Inclus dans les exports'); });
    });
    exportBtn2.appendChild(noExportInput);
    exportBtn2.appendChild(document.createTextNode('🚫 export'));
    actions.appendChild(exportBtn2);

    var qrBtn = document.createElement('button');
    qrBtn.className = 'btn';
    qrBtn.textContent = 'QR';
    qrBtn.title = 'Ouvrir sur un autre appareil via QR code';
    qrBtn.addEventListener('click', function () {
      openQr(location.origin + '/app.html?clip=' + c.id);
    });
    actions.appendChild(qrBtn);

    var linkBtn = document.createElement('button');
    linkBtn.className = 'btn';
    linkBtn.textContent = '🔗';
    linkBtn.title = 'Copier le lien direct';
    linkBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(location.origin + '/app.html?clip=' + c.id).then(function () {
        toast('Lien copié');
      });
    });
    actions.appendChild(linkBtn);

    card.appendChild(actions);

    if (c.share_token && c.share_expires_at > Date.now()) {
      var shareRow = document.createElement('div');
      shareRow.className = 'share-row';
      var shareInput = document.createElement('input');
      shareInput.readOnly = true;
      shareInput.value = location.origin + '/share.html#' + c.share_token;
      shareInput.addEventListener('click', function () { shareInput.select(); });
      shareRow.appendChild(shareInput);
      var shareQr = document.createElement('button');
      shareQr.className = 'btn';
      shareQr.textContent = 'QR';
      shareQr.addEventListener('click', function () { openQr(shareInput.value); });
      shareRow.appendChild(shareQr);
      card.appendChild(shareRow);
    }

    return card;
  }

  function loadClips() {
    return RA.listClips().then(function (data) {
      state.clips = data.clips;
      var grid = document.getElementById('clipGrid');
      grid.innerHTML = '';
      document.getElementById('clipEmpty').style.display = data.clips.length ? 'none' : 'block';
      document.getElementById('clipCount').textContent = data.clips.length ? data.clips.length : '';
      data.clips.forEach(function (c) { grid.appendChild(renderClip(c)); });
      updateClipCountdowns();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function updateClipCountdowns() {
    document.querySelectorAll('.clip-countdown').forEach(function (el) {
      var ms = Number(el.dataset.expires) - Date.now();
      if (ms <= 0) {
        el.textContent = 'expiré';
        var card = el.closest('.clip-card');
        if (card && !card.classList.contains('expiring')) {
          card.classList.add('expiring');
          setTimeout(function () { loadClips(); }, 1400);
        }
        return;
      }
      var mins = Math.round(ms / 60000);
      if (mins < 60) el.textContent = 'expire dans ' + mins + ' min';
      else if (mins < 24 * 60) el.textContent = 'expire dans ' + Math.round(mins / 60) + ' h';
      else el.textContent = 'expire dans ' + Math.round(mins / 1440) + ' j';
    });
  }
  setInterval(updateClipCountdowns, 30000);

  document.getElementById('clipPaste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast('Ton navigateur ne permet pas de lire le presse-papier automatiquement');
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (!text) { toast('Le presse-papier est vide'); return; }
      document.getElementById('clipContent').value = text;
      toast('Collé depuis le presse-papier');
    }).catch(function () {
      toast('Autorisation refusée pour lire le presse-papier');
    });
  });

  // ================= VUE AUJOURD'HUI =================

  function renderToday() {
    var container = document.getElementById('todayContent');
    container.innerHTML = '';
    var now = Date.now();
    var due = state.notes.filter(function (n) { return n.remind_at && n.remind_at <= now; })
      .sort(function (a, b) { return a.remind_at - b.remind_at; });
    var openTodos = state.notes.filter(function (n) { return n.kind === 'todo' && !n.done && n.status !== 'someday'; })
      .sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at - b.created_at); });
    var pinned = state.notes.filter(function (n) { return n.pinned && n.kind !== 'todo'; });
    var recentClips = state.clips.slice(0, 5);
    var any = due.length || openTodos.length || pinned.length || recentClips.length;
    document.getElementById('todayEmpty').style.display = any ? 'none' : 'block';

    [
      { title: '⏰ Rappels dus', items: due },
      { title: '✓ Tâches ouvertes', items: openTodos },
      { title: '★ Épinglé', items: pinned },
    ].forEach(function (sec) {
      if (!sec.items.length) return;
      var block = document.createElement('div');
      block.className = 'today-section';
      var h = document.createElement('h3');
      h.textContent = sec.title;
      block.appendChild(h);
      sec.items.forEach(function (n) {
        var row = document.createElement('div');
        row.className = 'today-row';
        var title = document.createElement('div');
        title.className = 'today-title';
        title.textContent = n.title;
        row.appendChild(title);
        var tag = document.createElement('div');
        tag.className = 'today-tag';
        tag.textContent = effectiveSpace(n);
        row.appendChild(tag);
        row.addEventListener('click', function () { jumpToNote(n.id); });
        block.appendChild(row);
      });
      container.appendChild(block);
    });

    if (recentClips.length) {
      var block2 = document.createElement('div');
      block2.className = 'today-section';
      var h2 = document.createElement('h3');
      h2.textContent = '📋 Presse-papier récent';
      block2.appendChild(h2);
      recentClips.forEach(function (c) {
        var row = document.createElement('div');
        row.className = 'today-row';
        var title = document.createElement('div');
        title.className = 'today-title';
        title.textContent = c.label || (c.kind === 'file' ? ('📎 ' + c.filename) : (c.preview || '').slice(0, 60));
        row.appendChild(title);
        row.addEventListener('click', function () { switchTab('clips'); });
        block2.appendChild(row);
      });
      container.appendChild(block2);
    }
  }

  // ================= REVUE HEBDOMADAIRE =================

  var weeklyModal = document.getElementById('weeklyModal');
  document.getElementById('weeklyBtn').addEventListener('click', function () {
    renderWeekly();
    weeklyModal.classList.add('show');
  });
  document.getElementById('weeklyClose').addEventListener('click', function () { weeklyModal.classList.remove('show'); });
  weeklyModal.addEventListener('click', function (e) { if (e.target === weeklyModal) weeklyModal.classList.remove('show'); });

  function weeklyRow(n, container, extra) {
    var row = document.createElement('div');
    row.className = 'weekly-item';
    var t = document.createElement('span');
    t.textContent = n.title;
    row.appendChild(t);
    var meta = document.createElement('span');
    meta.className = 'weekly-item-meta';
    meta.textContent = extra;
    row.appendChild(meta);
    row.addEventListener('click', function () { weeklyModal.classList.remove('show'); jumpToNote(n.id); });
    container.appendChild(row);
  }

  function renderWeekly() {
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    var addedEl = document.getElementById('weeklyAdded');
    addedEl.innerHTML = '';
    state.notes.filter(function (n) { return n.created_at >= weekAgo; })
      .sort(function (a, b) { return b.created_at - a.created_at; })
      .forEach(function (n) { weeklyRow(n, addedEl, noteMeta(n)); });

    var stuckEl = document.getElementById('weeklyStuck');
    stuckEl.innerHTML = '';
    state.notes.filter(function (n) { return n.status !== 'someday' && !n.done && n.created_at < monthAgo; })
      .sort(function (a, b) { return a.created_at - b.created_at; })
      .forEach(function (n) { weeklyRow(n, stuckEl, noteMeta(n)); });

    var archiveEl = document.getElementById('weeklyArchive');
    archiveEl.innerHTML = '';
    state.notes.filter(function (n) { return n.done && n.updated_at < monthAgo; })
      .sort(function (a, b) { return a.updated_at - b.updated_at; })
      .forEach(function (n) { weeklyRow(n, archiveEl, 'terminé le ' + noteMeta(n)); });
  }

  // ================= GRAPHE =================

  function renderGraph() {
    var canvas = document.getElementById('graphCanvas');
    var linked = state.notes.filter(function (n) { return parseLinks(n.links).length; });
    document.getElementById('graphEmpty').style.display = linked.length ? 'none' : 'block';
    canvas.style.display = linked.length ? '' : 'none';
    if (!linked.length) return;

    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = rect.width / 2, cy = rect.height / 2;
    var radius = Math.min(cx, cy) - 60;
    var positions = {};
    linked.forEach(function (n, i) {
      var angle = (i / linked.length) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, n: n };
    });

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.lineWidth = 1.2;
    var drawn = {};
    linked.forEach(function (n) {
      parseLinks(n.links).forEach(function (lid) {
        if (!positions[lid]) return;
        var key = [n.id, lid].sort().join('|');
        if (drawn[key]) return;
        drawn[key] = true;
        var a = positions[n.id], b = positions[lid];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
    });

    Object.keys(positions).forEach(function (id) {
      var p = positions[id];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = p.n.pinned ? '#ffd23f' : '#22d3ee';
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#e2f5ec';
      ctx.textAlign = 'center';
      var label = p.n.title.length > 18 ? p.n.title.slice(0, 17) + '…' : p.n.title;
      ctx.fillText(label, p.x, p.y - 12);
    });

    canvas.onclick = function (e) {
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var hit = Object.keys(positions).find(function (id) {
        var p = positions[id];
        return Math.hypot(p.x - x, p.y - y) < 14;
      });
      if (hit) jumpToNote(hit);
    };
  }

  window.addEventListener('resize', function () {
    if (document.getElementById('view-graph').classList.contains('active')) renderGraph();
  });

  // ================= CORBEILLE =================

  function renderTrashNoteRow(n) {
    var el = document.createElement('div');
    el.className = 'node depth-0';
    el.dataset.kind = n.kind;

    var dot = document.createElement('div');
    dot.className = 'node-dot';
    el.appendChild(dot);

    var body = document.createElement('div');
    body.className = 'node-body';
    var title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = n.title;
    body.appendChild(title);
    el.appendChild(body);

    var actions = document.createElement('div');
    actions.className = 'node-actions';
    actions.style.opacity = 1;

    var restoreBtn = document.createElement('button');
    restoreBtn.className = 'icon-btn restore-btn';
    restoreBtn.textContent = '↺';
    restoreBtn.title = 'Restaurer';
    restoreBtn.addEventListener('click', function () {
      RA.restoreNote(n.id).then(function () { loadTrash(); loadNotes(); });
    });
    actions.appendChild(restoreBtn);

    var purgeBtn = document.createElement('button');
    purgeBtn.className = 'icon-btn';
    purgeBtn.textContent = '×';
    purgeBtn.title = 'Supprimer définitivement';
    purgeBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement « ' + n.title + ' » ?')) return;
      RA.purgeNote(n.id).then(loadTrash);
    });
    actions.appendChild(purgeBtn);

    el.appendChild(actions);
    return el;
  }

  function renderTrashClipCard(c) {
    var card = document.createElement('div');
    card.className = 'clip-card';

    var head = document.createElement('div');
    head.className = 'clip-card-head';
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    head.appendChild(label);
    card.appendChild(head);

    var preview = document.createElement('div');
    preview.className = 'clip-preview expanded';
    preview.textContent = c.kind === 'file' ? ('📎 ' + c.filename) : (c.preview || '');
    card.appendChild(preview);

    var actions = document.createElement('div');
    actions.className = 'clip-actions';
    var restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn restore-btn';
    restoreBtn.textContent = 'Restaurer';
    restoreBtn.addEventListener('click', function () {
      RA.restoreClip(c.id).then(function () { loadTrash(); loadClips(); });
    });
    actions.appendChild(restoreBtn);

    var purgeBtn = document.createElement('button');
    purgeBtn.className = 'btn btn-danger';
    purgeBtn.textContent = 'Supprimer définitivement';
    purgeBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement cette entrée ?')) return;
      RA.purgeClip(c.id).then(loadTrash);
    });
    actions.appendChild(purgeBtn);

    card.appendChild(actions);
    return card;
  }

  function renderReminders() {
    var list = document.getElementById('reminderList');
    list.innerHTML = '';
    var withReminder = state.notes.filter(function (n) { return n.remind_at; })
      .sort(function (a, b) { return a.remind_at - b.remind_at; });
    document.getElementById('reminderEmpty').style.display = withReminder.length ? 'none' : 'block';
    withReminder.forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'reminder-row' + (n.remind_at <= Date.now() ? ' overdue' : '');
      var dateEl = document.createElement('div');
      dateEl.className = 'reminder-date';
      dateEl.textContent = formatRemindAt(n.remind_at);
      row.appendChild(dateEl);
      var titleEl = document.createElement('div');
      titleEl.className = 'reminder-title';
      titleEl.textContent = n.title;
      row.appendChild(titleEl);
      var spaceEl = document.createElement('div');
      spaceEl.className = 'reminder-space';
      spaceEl.textContent = effectiveSpace(n);
      row.appendChild(spaceEl);
      row.addEventListener('click', function () { jumpToNote(n.id); });
      list.appendChild(row);
    });
  }

  function loadTrash() {
    Promise.all([RA.trashNotes(), RA.trashClips()]).then(function (results) {
      var notes = results[0].notes;
      var clips = results[1].clips;
      var total = notes.length + clips.length;
      document.getElementById('trashCount').textContent = total ? total : '';

      var notesEl = document.getElementById('trashNotes');
      notesEl.innerHTML = '';
      notes.forEach(function (n) { notesEl.appendChild(renderTrashNoteRow(n)); });

      var clipsEl = document.getElementById('trashClips');
      clipsEl.innerHTML = '';
      clips.forEach(function (c) { clipsEl.appendChild(renderTrashClipCard(c)); });

      document.getElementById('trashEmpty').style.display = total ? 'none' : 'block';
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ================= INIT =================

  function initFromQuery() {
    var params = new URLSearchParams(location.search);
    if (params.get('tab') === 'clips') switchTab('clips');
    if (params.get('focus') === 'capture') { switchTab('notes'); captureInput.focus(); }
    var clipId = params.get('clip');
    if (clipId) {
      switchTab('clips');
      setTimeout(function () {
        var card = document.querySelector('[data-clip-id="' + clipId + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight');
          setTimeout(function () { card.classList.remove('highlight'); }, 2000);
        }
      }, 400);
    }
  }

  document.getElementById('captureBar').style.display = state.activeSpace === OVERVIEW ? 'none' : '';
  loadNotes();
  loadClips();
  initFromQuery();
  autoBackupIfNeeded();
})();
