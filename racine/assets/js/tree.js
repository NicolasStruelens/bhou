// Racine — arbre/hiérarchie parent-enfant, espaces (multi-projets), glisser-déposer
  // ================= ARBRE / ESPACES / DRAG & DROP =================

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
      var btn = document.createElement('div');
      btn.className = 'space-pill' + (state.activeSpace === name ? ' active' : '');
      btn.setAttribute('role', 'group');
      btn.setAttribute('aria-label', 'Espace ' + name);
      applySpaceColorVars(btn, name);
      var selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'space-pill-main';
      selectBtn.setAttribute('aria-pressed', state.activeSpace === name ? 'true' : 'false');
      var dot = document.createElement('span'); dot.className = 'dot';
      selectBtn.appendChild(dot);
      selectBtn.appendChild(document.createTextNode(name));
      selectBtn.addEventListener('click', function () { setActiveSpace(name); });
      btn.appendChild(selectBtn);

      var colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'space-pill-color';
      colorBtn.appendChild(icon('droplet'));
      colorBtn.title = 'Choisir une couleur';
      colorBtn.setAttribute('aria-label', 'Choisir une couleur pour « ' + name + ' »');
      function openColorFor(e) {
        e.stopPropagation();
        openColorPicker(name);
        colorModal.classList.add('show');
      }
      colorBtn.addEventListener('click', openColorFor);
      btn.appendChild(colorBtn);

      if (name !== 'Général') {
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'space-pill-edit';
        editBtn.appendChild(icon('pencil'));
        editBtn.title = 'Renommer l\'espace « ' + name + ' »';
        editBtn.setAttribute('aria-label', editBtn.title);
        function renameFor(e) { e.stopPropagation(); renameSpace(name); }
        editBtn.addEventListener('click', renameFor);
        btn.appendChild(editBtn);

        var delX = document.createElement('button');
        delX.type = 'button';
        delX.className = 'space-pill-del';
        delX.appendChild(icon('x'));
        delX.title = 'Supprimer l\'espace « ' + name + ' »';
        delX.setAttribute('aria-label', delX.title);
        function deleteFor(e) { e.stopPropagation(); deleteSpace(name); }
        delX.addEventListener('click', deleteFor);
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
      RA.updateNote(draggedId, { parent_id: targetNote.id, position: Date.now() }).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
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
      Promise.all(updates).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
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
