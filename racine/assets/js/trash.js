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

