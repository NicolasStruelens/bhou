// Racine — liens entre notes ("voir aussi"), modal de liaison, navigation vers une note
  // ================= LIENS ENTRE NOTES =================

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
    ]).then(function () { loadNotes(); toast('Notes liées'); }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function removeLink(aId, bId) {
    var a = state.notes.find(function (n) { return n.id === aId; });
    var b = state.notes.find(function (n) { return n.id === bId; });
    var updates = [];
    if (a) updates.push(RA.updateNote(aId, { links: parseLinks(a.links).filter(function (x) { return x !== bId; }).join(',') }));
    if (b) updates.push(RA.updateNote(bId, { links: parseLinks(b.links).filter(function (x) { return x !== aId; }).join(',') }));
    Promise.all(updates).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
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

  // ---------- "faire germer" v1 : suggestions de notes proches sans IA distante ----------
  // Règles : jamais de liaison automatique, 3 suggestions max, un geste pour accepter,
  // "ignorer" est permanent (mémorisé localement) — voir la vision de l'audit produit.

  var DISMISSED_SUGGESTIONS_KEY = 'racine_dismissed_suggestions';

  function dismissedSuggestions() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_SUGGESTIONS_KEY) || '[]'); } catch (e) { return []; }
  }
  function suggestionKey(aId, bId) { return [aId, bId].sort().join('|'); }
  function dismissSuggestion(aId, bId) {
    var list = dismissedSuggestions();
    var key = suggestionKey(aId, bId);
    if (list.indexOf(key) === -1) list.push(key);
    localStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(list));
  }

  var DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
  function wordsOf(str) {
    var noAccents = (str || '').toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
    return noAccents.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; });
  }

  function similarityScore(a, b) {
    if (a.id === b.id) return 0;
    if (parseLinks(a.links).indexOf(b.id) !== -1) return 0; // déjà lié, pas la peine de suggérer
    var score = 0;
    var aTags = parseTags(a.tags).map(function (t) { return t.toLowerCase(); });
    var bTags = parseTags(b.tags).map(function (t) { return t.toLowerCase(); });
    score += aTags.filter(function (t) { return bTags.indexOf(t) !== -1; }).length * 3;
    if (effectiveSpace(a) === effectiveSpace(b)) score += 1;
    var aWords = wordsOf(a.title + ' ' + a.content);
    var bWords = wordsOf(b.title + ' ' + b.content);
    var sharedWords = aWords.filter(function (w) { return bWords.indexOf(w) !== -1; });
    score += Math.min(sharedWords.length, 5) * 1.5;
    return score;
  }

  function findSimilarNotes(n, max) {
    var dismissed = dismissedSuggestions();
    return state.notes
      .filter(function (x) { return x.id !== n.id && dismissed.indexOf(suggestionKey(n.id, x.id)) === -1; })
      .map(function (x) { return { note: x, score: similarityScore(n, x) }; })
      .filter(function (s) { return s.score >= 3; }) // seuil minimal : évite le bruit sur des correspondances faibles
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, max || 3)
      .map(function (s) { return s.note; });
  }

  function renderSimilarNotes(n) {
    var container = document.getElementById('editSimilarNotes');
    container.innerHTML = '';
    var matches = findSimilarNotes(n, 3);
    if (!matches.length) return;
    var label = document.createElement('div');
    label.className = 'similar-notes-label';
    label.textContent = 'Notes proches (jamais liées automatiquement) :';
    container.appendChild(label);
    matches.forEach(function (m) {
      var row = document.createElement('div');
      row.className = 'similar-note-row';
      var title = document.createElement('span');
      title.className = 'similar-note-title';
      title.textContent = m.title;
      row.appendChild(title);
      var linkBtn = document.createElement('button');
      linkBtn.className = 'btn';
      linkBtn.type = 'button';
      linkBtn.textContent = 'Relier';
      linkBtn.addEventListener('click', function () { addLink(n.id, m.id); row.remove(); });
      row.appendChild(linkBtn);
      var ignoreBtn = document.createElement('button');
      ignoreBtn.className = 'icon-btn';
      ignoreBtn.type = 'button';
      ignoreBtn.title = 'Ignorer cette suggestion définitivement';
      ignoreBtn.setAttribute('aria-label', 'Ignorer cette suggestion définitivement');
      ignoreBtn.appendChild(icon('x'));
      ignoreBtn.addEventListener('click', function () { dismissSuggestion(n.id, m.id); row.remove(); });
      row.appendChild(ignoreBtn);
      container.appendChild(row);
    });
  }
