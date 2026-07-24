// Racine v51 — boussole mentale : orientation, fil de pensée et journal automatique.
(function () {
  var DAY = 86400000;
  var threadTrailIds = [];
  var threadModal = document.getElementById('threadModal');
  var lostModal = document.getElementById('lostModal');
  var journalModal = document.getElementById('journalModal');

  function byId(id) { return state.notes.find(function (n) { return n.id === id; }); }
  function timestamp(value) { var n = Number(value); return isFinite(n) ? n : 0; }
  function dayStart() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function active(n) { return !n.done && n.status !== 'someday'; }
  function noteSpace(n) { return typeof effectiveSpace === 'function' ? effectiveSpace(n) : (n.space || 'Général'); }
  function linksOf(n) { return typeof parseLinks === 'function' ? parseLinks(n.links) : (n.links || '').split(',').filter(Boolean); }
  function childrenOf(n) { return state.notes.filter(function (x) { return x.parent_id === n.id; }); }
  function closeModal(modal) { modal.classList.remove('show'); }
  function bindClose(modal, button) {
    button.addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });
  }

  // ---------- Je suis perdu : trois sorties réellement différentes ----------
  function lostCandidates() {
    var now = Date.now();
    var notes = state.notes.filter(active);
    var used = {};
    var result = [];

    function add(note, kicker, why, label, special) {
      if (!note || used[note.id] || result.length >= 3) return;
      used[note.id] = true;
      result.push({ note: note, kicker: kicker, why: why, label: label, special: special || '' });
    }

    var closing = window.RAHarvest && window.RAHarvest.getCandidate ? window.RAHarvest.getCandidate() : null;
    add(closing && closing.root, 'À terminer pour libérer', closing ? closing.metrics.openTasks.length + ' dernier' + (closing.metrics.openTasks.length > 1 ? 's gestes peuvent' : ' geste peut') + ' fermer cette boucle et la sortir de ton champ mental.' : '', 'Fermer la boucle', 'finish');

    var pressing = notes.filter(function (n) {
      return n.kind === 'todo' && n.energy !== 'attente' && ((n.remind_at && timestamp(n.remind_at) <= now) || n.energy === 'urgent');
    }).sort(function (a, b) {
      var ar = a.remind_at && timestamp(a.remind_at) <= now ? 100 : 0;
      var br = b.remind_at && timestamp(b.remind_at) <= now ? 100 : 0;
      return (br + (b.pinned ? 20 : 0)) - (ar + (a.pinned ? 20 : 0));
    })[0];
    add(pressing, 'À protéger maintenant', pressing && pressing.remind_at && timestamp(pressing.remind_at) <= now ? 'Son rappel est arrivé. La regarder évite qu’elle reste en bruit de fond.' : 'Tu l’as marquée urgente. Une décision courte suffit pour reprendre la main.', 'Regarder');

    var blocked = state.notes.filter(function (n) { return !n.parent_id && active(n) && !n.inbox; }).map(function (root) {
      var children = childrenOf(root).filter(active);
      var waiting = children.filter(function (n) { return n.energy === 'attente'; }).length;
      var open = children.filter(function (n) { return n.kind === 'todo' && n.energy !== 'attente'; }).length;
      var age = Math.floor((now - timestamp(root.updated_at)) / DAY);
      return { root: root, waiting: waiting, open: open, age: age, score: waiting * 20 + (!open ? 12 : 0) + Math.min(age, 30) };
    }).filter(function (x) { return x.waiting || !x.open || x.age >= 21; })
      .sort(function (a, b) { return b.score - a.score; })[0];
    add(blocked && blocked.root, 'À débloquer', blocked ? (blocked.waiting ? blocked.waiting + ' attente' + (blocked.waiting > 1 ? 's demandent' : ' demande') + ' une clarification.' : blocked.open ? 'Cette racine est silencieuse depuis ' + blocked.age + ' jours.' : 'Cette racine ne possède aucune prochaine action visible.') : '', 'Retrouver le fil');

    var quick = notes.filter(function (n) {
      var effort = Number(n.effort_minutes || 0);
      return n.kind === 'todo' && n.energy !== 'attente' && !n.inbox && (n.energy === '2min' || n.energy === 'facile' || (effort > 0 && effort <= 15));
    }).sort(function (a, b) {
      return (Number(a.effort_minutes || 99) - Number(b.effort_minutes || 99)) || (timestamp(a.updated_at) - timestamp(b.updated_at));
    })[0];
    add(quick, 'À remettre en mouvement', 'Un petit pas concret, compatible avec une énergie limitée.', 'Faire un petit pas');

    var inbox = notes.filter(function (n) { return n.inbox; }).sort(function (a, b) { return timestamp(a.created_at) - timestamp(b.created_at); })[0];
    add(inbox, 'À sortir de ta tête', 'Cette pensée attend simplement une décision, pas un classement parfait.', 'Trier maintenant', 'inbox');

    var pinned = notes.filter(function (n) { return n.pinned; }).sort(function (a, b) { return timestamp(a.updated_at) - timestamp(b.updated_at); })[0];
    add(pinned, 'À reconnecter', 'Tu l’avais désignée comme importante. Elle mérite peut-être de redevenir visible.', 'Ouvrir');

    var recent = notes.sort(function (a, b) { return timestamp(b.updated_at) - timestamp(a.updated_at); })[0];
    add(recent, 'À reprendre doucement', 'C’est la pensée active la plus récente : le contexte est encore proche.', 'Reprendre');
    return result;
  }

  function renderLost() {
    var container = document.getElementById('lostDirections');
    var picks = lostCandidates();
    container.innerHTML = '';
    if (!picks.length) {
      var calm = document.createElement('div');
      calm.className = 'mental-empty';
      calm.textContent = 'Rien ne réclame une décision. Tu peux simplement déposer ce qui traverse ton esprit.';
      container.appendChild(calm);
      return;
    }
    picks.forEach(function (pick, index) {
      var card = document.createElement('article');
      card.className = 'lost-direction';
      var number = document.createElement('span'); number.className = 'lost-number'; number.textContent = String(index + 1); card.appendChild(number);
      var copy = document.createElement('div'); copy.className = 'lost-copy';
      var kicker = document.createElement('div'); kicker.className = 'lost-kicker'; kicker.textContent = pick.kicker; copy.appendChild(kicker);
      var title = document.createElement('h3'); title.textContent = pick.note.title; copy.appendChild(title);
      var why = document.createElement('p'); why.textContent = pick.why; copy.appendChild(why);
      card.appendChild(copy);
      var action = document.createElement('button'); action.className = 'btn' + (index === 0 ? ' btn-primary' : ''); action.type = 'button'; action.textContent = pick.label;
      action.addEventListener('click', function () {
        closeModal(lostModal);
        if (pick.special === 'inbox') document.getElementById('inboxTriageStart').click();
        else if (pick.special === 'finish' && window.RAHarvest) window.RAHarvest.openFinish(pick.note.id);
        else if (pick.label === 'Retrouver le fil') openThread(pick.note.id);
        else jumpToNote(pick.note.id);
      });
      card.appendChild(action);
      container.appendChild(card);
    });
  }

  // ---------- Fil de pensée : parcourir les relations sans perdre le contexte ----------
  function words(n) {
    return ((n.title || '') + ' ' + (n.tags || '') + ' ' + (n.content || '').slice(0, 180)).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length >= 4; });
  }
  function closeness(a, b) {
    var aw = words(a), bw = words(b), seen = {};
    aw.forEach(function (w) { seen[w] = true; });
    var score = 0; bw.forEach(function (w) { if (seen[w]) score += 1; });
    return score;
  }
  function bestThreadStart() {
    var saved = localStorage.getItem('racine_thread_last');
    if (saved && active(byId(saved))) return byId(saved);
    var ranked = state.notes.filter(function (n) { return active(n) && !n.inbox; }).map(function (n) {
      var score = (n.pinned ? 15 : 0) + childrenOf(n).length * 3 + linksOf(n).length * 4 + (!n.parent_id ? 5 : 0) + Math.max(0, 7 - Math.floor((Date.now() - timestamp(n.updated_at)) / DAY));
      return { n: n, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
    return ranked.length ? ranked[0].n : state.notes[0];
  }
  function currentThreadNote() { return byId(threadTrailIds[threadTrailIds.length - 1]); }
  function moveThread(id) {
    if (!byId(id)) return;
    threadTrailIds.push(id);
    localStorage.setItem('racine_thread_last', id);
    document.getElementById('threadSearch').value = '';
    document.getElementById('threadSearchResults').classList.add('hidden');
    renderThread();
  }
  function threadChoice(n, relation) {
    var button = document.createElement('button'); button.className = 'thread-choice'; button.type = 'button';
    var title = document.createElement('strong'); title.textContent = n.title; button.appendChild(title);
    var meta = document.createElement('small'); meta.textContent = relation + ' · ' + noteSpace(n); button.appendChild(meta);
    button.addEventListener('click', function () { moveThread(n.id); });
    return button;
  }
  function addThreadGroup(container, label, items, relation, limit) {
    if (!items.length) return 0;
    var group = document.createElement('section'); group.className = 'thread-group';
    var title = document.createElement('div'); title.className = 'thread-group-title'; title.textContent = label; group.appendChild(title);
    items.slice(0, limit).forEach(function (n) { group.appendChild(threadChoice(n, relation)); });
    container.appendChild(group);
    return Math.min(items.length, limit);
  }
  function renderThread() {
    var n = currentThreadNote();
    if (!n) return;
    var trail = document.getElementById('threadTrail'); trail.innerHTML = '';
    threadTrailIds.slice(-4).forEach(function (id) {
      var item = byId(id); if (!item) return;
      var b = document.createElement('button'); b.type = 'button'; b.textContent = item.title;
      b.addEventListener('click', function () { threadTrailIds = threadTrailIds.slice(0, threadTrailIds.indexOf(id) + 1); renderThread(); });
      trail.appendChild(b);
    });

    var current = document.getElementById('threadCurrent'); current.innerHTML = '';
    var kind = document.createElement('div'); kind.className = 'thread-current-meta'; kind.textContent = (n.kind === 'todo' ? 'Action' : n.kind === 'note' ? 'Note' : 'Idée') + ' · ' + noteSpace(n); current.appendChild(kind);
    var h = document.createElement('h3'); h.textContent = n.title; current.appendChild(h);
    if (n.content) { var p = document.createElement('p'); p.textContent = n.content.slice(0, 320); current.appendChild(p); }

    var branches = document.getElementById('threadBranches'); branches.innerHTML = '';
    var excluded = {}; excluded[n.id] = true;
    var parent = n.parent_id && byId(n.parent_id); if (parent) excluded[parent.id] = true;
    var children = childrenOf(n).filter(function (x) { return x.status !== 'someday'; }); children.forEach(function (x) { excluded[x.id] = true; });
    var linked = linksOf(n).map(byId).filter(Boolean); linked.forEach(function (x) { excluded[x.id] = true; });
    var related = state.notes.filter(function (x) { return !excluded[x.id] && !x.done && x.status !== 'someday'; })
      .map(function (x) { return { n: x, score: closeness(n, x) }; }).filter(function (x) { return x.score >= 2; })
      .sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.n; });
    var shown = 0;
    if (parent) shown += addThreadGroup(branches, 'D’où elle vient', [parent], 'Pensée parente', 1);
    shown += addThreadGroup(branches, 'Ce qu’elle ouvre', children, 'Branche', 3);
    shown += addThreadGroup(branches, 'Ce qui est déjà relié', linked, 'Lien choisi', 2);
    if (shown < 6) shown += addThreadGroup(branches, 'Ce qui résonne', related, 'Proximité de sens', 6 - shown);
    if (!shown) { var empty = document.createElement('div'); empty.className = 'mental-empty'; empty.textContent = 'Cette pensée est encore seule. La développer ou la relier lui donnera de nouvelles directions.'; branches.appendChild(empty); }
    document.getElementById('threadBack').disabled = threadTrailIds.length <= 1;
  }
  function renderThreadSearch() {
    var input = document.getElementById('threadSearch');
    var results = document.getElementById('threadSearchResults');
    var term = input.value.trim().toLowerCase(); results.innerHTML = '';
    if (term.length < 2) { results.classList.add('hidden'); return; }
    state.notes.filter(function (n) { return !n.done && n.title.toLowerCase().indexOf(term) !== -1; }).slice(0, 6).forEach(function (n) {
      var b = document.createElement('button'); b.className = 'thread-choice'; b.type = 'button';
      var title = document.createElement('strong'); title.textContent = n.title; b.appendChild(title);
      var meta = document.createElement('small'); meta.textContent = noteSpace(n); b.appendChild(meta);
      b.addEventListener('click', function () {
        threadTrailIds = [n.id]; localStorage.setItem('racine_thread_last', n.id);
        input.value = ''; results.classList.add('hidden'); renderThread();
      });
      results.appendChild(b);
    });
    results.classList.toggle('hidden', !results.children.length);
  }
  function openThread(id) {
    var start = id && byId(id) || bestThreadStart();
    if (!start) { toast('Dépose d’abord une pensée pour créer un fil.'); return; }
    threadTrailIds = [start.id]; localStorage.setItem('racine_thread_last', start.id);
    document.getElementById('threadSearch').value = '';
    document.getElementById('threadSearchResults').classList.add('hidden');
    renderThread(); threadModal.classList.add('show');
  }

  // ---------- Journal vivant : faits dérivés, aucune saisie ----------
  function journalData() {
    var start = dayStart();
    var created = state.notes.filter(function (n) { return !n.done && timestamp(n.created_at) >= start; }).sort(function (a, b) { return timestamp(b.created_at) - timestamp(a.created_at); });
    var touched = state.notes.filter(function (n) { return !n.done && timestamp(n.updated_at) >= start && timestamp(n.created_at) < start; }).sort(function (a, b) { return timestamp(b.updated_at) - timestamp(a.updated_at); });
    var completed = state.notes.filter(function (n) { return n.done && timestamp(n.updated_at) >= start; });
    var growth = {};
    created.filter(function (n) { return n.parent_id; }).forEach(function (n) {
      var root = byId(n.parent_id); if (!root) return;
      growth[root.id] = growth[root.id] || { root: root, count: 0 }; growth[root.id].count += 1;
    });
    return { created: created, touched: touched, completed: completed, growth: Object.keys(growth).map(function (id) { return growth[id]; }).sort(function (a, b) { return b.count - a.count; }) };
  }
  function journalRow(n, meta) {
    var b = document.createElement('button'); b.className = 'journal-row'; b.type = 'button';
    var title = document.createElement('strong'); title.textContent = n.title; b.appendChild(title);
    var small = document.createElement('small'); small.textContent = meta; b.appendChild(small);
    b.addEventListener('click', function () { closeModal(journalModal); jumpToNote(n.id); });
    return b;
  }
  function journalSection(container, title, items, metaFn) {
    if (!items.length) return;
    var section = document.createElement('section'); section.className = 'journal-section';
    var h = document.createElement('h3'); h.textContent = title; section.appendChild(h);
    items.slice(0, 5).forEach(function (item) { section.appendChild(journalRow(item.root || item, metaFn(item))); });
    container.appendChild(section);
  }
  function renderJournal() {
    var data = journalData();
    var total = data.created.length + data.touched.length;
    document.getElementById('journalLead').textContent = total ? 'Ta journée a laissé ' + total + ' trace' + (total > 1 ? 's' : '') + '. Voici le mouvement réel, sans score ni culpabilité.' : 'La journée est encore silencieuse dans Racine. Rien à rattraper : tu peux commencer par une seule pensée.';
    var stats = document.getElementById('journalStats'); stats.innerHTML = '';
    [[data.created.length, 'capturées'], [data.touched.length, 'retouchées'], [data.completed.length, 'récoltées'], [data.growth.length, 'racines en pousse']].forEach(function (x) {
      var card = document.createElement('div'); var strong = document.createElement('strong'); strong.textContent = x[0]; card.appendChild(strong); var span = document.createElement('span'); span.textContent = x[1]; card.appendChild(span); stats.appendChild(card);
    });
    var sections = document.getElementById('journalSections'); sections.innerHTML = '';
    journalSection(sections, 'Nouvelles pensées', data.created, function (n) { return noteSpace(n); });
    journalSection(sections, 'Racines qui ont poussé', data.growth, function (x) { return x.count + ' nouvelle' + (x.count > 1 ? 's branches' : ' branche'); });
    journalSection(sections, 'Pensées revisitées', data.touched, function (n) { return noteSpace(n); });
    if (!sections.children.length) { var empty = document.createElement('div'); empty.className = 'mental-empty'; empty.textContent = 'Aucune trace aujourd’hui. Déposer une pensée suffit pour commencer.'; sections.appendChild(empty); }
  }
  function renderSummary() {
    var data = journalData();
    var count = data.created.length + data.touched.length;
    document.getElementById('journalSummary').textContent = count ? count + ' mouvement' + (count > 1 ? 's' : '') + ' aujourd’hui' : 'Aujourd’hui';
  }

  document.getElementById('lostOpen').addEventListener('click', function () { renderLost(); lostModal.classList.add('show'); });
  document.getElementById('threadOpen').addEventListener('click', function () { openThread(); });
  document.getElementById('journalOpen').addEventListener('click', function () { renderJournal(); journalModal.classList.add('show'); });
  document.getElementById('threadSearch').addEventListener('input', renderThreadSearch);
  document.getElementById('threadBack').addEventListener('click', function () { if (threadTrailIds.length > 1) { threadTrailIds.pop(); renderThread(); } });
  document.getElementById('threadGo').addEventListener('click', function () { var n = currentThreadNote(); if (n) { closeModal(threadModal); jumpToNote(n.id); } });
  document.getElementById('threadEdit').addEventListener('click', function () { var n = currentThreadNote(); if (n) { closeModal(threadModal); switchTab('notes'); openEditModal(n); } });
  bindClose(lostModal, document.getElementById('lostClose'));
  bindClose(threadModal, document.getElementById('threadClose'));
  bindClose(journalModal, document.getElementById('journalClose'));

  window.RAV51 = { render: renderSummary, openThread: openThread };
})();
