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
  };

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

  function submitCapture() {
    var title = captureInput.value.trim();
    if (!title) { captureInput.focus(); return; }
    RA.createNote({
      title: title,
      content: captureDetails.value.trim(),
      kind: state.kind,
      pinned: state.pinned,
      space: state.activeSpace === OVERVIEW ? 'Général' : state.activeSpace,
    }).then(function (res) {
      captureInput.value = '';
      captureDetails.value = '';
      captureDetails.classList.remove('open');
      detailToggle.classList.remove('active');
      detailToggle.textContent = '+ ajouter des détails';
      state.pinned = false;
      pinToggle.classList.remove('active');
      captureBar.classList.remove('has-value');
      state.lastAddedId = res.id;
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

  function matchesFilter(n) {
    if (state.filterKind !== 'all' && n.kind !== state.filterKind) return false;
    if (state.filterPinned && !n.pinned) return false;
    if (state.searchTerm) {
      var hay = (n.title + ' ' + (n.content || '')).toLowerCase();
      if (hay.indexOf(state.searchTerm) === -1) return false;
    }
    return true;
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
    localStorage.setItem('racine_active_space', name);
    document.getElementById('captureBar').style.display = name === OVERVIEW ? 'none' : '';
    renderSpaceBar();
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
    meta.textContent = (n.pinned ? '★ à ne pas oublier · ' : '') + noteMeta(n);
    body.appendChild(meta);

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
    var searchActive = !!state.searchTerm || state.filterKind !== 'all' || state.filterPinned;
    searchAllSpacesBtn.style.display = (searchActive && state.activeSpace !== OVERVIEW) ? '' : 'none';

    if (state.activeSpace === OVERVIEW) {
      var overdue = state.notes.filter(function (n) {
        return (n.pinned || (n.kind === 'todo' && !n.done)) && matchesFilter(n);
      });
      document.getElementById('emptyState').style.display = overdue.length ? 'none' : 'block';
      if (emptyMsg) emptyMsg.textContent = 'Rien d\'épinglé ni de tâche en attente, dans aucun espace. Tout est calme.';
      renderOverviewSummary(overdue);
      overdue.forEach(function (n) { renderFlatNode(n, treeEl, effectiveSpace(n), true); });
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
      var roots = buildTree(state.notes).filter(function (r) { return (r.space || 'Général') === state.activeSpace; });
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
      renderNotesView();
      checkReminders();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ================= RAPPELS =================

  var REMINDER_KEY = 'racine_reminders_enabled';
  var REMINDER_DAYS_KEY = 'racine_reminder_days';
  var NOTIFIED_KEY = 'racine_notified_map';
  var reminderToggle = document.getElementById('reminderToggle');

  function reminderDays() { return Number(localStorage.getItem(REMINDER_DAYS_KEY) || 3); }

  function checkReminders() {
    if (localStorage.getItem(REMINDER_KEY) !== '1') return;
    var days = reminderDays();
    var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    var overdue = state.notes.filter(function (n) {
      var relevant = n.pinned || (n.kind === 'todo' && !n.done);
      return relevant && n.created_at <= cutoff;
    });
    if (!overdue.length) return;

    var notifiedMap = {};
    try { notifiedMap = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch (e) {}
    var today = new Date().toDateString();
    var toNotify = overdue.filter(function (n) { return notifiedMap[n.id] !== today; });

    if (toNotify.length && 'Notification' in window && Notification.permission === 'granted') {
      var body = toNotify.slice(0, 3).map(function (n) { return '• ' + n.title; }).join('\n')
        + (toNotify.length > 3 ? '\n… et ' + (toNotify.length - 3) + ' autre(s)' : '');
      new Notification('Racine — ' + toNotify.length + ' chose(s) à ne pas oublier', { body: body });
      toNotify.forEach(function (n) { notifiedMap[n.id] = today; });
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedMap));
    }
    toast(overdue.length + ' élément(s) en attente depuis plus de ' + days + ' jour(s)');
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

  // ================= QR (modale) =================

  var qrModal = document.getElementById('qrModal');
  var qrImage = document.getElementById('qrImage');
  document.getElementById('qrClose').addEventListener('click', function () { qrModal.classList.remove('show'); });
  qrModal.addEventListener('click', function (e) { if (e.target === qrModal) qrModal.classList.remove('show'); });

  function openQr(url) {
    qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    qrModal.classList.add('show');
  }

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

    RA.createClip(payload).then(function () {
      document.getElementById('clipContent').value = '';
      document.getElementById('clipLabel').value = '';
      document.getElementById('clipFile').value = '';
      clipFileData = null;
      loadClips();
      toast('Envoyé — récupérable sur tes autres appareils');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    return (bytes / 1024).toFixed(1) + ' Ko';
  }

  function renderClip(c) {
    var card = document.createElement('div');
    card.className = 'clip-card';
    card.dataset.clipId = c.id;

    var head = document.createElement('div');
    head.className = 'clip-card-head';
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    head.appendChild(label);
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
    var d = new Date(c.created_at);
    var expiresTxt = c.expires_at ? ('expire ' + new Date(c.expires_at).toLocaleString('fr-FR')) : '';
    meta.innerHTML = '<span>' + d.toLocaleString('fr-FR') + '</span><span>' + expiresTxt + '</span>';
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

    var qrBtn = document.createElement('button');
    qrBtn.className = 'btn';
    qrBtn.textContent = 'QR';
    qrBtn.title = 'Ouvrir sur un autre appareil via QR code';
    qrBtn.addEventListener('click', function () {
      openQr(location.origin + '/app.html?clip=' + c.id);
    });
    actions.appendChild(qrBtn);

    card.appendChild(actions);

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
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

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
})();
