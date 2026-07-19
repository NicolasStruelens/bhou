// Racine v50 — boîte d'entrée guidée et radar des racines.
(function () {
  var triageModal = document.getElementById('triageModal');
  var triageIndex = 0;

  function inboxNotes() {
    return state.notes.filter(function (n) { return !!n.inbox && !n.done; })
      .sort(function (a, b) { return a.created_at - b.created_at; });
  }

  function childNotes(root) {
    return state.notes.filter(function (n) { return n.parent_id === root.id; });
  }

  function radarRoots() {
    var now = Date.now();
    return state.notes.filter(function (n) {
      return !n.parent_id && !n.done && n.status !== 'someday' && !n.inbox;
    }).map(function (root) {
      var children = childNotes(root);
      var open = children.filter(function (n) { return n.kind === 'todo' && !n.done && n.status !== 'someday'; });
      var waiting = children.filter(function (n) { return n.energy === 'attente' && !n.done; });
      var age = Math.max(0, Math.floor((now - root.updated_at) / 86400000));
      var score = (root.pinned ? 8 : 0) + (waiting.length ? 6 : 0) + (!open.length ? 5 : 0) + Math.min(7, Math.floor(age / 7));
      return { root: root, open: open.length, waiting: waiting.length, age: age, score: score };
    }).filter(function (x) {
      return x.root.pinned || x.waiting || !x.open || x.age >= 14;
    }).sort(function (a, b) {
      return b.score - a.score || a.root.title.localeCompare(b.root.title);
    }).slice(0, 4);
  }

  function radarReason(item) {
    if (item.waiting) return item.waiting + ' attente' + (item.waiting > 1 ? 's' : '') + ' à clarifier';
    if (!item.open) return 'Aucune prochaine action visible';
    if (item.age >= 14) return 'Silencieuse depuis ' + item.age + ' jours';
    return item.open + ' action' + (item.open > 1 ? 's' : '') + ' ouverte' + (item.open > 1 ? 's' : '');
  }

  function renderInboxCommand() {
    var list = inboxNotes();
    var title = document.getElementById('inboxCommandTitle');
    var hint = document.getElementById('inboxCommandHint');
    var btn = document.getElementById('inboxTriageStart');
    title.textContent = list.length ? list.length + ' pensée' + (list.length > 1 ? 's' : '') + ' à faire germer' : 'Rien à trier';
    hint.textContent = list.length ? 'Quelques décisions courtes suffisent pour retrouver de l’air.' : 'Tout ce qui traverse ton esprit a trouvé sa place.';
    btn.disabled = !list.length;
    btn.textContent = list.length ? 'Trier ' + Math.min(list.length, 9) : 'À jour';
    document.getElementById('inboxCommand').classList.toggle('is-clear', !list.length);
  }

  function renderRadar() {
    var list = radarRoots();
    var container = document.getElementById('projectRadarList');
    var count = document.getElementById('projectRadarCount');
    container.innerHTML = '';
    count.textContent = list.length ? list.length : 'calme';
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'project-radar-empty';
      empty.textContent = 'Chaque racine active possède un prochain pas.';
      container.appendChild(empty);
      return;
    }
    list.forEach(function (item) {
      var button = document.createElement('button');
      button.className = 'project-radar-item';
      button.type = 'button';
      var copy = document.createElement('span');
      var title = document.createElement('strong'); title.textContent = item.root.title; copy.appendChild(title);
      var reason = document.createElement('small'); reason.textContent = radarReason(item); copy.appendChild(reason);
      button.appendChild(copy);
      var arrow = document.createElement('span'); arrow.className = 'project-radar-arrow'; arrow.textContent = '→'; button.appendChild(arrow);
      button.addEventListener('click', function () { switchTab('notes'); jumpToNote(item.root.id); });
      container.appendChild(button);
    });
  }

  function renderTriageThought() {
    var list = inboxNotes();
    if (!list.length) {
      triageModal.classList.remove('show');
      toast('Boîte d’entrée claire — tout a une place.');
      renderInboxCommand();
      return;
    }
    triageIndex = Math.min(triageIndex, list.length - 1);
    var n = list[triageIndex];
    triageModal.dataset.noteId = n.id;
    document.getElementById('triageProgress').textContent = (triageIndex + 1) + ' sur ' + list.length;
    document.getElementById('triageKind').textContent = n.kind === 'todo' ? 'Action' : n.kind === 'note' ? 'Note' : 'Idée';
    document.getElementById('triageThoughtTitle').textContent = n.title;
    var content = document.getElementById('triageThoughtContent');
    content.textContent = n.content || 'Aucun détail pour l’instant.';
    content.classList.toggle('is-empty', !n.content);
  }

  function currentThought() {
    var id = triageModal.dataset.noteId;
    return state.notes.find(function (n) { return n.id === id; });
  }

  function updateCurrent(patch, message) {
    var n = currentThought();
    if (!n) return;
    triageModal.classList.add('is-busy');
    RA.updateNote(n.id, patch).then(function () {
      toast(message);
      return loadNotes();
    }).then(function () {
      triageIndex = 0;
      renderTriageThought();
    }).catch(function (err) {
      toast('Erreur : ' + err.message);
    }).finally(function () { triageModal.classList.remove('is-busy'); });
  }

  function render() {
    renderInboxCommand();
    renderRadar();
    if (triageModal.classList.contains('show')) renderTriageThought();
  }

  document.getElementById('inboxTriageStart').addEventListener('click', function () {
    if (!inboxNotes().length) return;
    triageIndex = 0;
    triageModal.classList.add('show');
    renderTriageThought();
  });
  document.getElementById('triageClose').addEventListener('click', function () { triageModal.classList.remove('show'); });
  triageModal.addEventListener('click', function (e) { if (e.target === triageModal) triageModal.classList.remove('show'); });
  document.getElementById('triageKeep').addEventListener('click', function () { updateCurrent({ inbox: false }, 'Pensée gardée, sans rangement compliqué.'); });
  document.getElementById('triageSomeday').addEventListener('click', function () { updateCurrent({ inbox: false, status: 'someday' }, 'Mise de côté sans pression.'); });
  document.getElementById('triageOrganize').addEventListener('click', function () {
    var n = currentThought();
    if (!n) return;
    triageModal.classList.remove('show');
    switchTab('notes');
    openEditModal(n);
  });
  document.getElementById('triageSkip').addEventListener('click', function () {
    var list = inboxNotes();
    if (!list.length) return;
    triageIndex = (triageIndex + 1) % list.length;
    renderTriageThought();
  });

  window.RAV50 = { render: render };
})();
