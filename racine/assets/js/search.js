// Racine — recherche, filtres (kind/pinned/energy/someday), opérateurs de recherche, tags
  // ================= RECHERCHE / FILTRE =================

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

  // ---------- compréhension du langage naturel (FR) : traduit une phrase libre vers les opérateurs
  // ci-dessus, pour ne pas obliger à connaître la syntaxe cachée energie:/kind:/someday:/etc. ----------
  // NB : \b (frontière de mot) de JS ne reconnaît pas les lettres accentuées comme "lettres" (\w = [A-Za-z0-9_]
  // uniquement), donc \bépingl\w*\b échoue silencieusement sur "épinglées". On utilise donc des frontières
  // basées sur les espaces (?:^|\s) / (?=\s|$), et une classe de lettres françaises pour les suffixes accentués.
  var FR = 'a-zàâäéèêëïîôöùûüç';
  function nlWord(word) { return new RegExp('(?:^|\\s)(' + word + ')(?=\\s|$)', 'i'); }

  var NL_KIND_MAP = [
    { re: nlWord('idées?'), kind: 'idee' },
    { re: nlWord('tâches?|à faire'), kind: 'todo' },
    { re: nlWord('notes?'), kind: 'note' },
  ];
  var NL_ENERGY_MAP = [
    { re: nlWord('2\\s?min(?:utes)?|deux minutes'), energy: '2min' },
    { re: nlWord('faciles?'), energy: 'facile' },
    { re: nlWord('profondes?'), energy: 'profond' },
    { re: nlWord('urgentes?'), energy: 'urgent' },
    { re: nlWord('en attente|attente'), energy: 'attente' },
  ];
  var NL_SOMEDAY_RE = nlWord('someday|un jour|parking mental|plus tard');
  var NL_PINNED_RE = nlWord('épingl[' + FR + ']*|à ne pas oublier');

  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek(ts) { var d = new Date(ts); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfMonth(ts) { var d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function naturalToOperators(raw) {
    var s = raw;
    var now = Date.now();
    var ops = [];

    NL_KIND_MAP.forEach(function (m) { if (m.re.test(s)) { ops.push('kind:' + m.kind); s = s.replace(m.re, ' '); } });
    NL_ENERGY_MAP.forEach(function (m) { if (m.re.test(s)) { ops.push('energie:' + m.energy); s = s.replace(m.re, ' '); } });
    if (NL_SOMEDAY_RE.test(s)) { ops.push('someday:oui'); s = s.replace(NL_SOMEDAY_RE, ' '); }
    if (NL_PINNED_RE.test(s)) { ops.push('pin:oui'); s = s.replace(NL_PINNED_RE, ' '); }

    var reAujourdhui = nlWord("aujourd'?hui");
    var reHier = nlWord('hier');
    var reSemaine = nlWord('cette semaine');
    var reMois = nlWord('ce mois-?ci|ce mois');
    var reMoisDernier = nlWord('(?:le )?mois dernier');
    if (reAujourdhui.test(s)) {
      ops.push('apres:' + new Date(startOfDay(now)).toISOString());
      s = s.replace(reAujourdhui, ' ');
    } else if (reHier.test(s)) {
      ops.push('apres:' + new Date(startOfDay(now) - 86400000).toISOString());
      ops.push('avant:' + new Date(startOfDay(now)).toISOString());
      s = s.replace(reHier, ' ');
    } else if (reSemaine.test(s)) {
      ops.push('apres:' + new Date(startOfWeek(now)).toISOString());
      s = s.replace(reSemaine, ' ');
    } else if (reMois.test(s)) {
      ops.push('apres:' + new Date(startOfMonth(now)).toISOString());
      s = s.replace(reMois, ' ');
    } else if (reMoisDernier.test(s)) {
      var thisMonthStart = startOfMonth(now);
      var lastMonthDate = new Date(thisMonthStart);
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      ops.push('apres:' + lastMonthDate.toISOString());
      ops.push('avant:' + new Date(thisMonthStart).toISOString());
      s = s.replace(reMoisDernier, ' ');
    }

    // reconnaît un espace existant cité tel quel dans la requête (ex. "idées maison" si "Maison" est un espace)
    if (typeof allSpaces === 'function') {
      allSpaces().forEach(function (name) {
        if (name === 'Général') return;
        var re = nlWord(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (re.test(s)) { ops.push('espace:' + name); s = s.replace(re, ' '); }
      });
    }

    s = s.replace(/\s+/g, ' ').trim();
    return (ops.join(' ') + ' ' + s).trim();
  }

  searchInput.addEventListener('input', function () {
    state.searchQuery = parseSearchQuery(naturalToOperators(searchInput.value.trim()));
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
      var words = state.searchTerm.split(/\s+/).filter(Boolean);
      if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return false;
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
