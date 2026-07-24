// Racine v49 — Constellation utile : lentilles mentales, hiérarchie visible, fiche d'action et liste accessible.
(function () {
  var graph49 = {
    offsetX: 0, offsetY: 0, scale: 1,
    selectedId: null, hoveredId: null, positions: {}, notes: [],
    clusterLabels: [], suggestedLinks: [], rafId: null, didDrag: false,
  };

  function replaceWithoutListeners(id) {
    var old = document.getElementById(id);
    var fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    return fresh;
  }

  var canvas = replaceWithoutListeners('graphCanvas');
  var resetBtn = replaceWithoutListeners('graphResetView');
  var promenadeBtn = replaceWithoutListeners('graphPromenadeToggle');
  var timeFilter = replaceWithoutListeners('graphTimeFilter');
  var lensSelect = document.getElementById('graphLens');
  var searchInputGraph = document.getElementById('graphSearch');
  var inspector = document.getElementById('graphInspector');
  var nodeList = document.getElementById('graphNodeList');
  var stats = document.getElementById('graphStats');
  var listWrap = document.querySelector('.graph-accessible-list-wrap');
  var listToggle = document.getElementById('graphListToggle');

  function setListCollapsed(collapsed) {
    listWrap.classList.toggle('is-collapsed', collapsed);
    listToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    listToggle.textContent = collapsed ? 'Afficher la liste' : 'Réduire';
    try { localStorage.setItem('racine_graph_list_collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }

  listToggle.addEventListener('click', function () {
    setListCollapsed(!listWrap.classList.contains('is-collapsed'));
  });
  try { setListCollapsed(localStorage.getItem('racine_graph_list_collapsed') === '1'); } catch (e) {}

  function rootOf(n) {
    var byId = {};
    graph49.notes.forEach(function (x) { byId[x.id] = x; });
    var cur = n, seen = {};
    while (cur && cur.parent_id && byId[cur.parent_id] && !seen[cur.id]) {
      seen[cur.id] = true;
      cur = byId[cur.parent_id];
    }
    return cur || n;
  }

  function lensLabel(value) {
    return {
      attention: 'attention', roots: 'projets et branches', waiting: 'blocages et attentes',
      dormant: 'pensées dormantes', all: 'exploration libre',
    }[value] || 'constellation';
  }

  function filteredNotes() {
    var now = Date.now();
    var cutoffValue = timeFilter.value;
    var cutoff = cutoffValue === 'all' ? null : now - Number(cutoffValue) * 86400000;
    var term = searchInputGraph.value.trim().toLowerCase();
    var lens = lensSelect.value;
    var pool = state.notes.filter(function (n) {
      if (n.done) return false;
      if (cutoff && n.updated_at < cutoff) return false;
      if (term) {
        var hay = (n.title + ' ' + (n.content || '') + ' ' + (n.tags || '') + ' ' + effectiveSpace(n)).toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      if (lens === 'attention') {
        return !!n.inbox || !!n.pinned || (n.kind === 'todo' && !n.done) || (!!n.remind_at && n.remind_at <= now);
      }
      if (lens === 'waiting') return n.energy === 'attente' || (!!n.remind_at && !n.done);
      if (lens === 'dormant') return !n.done && n.updated_at < now - 45 * 86400000;
      return true;
    });

    if (lens === 'attention') {
      pool.sort(function (a, b) { return noteScore(b, now) - noteScore(a, now); });
      pool = pool.slice(0, 24);
    } else if (lens === 'waiting') {
      pool.sort(function (a, b) { return (a.remind_at || Infinity) - (b.remind_at || Infinity); });
      pool = pool.slice(0, 30);
    } else if (lens === 'dormant') {
      pool.sort(function (a, b) { return a.updated_at - b.updated_at; });
      pool = pool.slice(0, 30);
    } else if (lens === 'roots') {
      pool.sort(function (a, b) { return (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || a.position - b.position; });
      pool = pool.slice(0, 90);
    } else {
      pool = pool.slice(0, 100);
    }
    return pool;
  }

  function clusterKey(n) {
    if (lensSelect.value === 'roots') return rootOf(n).title;
    return effectiveSpace(n);
  }

  function graphRichness49(n) {
    var children = graph49.notes.filter(function (x) { return x.parent_id === n.id; }).length;
    return Math.min(7, (n.content || '').length / 120 + children * 1.5 + parseLinks(n.links).length);
  }

  function computeLayout(rect) {
    var pool = filteredNotes();
    graph49.notes = pool;
    var clusters = {};
    pool.forEach(function (n) { var key = clusterKey(n); (clusters[key] = clusters[key] || []).push(n); });
    var keys = Object.keys(clusters).sort(function (a, b) { return clusters[b].length - clusters[a].length; });
    if (keys.length > 8) {
      var keep = keys.slice(0, 7), divers = [];
      keys.slice(7).forEach(function (key) { divers = divers.concat(clusters[key]); delete clusters[key]; });
      clusters['Autres chemins'] = divers;
      keys = keep.concat(['Autres chemins']);
    }

    var padding = 34;
    var aspect = Math.max(0.7, rect.width / Math.max(rect.height, 1));
    var cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(keys.length, 1) * aspect)));
    var rows = Math.max(1, Math.ceil(Math.max(keys.length, 1) / cols));
    var cellW = Math.max(100, (rect.width - padding * 2) / cols);
    var cellH = Math.max(100, (rect.height - padding * 2) / rows);
    var positions = {}, labels = [];
    var golden = Math.PI * (3 - Math.sqrt(5));

    keys.forEach(function (key, ci) {
      var row = Math.floor(ci / cols), col = ci % cols;
      var ccx = padding + cellW * (col + 0.5);
      var ccy = padding + cellH * (row + 0.56);
      var members = clusters[key];
      var maxR = Math.max(18, Math.min(cellW, cellH) * 0.34);
      var radialStep = members.length > 1 ? maxR / Math.sqrt(members.length - 1) : 0;
      var safeNodeRadius = members.length > 1 ? Math.max(4, radialStep * 0.34) : 14;
      labels.push({ key: key.length > 24 ? key.slice(0, 23) + '…' : key, count: members.length, x: ccx, y: Math.max(18, padding + row * cellH + 12) });
      members.forEach(function (n, ni) {
        var r = ni ? Math.sqrt(ni) * radialStep : 0;
        var angle = ni * golden - Math.PI / 2;
        positions[n.id] = {
          x: Math.max(22, Math.min(rect.width - 22, ccx + Math.cos(angle) * r)),
          y: Math.max(34, Math.min(rect.height - 22, ccy + Math.sin(angle) * r)),
          n: n,
          radius: Math.max(4, Math.min(14, safeNodeRadius, 6 + graphRichness49(n))),
        };
      });
    });
    graph49.clusterLabels = labels;
    return positions;
  }

  function suggestionsFor(positions) {
    if (lensSelect.value === 'roots' || lensSelect.value === 'waiting') return [];
    var ids = Object.keys(positions), dismissed = dismissedSuggestions(), candidates = [], degree = {};
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        var a = positions[ids[i]].n, b = positions[ids[j]].n;
        if (dismissed.indexOf(suggestionKey(a.id, b.id)) !== -1) continue;
        var score = similarityScore(a, b);
        if (score >= 4.5) candidates.push({ a: a.id, b: b.id, score: score });
      }
    }
    candidates.sort(function (a, b) { return b.score - a.score; });
    var out = [];
    candidates.forEach(function (s) {
      degree[s.a] = degree[s.a] || 0; degree[s.b] = degree[s.b] || 0;
      if (out.length >= 8 || degree[s.a] >= 1 || degree[s.b] >= 1) return;
      degree[s.a]++; degree[s.b]++; out.push(s);
    });
    return out;
  }

  function nodeColor(n) {
    if (n.kind === 'todo') return '#34d399';
    if (n.kind === 'note') return '#a78bfa';
    return '#22d3ee';
  }

  function updateStats() {
    var roots = graph49.notes.filter(function (n) { return !n.parent_id; }).length;
    var manual = 0, ids = {};
    graph49.notes.forEach(function (n) { ids[n.id] = true; });
    graph49.notes.forEach(function (n) { manual += parseLinks(n.links).filter(function (id) { return ids[id]; }).length; });
    stats.textContent = graph49.notes.length + ' pensée' + (graph49.notes.length > 1 ? 's' : '') + ' · ' + roots + ' racine' + (roots > 1 ? 's' : '') + ' · ' + Math.floor(manual / 2) + ' liens';
  }

  function reasonFor(n) {
    var lens = lensSelect.value;
    if (lens === 'attention') {
      if (n.inbox) return 'Cette pensée apparaît parce qu’elle attend encore d’être organisée.';
      if (n.remind_at && n.remind_at <= Date.now()) return 'Cette pensée apparaît parce que son rappel est arrivé.';
      if (n.energy === 'urgent') return 'Cette pensée apparaît parce qu’elle est marquée urgente.';
      if (n.pinned) return 'Cette pensée apparaît parce que tu l’as marquée comme importante.';
      return 'Cette action est encore ouverte et mérite une décision.';
    }
    if (lens === 'waiting') return n.energy === 'attente' ? 'Elle dépend de quelqu’un ou de quelque chose avant de pouvoir avancer.' : 'Un rappel la maintient dans ton radar.';
    if (lens === 'dormant') return 'Elle n’a pas bougé depuis ' + Math.max(1, Math.floor((Date.now() - n.updated_at) / 86400000)) + ' jours.';
    if (lens === 'roots') return n.parent_id ? 'Cette pensée est une branche de « ' + rootOf(n).title + ' ».' : 'Cette pensée est une racine qui peut porter plusieurs branches.';
    return 'Elle fait partie de ton paysage mental complet.';
  }

  function clearInspector() {
    graph49.selectedId = null;
    inspector.classList.remove('has-content');
    inspector.innerHTML = '';
    var empty = document.createElement('div'); empty.className = 'graph-inspector-empty';
    empty.appendChild(icon('node3'));
    var span = document.createElement('span'); span.textContent = 'Choisis une étoile ou un élément de la liste.'; empty.appendChild(span);
    inspector.appendChild(empty);
    renderNodeList();
  }

  function closeInspectorButton() {
    var close = document.createElement('button');
    close.className = 'icon-btn graph-inspector-close'; close.type = 'button'; close.title = 'Fermer la fiche'; close.setAttribute('aria-label', 'Fermer la fiche'); close.appendChild(icon('x'));
    close.addEventListener('click', clearInspector);
    return close;
  }

  function relationStat(value, label) {
    var box = document.createElement('div'); box.className = 'graph-relation-stat';
    var strong = document.createElement('strong'); strong.textContent = value; box.appendChild(strong);
    var span = document.createElement('span'); span.textContent = label; box.appendChild(span);
    return box;
  }

  function renderInspector(n) {
    graph49.selectedId = n.id;
    inspector.innerHTML = ''; inspector.classList.add('has-content'); inspector.appendChild(closeInspectorButton());
    var kicker = document.createElement('div'); kicker.className = 'graph-inspector-kicker'; kicker.textContent = effectiveSpace(n) + ' · ' + (n.kind === 'todo' ? 'action' : n.kind === 'note' ? 'note' : 'idée'); inspector.appendChild(kicker);
    var title = document.createElement('h3'); title.textContent = n.title; inspector.appendChild(title);
    if (n.content) { var p = document.createElement('p'); p.textContent = n.content.slice(0, 260); inspector.appendChild(p); }
    var why = document.createElement('div'); why.className = 'graph-inspector-why'; why.textContent = reasonFor(n); inspector.appendChild(why);
    var relations = document.createElement('div'); relations.className = 'graph-inspector-relations';
    relations.appendChild(relationStat(graph49.notes.filter(function (x) { return x.parent_id === n.id; }).length, 'branches'));
    relations.appendChild(relationStat(parseLinks(n.links).length, 'liens'));
    relations.appendChild(relationStat(n.effort_minutes ? n.effort_minutes + 'm' : '—', 'durée'));
    inspector.appendChild(relations);
    var open = document.createElement('button'); open.className = 'btn btn-primary'; open.type = 'button'; open.textContent = 'Ouvrir cette pensée'; open.addEventListener('click', function () { jumpToNote(n.id); }); inspector.appendChild(open);
    var connect = document.createElement('button'); connect.className = 'btn'; connect.type = 'button'; connect.textContent = 'Choisir un lien'; connect.addEventListener('click', function () { openLinkModal(n); }); inspector.appendChild(connect);
    renderNodeList();
  }

  function sharedReasons(a, b) {
    var reasons = [];
    var at = parseTags(a.tags).map(function (t) { return t.toLowerCase(); });
    var bt = parseTags(b.tags).map(function (t) { return t.toLowerCase(); });
    var commonTags = at.filter(function (t) { return bt.indexOf(t) !== -1; });
    if (commonTags.length) reasons.push('tag ' + commonTags[0]);
    if (effectiveSpace(a) === effectiveSpace(b)) reasons.push('même espace « ' + effectiveSpace(a) + ' »');
    var aw = wordsOf(a.title + ' ' + a.content), bw = wordsOf(b.title + ' ' + b.content);
    var common = aw.filter(function (w, i) { return bw.indexOf(w) !== -1 && aw.indexOf(w) === i; }).slice(0, 3);
    if (common.length) reasons.push('mots proches : ' + common.join(', '));
    return reasons.length ? reasons.join(' · ') : 'proximité de sens détectée dans leur contenu';
  }

  function renderSuggestion(s) {
    var a = graph49.positions[s.a].n, b = graph49.positions[s.b].n;
    inspector.innerHTML = ''; inspector.classList.add('has-content'); inspector.appendChild(closeInspectorButton());
    var kicker = document.createElement('div'); kicker.className = 'graph-inspector-kicker'; kicker.textContent = 'Lien proposé — jamais automatique'; inspector.appendChild(kicker);
    var title = document.createElement('h3'); title.textContent = '« ' + a.title + ' » ↔ « ' + b.title + ' »'; inspector.appendChild(title);
    var why = document.createElement('div'); why.className = 'graph-inspector-why'; why.textContent = 'Pourquoi : ' + sharedReasons(a, b) + '.'; inspector.appendChild(why);
    var actions = document.createElement('div'); actions.className = 'graph-suggestion-actions';
    var accept = document.createElement('button'); accept.className = 'btn btn-primary'; accept.type = 'button'; accept.textContent = 'Relier'; accept.addEventListener('click', function () { addLink(a.id, b.id); clearInspector(); }); actions.appendChild(accept);
    var reject = document.createElement('button'); reject.className = 'btn'; reject.type = 'button'; reject.textContent = 'Pas pertinent'; reject.addEventListener('click', function () { dismissSuggestion(a.id, b.id); renderGraph49(); clearInspector(); }); actions.appendChild(reject);
    inspector.appendChild(actions);
  }

  function renderNodeList() {
    nodeList.innerHTML = '';
    graph49.notes.slice(0, 30).forEach(function (n) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'graph-node-list-item' + (n.id === graph49.selectedId ? ' active' : '');
      var dot = document.createElement('i'); dot.className = 'legend-dot ' + (n.kind === 'todo' ? 'todo' : n.kind === 'note' ? 'note' : 'idea'); btn.appendChild(dot);
      var copy = document.createElement('span'); copy.className = 'graph-node-list-copy';
      var title = document.createElement('span'); title.className = 'graph-node-list-title'; title.textContent = n.title; copy.appendChild(title);
      var meta = document.createElement('span'); meta.className = 'graph-node-list-meta'; meta.textContent = effectiveSpace(n) + ' · ' + reasonFor(n); copy.appendChild(meta); btn.appendChild(copy);
      btn.addEventListener('click', function () { renderInspector(n); });
      nodeList.appendChild(btn);
    });
  }

  function pointDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function toGraph(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - graph49.offsetX) / graph49.scale, y: (clientY - rect.top - graph49.offsetY) / graph49.scale };
  }

  function hitNode(g) {
    return Object.keys(graph49.positions).find(function (id) { var p = graph49.positions[id]; return Math.hypot(p.x - g.x, p.y - g.y) < p.radius + 7; });
  }

  function hitSuggestion(g) {
    for (var i = 0; i < graph49.suggestedLinks.length; i++) {
      var s = graph49.suggestedLinks[i], a = graph49.positions[s.a], b = graph49.positions[s.b];
      if (a && b && pointDistance(g.x, g.y, a.x, a.y, b.x, b.y) < 7 / graph49.scale) return s;
    }
    return null;
  }

  function resetView() { graph49.offsetX = 0; graph49.offsetY = 0; graph49.scale = 1; clearInspector(); }

  function renderGraph49() {
    if (graph49.rafId) { cancelAnimationFrame(graph49.rafId); graph49.rafId = null; }
    // Le premier rendu peut arriver avant le retour API et masquer la zone vide.
    // La rouvrir avant la mesure évite qu'un rendu suivant reste bloqué à 0 × 0.
    var layout = document.querySelector('.graph-layout');
    layout.classList.remove('hidden');
    canvas.classList.remove('hidden');
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext('2d');
    graph49.positions = computeLayout(rect);
    graph49.suggestedLinks = suggestionsFor(graph49.positions);
    var ids = Object.keys(graph49.positions);
    document.getElementById('graphEmpty').classList.toggle('hidden', ids.length > 0);
    canvas.classList.toggle('hidden', ids.length === 0);
    layout.classList.toggle('hidden', ids.length === 0);
    document.querySelector('.graph-accessible-list-wrap').classList.toggle('hidden', ids.length === 0);
    if (graph49.selectedId && !graph49.positions[graph49.selectedId]) clearInspector();
    updateStats(); renderNodeList();
    if (!ids.length) return;

    function line(a, b, color, width, dash) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width / graph49.scale; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
    }

    function draw() {
      if (!document.getElementById('view-graph').classList.contains('active')) { graph49.rafId = null; return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save(); ctx.translate(graph49.offsetX, graph49.offsetY); ctx.scale(graph49.scale, graph49.scale);

      graph49.clusterLabels.forEach(function (c) {
        ctx.font = '700 ' + (11 / graph49.scale) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(127,169,152,0.88)';
        ctx.fillText(c.key + ' · ' + c.count, c.x, c.y);
      });

      ids.forEach(function (id) {
        var p = graph49.positions[id], parent = p.n.parent_id && graph49.positions[p.n.parent_id];
        if (parent) line(parent, p, 'rgba(167,139,250,0.58)', 1.8, []);
      });
      var drawn = {};
      ids.forEach(function (id) {
        parseLinks(graph49.positions[id].n.links).forEach(function (lid) {
          if (!graph49.positions[lid]) return;
          var key = [id, lid].sort().join('|'); if (drawn[key]) return; drawn[key] = true;
          line(graph49.positions[id], graph49.positions[lid], 'rgba(52,211,153,0.48)', 1.35, []);
        });
      });
      graph49.suggestedLinks.forEach(function (s) { line(graph49.positions[s.a], graph49.positions[s.b], 'rgba(255,210,63,0.62)', 1, [4, 5]); });

      var now = Date.now();
      ids.forEach(function (id) {
        var p = graph49.positions[id], n = p.n;
        if (n.inbox || n.energy === 'urgent' || n.energy === 'attente') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = n.energy === 'urgent' ? 'rgba(251,113,133,0.8)' : n.energy === 'attente' ? 'rgba(255,210,63,0.7)' : 'rgba(34,211,238,0.55)';
          ctx.lineWidth = 1.6 / graph49.scale; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = nodeColor(n); ctx.globalAlpha = n.done ? 0.35 : 0.92; ctx.fill(); ctx.globalAlpha = 1;
        if (id === graph49.selectedId || id === graph49.hoveredId) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / graph49.scale; ctx.stroke();
        }
        // La carte donne d'abord la forme générale. Les noms apparaissent seulement
        // quand ils sont réellement utiles : petit ensemble, sélection/survol, ou
        // racines lorsque l'utilisateur a volontairement zoomé.
        var showLabel = ids.length <= 8 || id === graph49.selectedId || id === graph49.hoveredId || (graph49.scale >= 1.6 && !n.parent_id);
        if (showLabel) {
          ctx.font = (10.5 / graph49.scale) + 'px sans-serif'; ctx.fillStyle = '#e2f5ec'; ctx.textAlign = 'center';
          var label = n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title; ctx.fillText(label, p.x, p.y - p.radius - 6);
        }
        if (now - n.updated_at < 3 * 86400000 && !n.done) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 8 + Math.sin(now / 600 + p.x), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(34,211,238,0.16)'; ctx.lineWidth = 1 / graph49.scale; ctx.stroke();
        }
      });
      ctx.restore(); graph49.rafId = requestAnimationFrame(draw);
    }
    draw();
  }

  // Une déclaration globale `function renderGraph()` existe dans views.js. Sur certains
  // navigateurs, remplacer seulement la propriété window ne met pas à jour ce binding.
  // L'affectation directe garantit que loadNotes(), switchTab() et les contrôles v49
  // utilisent tous le même moteur.
  window.renderGraph = renderGraph49;
  renderGraph = renderGraph49;

  var panning = false, startX = 0, startY = 0, startOX = 0, startOY = 0, pinchDistance = 0, pinchScale = 1;
  canvas.addEventListener('mousedown', function (e) { panning = true; startX = e.clientX; startY = e.clientY; startOX = graph49.offsetX; startOY = graph49.offsetY; graph49.didDrag = false; });
  window.addEventListener('mousemove', function (e) { if (!panning) return; var dx = e.clientX - startX, dy = e.clientY - startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) graph49.didDrag = true; graph49.offsetX = startOX + dx; graph49.offsetY = startOY + dy; });
  window.addEventListener('mouseup', function () { panning = false; });
  canvas.addEventListener('mousemove', function (e) { if (!panning) { var g = toGraph(e.clientX, e.clientY); graph49.hoveredId = hitNode(g) || null; } });
  canvas.addEventListener('mouseleave', function () { graph49.hoveredId = null; });
  canvas.addEventListener('click', function (e) {
    if (graph49.didDrag) { graph49.didDrag = false; return; }
    var g = toGraph(e.clientX, e.clientY), id = hitNode(g);
    if (id) { renderInspector(graph49.positions[id].n); return; }
    var suggestion = hitSuggestion(g); if (suggestion) { renderSuggestion(suggestion); return; }
    clearInspector();
  });
  canvas.addEventListener('dblclick', function (e) { var id = hitNode(toGraph(e.clientX, e.clientY)); if (id) jumpToNote(id); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    var gx = (sx - graph49.offsetX) / graph49.scale, gy = (sy - graph49.offsetY) / graph49.scale;
    var next = Math.max(0.65, Math.min(2.8, graph49.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
    graph49.offsetX = sx - gx * next; graph49.offsetY = sy - gy * next; graph49.scale = next;
  }, { passive: false });
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault(); graph49.didDrag = false;
    if (e.touches.length === 2) { pinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); pinchScale = graph49.scale; panning = false; return; }
    if (e.touches.length === 1) { panning = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY; startOX = graph49.offsetX; startOY = graph49.offsetY; }
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDistance) { var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); graph49.scale = Math.max(0.65, Math.min(2.8, pinchScale * dist / pinchDistance)); graph49.didDrag = true; return; }
    if (panning && e.touches.length === 1) { var dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) graph49.didDrag = true; graph49.offsetX = startOX + dx; graph49.offsetY = startOY + dy; }
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) { panning = false; pinchDistance = 0; if (!graph49.didDrag && e.changedTouches.length) { var g = toGraph(e.changedTouches[0].clientX, e.changedTouches[0].clientY), id = hitNode(g); if (id) renderInspector(graph49.positions[id].n); } });
  canvas.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && graph49.notes.length) { e.preventDefault(); renderInspector(graph49.notes[0]); } });

  resetBtn.addEventListener('click', function () { resetView(); renderGraph49(); });
  function refreshLens() { graph49.offsetX = 0; graph49.offsetY = 0; graph49.scale = 1; clearInspector(); renderGraph49(); }
  lensSelect.addEventListener('change', refreshLens);
  timeFilter.addEventListener('change', refreshLens);
  searchInputGraph.addEventListener('input', refreshLens);
  promenadeBtn.addEventListener('click', function () {
    var on = promenadeBtn.classList.toggle('active');
    document.getElementById('graphHint').classList.toggle('hidden', on);
    document.getElementById('graphPromenadeHint').classList.toggle('hidden', !on);
    document.getElementById('graphToolbar').classList.toggle('promenade', on);
    promenadeBtn.textContent = on ? 'Quitter la promenade' : 'Mode promenade';
  });
})();
