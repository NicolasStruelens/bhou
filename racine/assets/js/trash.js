// Racine — corbeille (notes + presse-papier), restauration/purge
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
    restoreBtn.appendChild(icon('history'));
    restoreBtn.title = 'Restaurer';
    restoreBtn.setAttribute('aria-label', 'Restaurer');
    restoreBtn.addEventListener('click', function () {
      if (window.RAUniverse) window.RAUniverse.emit('restore', el);
      RA.restoreNote(n.id).then(function () { loadTrash(); loadNotes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(restoreBtn);

    var purgeBtn = document.createElement('button');
    purgeBtn.className = 'icon-btn';
    purgeBtn.appendChild(icon('x'));
    purgeBtn.title = 'Supprimer définitivement';
    purgeBtn.setAttribute('aria-label', 'Supprimer définitivement « ' + n.title + ' »');
    purgeBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement « ' + n.title + ' » ?')) return;
      if (window.RAUniverse) window.RAUniverse.emit('delete', el);
      el.classList.add('removing');
      setTimeout(function () {
        RA.purgeNote(n.id).then(loadTrash).catch(function (err) { toast('Erreur : ' + err.message); el.classList.remove('removing'); });
      }, 190);
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

    var preview;
    if (c.kind === 'file') {
      preview = document.createElement('div');
      preview.className = 'clip-preview expanded';
      preview.appendChild(icon('paperclip', 'icon-inline'));
      preview.appendChild(document.createTextNode(' ' + c.filename));
    } else {
      preview = buildTrashPreview(c.preview || '', 'Afficher le contenu supprimé', !!c.preview_truncated);
    }
    card.appendChild(preview);

    var actions = document.createElement('div');
    actions.className = 'clip-actions';
    var restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn restore-btn';
    restoreBtn.textContent = 'Restaurer';
    restoreBtn.addEventListener('click', function () {
      if (window.RAUniverse) window.RAUniverse.emit('restore', card);
      RA.restoreClip(c.id).then(function () { loadTrash(); loadClips(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(restoreBtn);

    var purgeBtn = document.createElement('button');
    purgeBtn.className = 'btn btn-danger';
    purgeBtn.textContent = 'Supprimer définitivement';
    purgeBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement cette entrée ?')) return;
      if (window.RAUniverse) window.RAUniverse.emit('delete', card);
      card.classList.add('removing');
      setTimeout(function () {
        RA.purgeClip(c.id).then(loadTrash).catch(function (err) { toast('Erreur : ' + err.message); card.classList.remove('removing'); });
      }, 190);
    });
    actions.appendChild(purgeBtn);

    card.appendChild(actions);
    return card;
  }

  function renderTrashRecipeCard(r) {
    var ingredients = [];
    try { ingredients = JSON.parse(r.ingredients || '[]'); } catch (e) {}

    var card = document.createElement('div');
    card.className = 'recipe-card';

    var head = document.createElement('div');
    head.className = 'recipe-card-head';
    var label = document.createElement('span');
    label.className = 'recipe-title';
    label.textContent = r.title;
    head.appendChild(label);
    card.appendChild(head);

    var ingredientText = ingredients.map(function (i) { return typeof formatIngredientLabel === 'function' ? formatIngredientLabel(i) : i.name; }).join(', ');
    var preview = buildTrashPreview(ingredientText, 'Afficher les ingrédients supprimés');
    card.appendChild(preview);

    var actions = document.createElement('div');
    actions.className = 'clip-actions';
    var restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn restore-btn';
    restoreBtn.textContent = 'Restaurer';
    restoreBtn.addEventListener('click', function () {
      if (window.RAUniverse) window.RAUniverse.emit('restore', card);
      RA.restoreRecipe(r.id).then(function () { loadTrash(); loadRecipes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(restoreBtn);

    var purgeBtn = document.createElement('button');
    purgeBtn.className = 'btn btn-danger';
    purgeBtn.textContent = 'Supprimer définitivement';
    purgeBtn.addEventListener('click', function () {
      if (!confirm('Supprimer définitivement « ' + r.title + ' » ?')) return;
      if (window.RAUniverse) window.RAUniverse.emit('delete', card);
      card.classList.add('removing');
      setTimeout(function () {
        RA.purgeRecipe(r.id).then(loadTrash).catch(function (err) { toast('Erreur : ' + err.message); card.classList.remove('removing'); });
      }, 190);
    });
    actions.appendChild(purgeBtn);

    card.appendChild(actions);
    return card;
  }

  function buildTrashPreview(text, label, forceLong) {
    var isLong = !!forceLong || text.length > 280;
    if (!isLong) {
      var shortPreview = document.createElement('div');
      shortPreview.className = 'clip-preview expanded';
      shortPreview.textContent = text;
      return shortPreview;
    }
    var preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'clip-preview trash-preview-toggle';
    preview.textContent = text;
    preview.setAttribute('aria-expanded', 'false');
    preview.setAttribute('aria-label', label);
    preview.addEventListener('click', function () {
      var open = preview.classList.toggle('expanded');
      preview.setAttribute('aria-expanded', open ? 'true' : 'false');
      preview.setAttribute('aria-label', open ? 'Replier le contenu supprimé' : label);
    });
    return preview;
  }

  function renderReminders() {
    var list = document.getElementById('reminderList');
    list.innerHTML = '';
    var withReminder = state.notes.filter(function (n) { return !n.done && n.remind_at; })
      .sort(function (a, b) { return a.remind_at - b.remind_at; });
    document.getElementById('reminderEmpty').style.display = withReminder.length ? 'none' : 'block';
    withReminder.forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'reminder-row' + (n.remind_at <= Date.now() ? ' overdue' : '');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', 'Ouvrir « ' + n.title + ' »');
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
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToNote(n.id); }
      });
      list.appendChild(row);
    });
  }

  function loadTrash() {
    Promise.all([RA.trashNotes(), RA.trashClips(), RA.trashRecipes()]).then(function (results) {
      var notes = results[0].notes;
      var clips = results[1].clips;
      var recipes = results[2].recipes;
      var total = notes.length + clips.length + recipes.length;
      document.getElementById('trashCount').textContent = total ? total : '';

      var notesEl = document.getElementById('trashNotes');
      notesEl.innerHTML = '';
      notes.forEach(function (n) { notesEl.appendChild(renderTrashNoteRow(n)); });

      var clipsEl = document.getElementById('trashClips');
      clipsEl.innerHTML = '';
      clips.forEach(function (c) { clipsEl.appendChild(renderTrashClipCard(c)); });

      var recipesEl = document.getElementById('trashRecipes');
      recipesEl.innerHTML = '';
      recipes.forEach(function (r) { recipesEl.appendChild(renderTrashRecipeCard(r)); });

      document.getElementById('trashEmpty').style.display = total ? 'none' : 'block';
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }
