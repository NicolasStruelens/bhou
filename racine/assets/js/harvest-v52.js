// Racine v52 — la Récolte : finir fait disparaître, fermer une branche reste un choix conscient.
(function () {
  var DAY = 86400000;
  var finishModal = document.getElementById('finishModal');
  var currentFinishId = null;

  function byId(id) { return state.notes.find(function (n) { return n.id === id; }); }
  function ts(value) { var n = Number(value); return isFinite(n) ? n : 0; }
  function isActive(n) { return n && !n.done && n.status !== 'someday'; }
  function children(id) { return state.notes.filter(function (n) { return n.parent_id === id; }); }
  function descendants(id) {
    var result = [], queue = children(id).slice(), seen = {};
    while (queue.length) {
      var n = queue.shift();
      if (!n || seen[n.id]) continue;
      seen[n.id] = true; result.push(n);
      queue = queue.concat(children(n.id));
    }
    return result;
  }
  function spaceOf(n) { return typeof effectiveSpace === 'function' ? effectiveSpace(n) : (n.space || 'Général'); }
  function branchMetrics(root) {
    var branch = descendants(root.id);
    var tasks = branch.filter(function (n) { return n.kind === 'todo'; });
    if (root.kind === 'todo') tasks.unshift(root);
    var doneTasks = tasks.filter(function (n) { return n.done; });
    var openTasks = tasks.filter(isActive);
    var openOther = branch.filter(function (n) { return isActive(n) && n.kind !== 'todo'; });
    var ratio = tasks.length ? doneTasks.length / tasks.length : (openOther.length ? 0 : 1);
    return { branch: branch, tasks: tasks, doneTasks: doneTasks, openTasks: openTasks, openOther: openOther, ratio: ratio };
  }

  // Une animation brève matérialise le soulagement, puis l'élément quitte vraiment la vue.
  function bloom(element) {
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var rect = element.getBoundingClientRect();
    var burst = document.createElement('div'); burst.className = 'harvest-bloom';
    burst.style.left = (rect.left + Math.min(rect.width - 30, rect.width * .78)) + 'px';
    burst.style.top = (rect.top + rect.height * .5) + 'px';
    for (var i = 0; i < 7; i++) {
      var leaf = document.createElement('span');
      leaf.style.setProperty('--a', (i * 51) + 'deg');
      leaf.style.setProperty('--d', (22 + (i % 3) * 9) + 'px');
      burst.appendChild(leaf);
    }
    document.body.appendChild(burst);
    setTimeout(function () { burst.remove(); }, 720);
  }
  function optimisticDone(ids, value) {
    ids.forEach(function (id) { var n = byId(id); if (n) n.done = value; });
  }
  function refreshAfterMutation() {
    return loadNotes().then(function () {
      renderCompleted(); renderFinishPulse();
      if (finishModal.classList.contains('show') && currentFinishId && byId(currentFinishId) && !byId(currentFinishId).done) renderFinishModal();
    });
  }
  function finishIds(ids, options) {
    options = options || {};
    ids = ids.filter(function (id, index) { return ids.indexOf(id) === index; });
    // Ne modifier que ce qui est encore ouvert : ainsi « Annuler » restaure exactement
    // le geste courant sans rouvrir d'anciennes tâches déjà récoltées auparavant.
    var changedIds = ids.filter(function (id) { var n = byId(id); return n && !n.done; });
    if (!changedIds.length) return Promise.resolve();
    var element = options.element;
    if (window.RAUniverse) window.RAUniverse.emit('harvest', element || document.querySelector('#finishModal .finish-root-card'));
    if (element) { bloom(element); element.classList.add('harvest-away'); }
    var delay = element ? 210 : 0;
    return new Promise(function (resolve) { setTimeout(resolve, delay); }).then(function () {
      return Promise.all(changedIds.map(function (id) { return RA.updateNote(id, { done: true }); }));
    }).then(function () {
      optimisticDone(changedIds, true);
      return refreshAfterMutation();
    }).then(function () {
      if (!options.quiet) {
        toast(ids.length > 1 ? 'Branche récoltée — elle a quitté tes vues actives.' : 'Récolté — cette tâche ne reste plus sous tes yeux.', 'Annuler', function () {
          Promise.all(changedIds.map(function (id) { return RA.updateNote(id, { done: false }); })).then(function () {
            optimisticDone(changedIds, false); return refreshAfterMutation();
          }).catch(function (err) { toast('Erreur : ' + err.message); });
        });
      }
    }).catch(function (err) {
      if (element) element.classList.remove('harvest-away');
      toast('Erreur : ' + err.message);
      throw err;
    });
  }
  function reopenIds(ids, source) {
    if (window.RAUniverse) window.RAUniverse.emit('restore', source);
    return Promise.all(ids.map(function (id) { return RA.updateNote(id, { done: false }); })).then(function () {
      optimisticDone(ids, false);
      return refreshAfterMutation();
    }).then(function () { toast(ids.length > 1 ? 'Branche rouverte dans Racines.' : 'Élément rouvert dans Racines.'); });
  }
  function complete(note, element) {
    var openBelow = descendants(note.id).filter(isActive);
    if (openBelow.length) { openFinish(note.id); return Promise.resolve({ guided: true }); }
    return finishIds([note.id], { element: element });
  }

  // ---------- Rituel de fermeture ----------
  function finishCandidate() {
    var now = Date.now();
    var ranked = state.notes.filter(function (n) { return !n.parent_id && isActive(n) && !n.inbox; }).map(function (root) {
      var m = branchMetrics(root);
      var age = Math.max(0, Math.floor((now - ts(root.updated_at)) / DAY));
      var finishable = m.openTasks.length > 0 && m.openTasks.length <= 6;
      var score = m.doneTasks.length * 32 + Math.round(m.ratio * 45) + Math.min(age, 30) + (root.pinned ? 8 : 0) - m.openTasks.length * 3;
      return { root: root, metrics: m, age: age, score: score, finishable: finishable };
    }).filter(function (x) {
      return x.finishable && (x.metrics.doneTasks.length > 0 || x.age >= 12 || x.metrics.openTasks.length <= 2);
    }).sort(function (a, b) { return b.score - a.score; });
    return ranked[0] || null;
  }
  function renderFinishPulse() {
    var el = document.getElementById('finishPulse');
    var candidate = finishCandidate();
    if (!candidate) { el.classList.add('hidden'); el.dataset.noteId = ''; return; }
    var m = candidate.metrics;
    el.classList.remove('hidden'); el.dataset.noteId = candidate.root.id;
    document.getElementById('finishPulseTitle').textContent = candidate.root.title;
    document.getElementById('finishPulseHint').textContent = m.openTasks.length + ' action' + (m.openTasks.length > 1 ? 's restent' : ' reste') + ' avant de libérer cette branche.';
    document.getElementById('finishPulseBar').style.width = Math.max(8, Math.round(m.ratio * 100)) + '%';
  }
  function finishRow(note) {
    var row = document.createElement('div'); row.className = 'finish-open-row';
    var done = document.createElement('button'); done.className = 'finish-check'; done.type = 'button'; done.setAttribute('aria-label', 'Terminer « ' + note.title + ' »'); done.appendChild(icon('check'));
    var copy = document.createElement('div');
    var title = document.createElement('strong'); title.textContent = note.title; copy.appendChild(title);
    var meta = document.createElement('small'); meta.textContent = (note.effort_minutes ? '≈ ' + note.effort_minutes + ' min · ' : '') + spaceOf(note); copy.appendChild(meta);
    row.appendChild(done); row.appendChild(copy);
    done.addEventListener('click', function () {
      finishIds([note.id], { element: row, quiet: true }).then(function () { if (finishModal.classList.contains('show')) renderFinishModal(); }).catch(function () {});
    });
    return row;
  }
  function renderFinishModal() {
    var root = byId(currentFinishId); if (!root) { finishModal.classList.remove('show'); return; }
    var m = branchMetrics(root);
    var total = m.tasks.length;
    var doneCount = m.doneTasks.length;
    document.getElementById('finishRootSpace').textContent = spaceOf(root);
    document.getElementById('finishRootTitle').textContent = root.title;
    document.getElementById('finishProgressText').textContent = total ? doneCount + ' / ' + total + ' actions' : m.branch.length + ' branches';
    document.getElementById('finishProgressBar').style.width = Math.round(m.ratio * 100) + '%';
    document.getElementById('finishOpenCount').textContent = m.openTasks.length ? m.openTasks.length + ' à fermer' : 'aucune action ouverte';
    var list = document.getElementById('finishOpenList'); list.innerHTML = '';
    m.openTasks.slice(0, 6).forEach(function (n) { list.appendChild(finishRow(n)); });
    if (!m.openTasks.length) {
      var ready = document.createElement('div'); ready.className = 'finish-ready'; ready.appendChild(icon('leaf')); ready.appendChild(document.createTextNode(' La branche est prête à quitter tes vues actives.')); list.appendChild(ready);
    }
    var hiddenCount = Math.max(0, m.openTasks.length - 6);
    document.getElementById('finishCalmNote').textContent = hiddenCount ? hiddenCount + ' autres actions restent visibles dans Racines.' : m.openOther.length ? m.openOther.length + ' idées ou notes font aussi partie de cette branche ; elles seront conservées dans la Récolte.' : 'Fermer ne détruit rien : toute la branche restera réouvrable depuis la Récolte.';
  }
  function openFinish(id) {
    var root = byId(id); if (!root) return;
    currentFinishId = root.id; renderFinishModal(); finishModal.classList.add('show');
  }
  function restBranch() {
    var root = byId(currentFinishId); if (!root) return;
    var branch = [root].concat(descendants(root.id)).filter(isActive);
    var previous = branch.map(function (n) { return { id: n.id, status: n.status || 'active' }; });
    if (window.RAUniverse) window.RAUniverse.emit('rest', finishModal.querySelector('.finish-root-card'));
    finishModal.classList.remove('show');
    Promise.all(branch.map(function (n) { return RA.updateNote(n.id, { status: 'someday' }); })).then(function () {
      branch.forEach(function (n) { n.status = 'someday'; }); return refreshAfterMutation();
    }).then(function () {
      toast('Branche mise au repos — elle ne réclamera plus ton attention.', 'Annuler', function () {
        Promise.all(previous.map(function (x) { return RA.updateNote(x.id, { status: x.status }); })).then(refreshAfterMutation).catch(function (err) { toast('Erreur : ' + err.message); });
      });
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  // ---------- Récolte dédiée ----------
  function harvestedRoots() {
    return state.notes.filter(function (n) {
      if (!n.done) return false;
      var parent = n.parent_id && byId(n.parent_id);
      return !parent || !parent.done;
    });
  }
  function harvestDate(n) {
    return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts(n.completed_at || n.updated_at) || Date.now()));
  }
  function harvestCard(note) {
    var card = document.createElement('article'); card.className = 'harvest-card';
    var mark = document.createElement('div'); mark.className = 'harvest-mark'; mark.appendChild(icon('check')); card.appendChild(mark);
    var copy = document.createElement('div'); copy.className = 'harvest-card-copy';
    var title = document.createElement('h3'); title.textContent = note.title; copy.appendChild(title);
    var branchIds = [note.id].concat(descendants(note.id).filter(function (n) { return n.done; }).map(function (n) { return n.id; }));
    var meta = document.createElement('p'); meta.textContent = spaceOf(note) + ' · ' + harvestDate(note) + (branchIds.length > 1 ? ' · branche de ' + branchIds.length + ' éléments' : ''); copy.appendChild(meta);
    if (note.content) { var snippet = document.createElement('small'); snippet.textContent = note.content.slice(0, 120); copy.appendChild(snippet); }
    card.appendChild(copy);
    var reopen = document.createElement('button'); reopen.className = 'btn'; reopen.type = 'button'; reopen.textContent = branchIds.length > 1 ? 'Réouvrir la branche' : 'Réouvrir'; reopen.addEventListener('click', function () { reopenIds(branchIds, card).catch(function (err) { toast('Erreur : ' + err.message); }); }); card.appendChild(reopen);
    return card;
  }
  function harvestGroup(container, title, items) {
    if (!items.length) return;
    var section = document.createElement('section'); section.className = 'harvest-group';
    var head = document.createElement('div'); head.className = 'harvest-group-head'; var h = document.createElement('h3'); h.textContent = title; head.appendChild(h); var count = document.createElement('span'); count.textContent = items.length; head.appendChild(count); section.appendChild(head);
    var grid = document.createElement('div'); grid.className = 'harvest-grid'; items.forEach(function (n) { grid.appendChild(harvestCard(n)); }); section.appendChild(grid); container.appendChild(section);
  }
  function renderCompleted() {
    var container = document.getElementById('harvestGroups'); if (!container) return;
    var term = document.getElementById('harvestSearch').value.trim().toLowerCase();
    var roots = harvestedRoots().filter(function (n) { return !term || ((n.title || '') + ' ' + (n.content || '') + ' ' + spaceOf(n)).toLowerCase().indexOf(term) !== -1; }).sort(function (a, b) { return ts(b.completed_at || b.updated_at) - ts(a.completed_at || a.updated_at); });
    var today = new Date(); today.setHours(0, 0, 0, 0); var start = today.getTime(), week = start - 6 * DAY;
    var recent = roots.filter(function (n) { return ts(n.completed_at || n.updated_at) >= start; });
    var thisWeek = roots.filter(function (n) { var doneAt = ts(n.completed_at || n.updated_at); return doneAt < start && doneAt >= week; });
    var older = roots.filter(function (n) { return ts(n.completed_at || n.updated_at) < week; });
    container.innerHTML = ''; harvestGroup(container, 'Aujourd’hui', recent); harvestGroup(container, 'Cette semaine', thisWeek); harvestGroup(container, 'Plus ancien', older);
    document.getElementById('harvestEmpty').classList.toggle('hidden', roots.length > 0);
    var stats = document.getElementById('harvestStats'); stats.innerHTML = '';
    var allDone = state.notes.filter(function (n) { return n.done; }).length;
    [[allDone, 'éléments libérés'], [recent.length, 'récoltes aujourd’hui']].forEach(function (x) { var d = document.createElement('div'); var strong = document.createElement('strong'); strong.textContent = x[0]; d.appendChild(strong); var span = document.createElement('span'); span.textContent = x[1]; d.appendChild(span); stats.appendChild(d); });
  }

  document.getElementById('harvestSearch').addEventListener('input', renderCompleted);
  document.getElementById('finishPulseOpen').addEventListener('click', function () { var id = document.getElementById('finishPulse').dataset.noteId; if (id) openFinish(id); });
  document.getElementById('finishClose').addEventListener('click', function () { finishModal.classList.remove('show'); });
  finishModal.addEventListener('click', function (e) { if (e.target === finishModal) finishModal.classList.remove('show'); });
  document.getElementById('finishGo').addEventListener('click', function () { var id = currentFinishId; finishModal.classList.remove('show'); if (id) jumpToNote(id); });
  document.getElementById('finishRest').addEventListener('click', restBranch);
  document.getElementById('finishHarvestAll').addEventListener('click', function () {
    var root = byId(currentFinishId); if (!root) return;
    var ids = [root.id].concat(descendants(root.id).map(function (n) { return n.id; }));
    finishModal.classList.remove('show'); finishIds(ids).catch(function () {});
  });

  window.RAHarvest = {
    complete: complete,
    finishIds: finishIds,
    openFinish: openFinish,
    getCandidate: finishCandidate,
    render: function () { renderFinishPulse(); renderCompleted(); },
    renderCompleted: renderCompleted,
  };
})();
