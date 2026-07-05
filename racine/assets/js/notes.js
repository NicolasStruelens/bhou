// Racine — notes : capture, énergie/someday, templates, palette de commandes, tags, liens, édition, arbre, drag & drop
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

  // ---------- opérateurs de recherche : tag: espace: energie: kind: avant: apres: someday: pin: ----------
  function parseSearchQuery(raw) {
    var q = { tag: null, space: null, energy: null, kind: null, before: null, after: null, someday: null, pinned: null };
    var s = raw;
    s = s.replace(/\btag:(\S+)/i, function (_, g) { q.tag = g.replace(/^#/, '').toLowerCase(); return ' '; });
    s = s.replace(/\bespace:(\S+)/i, function (_, g) { q.space = g; return ' '; });
    s = s.replace(/\benergie:(\S+)/i, function (_, g) { q.energy = g.toLowerCase(); return ' '; });
    s = s.replace(/\bkind:(\S+)/i, function (_, g) { q.kind = g.toLowerCase(); return ' '; });
    s = s.replace(/\bavant:(\S+)/i, function (_, g) { var t = Date.parse(g); if (!isNaN(t)) q.before = t; return ' '; });
    s = s.replace(/\bapres:(\S+)/i, function (_, g) { var t = Date.parse(g); if (!isNaN(t)) q.after = t; return ' '; });
    s = s.replace(/\bsomeday:(oui|yes|true)\b/i, function () { q.someday = true; return ' '; });
    s = s.replace(/\bpin:(oui|yes|true)\b/i, function () { q.pinned = true; return ' '; });
    q.text = s.replace(/\s+/g, ' ').trim().toLowerCase();
    return q;
  }
  function hasSearchOperators(q) {
    return !!(q.tag || q.space || q.energy || q.kind || q.before || q.after || q.someday || q.pinned);
  }

  searchInput.addEventListener('input', function () {
    state.searchQuery = parseSearchQuery(searchInput.value.trim());
    state.searchTerm = state.searchQuery.text;
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
    state.searchQuery = parseSearchQuery('');
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
  var editHistoryToggle = document.getElementById('editHistoryToggle');
  var editHistoryList = document.getElementById('editHistoryList');
  var editTargetId = null;
  var editTargetHistory = [];

  function renderHistoryList() {
    editHistoryList.innerHTML = '';
    if (!editTargetHistory.length) {
      var empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'Aucune version précédente enregistrée pour cette note.';
      editHistoryList.appendChild(empty);
      return;
    }
    // plus récent en premier
    editTargetHistory.slice().reverse().forEach(function (v) {
      var item = document.createElement('div');
      item.className = 'history-item';
      var date = document.createElement('div');
      date.className = 'history-date';
      date.textContent = new Date(v.updated_at).toLocaleString('fr-FR');
      item.appendChild(date);
      var title = document.createElement('div');
      title.className = 'history-title';
      title.textContent = v.title;
      item.appendChild(title);
      var restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Restaurer cette version';
      restoreBtn.addEventListener('click', function () {
        editTitle.value = v.title;
        editContent.value = v.content || '';
        editTags.value = v.tags || '';
        editEnergy.value = v.energy || '';
        toast('Version chargée dans le formulaire — clique « Enregistrer » pour confirmer');
      });
      item.appendChild(restoreBtn);
      editHistoryList.appendChild(item);
    });
  }

  editHistoryToggle.addEventListener('click', function () {
    var open = editHistoryList.classList.toggle('hidden') === false;
    editHistoryToggle.textContent = open ? '− masquer l\'historique' : ('🕘 historique des versions (' + editTargetHistory.length + ')');
    if (open) renderHistoryList();
  });

  function openEditModal(n) {
    editTargetId = n.id;
    editTitle.value = n.title;
    editContent.value = n.content || '';
    editTags.value = n.tags || '';
    editKind.value = n.kind;
    editEnergy.value = n.energy || '';
    editSomeday.checked = n.status === 'someday';
    try { editTargetHistory = JSON.parse(n.history || '[]'); } catch (e) { editTargetHistory = []; }
    editHistoryList.classList.add('hidden');
    editHistoryToggle.textContent = '🕘 historique des versions (' + editTargetHistory.length + ')';
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
    var wantsSomeday = state.filterSomeday || (state.searchQuery && state.searchQuery.someday);
    if (wantsSomeday && n.status !== 'someday') return false;
    if (!wantsSomeday && n.status === 'someday') return false;
    if (state.filterTag && parseTags(n.tags).map(function (t) { return t.toLowerCase(); }).indexOf(state.filterTag.toLowerCase()) === -1) return false;
    if (state.searchTerm) {
      var hay = (n.title + ' ' + (n.content || '') + ' ' + (n.tags || '')).toLowerCase();
      if (hay.indexOf(state.searchTerm) === -1) return false;
    }
    var q = state.searchQuery;
    if (q) {
      if (q.tag && parseTags(n.tags).map(function (t) { return t.toLowerCase().replace(/^#/, ''); }).indexOf(q.tag) === -1) return false;
      if (q.space && effectiveSpace(n).toLowerCase() !== q.space.toLowerCase()) return false;
      if (q.energy && (n.energy || '').toLowerCase() !== q.energy) return false;
      if (q.kind && n.kind !== q.kind) return false;
      if (q.someday && n.status !== 'someday') return false;
      if (q.pinned && !n.pinned) return false;
      if (q.before && n.created_at >= q.before) return false;
      if (q.after && n.created_at <= q.after) return false;
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
    var searchActive = !!state.searchTerm || state.filterKind !== 'all' || state.filterPinned || !!state.filterTag || !!state.filterEnergy || hasSearchOperators(state.searchQuery);
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
      if (document.getElementById('view-today').classList.contains('active')) renderToday();
      if (document.getElementById('view-graph').classList.contains('active')) renderGraph();
      if (window.RAStarfield) window.RAStarfield.setNodeCount(12 + data.notes.length);
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

