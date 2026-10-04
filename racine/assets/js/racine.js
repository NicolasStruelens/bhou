// Racine — application simplifiée : 3 axes (Idées · Recettes · Presse-papier).
// Un seul fichier, scope global classique, s'appuie uniquement sur api.js + le backend.

// toast exposé en global : api.js et offline-queue.js s'attendent à le trouver.
window.toast = function (msg, actionLabel, actionFn) {
  var box = document.getElementById('toast');
  var m = document.getElementById('toastMsg');
  var a = document.getElementById('toastAction');
  m.textContent = msg;
  box.classList.add('show');
  clearTimeout(window.__toastTimer);
  if (actionLabel && actionFn) {
    a.textContent = actionLabel; a.classList.remove('hidden');
    a.onclick = function () { clearTimeout(window.__toastTimer); box.classList.remove('show'); actionFn(); };
  } else {
    a.classList.add('hidden'); a.onclick = null;
  }
  window.__toastTimer = setTimeout(function () { box.classList.remove('show'); }, actionFn ? 5000 : 2400);
};

(function () {
  'use strict';
  var toast = window.toast;

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#i-' + name);
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }
  function fail(err) { toast('Erreur : ' + (err && err.message ? err.message : err)); }

  var SUBJECTS_KEY = 'racine_spaces';
  var ALL = '__all__';
  var PALETTE = ['#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#fb923c', '#fbbf24', '#a3e635'];
  function subjectColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  var S = {
    notes: [], recipes: [], clips: [],
    activeSubject: localStorage.getItem('racine_active_subject') || ALL,
    captureKind: 'idee',
    recipeCat: ALL,
    recipeSearch: '',
    ingDraft: [],      // lignes de l'éditeur d'ingrédients
    recipeEditId: null,
    ideaEditId: null,
  };

  // ---------- sujets ----------
  function knownSubjects() {
    var set = {};
    set['Général'] = true;
    try { (JSON.parse(localStorage.getItem(SUBJECTS_KEY) || '[]') || []).forEach(function (s) { if (s) set[s] = true; }); } catch (e) {}
    S.notes.forEach(function (n) { if (n.space) set[n.space] = true; });
    var list = Object.keys(set);
    list.sort(function (a, b) { if (a === 'Général') return -1; if (b === 'Général') return 1; return a.localeCompare(b); });
    return list;
  }
  function addSubject(name) {
    name = (name || '').trim().slice(0, 60);
    if (!name) return null;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(SUBJECTS_KEY) || '[]') || []; } catch (e) {}
    if (list.indexOf(name) === -1) { list.push(name); localStorage.setItem(SUBJECTS_KEY, JSON.stringify(list)); }
    if (RA.setPreferences) RA.setPreferences({ racine_spaces: JSON.stringify(list) }).catch(function () {});
    return name;
  }

  // ======================================================================
  //  IDÉES
  // ======================================================================
  function loadNotes() {
    return RA.listNotes().then(function (data) {
      S.notes = (data.notes || []).filter(function (n) { return !n.parent_id || true; }); // à plat : tout est listé
      renderSubjectBar();
      fillSubjectSelects();
      renderIdeas();
    }).catch(fail);
  }

  function renderSubjectBar() {
    var bar = $('subjectBar');
    bar.innerHTML = '';
    function pill(label, value, color, count) {
      var p = el('button', 'subject-pill' + (S.activeSubject === value ? ' active' : ''));
      if (color) { p.style.setProperty('--sc', color); var d = el('span', 'dot'); p.appendChild(d); }
      p.appendChild(document.createTextNode(label + (count ? ' · ' + count : '')));
      p.addEventListener('click', function () {
        S.activeSubject = value;
        localStorage.setItem('racine_active_subject', value);
        renderSubjectBar(); renderIdeas();
        if (value !== ALL) { $('captureSubject').value = value; }
      });
      return p;
    }
    bar.appendChild(pill('Tous', ALL, null, 0));
    knownSubjects().forEach(function (s) {
      var open = S.notes.filter(function (n) { return (n.space || 'Général') === s && !n.done; }).length;
      bar.appendChild(pill(s, s, subjectColor(s), open));
    });
    var add = el('button', 'subject-pill add');
    add.appendChild(icon('plus', 'icon-sm'));
    add.appendChild(document.createTextNode(' sujet'));
    add.addEventListener('click', function () {
      var name = addSubject(prompt('Nom du nouveau sujet :', ''));
      if (!name) return;
      S.activeSubject = name;
      localStorage.setItem('racine_active_subject', name);
      renderSubjectBar(); fillSubjectSelects(); renderIdeas();
      $('captureSubject').value = name;
    });
    bar.appendChild(add);
  }

  function fillSubjectSelects() {
    [$('captureSubject'), $('ideaEditSubject')].forEach(function (sel) {
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '';
      knownSubjects().forEach(function (s) {
        var o = el('option', null, s); o.value = s; sel.appendChild(o);
      });
      if (cur && knownSubjects().indexOf(cur) !== -1) sel.value = cur;
      else if (S.activeSubject !== ALL) sel.value = S.activeSubject;
    });
  }

  function ideaRow(n) {
    var row = el('div', 'idea' + (n.done ? ' done' : ''));
    if (n.kind === 'todo') {
      var cb = el('input', 'idea-check'); cb.type = 'checkbox'; cb.checked = !!n.done;
      cb.addEventListener('change', function () {
        RA.updateNote(n.id, { done: cb.checked }).then(loadNotes).catch(fail);
      });
      row.appendChild(cb);
    } else {
      row.appendChild(el('span', 'idea-bullet'));
    }
    var main = el('div', 'idea-main');
    main.appendChild(el('div', 'idea-title', n.title));
    if (n.content) { var sub = el('div', 'idea-sub', n.content.slice(0, 80)); main.appendChild(sub); }
    main.addEventListener('click', function () { openIdeaModal(n); });
    row.appendChild(main);
    var del = el('button', 'idea-del'); del.title = 'Supprimer'; del.appendChild(icon('x', 'icon-sm'));
    del.addEventListener('click', function () {
      RA.deleteNote(n.id).then(function () {
        loadNotes();
        toast('Supprimé', 'Annuler', function () { RA.restoreNote(n.id).then(loadNotes).catch(fail); });
      }).catch(fail);
    });
    row.appendChild(del);
    return row;
  }

  function sortIdeas(arr) {
    return arr.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;      // ouverts d'abord
      return (b.created_at || 0) - (a.created_at || 0);        // puis plus récents
    });
  }

  function renderIdeas() {
    var box = $('ideasList');
    box.innerHTML = '';
    var notes = S.notes;
    if (S.activeSubject === ALL) {
      var subjects = knownSubjects().filter(function (s) {
        return notes.some(function (n) { return (n.space || 'Général') === s; });
      });
      if (!subjects.length) { box.appendChild(el('div', 'empty', 'Aucune idée. Dépose ta première pensée ci-dessus.')); return; }
      subjects.forEach(function (s) {
        var items = sortIdeas(notes.filter(function (n) { return (n.space || 'Général') === s; }));
        if (!items.length) return;
        var group = el('div', 'idea-group');
        var head = el('div', 'idea-group-head');
        var dot = el('span', 'dot'); dot.style.setProperty('--sc', subjectColor(s)); head.appendChild(dot);
        head.appendChild(el('h3', null, s));
        head.appendChild(el('span', 'count', items.length + ''));
        group.appendChild(head);
        items.forEach(function (n) { group.appendChild(ideaRow(n)); });
        box.appendChild(group);
      });
    } else {
      var list = sortIdeas(notes.filter(function (n) { return (n.space || 'Général') === S.activeSubject; }));
      if (!list.length) { box.appendChild(el('div', 'empty', 'Rien dans « ' + S.activeSubject +' ». Dépose une idée ou une tâche.')); return; }
      list.forEach(function (n) { box.appendChild(ideaRow(n)); });
    }
  }

  function submitCapture() {
    var input = $('captureInput');
    var title = input.value.trim();
    if (!title) { input.focus(); return; }
    var subject = $('captureSubject').value || 'Général';
    addSubject(subject);
    RA.createNote({ title: title, kind: S.captureKind, space: subject, content: '' }).then(function () {
      input.value = ''; input.focus();
      loadNotes();
    }).catch(fail);
  }

  function openIdeaModal(n) {
    S.ideaEditId = n.id;
    $('ideaEditTitle').value = n.title;
    $('ideaEditContent').value = n.content || '';
    $('ideaEditKind').value = n.kind === 'todo' ? 'todo' : 'idee';
    fillSubjectSelects();
    $('ideaEditSubject').value = n.space || 'Général';
    $('ideaModal').classList.add('show');
    $('ideaEditTitle').focus();
  }

  // ======================================================================
  //  RECETTES
  // ======================================================================
  var UNITS = { piece: 'pièce', g: 'g', kg: 'kg' };
  function parseIngredients(r) {
    try { var x = JSON.parse(r.ingredients || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; }
  }
  function fmtQty(q) { return String(Math.round(q * 100) / 100); }
  function fmtIngredient(ing) {
    if (!ing.qty) return ing.name;
    if (ing.unit === 'g' || ing.unit === 'kg') return fmtQty(ing.qty) + ' ' + ing.unit + ' ' + ing.name;
    return fmtQty(ing.qty) + ' ' + ing.name;
  }

  function loadRecipes() {
    return RA.listRecipes().then(function (data) {
      S.recipes = data.recipes || [];
      renderRecipeCats();
      renderRecipes();
    }).catch(fail);
  }

  function recipeCategories() {
    var set = {};
    S.recipes.forEach(function (r) { if (r.category) set[r.category] = true; });
    return Object.keys(set).sort();
  }

  function renderRecipeCats() {
    var bar = $('recipeCats');
    bar.innerHTML = '';
    var cats = recipeCategories();
    var dl = $('recipeCatList'); dl.innerHTML = '';
    cats.forEach(function (c) { var o = el('option'); o.value = c; dl.appendChild(o); });
    if (!cats.length) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    function catPill(label, value) {
      var p = el('button', 'cat-pill' + (S.recipeCat === value ? ' active' : ''), label);
      p.addEventListener('click', function () { S.recipeCat = value; renderRecipeCats(); renderRecipes(); });
      return p;
    }
    bar.appendChild(catPill('Toutes', ALL));
    cats.forEach(function (c) { bar.appendChild(catPill(c, c)); });
  }

  function recipeMatches(r) {
    if (S.recipeCat !== ALL && (r.category || '') !== S.recipeCat) return false;
    var q = S.recipeSearch.trim().toLowerCase();
    if (!q) return true;
    if (r.title.toLowerCase().indexOf(q) !== -1) return true;
    if ((r.category || '').toLowerCase().indexOf(q) !== -1) return true;
    return parseIngredients(r).some(function (i) { return i.name.toLowerCase().indexOf(q) !== -1; });
  }

  function renderRecipes() {
    var grid = $('recipeGrid');
    grid.innerHTML = '';
    var list = S.recipes.filter(recipeMatches);
    $('recipeEmpty').classList.toggle('hidden', S.recipes.length > 0);
    list.forEach(function (r) { grid.appendChild(recipeCard(r)); });
  }

  function recipeCard(r) {
    var ings = parseIngredients(r);
    var card = el('div', 'recipe-card');
    var head = el('div', 'recipe-card-head');
    head.appendChild(el('span', 'recipe-title', r.title));
    card.appendChild(head);

    if (r.category || r.portions) {
      var meta = el('div', 'recipe-meta');
      if (r.category) meta.appendChild(el('span', 'recipe-chip', r.category));
      if (r.portions) meta.appendChild(el('span', 'recipe-chip', r.portions + ' portion' + (r.portions > 1 ? 's' : '')));
      card.appendChild(meta);
    }

    if (ings.length) {
      var il = el('div', 'recipe-ings');
      ings.forEach(function (ing, idx) {
        var row = el('label', 'recipe-ing' + (ing.have ? ' have' : ''));
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!ing.have;
        cb.addEventListener('change', function () {
          var next = ings.map(function (x, i) { return i === idx ? Object.assign({}, x, { have: cb.checked }) : x; });
          RA.updateRecipe(r.id, { ingredients: next }).then(loadRecipes).catch(fail);
        });
        row.appendChild(cb);
        row.appendChild(el('span', null, fmtIngredient(ing)));
        il.appendChild(row);
      });
      card.appendChild(il);
    }

    if (r.steps && r.steps.trim()) {
      card.appendChild(el('div', 'recipe-steps', r.steps.trim()));
    }

    var actions = el('div', 'recipe-card-actions');
    var editB = el('button', 'btn btn-sm'); editB.appendChild(icon('pencil', 'icon-sm')); editB.appendChild(document.createTextNode(' Modifier'));
    editB.addEventListener('click', function () { openRecipeModal(r); });
    actions.appendChild(editB);

    var missing = ings.filter(function (i) { return !i.have; });
    if (missing.length) {
      var listB = el('button', 'btn btn-sm'); listB.appendChild(icon('cart', 'icon-sm')); listB.appendChild(document.createTextNode(' Courses'));
      listB.addEventListener('click', function () {
        var text = 'Liste de courses — ' + r.title + ' :\n' + missing.map(function (i) { return '* ' + fmtIngredient(i); }).join('\n');
        copyText(text);
      });
      actions.appendChild(listB);
    }

    var delB = el('button', 'btn btn-sm btn-danger'); delB.appendChild(icon('x', 'icon-sm'));
    delB.addEventListener('click', function () {
      RA.deleteRecipe(r.id).then(function () {
        loadRecipes();
        toast('Recette supprimée', 'Annuler', function () { RA.restoreRecipe(r.id).then(loadRecipes).catch(fail); });
      }).catch(fail);
    });
    actions.appendChild(delB);
    card.appendChild(actions);
    return card;
  }

  // ----- éditeur de recette -----
  function renderIngEditor() {
    var box = $('ingEditor');
    box.innerHTML = '';
    S.ingDraft.forEach(function (ing, idx) {
      var row = el('div', 'ing-row');
      var name = el('input', 'field ing-name'); name.type = 'text'; name.placeholder = 'Ingrédient'; name.value = ing.name || '';
      name.addEventListener('input', function () { ing.name = name.value; });
      var qty = el('input', 'field ing-qty'); qty.type = 'number'; qty.placeholder = 'Qté'; qty.min = '0'; qty.step = '0.1'; qty.value = ing.qty || '';
      qty.addEventListener('input', function () { ing.qty = qty.value ? Number(qty.value) : null; });
      var unit = el('select', 'field ing-unit');
      ['piece', 'g', 'kg'].forEach(function (u) { var o = el('option', null, UNITS[u]); o.value = u; unit.appendChild(o); });
      unit.value = ing.unit || 'piece';
      unit.addEventListener('change', function () { ing.unit = unit.value; });
      var rm = el('button', 'btn btn-sm ing-rm'); rm.type = 'button'; rm.appendChild(icon('x', 'icon-sm'));
      rm.addEventListener('click', function () { S.ingDraft.splice(idx, 1); renderIngEditor(); });
      row.appendChild(name); row.appendChild(qty); row.appendChild(unit); row.appendChild(rm);
      box.appendChild(row);
    });
  }

  function openRecipeModal(r) {
    S.recipeEditId = r ? r.id : null;
    $('recipeModalTitle').textContent = r ? 'Modifier la recette' : 'Nouvelle recette';
    $('recipeEditTitle').value = r ? r.title : '';
    $('recipeEditCategory').value = r ? (r.category || '') : '';
    $('recipeEditPortions').value = r && r.portions ? r.portions : '';
    $('recipeEditSteps').value = r ? (r.steps || '') : '';
    S.ingDraft = r ? parseIngredients(r).map(function (i) { return { name: i.name, qty: i.qty, unit: i.unit || 'piece', have: !!i.have }; }) : [];
    if (!S.ingDraft.length) S.ingDraft.push({ name: '', qty: null, unit: 'piece', have: false });
    renderIngEditor();
    $('recipeModal').classList.add('show');
    $('recipeEditTitle').focus();
  }

  function saveRecipe() {
    var title = $('recipeEditTitle').value.trim();
    if (!title) { toast('Donne un nom à la recette'); $('recipeEditTitle').focus(); return; }
    var ingredients = S.ingDraft.filter(function (i) { return (i.name || '').trim(); })
      .map(function (i) { return { name: i.name.trim(), qty: i.qty && i.qty > 0 ? i.qty : null, unit: i.unit || 'piece', have: !!i.have }; });
    var portionsVal = $('recipeEditPortions').value;
    var payload = {
      title: title,
      category: $('recipeEditCategory').value.trim(),
      portions: portionsVal ? Number(portionsVal) : null,
      steps: $('recipeEditSteps').value,
      ingredients: ingredients,
    };
    var p = S.recipeEditId ? RA.updateRecipe(S.recipeEditId, payload) : RA.createRecipe(payload);
    p.then(function () {
      $('recipeModal').classList.remove('show');
      toast(S.recipeEditId ? 'Recette mise à jour' : 'Recette créée');
      loadRecipes();
    }).catch(fail);
  }

  function globalShoppingList() {
    var seen = {}; var lines = [];
    S.recipes.forEach(function (r) {
      parseIngredients(r).filter(function (i) { return !i.have; }).forEach(function (i) {
        var key = (i.name + '|' + (i.unit || '')).toLowerCase();
        if (seen[key]) return; seen[key] = true;
        lines.push('* ' + fmtIngredient(i));
      });
    });
    if (!lines.length) { toast('Rien à acheter — tout est à la maison !'); return; }
    copyText('Liste de courses :\n' + lines.join('\n'));
  }

  // ======================================================================
  //  PRESSE-PAPIER
  // ======================================================================
  function loadClips() {
    return RA.listClips().then(function (data) {
      S.clips = (data.clips || []).filter(function (c) { return c.kind !== 'file'; });
      renderClips();
    }).catch(fail);
  }

  function renderClips() {
    var box = $('clipsList');
    box.innerHTML = '';
    $('clipEmpty').classList.toggle('hidden', S.clips.length > 0);
    S.clips.forEach(function (c) {
      var card = el('div', 'clip');
      var head = el('div', 'clip-head');
      head.appendChild(el('span', 'clip-label-text', c.label || 'Sans titre'));
      head.appendChild(el('span', 'clip-date', new Date(c.created_at).toLocaleDateString('fr-FR')));
      card.appendChild(head);
      if (c.preview) card.appendChild(el('div', 'clip-preview', c.preview));
      var actions = el('div', 'clip-actions');
      var copyB = el('button', 'btn btn-sm btn-primary'); copyB.appendChild(icon('clipboard', 'icon-sm')); copyB.appendChild(document.createTextNode(' Copier'));
      copyB.addEventListener('click', function () {
        RA.getClip(c.id).then(function (d) {
          var content = d && d.clip ? d.clip.content : (d ? d.content : '');
          copyText(content || c.preview || '');
        }).catch(function () { copyText(c.preview || ''); });
      });
      actions.appendChild(copyB);
      var delB = el('button', 'btn btn-sm btn-danger'); delB.appendChild(icon('x', 'icon-sm'));
      delB.addEventListener('click', function () {
        RA.deleteClip(c.id).then(function () {
          loadClips();
          toast('Supprimé', 'Annuler', function () { RA.restoreClip(c.id).then(loadClips).catch(fail); });
        }).catch(fail);
      });
      actions.appendChild(delB);
      card.appendChild(actions);
      box.appendChild(card);
    });
  }

  function addClip() {
    var content = $('clipContent').value;
    if (!content.trim()) { $('clipContent').focus(); return; }
    RA.createClip({ content: content, label: $('clipLabel').value.trim(), kind: 'text' }).then(function () {
      $('clipContent').value = ''; $('clipLabel').value = '';
      loadClips();
      toast('Gardé');
    }).catch(fail);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copié dans le presse-papier'); }).catch(function () { toast('Copie impossible sur cet appareil'); });
    } else {
      toast('Copie impossible sur cet appareil');
    }
  }

  // ======================================================================
  //  CORBEILLE
  // ======================================================================
  function openTrash() {
    $('settingsModal').classList.remove('show');
    var body = $('trashBody');
    body.innerHTML = 'Chargement…';
    Promise.all([RA.trashNotes(), RA.trashClips(), RA.trashRecipes()]).then(function (res) {
      body.innerHTML = '';
      var sections = [
        { title: 'Idées', items: res[0].notes || [], name: function (n) { return n.title; }, restore: RA.restoreNote, purge: RA.purgeNote, reload: loadNotes },
        { title: 'Presse-papier', items: res[1].clips || [], name: function (c) { return c.label || c.preview || 'Sans titre'; }, restore: RA.restoreClip, purge: RA.purgeClip, reload: loadClips },
        { title: 'Recettes', items: res[2].recipes || [], name: function (r) { return r.title; }, restore: RA.restoreRecipe, purge: RA.purgeRecipe, reload: loadRecipes },
      ];
      var any = false;
      sections.forEach(function (sec) {
        if (!sec.items.length) return;
        any = true;
        var wrap = el('div', 'trash-section');
        wrap.appendChild(el('div', 'section-title', sec.title));
        sec.items.forEach(function (it) {
          var row = el('div', 'trash-item');
          row.appendChild(el('span', 'trash-name', sec.name(it)));
          var rB = el('button', 'btn btn-sm', 'Restaurer');
          rB.addEventListener('click', function () { sec.restore(it.id).then(function () { sec.reload(); openTrash(); }).catch(fail); });
          var pB = el('button', 'btn btn-sm btn-danger'); pB.appendChild(icon('x', 'icon-sm'));
          pB.addEventListener('click', function () {
            if (!confirm('Supprimer définitivement ?')) return;
            sec.purge(it.id).then(openTrash).catch(fail);
          });
          row.appendChild(rB); row.appendChild(pB);
          wrap.appendChild(row);
        });
        body.appendChild(wrap);
      });
      if (!any) body.appendChild(el('div', 'empty', 'La corbeille est vide.'));
    }).catch(fail);
    $('trashModal').classList.add('show');
  }

  // ======================================================================
  //  RÉGLAGES : export / import / sauvegarde
  // ======================================================================
  function doExport() {
    RA.exportAll().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = el('a'); a.href = url; a.download = 'racine-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast('Export téléchargé');
    }).catch(fail);
  }
  function doImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('Fichier JSON invalide'); return; }
      if (!confirm('Importer ce fichier ? Les éléments seront fusionnés à tes données actuelles.')) return;
      RA.importAll(data, 'merge').then(function () {
        toast('Import terminé');
        loadNotes(); loadRecipes(); loadClips();
        $('settingsModal').classList.remove('show');
      }).catch(fail);
    };
    reader.readAsText(file);
  }

  // ======================================================================
  //  ONGLETS / THÈME / INIT
  // ======================================================================
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'recettes') loadRecipes();
    if (name === 'clips') loadClips();
  }

  function applyThemeIcon() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var btn = $('themeToggle'); btn.innerHTML = ''; btn.appendChild(icon(isLight ? 'sun' : 'moon'));
  }

  function wire() {
    // onglets
    document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { switchTab(t.dataset.view); }); });

    // capture idées
    $('captureKind').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.captureKind = b.dataset.kind;
        $('captureKind').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      });
    });
    $('captureAdd').addEventListener('click', submitCapture);
    $('captureInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitCapture(); } });

    // modale idée
    $('ideaModalClose').addEventListener('click', function () { $('ideaModal').classList.remove('show'); });
    $('ideaModal').addEventListener('click', function (e) { if (e.target === $('ideaModal')) $('ideaModal').classList.remove('show'); });
    $('ideaEditSave').addEventListener('click', function () {
      var title = $('ideaEditTitle').value.trim();
      if (!title) { toast('Le titre ne peut pas être vide'); return; }
      var subject = $('ideaEditSubject').value || 'Général';
      addSubject(subject);
      RA.updateNote(S.ideaEditId, { title: title, content: $('ideaEditContent').value, kind: $('ideaEditKind').value, space: subject }).then(function () {
        $('ideaModal').classList.remove('show'); loadNotes();
      }).catch(fail);
    });
    $('ideaEditDelete').addEventListener('click', function () {
      var id = S.ideaEditId;
      RA.deleteNote(id).then(function () {
        $('ideaModal').classList.remove('show'); loadNotes();
        toast('Supprimé', 'Annuler', function () { RA.restoreNote(id).then(loadNotes).catch(fail); });
      }).catch(fail);
    });

    // recettes
    $('recipeNew').addEventListener('click', function () { openRecipeModal(null); });
    $('recipeSearch').addEventListener('input', function () { S.recipeSearch = $('recipeSearch').value; renderRecipes(); });
    $('shoppingBtn').addEventListener('click', globalShoppingList);
    $('recipeModalClose').addEventListener('click', function () { $('recipeModal').classList.remove('show'); });
    $('recipeModalCancel').addEventListener('click', function () { $('recipeModal').classList.remove('show'); });
    $('ingAddRow').addEventListener('click', function () { S.ingDraft.push({ name: '', qty: null, unit: 'piece', have: false }); renderIngEditor(); });
    $('recipeEditSave').addEventListener('click', saveRecipe);

    // presse-papier
    $('clipAdd').addEventListener('click', addClip);

    // réglages
    $('settingsBtn').addEventListener('click', function () {
      $('settingsModal').classList.add('show');
      RA.health().then(function (h) { $('settingsNote').textContent = 'Schéma v' + (h.schema_version || '?') + ' · ' + (h.notes || 0) + ' idées · ' + (h.recipes || 0) + ' recettes'; }).catch(function () {});
    });
    $('settingsClose').addEventListener('click', function () { $('settingsModal').classList.remove('show'); });
    $('exportBtn').addEventListener('click', doExport);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ''; });
    $('backupBtn').addEventListener('click', function () { RA.createBackup().then(function () { toast('Sauvegarde créée'); }).catch(fail); });
    $('trashBtn').addEventListener('click', openTrash);
    $('trashClose').addEventListener('click', function () { $('trashModal').classList.remove('show'); });
    $('logoutBtn').addEventListener('click', function () {
      var clearCaches = typeof caches !== 'undefined' ? caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); }) : Promise.resolve();
      Promise.all([RA.logout(), clearCaches]).then(function () { location.href = 'login.html'; });
    });

    // thème
    applyThemeIcon();
    $('themeToggle').addEventListener('click', function () {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('racine_theme', ''); }
      else { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('racine_theme', 'light'); }
      applyThemeIcon();
      if (window.RAStarfield && window.RAStarfield.setTheme) window.RAStarfield.setTheme(isLight ? 'dark' : 'light');
    });

    // fermer une modale au clic sur le fond
    ['recipeModal', 'settingsModal', 'trashModal'].forEach(function (id) {
      $(id).addEventListener('click', function (e) { if (e.target === $(id)) $(id).classList.remove('show'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { var open = document.querySelector('.modal.show'); if (open) open.classList.remove('show'); }
    });
  }

  // ---------- démarrage ----------
  RA.me().then(function () {
    wire();
    loadNotes();
    if (navigator.onLine && typeof OfflineQueue !== 'undefined') {
      OfflineQueue.flush().then(function (n) { if (n > 0) { loadNotes(); loadRecipes(); loadClips(); } });
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }).catch(function () { location.href = 'login.html'; });

  window.addEventListener('online', function () {
    if (typeof OfflineQueue !== 'undefined') OfflineQueue.flush().then(function () { loadNotes(); loadRecipes(); loadClips(); });
  });
})();
