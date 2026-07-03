(function () {
  var state = {
    notes: [],
    clips: [],
    kind: 'idee',
    pinned: false,
  };

  // ---------- garde-fou session ----------
  RA.me().catch(function () { location.href = 'login.html'; });

  // ---------- toast ----------
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // ---------- tabs ----------
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('view-' + tab.dataset.view).classList.add('active');
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    RA.logout().then(function () { location.href = 'login.html'; });
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

  var captureInput = document.getElementById('captureInput');
  captureInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !captureInput.value.trim()) return;
    RA.createNote({
      title: captureInput.value.trim(),
      kind: state.kind,
      pinned: state.pinned,
    }).then(function () {
      captureInput.value = '';
      state.pinned = false;
      pinToggle.classList.remove('active');
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

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

  function renderNode(n, depth, container) {
    var el = document.createElement('div');
    el.className = 'node depth-' + Math.min(depth, 3);
    el.dataset.kind = n.kind;
    if (n.pinned) el.classList.add('pinned');
    if (n.done) el.classList.add('done');

    var dot = document.createElement('div');
    dot.className = 'node-dot';
    el.appendChild(dot);

    var body = document.createElement('div');
    body.className = 'node-body';

    var title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = n.title;
    body.appendChild(title);

    if (n.content) {
      var content = document.createElement('div');
      content.className = 'node-content';
      content.textContent = n.content;
      body.appendChild(content);
    }

    var meta = document.createElement('div');
    meta.className = 'node-meta';
    meta.textContent = (n.pinned ? '★ à ne pas oublier · ' : '') + noteMeta(n);
    body.appendChild(meta);

    el.appendChild(body);

    var actions = document.createElement('div');
    actions.className = 'node-actions';

    if (n.kind === 'todo') {
      var doneBtn = document.createElement('button');
      doneBtn.className = 'icon-btn';
      doneBtn.title = n.done ? 'Marquer à faire' : 'Marquer fait';
      doneBtn.textContent = n.done ? '↺' : '✓';
      doneBtn.addEventListener('click', function () {
        RA.updateNote(n.id, { done: !n.done }).then(loadNotes);
      });
      actions.appendChild(doneBtn);
    }

    var pinBtn = document.createElement('button');
    pinBtn.className = 'icon-btn';
    pinBtn.title = 'Épingler';
    pinBtn.textContent = '★';
    pinBtn.addEventListener('click', function () {
      RA.updateNote(n.id, { pinned: !n.pinned }).then(loadNotes);
    });
    actions.appendChild(pinBtn);

    var addChildBtn = document.createElement('button');
    addChildBtn.className = 'icon-btn';
    addChildBtn.title = 'Ajouter une branche';
    addChildBtn.textContent = '+';
    addChildBtn.addEventListener('click', function () {
      var title = prompt('Nouvelle branche sous « ' + n.title + ' » :');
      if (!title || !title.trim()) return;
      RA.createNote({ title: title.trim(), kind: n.kind, parent_id: n.id }).then(loadNotes);
    });
    actions.appendChild(addChildBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Supprimer';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function () {
      if (!confirm('Supprimer « ' + n.title + ' » (et ses branches) ?')) return;
      RA.deleteNote(n.id).then(loadNotes);
    });
    actions.appendChild(delBtn);

    el.appendChild(actions);
    container.appendChild(el);

    n._children.forEach(function (child) { renderNode(child, depth + 1, container); });
  }

  function loadNotes() {
    RA.listNotes().then(function (data) {
      state.notes = data.notes;
      var treeEl = document.getElementById('tree');
      treeEl.innerHTML = '';
      var roots = buildTree(data.notes);
      document.getElementById('emptyState').style.display = data.notes.length ? 'none' : 'block';
      roots.forEach(function (n) { renderNode(n, 0, treeEl); });
    }).catch(function (err) { toast('Erreur : ' + err.message); });
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

    var head = document.createElement('div');
    head.className = 'clip-card-head';
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    head.appendChild(label);
    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Supprimer';
    delBtn.addEventListener('click', function () {
      RA.deleteClip(c.id).then(loadClips);
    });
    head.appendChild(delBtn);
    card.appendChild(head);

    var preview = document.createElement('div');
    preview.className = 'clip-preview';
    preview.textContent = c.kind === 'file' ? ('📎 ' + c.filename + ' · ' + formatSize(c.size)) : (c.preview || '');
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
    card.appendChild(actions);

    return card;
  }

  function loadClips() {
    RA.listClips().then(function (data) {
      state.clips = data.clips;
      var grid = document.getElementById('clipGrid');
      grid.innerHTML = '';
      document.getElementById('clipEmpty').style.display = data.clips.length ? 'none' : 'block';
      document.getElementById('clipCount').textContent = data.clips.length ? data.clips.length : '';
      data.clips.forEach(function (c) { grid.appendChild(renderClip(c)); });
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  loadNotes();
  loadClips();
})();
