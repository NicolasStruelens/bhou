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
