// Racine — vues transversales : Aujourd'hui, revue hebdomadaire, graphe des notes liées
  // ================= VUE AUJOURD'HUI =================

  // ================= LA CLAIRIÈRE =================
  // sélection curée (4 emplacements max) plutôt qu'une agrégation exhaustive — voir DEPLOIEMENT.md
  // pour la logique. Moteur de scoring déterministe, sans IA distante.

  var SKIP_TODAY_KEY = 'racine_skip_today';

  function todayKey() { return new Date().toDateString(); }
  function skippedToday() {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem(SKIP_TODAY_KEY) || '{}'); } catch (e) {}
    if (raw.date !== todayKey()) return [];
    return raw.ids || [];
  }
  function skipToday(id) {
    var ids = skippedToday();
    if (ids.indexOf(id) === -1) ids.push(id);
    localStorage.setItem(SKIP_TODAY_KEY, JSON.stringify({ date: todayKey(), ids: ids }));
  }

  function noteScore(n, now) {
    var score = 0;
    if (n.remind_at && n.remind_at <= now) score += 100;
    if (n.pinned) score += 40;
    if (n.energy === 'urgent') score += 30;
    if (n.kind === 'todo' && !n.done) score += 10;
    score += Math.min((now - n.created_at) / 86400000, 30); // vieillir augmente doucement la priorité, plafonné à 30j
    return score;
  }

  function clairiereCandidates() {
    var skipped = skippedToday();
    return state.notes.filter(function (n) {
      return n.status !== 'someday' && !n.done && skipped.indexOf(n.id) === -1;
    });
  }

  function pickClairiere() {
    var now = Date.now();
    var pool = clairiereCandidates();
    var used = {};
    var picks = {};

    var maintenantPool = pool.filter(function (n) { return n.energy !== 'attente'; })
      .sort(function (a, b) { return noteScore(b, now) - noteScore(a, now); });
    if (maintenantPool.length) { picks.maintenant = maintenantPool[0]; used[maintenantPool[0].id] = true; }

    var weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    var graine = pool.filter(function (n) {
      return n.kind === 'idee' && !used[n.id] && (n.inbox || n.created_at >= weekAgo);
    }).sort(function (a, b) {
      if (!!a.inbox !== !!b.inbox) return a.inbox ? -1 : 1;
      return b.created_at - a.created_at;
    })[0];
    if (graine) { picks.graine = graine; used[graine.id] = true; }

    // Résonance = une pensée ancienne qui partage du sens avec ce qui bouge récemment.
    var anchor = pool.filter(function (n) { return !used[n.id] && !n.inbox; })
      .sort(function (a, b) { return b.updated_at - a.updated_at; })[0];
    var resonancePool = pool.filter(function (n) {
      return (n.kind === 'idee' || n.kind === 'note') && !n.inbox && !used[n.id] && (!anchor || n.id !== anchor.id);
    });
    var resonance = anchor ? resonancePool.map(function (n) {
      return { note: n, score: similarityScore(anchor, n), age: now - n.updated_at };
    }).filter(function (x) { return x.score >= 2.5; })
      .sort(function (a, b) { return (b.score - a.score) || (b.age - a.age); })[0] : null;
    resonance = resonance ? resonance.note : resonancePool.sort(function (a, b) { return a.updated_at - b.updated_at; })[0];
    if (resonance) { picks.resonance = resonance; used[resonance.id] = true; }

    var attente = pool.filter(function (n) { return n.energy === 'attente' && !used[n.id]; })
      .sort(function (a, b) { return (a.remind_at || Infinity) - (b.remind_at || Infinity); })[0];
    if (attente) { picks.attente = attente; }

    return picks;
  }

  function clairiereAction(id, patch) {
    return RA.updateNote(id, patch).then(function () { loadNotes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function buildClairiereCard(slot, n) {
    var card = document.createElement('div');
    card.className = 'clairiere-card slot-' + slot.key;

    var head = document.createElement('div');
    head.className = 'clairiere-card-head';
    head.appendChild(icon(slot.icon, 'icon-inline'));
    head.appendChild(document.createTextNode(' ' + slot.label));
    card.appendChild(head);

    var title = document.createElement('div');
    title.className = 'clairiere-title';
    title.textContent = n.title;
    card.appendChild(title);

    if (n.content) {
      var snippet = document.createElement('div');
      snippet.className = 'clairiere-snippet';
      snippet.textContent = n.content.slice(0, 140);
      card.appendChild(snippet);
    }

    var meta = document.createElement('div');
    meta.className = 'clairiere-meta';
    meta.textContent = effectiveSpace(n);
    card.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'clairiere-actions';
    var secondary = document.createElement('div');
    secondary.className = 'clairiere-secondary hidden';

    function actionBtn(container, label, handler, primary) {
      var b = document.createElement('button');
      b.className = 'btn' + (primary ? ' btn-primary clairiere-primary' : '');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', handler);
      container.appendChild(b);
      return b;
    }

    var primaryLabel = slot.key === 'maintenant' ? 'Commencer' : slot.key === 'graine' ? 'Faire germer' : slot.key === 'attente' ? 'Voir ce qui bloque' : 'Explorer';
    actionBtn(actions, primaryLabel, function () {
      if (slot.key === 'graine' || slot.key === 'resonance') { switchTab('notes'); openEditModal(n); }
      else { switchTab('notes'); jumpToNote(n.id); }
    }, true);

    var more = document.createElement('button');
    more.className = 'btn clairiere-more';
    more.type = 'button';
    more.textContent = '•••';
    more.title = 'Autres choix';
    more.setAttribute('aria-label', 'Autres choix pour « ' + n.title + ' »');
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', function () {
      var open = secondary.classList.toggle('hidden') === false;
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      card.classList.toggle('details-open', open);
    });
    actions.appendChild(more);

    actionBtn(secondary, 'Ouvrir', function () { switchTab('notes'); jumpToNote(n.id); });
    actionBtn(secondary, 'Garder pour plus tard', function () { clairiereAction(n.id, { status: 'someday' }); });
    actionBtn(secondary, 'Relier', function () { switchTab('notes'); openLinkModal(n); });
    actionBtn(secondary, 'Pas aujourd\'hui', function () { skipToday(n.id); renderClairiere(); });
    actionBtn(secondary, 'Ne plus proposer', function () {
      if (!confirm('Mettre « ' + n.title + ' » à la corbeille ?')) return;
      if (window.RAUniverse) window.RAUniverse.emit('delete', card);
      RA.deleteNote(n.id).then(function () { loadNotes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    });

    card.appendChild(actions);
    card.appendChild(secondary);
    return card;
  }

  // ce n'est pas un compteur de productivité : juste un signe visible que quelque chose grandit
  function computeGrowthOfWeek() {
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var roots = state.notes.filter(function (n) { return !n.parent_id && !n.done && n.status !== 'someday'; });
    var best = null, bestCount = 0;
    roots.forEach(function (r) {
      var count = state.notes.filter(function (n) { return n.parent_id === r.id && !n.done && n.created_at >= weekAgo; }).length;
      if (count > bestCount) { bestCount = count; best = r; }
    });
    return bestCount > 0 ? { note: best, count: bestCount } : null;
  }

  function renderGrowthOfWeek() {
    var el = document.getElementById('growthOfWeek');
    var growth = computeGrowthOfWeek();
    if (!growth) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    el.innerHTML = '';
    el.appendChild(icon('leaf', 'icon-inline'));
    el.appendChild(document.createTextNode(
      ' Pousse de la semaine : « ' + growth.note.title + ' » a gagné ' + growth.count + ' nouvelle' + (growth.count > 1 ? 's branches' : ' branche')
    ));
    el.onclick = function () { switchTab('notes'); jumpToNote(growth.note.id); };
  }

  // ---------- "faire germer" v2 : regrouper plusieurs graines proches en une nouvelle racine ----------
  // jamais automatique : juste une proposition, à valider ou ignorer explicitement
  var DISMISSED_BUNDLES_KEY = 'racine_dismissed_bundles';

  function dismissedBundles() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_BUNDLES_KEY) || '[]'); } catch (e) { return []; }
  }
  function bundleKey(tag, notes) { return tag + ':' + notes.map(function (n) { return n.id; }).sort().join(','); }
  function dismissBundle(key) {
    var list = dismissedBundles();
    if (list.indexOf(key) === -1) list.push(key);
    localStorage.setItem(DISMISSED_BUNDLES_KEY, JSON.stringify(list));
  }

  function computeBundleSuggestion() {
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var dismissed = dismissedBundles();
    var candidates = state.notes.filter(function (n) {
      return !n.parent_id && !n.done && n.kind === 'idee' && n.status !== 'someday' && n.created_at >= weekAgo;
    });
    var byTag = {};
    candidates.forEach(function (n) {
      parseTags(n.tags).forEach(function (t) {
        var key = t.toLowerCase();
        (byTag[key] = byTag[key] || []).push(n);
      });
    });
    var best = null;
    Object.keys(byTag).forEach(function (tag) {
      var group = byTag[tag];
      if (group.length < 3) return;
      if (dismissed.indexOf(bundleKey(tag, group)) !== -1) return;
      if (!best || group.length > best.notes.length) best = { tag: tag, notes: group };
    });
    return best;
  }

  function bundleGroup(bundle) {
    var title = 'Regroupement : #' + bundle.tag.replace(/^#/, '');
    RA.createNote({ title: title, kind: 'idee', space: effectiveSpace(bundle.notes[0]) }).then(function (res) {
      return Promise.all(bundle.notes.map(function (n) { return RA.updateNote(n.id, { parent_id: res.id, inbox: false }); }));
    }).then(function () {
      if (window.RAUniverse) window.RAUniverse.emit('create', document.getElementById('bundleSuggestion'));
      loadNotes();
      toast(bundle.notes.length + ' idées regroupées sous « ' + title + ' »');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function renderBundleSuggestion() {
    var el = document.getElementById('bundleSuggestion');
    var bundle = computeBundleSuggestion();
    el.innerHTML = '';
    if (!bundle) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var text = document.createElement('span');
    text.appendChild(icon('node3', 'icon-inline'));
    text.appendChild(document.createTextNode(
      ' ' + bundle.notes.length + ' idées récentes autour de #' + bundle.tag.replace(/^#/, '') + ' — les rassembler en une nouvelle racine ?'
    ));
    el.appendChild(text);
    var groupBtn = document.createElement('button');
    groupBtn.className = 'btn btn-primary';
    groupBtn.type = 'button';
    groupBtn.textContent = 'Regrouper';
    groupBtn.addEventListener('click', function () { bundleGroup(bundle); });
    el.appendChild(groupBtn);
    var ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'btn';
    ignoreBtn.type = 'button';
    ignoreBtn.textContent = 'Pas maintenant';
    ignoreBtn.addEventListener('click', function () {
      dismissBundle(bundleKey(bundle.tag, bundle.notes));
      renderBundleSuggestion();
    });
    el.appendChild(ignoreBtn);
  }

  function renderClairiere() {
    renderGrowthOfWeek();
    renderBundleSuggestion();
    var container = document.getElementById('clairiereCards');
    container.innerHTML = '';
    var picks = pickClairiere();
    var slots = [
      { key: 'maintenant', icon: 'target', label: 'Maintenant' },
      { key: 'graine', icon: 'leaf', label: 'À faire germer' },
      { key: 'resonance', icon: 'history', label: 'Résonance' },
      { key: 'attente', icon: 'hourglass', label: 'En attente' },
    ];
    var any = false;
    slots.forEach(function (slot) {
      var n = picks[slot.key];
      if (!n) return;
      any = true;
      container.appendChild(buildClairiereCard(slot, n));
    });
    return any;
  }

  function renderToday() {
    var clairiereHasContent = renderClairiere();
    var container = document.getElementById('todayContent');
    container.innerHTML = '';
    var now = Date.now();
    var due = state.notes.filter(function (n) { return !n.done && n.remind_at && n.remind_at <= now; })
      .sort(function (a, b) { return a.remind_at - b.remind_at; });
    var openTodos = state.notes.filter(function (n) { return n.kind === 'todo' && !n.done && n.status !== 'someday'; })
      .sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at - b.created_at); });
    var pinned = state.notes.filter(function (n) { return !n.done && n.pinned && n.kind !== 'todo'; });
    var recentClips = state.clips.slice(0, 5);
    var any = due.length || openTodos.length || pinned.length || recentClips.length;
    document.getElementById('todayEmpty').style.display = (any || clairiereHasContent) ? 'none' : 'block';
    var restCount = due.length + openTodos.length + pinned.length + recentClips.length;
    document.getElementById('todayRestToggle').style.display = any ? '' : 'none';
    document.getElementById('todayRestCount').textContent = restCount ? restCount + ' élément' + (restCount > 1 ? 's' : '') : '';

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
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', 'Ouvrir « ' + n.title + ' »');
        row.addEventListener('click', function () { jumpToNote(n.id); });
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToNote(n.id); } });
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
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', 'Ouvrir le presse-papier');
        row.addEventListener('click', function () { switchTab('clips'); });
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab('clips'); } });
        block2.appendChild(row);
      });
      container.appendChild(block2);
    }
    if (window.RAV50) window.RAV50.render();
    if (window.RAV51) window.RAV51.render();
    if (window.RAHarvest) window.RAHarvest.render();
  }

  var todayRestToggle = document.getElementById('todayRestToggle');
  todayRestToggle.addEventListener('click', function () {
    var panel = document.getElementById('todayRestPanel');
    var open = panel.classList.toggle('hidden') === false;
    todayRestToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    todayRestToggle.querySelector('span').lastChild.textContent = open ? ' Masquer le reste' : ' Voir le reste';
  });

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
    row.addEventListener('click', function () {
      weeklyModal.classList.remove('show');
      if (n.done && window.RAHarvest) {
        switchTab('completed');
        document.getElementById('harvestSearch').value = n.title;
        window.RAHarvest.renderCompleted();
      } else {
        jumpToNote(n.id);
      }
    });
    container.appendChild(row);
  }

  function renderWeekly() {
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    var addedEl = document.getElementById('weeklyAdded');
    addedEl.innerHTML = '';
    state.notes.filter(function (n) { return !n.done && n.created_at >= weekAgo; })
      .sort(function (a, b) { return b.created_at - a.created_at; })
      .forEach(function (n) { weeklyRow(n, addedEl, noteMeta(n)); });

    var maturedEl = document.getElementById('weeklyMatured');
    maturedEl.innerHTML = '';
    state.notes.filter(function (n) {
      if (n.done || n.parent_id || n.created_at >= weekAgo) return false; // seulement les racines actives déjà là avant cette semaine
      var recentChildren = state.notes.filter(function (x) { return x.parent_id === n.id && !x.done && x.created_at >= weekAgo; }).length;
      var recentLink = parseLinks(n.links).length > 0 && n.updated_at >= weekAgo;
      return recentChildren > 0 || recentLink;
    }).sort(function (a, b) { return b.updated_at - a.updated_at; })
      .forEach(function (n) { weeklyRow(n, maturedEl, noteMeta(n)); });

    var stuckEl = document.getElementById('weeklyStuck');
    stuckEl.innerHTML = '';
    state.notes.filter(function (n) { return n.status !== 'someday' && !n.done && n.created_at < monthAgo; })
      .sort(function (a, b) { return a.created_at - b.created_at; })
      .forEach(function (n) { weeklyRow(n, stuckEl, noteMeta(n)); });

    var archiveEl = document.getElementById('weeklyArchive');
    archiveEl.innerHTML = '';
    state.notes.filter(function (n) { return n.done && n.updated_at < monthAgo; })
      .sort(function (a, b) { return a.updated_at - b.updated_at; })
      .forEach(function (n) { weeklyRow(n, archiveEl, 'récolté le ' + noteMeta(n)); });

    renderRandomForgottenNote();
  }

  // ---------- carte aléatoire : "une pensée que tu n'as pas revue depuis longtemps" ----------
  function renderRandomForgottenNote() {
    var el = document.getElementById('weeklyRandomCard');
    var sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    var forgotten = state.notes.filter(function (n) { return !n.done && n.updated_at < sixMonthsAgo; });
    el.innerHTML = '';
    if (!forgotten.length) {
      var empty = document.createElement('p');
      empty.className = 'weekly-random-empty';
      empty.textContent = 'Rien d\'assez ancien pour l\'instant — reviens dans quelques mois.';
      el.appendChild(empty);
      return;
    }
    var pick = forgotten[Math.floor(Math.random() * forgotten.length)];
    var card = document.createElement('div');
    card.className = 'weekly-item';
    var t = document.createElement('span');
    t.textContent = pick.title;
    card.appendChild(t);
    var meta = document.createElement('span');
    meta.className = 'weekly-item-meta';
    meta.textContent = noteMeta(pick);
    card.appendChild(meta);
    card.addEventListener('click', function () { weeklyModal.classList.remove('show'); switchTab('notes'); jumpToNote(pick.id); });
    el.appendChild(card);
  }
  document.getElementById('weeklyRandomBtn').addEventListener('click', renderRandomForgottenNote);

  // ================= LA CONSTELLATION =================
  // graphe groupé par thème (tags/espace), taille selon la richesse, halo pour l'activité
  // récente, orphelins en pointillés, suggestions de liens (moteur de similarité du Bloc F),
  // filtre temporel, sélection + chemin entre deux notes, pan/zoom. Sans IA distante.

  var graphState = {
    offsetX: 0, offsetY: 0, scale: 1,
    selectedId: null, pathIds: null, hoveredId: null,
    positions: {}, suggestedLinks: [], clusterLabels: [],
    rafId: null, didDrag: false,
  };

  function graphClusterKey(n) {
    var tags = parseTags(n.tags);
    return tags.length ? tags[0].toLowerCase() : ('espace:' + effectiveSpace(n));
  }

  function graphRichness(n) {
    var childCount = state.notes.filter(function (x) { return x.parent_id === n.id; }).length;
    var linkCount = parseLinks(n.links).length;
    return (n.content || '').length / 80 + childCount * 2 + linkCount * 2;
  }

  function isGraphOrphan(n) {
    if (n.parent_id) return false;
    if (parseLinks(n.links).length) return false;
    return !state.notes.some(function (x) { return x.parent_id === n.id; });
  }

  function graphTimeCutoff() {
    var val = document.getElementById('graphTimeFilter').value;
    if (val === 'all') return null;
    return Date.now() - Number(val) * 24 * 60 * 60 * 1000;
  }

  var GRAPH_NODE_MIN = 6, GRAPH_NODE_MAX = 15;
  var GRAPH_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // spirale de phyllotaxie : répartit les points sans jamais les superposer

  function computeGraphLayout(rect) {
    var cutoff = graphTimeCutoff();
    var pool = state.notes.filter(function (n) { return !n.done && (!cutoff || n.created_at >= cutoff); });
    var clusters = {};
    pool.forEach(function (n) {
      var key = graphClusterKey(n);
      (clusters[key] = clusters[key] || []).push(n);
    });
    var clusterKeys = Object.keys(clusters).sort(function (a, b) { return clusters[b].length - clusters[a].length; });

    // au-delà d'un certain nombre de groupes, ça devient illisible : on garde les plus gros
    // et on regroupe le reste sous "Divers" plutôt que de tout entasser au même endroit
    var MAX_CLUSTERS = 8;
    if (clusterKeys.length > MAX_CLUSTERS) {
      var kept = clusterKeys.slice(0, MAX_CLUSTERS - 1);
      var divers = [];
      clusterKeys.slice(MAX_CLUSTERS - 1).forEach(function (k) { divers = divers.concat(clusters[k]); delete clusters[k]; });
      clusters['Divers'] = divers;
      clusterKeys = kept.concat(['Divers']);
    }

    var cx = rect.width / 2, cy = rect.height / 2;
    var positions = {};
    var clusterLabels = [];
    var nodeSpacing = GRAPH_NODE_MAX * 2.2;

    clusterKeys.forEach(function (key, ci) {
      var members = clusters[key];
      var localSpread = Math.sqrt(members.length) * nodeSpacing;
      // les clusters s'écartent en spirale, chacun plus loin que le précédent —
      // évite que deux groupes se retrouvent l'un sur l'autre, contrairement à un simple cercle
      var dist = ci === 0 ? 0 : Math.sqrt(ci) * (localSpread + 70);
      var angle = ci * GRAPH_GOLDEN_ANGLE;
      var ccx = cx + Math.cos(angle) * dist;
      var ccy = cy + Math.sin(angle) * dist;
      clusterLabels.push({ key: key.replace(/^espace:/, ''), x: ccx, y: ccy - localSpread - 28, count: members.length });

      members.forEach(function (n, ni) {
        var localR = ni === 0 ? 0 : Math.sqrt(ni) * nodeSpacing;
        var localAngle = ni * GRAPH_GOLDEN_ANGLE;
        positions[n.id] = {
          x: ccx + Math.cos(localAngle) * localR,
          y: ccy + Math.sin(localAngle) * localR,
          n: n,
          radius: Math.max(GRAPH_NODE_MIN, Math.min(GRAPH_NODE_MAX, GRAPH_NODE_MIN + graphRichness(n))),
        };
      });
    });
    graphState.clusterLabels = clusterLabels;
    return positions;
  }

  function computeSuggestedLinks(positions) {
    var ids = Object.keys(positions);
    var dismissed = dismissedSuggestions();
    var degree = {}; // limite par nœud : sinon une note "générique" attire plein de fils vers elle (effet toile d'araignée)
    var candidates = [];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        var a = positions[ids[i]].n, b = positions[ids[j]].n;
        var key = suggestionKey(a.id, b.id);
        if (dismissed.indexOf(key) !== -1) continue;
        var score = similarityScore(a, b);
        if (score >= 4) candidates.push({ a: a.id, b: b.id, score: score });
      }
    }
    candidates.sort(function (x, y) { return y.score - x.score; });
    var suggestions = [];
    var MAX_PER_NODE = 2, MAX_TOTAL = 15;
    for (var k = 0; k < candidates.length && suggestions.length < MAX_TOTAL; k++) {
      var c = candidates[k];
      degree[c.a] = degree[c.a] || 0;
      degree[c.b] = degree[c.b] || 0;
      if (degree[c.a] >= MAX_PER_NODE || degree[c.b] >= MAX_PER_NODE) continue;
      degree[c.a]++; degree[c.b]++;
      suggestions.push(c);
    }
    return suggestions;
  }

  function buildLinkAdjacency(notesInGraph) {
    var ids = {};
    notesInGraph.forEach(function (n) { ids[n.id] = true; });
    var adj = {};
    notesInGraph.forEach(function (n) { adj[n.id] = parseLinks(n.links).filter(function (id) { return ids[id]; }); });
    return adj;
  }

  function findGraphPath(adj, startId, endId) {
    if (startId === endId) return [startId];
    var visited = {};
    visited[startId] = true;
    var queue = [[startId]];
    while (queue.length) {
      var path = queue.shift();
      var last = path[path.length - 1];
      var neighbors = adj[last] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var nb = neighbors[i];
        if (nb === endId) return path.concat(nb);
        if (!visited[nb]) { visited[nb] = true; queue.push(path.concat(nb)); }
      }
    }
    return null;
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    var t = lenSq ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)) : 0;
    var cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function renderGraph() {
    var canvas = document.getElementById('graphCanvas');
    document.getElementById('graphEmpty').style.display = state.notes.length ? 'none' : 'block';
    canvas.style.display = state.notes.length ? '' : 'none';
    if (graphState.rafId) { cancelAnimationFrame(graphState.rafId); graphState.rafId = null; }
    if (!state.notes.length) return;

    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');

    graphState.positions = computeGraphLayout(rect);
    graphState.suggestedLinks = computeSuggestedLinks(graphState.positions);

    function draw() {
      if (!document.getElementById('view-graph').classList.contains('active')) { graphState.rafId = null; return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(graphState.offsetX, graphState.offsetY);
      ctx.scale(graphState.scale, graphState.scale);

      var positions = graphState.positions;
      var now = Date.now();

      graphState.clusterLabels.forEach(function (cluster) {
        ctx.font = '700 ' + (12 / graphState.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(127,169,152,0.82)';
        ctx.fillText(cluster.key + ' · ' + cluster.count, cluster.x, cluster.y);
      });

      ctx.strokeStyle = 'rgba(52,211,153,0.35)';
      ctx.lineWidth = 1.2 / graphState.scale;
      var drawnPairs = {};
      Object.keys(positions).forEach(function (id) {
        parseLinks(positions[id].n.links).forEach(function (lid) {
          if (!positions[lid]) return;
          var key = [id, lid].sort().join('|');
          if (drawnPairs[key]) return;
          drawnPairs[key] = true;
          var a = positions[id], b = positions[lid];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      });

      if (graphState.pathIds && graphState.pathIds.length > 1) {
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2.4 / graphState.scale;
        for (var i = 0; i < graphState.pathIds.length - 1; i++) {
          var pa = positions[graphState.pathIds[i]], pb = positions[graphState.pathIds[i + 1]];
          if (!pa || !pb) continue;
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,210,63,0.5)';
      ctx.lineWidth = 1 / graphState.scale;
      graphState.suggestedLinks.forEach(function (s) {
        var a = positions[s.a], b = positions[s.b];
        if (!a || !b) return;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.setLineDash([]);

      var ids = Object.keys(positions);
      var showAllLabels = ids.length <= 6 || graphState.scale > 2.2;
      ids.forEach(function (id) {
        var p = positions[id];
        var n = p.n;
        var orphan = isGraphOrphan(n);
        var recent = (now - n.updated_at) < 3 * 24 * 60 * 60 * 1000;

        if (recent) {
          var pulse = 0.3 + 0.25 * Math.sin(now / 500 + p.x);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(34,211,238,' + pulse + ')';
          ctx.lineWidth = 2 / graphState.scale;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = orphan ? 'rgba(226,245,236,0.35)' : (n.pinned ? '#ffd23f' : '#22d3ee');
        ctx.fill();
        if (orphan) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(226,245,236,0.7)';
          ctx.lineWidth = 1.2 / graphState.scale;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (id === graphState.selectedId) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5 / graphState.scale;
          ctx.stroke();
        }
        // les libellés de tous les nœuds à la fois rendent le graphe illisible dès qu'il y a
        // plus d'une poignée de notes : on ne montre que le sélectionné/survolé, sauf vue clairsemée ou zoom fort
        if (showAllLabels || id === graphState.selectedId || id === graphState.hoveredId) {
          ctx.font = (11 / graphState.scale) + 'px sans-serif';
          ctx.fillStyle = '#e2f5ec';
          ctx.textAlign = 'center';
          var label = n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title;
          ctx.fillText(label, p.x, p.y - p.radius - 6);
        }
      });

      ctx.restore();
      graphState.rafId = requestAnimationFrame(draw);
    }
    draw();
  }

  function screenToGraph(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    return { x: (x - graphState.offsetX) / graphState.scale, y: (y - graphState.offsetY) / graphState.scale };
  }

  function hitTestNode(gx, gy) {
    var positions = graphState.positions;
    return Object.keys(positions).find(function (id) {
      var p = positions[id];
      return Math.hypot(p.x - gx, p.y - gy) < p.radius + 6;
    });
  }

  function hitTestSuggestedLink(gx, gy) {
    var positions = graphState.positions;
    for (var i = 0; i < graphState.suggestedLinks.length; i++) {
      var s = graphState.suggestedLinks[i];
      var a = positions[s.a], b = positions[s.b];
      if (!a || !b) continue;
      if (pointSegmentDistance(gx, gy, a.x, a.y, b.x, b.y) < 6) return s;
    }
    return null;
  }

  function renderGraphInspector(n) {
    var el = document.getElementById('graphInspector');
    el.innerHTML = '';
    if (!n) {
      var empty = document.createElement('div');
      empty.className = 'graph-inspector-empty';
      empty.appendChild(icon('node3'));
      var text = document.createElement('span');
      text.textContent = 'Touche une étoile pour découvrir la pensée.';
      empty.appendChild(text);
      el.appendChild(empty);
      return;
    }
    var kicker = document.createElement('div');
    kicker.className = 'graph-inspector-kicker';
    kicker.textContent = graphClusterKey(n).replace(/^espace:/, '');
    el.appendChild(kicker);
    var title = document.createElement('h3'); title.textContent = n.title; el.appendChild(title);
    if (n.content) { var p = document.createElement('p'); p.textContent = n.content.slice(0, 240); el.appendChild(p); }
    var meta = document.createElement('div');
    meta.className = 'graph-inspector-meta';
    meta.textContent = effectiveSpace(n) + ' · ' + parseLinks(n.links).length + ' lien(s)' + (n.effort_minutes ? ' · ≈ ' + n.effort_minutes + ' min' : '');
    el.appendChild(meta);
    var open = document.createElement('button');
    open.className = 'btn btn-primary'; open.type = 'button'; open.textContent = 'Ouvrir cette pensée';
    open.addEventListener('click', function () { jumpToNote(n.id); });
    el.appendChild(open);
  }

  function handleGraphClick(clientX, clientY, canvas) {
    if (graphState.didDrag) { graphState.didDrag = false; return; }
    var g = screenToGraph(canvas, clientX, clientY);
    var hitId = hitTestNode(g.x, g.y);
    if (hitId) {
      if (graphState.selectedId && graphState.selectedId !== hitId) {
        var notesInGraph = Object.keys(graphState.positions).map(function (id) { return graphState.positions[id].n; });
        var adj = buildLinkAdjacency(notesInGraph);
        var path = findGraphPath(adj, graphState.selectedId, hitId);
        if (path && path.length > 1) {
          graphState.pathIds = path;
          toast(path.length - 1 === 1 ? 'Lien direct entre ces deux notes' : 'Chemin trouvé en ' + (path.length - 1) + ' étapes');
        } else {
          toast('Aucun chemin trouvé entre ces deux notes');
          graphState.pathIds = null;
        }
        graphState.selectedId = null;
      } else if (graphState.selectedId === hitId) {
        jumpToNote(hitId);
        graphState.selectedId = null;
        graphState.pathIds = null;
      } else {
        graphState.selectedId = hitId;
        graphState.pathIds = null;
        renderGraphInspector(graphState.positions[hitId].n);
      }
      return;
    }
    var suggestion = hitTestSuggestedLink(g.x, g.y);
    if (suggestion) addLink(suggestion.a, suggestion.b);
  }

  (function setupGraphInteractions() {
    var canvas = document.getElementById('graphCanvas');
    var panning = false, panStartX = 0, panStartY = 0, panStartOffsetX = 0, panStartOffsetY = 0;

    canvas.addEventListener('mousedown', function (e) {
      panning = true;
      panStartX = e.clientX; panStartY = e.clientY;
      panStartOffsetX = graphState.offsetX; panStartOffsetY = graphState.offsetY;
      graphState.didDrag = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (!panning) return;
      var dx = e.clientX - panStartX, dy = e.clientY - panStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) graphState.didDrag = true;
      graphState.offsetX = panStartOffsetX + dx;
      graphState.offsetY = panStartOffsetY + dy;
    });
    window.addEventListener('mouseup', function () { panning = false; });
    canvas.addEventListener('click', function (e) { handleGraphClick(e.clientX, e.clientY, canvas); });
    canvas.addEventListener('mousemove', function (e) {
      if (panning) return;
      var g = screenToGraph(canvas, e.clientX, e.clientY);
      graphState.hoveredId = hitTestNode(g.x, g.y) || null;
    });
    canvas.addEventListener('mouseleave', function () { graphState.hoveredId = null; });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY > 0 ? 0.9 : 1.1;
      graphState.scale = Math.max(0.3, Math.min(3, graphState.scale * factor));
    }, { passive: false });

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      panning = true;
      panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
      panStartOffsetX = graphState.offsetX; panStartOffsetY = graphState.offsetY;
      graphState.didDrag = false;
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (!panning || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - panStartX, dy = e.touches[0].clientY - panStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) graphState.didDrag = true;
      graphState.offsetX = panStartOffsetX + dx;
      graphState.offsetY = panStartOffsetY + dy;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      panning = false;
      if (e.changedTouches.length) handleGraphClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY, canvas);
    });

    document.getElementById('graphResetView').addEventListener('click', function () {
      graphState.offsetX = 0; graphState.offsetY = 0; graphState.scale = 1;
      graphState.selectedId = null; graphState.pathIds = null;
      renderGraphInspector(null);
    });
    document.getElementById('graphTimeFilter').addEventListener('change', renderGraph);

    // ---------- mode promenade : rien à faire ici, juste explorer ----------
    var promenadeToggle = document.getElementById('graphPromenadeToggle');
    promenadeToggle.addEventListener('click', function () {
      var on = promenadeToggle.classList.toggle('active');
      document.getElementById('graphHint').classList.toggle('hidden', on);
      document.getElementById('graphPromenadeHint').classList.toggle('hidden', !on);
      document.getElementById('graphToolbar').classList.toggle('promenade', on);
      promenadeToggle.textContent = on ? 'Quitter la promenade' : 'Mode promenade';
    });
  })();

  window.addEventListener('resize', function () {
    if (document.getElementById('view-graph').classList.contains('active')) window.renderGraph();
  });
