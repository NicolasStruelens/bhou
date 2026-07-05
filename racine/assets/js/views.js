// Racine — vues transversales : Aujourd'hui, revue hebdomadaire, graphe des notes liées
  // ================= VUE AUJOURD'HUI =================

  var MORNING_REVIEW_KEY = 'racine_morning_review';
  var morningReviewToggle = document.getElementById('morningReviewToggle');
  morningReviewToggle.checked = localStorage.getItem(MORNING_REVIEW_KEY) === '1';
  morningReviewToggle.addEventListener('change', function () {
    localStorage.setItem(MORNING_REVIEW_KEY, morningReviewToggle.checked ? '1' : '0');
    toast(morningReviewToggle.checked ? 'Racine ouvrira ici au prochain démarrage' : 'Retour à l\'onglet Racine au démarrage');
  });

  function renderToday() {
    var container = document.getElementById('todayContent');
    container.innerHTML = '';
    var now = Date.now();
    var due = state.notes.filter(function (n) { return n.remind_at && n.remind_at <= now; })
      .sort(function (a, b) { return a.remind_at - b.remind_at; });
    var openTodos = state.notes.filter(function (n) { return n.kind === 'todo' && !n.done && n.status !== 'someday'; })
      .sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at - b.created_at); });
    var pinned = state.notes.filter(function (n) { return n.pinned && n.kind !== 'todo'; });
    var recentClips = state.clips.slice(0, 5);
    var any = due.length || openTodos.length || pinned.length || recentClips.length;
    document.getElementById('todayEmpty').style.display = any ? 'none' : 'block';

    [
      { icon: 'clock', title: 'Rappels dus', items: due },
      { icon: 'check', title: 'Tâches ouvertes', items: openTodos },
      { icon: 'star', title: 'Épinglé', items: pinned },
    ].forEach(function (sec) {
      if (!sec.items.length) return;
      var block = document.createElement('div');
      block.className = 'today-section';
      var h = document.createElement('h3');
      h.appendChild(icon(sec.icon, 'icon-inline'));
      h.appendChild(document.createTextNode(' ' + sec.title));
      block.appendChild(h);
      sec.items.forEach(function (n) {
        var row = document.createElement('div');
        row.className = 'today-row';
        var title = document.createElement('div');
        title.className = 'today-title';
        title.textContent = n.title;
        row.appendChild(title);
        var tag = document.createElement('div');
        tag.className = 'today-tag';
        tag.textContent = effectiveSpace(n);
        row.appendChild(tag);
        row.addEventListener('click', function () { jumpToNote(n.id); });
        block.appendChild(row);
      });
      container.appendChild(block);
    });

    if (recentClips.length) {
      var block2 = document.createElement('div');
      block2.className = 'today-section';
      var h2 = document.createElement('h3');
      h2.appendChild(icon('clipboard', 'icon-inline'));
      h2.appendChild(document.createTextNode(' Presse-papier récent'));
      block2.appendChild(h2);
      recentClips.forEach(function (c) {
        var row = document.createElement('div');
        row.className = 'today-row';
        var title = document.createElement('div');
        title.className = 'today-title';
        if (c.label) {
          title.textContent = c.label;
        } else if (c.kind === 'file') {
          title.appendChild(icon('paperclip', 'icon-inline'));
          title.appendChild(document.createTextNode(' ' + c.filename));
        } else {
          title.textContent = (c.preview || '').slice(0, 60);
        }
        row.appendChild(title);
        row.addEventListener('click', function () { switchTab('clips'); });
        block2.appendChild(row);
      });
      container.appendChild(block2);
    }
  }

  // ================= REVUE HEBDOMADAIRE =================

  var weeklyModal = document.getElementById('weeklyModal');
  document.getElementById('weeklyBtn').addEventListener('click', function () {
    renderWeekly();
    weeklyModal.classList.add('show');
  });
  document.getElementById('weeklyClose').addEventListener('click', function () { weeklyModal.classList.remove('show'); });
  weeklyModal.addEventListener('click', function (e) { if (e.target === weeklyModal) weeklyModal.classList.remove('show'); });

  function weeklyRow(n, container, extra) {
    var row = document.createElement('div');
    row.className = 'weekly-item';
    var t = document.createElement('span');
    t.textContent = n.title;
    row.appendChild(t);
    var meta = document.createElement('span');
    meta.className = 'weekly-item-meta';
    meta.textContent = extra;
    row.appendChild(meta);
    row.addEventListener('click', function () { weeklyModal.classList.remove('show'); jumpToNote(n.id); });
    container.appendChild(row);
  }

  function renderWeekly() {
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    var addedEl = document.getElementById('weeklyAdded');
    addedEl.innerHTML = '';
    state.notes.filter(function (n) { return n.created_at >= weekAgo; })
      .sort(function (a, b) { return b.created_at - a.created_at; })
      .forEach(function (n) { weeklyRow(n, addedEl, noteMeta(n)); });

    var stuckEl = document.getElementById('weeklyStuck');
    stuckEl.innerHTML = '';
    state.notes.filter(function (n) { return n.status !== 'someday' && !n.done && n.created_at < monthAgo; })
      .sort(function (a, b) { return a.created_at - b.created_at; })
      .forEach(function (n) { weeklyRow(n, stuckEl, noteMeta(n)); });

    var archiveEl = document.getElementById('weeklyArchive');
    archiveEl.innerHTML = '';
    state.notes.filter(function (n) { return n.done && n.updated_at < monthAgo; })
      .sort(function (a, b) { return a.updated_at - b.updated_at; })
      .forEach(function (n) { weeklyRow(n, archiveEl, 'terminé le ' + noteMeta(n)); });
  }

  // ================= GRAPHE =================

  function renderGraph() {
    var canvas = document.getElementById('graphCanvas');
    var linked = state.notes.filter(function (n) { return parseLinks(n.links).length; });
    document.getElementById('graphEmpty').style.display = linked.length ? 'none' : 'block';
    canvas.style.display = linked.length ? '' : 'none';
    if (!linked.length) return;

    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = rect.width / 2, cy = rect.height / 2;
    var radius = Math.min(cx, cy) - 60;
    var positions = {};
    linked.forEach(function (n, i) {
      var angle = (i / linked.length) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, n: n };
    });

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.lineWidth = 1.2;
    var drawn = {};
    linked.forEach(function (n) {
      parseLinks(n.links).forEach(function (lid) {
        if (!positions[lid]) return;
        var key = [n.id, lid].sort().join('|');
        if (drawn[key]) return;
        drawn[key] = true;
        var a = positions[n.id], b = positions[lid];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
    });

    Object.keys(positions).forEach(function (id) {
      var p = positions[id];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = p.n.pinned ? '#ffd23f' : '#22d3ee';
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#e2f5ec';
      ctx.textAlign = 'center';
      var label = p.n.title.length > 18 ? p.n.title.slice(0, 17) + '…' : p.n.title;
      ctx.fillText(label, p.x, p.y - 12);
    });

    canvas.onclick = function (e) {
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var hit = Object.keys(positions).find(function (id) {
        var p = positions[id];
        return Math.hypot(p.x - x, p.y - y) < 14;
      });
      if (hit) jumpToNote(hit);
    };
  }

  window.addEventListener('resize', function () {
    if (document.getElementById('view-graph').classList.contains('active')) renderGraph();
  });

