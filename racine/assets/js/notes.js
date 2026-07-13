// Racine — notes : édition complète, rendu des cartes, chargement/état de la vue
  // ================= NOTES =================

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

  function setHistoryToggleLabel(open) {
    editHistoryToggle.innerHTML = '';
    if (!open) editHistoryToggle.appendChild(icon('history'));
    editHistoryToggle.appendChild(document.createTextNode(open ? ' masquer l\'historique' : (' historique des versions (' + editTargetHistory.length + ')')));
  }

  editHistoryToggle.addEventListener('click', function () {
    var open = editHistoryList.classList.toggle('hidden') === false;
    setHistoryToggleLabel(open);
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
    setHistoryToggleLabel(false);
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

  function noteMeta(n) {
    var d = new Date(n.created_at);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    if (n.pinned) {
      meta.appendChild(icon('star', 'icon-inline'));
      meta.appendChild(document.createTextNode(' à ne pas oublier · '));
    }
    meta.appendChild(document.createTextNode(noteMeta(n)));
    if (n.remind_at) {
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(icon('clock', 'icon-inline'));
      meta.appendChild(document.createTextNode(' ' + formatRemindAt(n.remind_at)));
    }
    if (n.status === 'someday') {
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(icon('clock-later', 'icon-inline'));
      meta.appendChild(document.createTextNode(' someday'));
    }
    if (n.energy && ENERGY_LABELS[n.energy]) {
      var energyBadge = document.createElement('span');
      energyBadge.className = 'node-energy';
      energyBadge.appendChild(icon(ENERGY_LABELS[n.energy].icon, 'icon-inline'));
      energyBadge.appendChild(document.createTextNode(' ' + ENERGY_LABELS[n.energy].text));
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
        label.tabIndex = 0;
        label.setAttribute('role', 'button');
        label.setAttribute('aria-label', 'Ouvrir « ' + target.title + ' »');
        label.appendChild(icon('link', 'icon-inline'));
        label.appendChild(document.createTextNode(' ' + target.title));
        label.addEventListener('click', function (e) { e.stopPropagation(); jumpToNote(lid); });
        label.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); jumpToNote(lid); }
        });
        chip.appendChild(label);
        var unlinkX = document.createElement('span');
        unlinkX.className = 'unlink-x';
        unlinkX.tabIndex = 0;
        unlinkX.setAttribute('role', 'button');
        unlinkX.appendChild(icon('x', 'icon-inline'));
        unlinkX.title = 'Retirer le lien';
        unlinkX.setAttribute('aria-label', 'Retirer le lien vers « ' + target.title + ' »');
        unlinkX.addEventListener('click', function (e) { e.stopPropagation(); removeLink(n.id, lid); });
        unlinkX.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); removeLink(n.id, lid); }
        });
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
    ]).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function buildActions(n, flat) {
    var actions = document.createElement('div');
    actions.className = 'node-actions';

    var doneBtn = document.createElement('button');
    doneBtn.className = 'icon-btn';
    doneBtn.title = n.done ? 'Marquer non terminé' : 'Marquer terminé';
    doneBtn.setAttribute('aria-label', doneBtn.title);
    doneBtn.appendChild(icon(n.done ? 'history' : 'check'));
    doneBtn.addEventListener('click', function () {
      RA.updateNote(n.id, { done: !n.done }).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(doneBtn);

    var pinBtn = document.createElement('button');
    pinBtn.className = 'icon-btn';
    pinBtn.title = 'Épingler';
    pinBtn.setAttribute('aria-label', 'Épingler');
    pinBtn.appendChild(icon('star'));
    pinBtn.addEventListener('click', function () {
      RA.updateNote(n.id, { pinned: !n.pinned }).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(pinBtn);

    var remindBtn = document.createElement('button');
    remindBtn.className = 'icon-btn';
    remindBtn.title = n.remind_at ? 'Modifier le rappel' : 'Ajouter un rappel daté';
    remindBtn.setAttribute('aria-label', remindBtn.title);
    remindBtn.appendChild(icon('clock'));
    remindBtn.addEventListener('click', function () { openRemindModal(n); });
    actions.appendChild(remindBtn);

    var linkBtn = document.createElement('button');
    linkBtn.className = 'icon-btn';
    linkBtn.title = 'Lier à une autre note ("voir aussi")';
    linkBtn.setAttribute('aria-label', linkBtn.title);
    linkBtn.appendChild(icon('link'));
    linkBtn.addEventListener('click', function () { openLinkModal(n); });
    actions.appendChild(linkBtn);

    var editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Modifier';
    editBtn.setAttribute('aria-label', 'Modifier');
    editBtn.appendChild(icon('pencil'));
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
        upBtn.setAttribute('aria-label', 'Monter');
        upBtn.appendChild(icon('chevron-up'));
        upBtn.addEventListener('click', function () { swapPosition(n, siblings[idx - 1]); });
        actions.appendChild(upBtn);
      }
      if (idx !== -1 && idx < siblings.length - 1) {
        var downBtn = document.createElement('button');
        downBtn.className = 'icon-btn';
        downBtn.title = 'Descendre';
        downBtn.setAttribute('aria-label', 'Descendre');
        downBtn.appendChild(icon('chevron-down'));
        downBtn.addEventListener('click', function () { swapPosition(n, siblings[idx + 1]); });
        actions.appendChild(downBtn);
      }
      if (n.parent_id) {
        var detachBtn = document.createElement('button');
        detachBtn.className = 'icon-btn';
        detachBtn.title = 'Détacher (devient une racine)';
        detachBtn.setAttribute('aria-label', 'Détacher (devient une racine)');
        detachBtn.appendChild(icon('detach'));
        detachBtn.addEventListener('click', function () {
          RA.updateNote(n.id, { parent_id: null, position: Date.now(), space: effectiveSpace(n) }).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
        });
        actions.appendChild(detachBtn);
      }

      var addChildBtn = document.createElement('button');
      addChildBtn.className = 'icon-btn';
      addChildBtn.title = 'Ajouter une branche';
      addChildBtn.setAttribute('aria-label', 'Ajouter une branche');
      addChildBtn.appendChild(icon('plus'));
      addChildBtn.addEventListener('click', function () {
        var title = prompt('Nouvelle branche sous « ' + n.title + ' » :');
        if (!title || !title.trim()) return;
        state.collapsed.delete(n.id);
        RA.createNote({ title: title.trim(), kind: n.kind, parent_id: n.id }).then(function (res) {
          state.lastAddedId = res.id;
          loadNotes();
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      actions.appendChild(addChildBtn);
    }

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Mettre à la corbeille';
    delBtn.setAttribute('aria-label', 'Mettre à la corbeille');
    delBtn.appendChild(icon('x'));
    delBtn.addEventListener('click', function () {
      if (!confirm('Mettre « ' + n.title + ' » (et ses branches) à la corbeille ?')) return;
      var row = delBtn.closest('.node, .root-card, .branch-row');
      if (row) row.classList.add('removing');
      setTimeout(function () {
        RA.deleteNote(n.id).then(function () {
          loadNotes();
          toast('Mis à la corbeille', 'Annuler', function () {
            RA.restoreNote(n.id).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
          });
        }).catch(function (err) { toast('Erreur : ' + err.message); if (row) row.classList.remove('removing'); });
      }, row ? 190 : 0);
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
      collapseBtn.setAttribute('aria-label', 'Replier ou déplier les branches');
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
      statsChip.appendChild(icon('trend', 'icon-inline'));
      statsChip.appendChild(document.createTextNode(' '));
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
    RA.updateNote(state.dragId, { parent_id: null, position: Date.now(), space: state.activeSpace }).then(loadNotes).catch(function (err) { toast('Erreur : ' + err.message); });
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
