// Racine — recettes et listes de courses (ingrédients qu'on a déjà / qu'il faut acheter)
  // ================= RECETTES =================

  // liste d'ingrédients courants de supermarché, pour autocomplétion (datalist native du navigateur)
  var COMMON_INGREDIENTS = [
    'Pomme', 'Poire', 'Banane', 'Orange', 'Citron', 'Citron vert', 'Pamplemousse', 'Fraise', 'Framboise',
    'Myrtille', 'Cerise', 'Abricot', 'Pêche', 'Nectarine', 'Prune', 'Raisin', 'Kiwi', 'Ananas', 'Mangue',
    'Melon', 'Pastèque', 'Avocat', 'Figue', 'Grenade', 'Litchi', 'Clémentine', 'Mandarine',
    'Tomate', 'Tomate cerise', 'Concombre', 'Courgette', 'Aubergine', 'Poivron rouge', 'Poivron vert',
    'Poivron jaune', 'Oignon', 'Échalote', 'Ail', 'Pomme de terre', 'Patate douce', 'Carotte', 'Céleri',
    'Céleri-rave', 'Poireau', 'Chou', 'Chou-fleur', 'Brocoli', 'Chou de Bruxelles', 'Chou rouge', 'Épinard',
    'Salade verte', 'Laitue', 'Roquette', 'Mâche', 'Endive', 'Radis', 'Betterave', 'Navet', 'Fenouil',
    'Haricot vert', 'Petit pois', 'Maïs', 'Champignon de Paris', 'Champignon', 'Courge butternut', 'Potiron',
    'Artichaut', 'Asperge',
    'Persil', 'Basilic', 'Coriandre', 'Ciboulette', 'Thym', 'Romarin', 'Laurier', 'Menthe', 'Estragon',
    'Aneth', 'Origan', 'Gingembre frais',
    'Poulet', 'Blanc de poulet', 'Cuisse de poulet', 'Bœuf haché', 'Steak haché', 'Steak', 'Bœuf bourguignon',
    'Escalope de veau', 'Porc', 'Côte de porc', 'Lardons', 'Bacon', 'Jambon', 'Jambon blanc', 'Saucisse',
    'Chorizo', 'Merguez', 'Dinde', 'Canard', 'Agneau', 'Côtelette d\'agneau',
    'Saumon', 'Cabillaud', 'Thon', 'Thon en boîte', 'Crevettes', 'Moules', 'Sardine', 'Maquereau', 'Colin',
    'Truite', 'Poisson blanc', 'Calamar',
    'Lait', 'Lait entier', 'Lait demi-écrémé', 'Crème fraîche', 'Crème liquide', 'Beurre', 'Œufs', 'Yaourt',
    'Yaourt nature', 'Fromage râpé', 'Emmental', 'Gruyère', 'Comté', 'Mozzarella', 'Parmesan', 'Feta',
    'Chèvre', 'Camembert', 'Ricotta', 'Mascarpone', 'Fromage blanc', 'Petit-suisse',
    'Farine', 'Farine de blé', 'Sucre', 'Sucre en poudre', 'Sucre roux', 'Sel', 'Poivre', 'Huile d\'olive',
    'Huile de tournesol', 'Vinaigre', 'Vinaigre balsamique', 'Moutarde', 'Mayonnaise', 'Ketchup', 'Sauce soja',
    'Riz', 'Pâtes', 'Spaghetti', 'Semoule', 'Quinoa', 'Lentilles', 'Pois chiches', 'Haricots rouges',
    'Haricots blancs', 'Bouillon de légumes', 'Bouillon de poule', 'Concentré de tomate', 'Tomates pelées',
    'Coulis de tomate', 'Olives', 'Câpres', 'Cornichons', 'Levure chimique', 'Levure boulangère', 'Chapelure',
    'Pain', 'Pain de mie', 'Baguette',
    'Chocolat noir', 'Chocolat au lait', 'Chocolat blanc', 'Pépites de chocolat', 'Cacao en poudre', 'Miel',
    'Confiture', 'Pâte à tartiner', 'Vanille', 'Cannelle', 'Biscuits', 'Céréales', 'Amandes', 'Noisettes',
    'Noix', 'Raisins secs', 'Pignons de pin',
    'Eau', 'Jus d\'orange', 'Café', 'Thé', 'Vin rouge', 'Vin blanc', 'Lait de coco',
    'Légumes surgelés', 'Frites surgelées', 'Épinards surgelés', 'Petits pois surgelés', 'Pizza surgelée', 'Glace',
  ];

  (function buildIngredientDatalist() {
    var dl = document.createElement('datalist');
    dl.id = 'ingredientDatalist';
    COMMON_INGREDIENTS.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
  })();

  function formatQty(qty) {
    // affiche 500 plutôt que 500.0, mais garde 0.5 si besoin
    return String(Math.round(qty * 100) / 100);
  }

  function formatIngredientLabel(ing, scale) {
    scale = scale || 1;
    if (!ing.qty) return ing.name;
    var qty = Number(ing.qty) * scale;
    if (ing.unit === 'g' || ing.unit === 'kg') return formatQty(qty) + ' ' + ing.unit + ' ' + ing.name;
    return formatQty(qty) + ' ' + ing.name;
  }

  var recipeDraftIngredients = [];
  var recipeIngredientInput = document.getElementById('recipeIngredientInput');
  var recipeIngredientQty = document.getElementById('recipeIngredientQty');
  var recipeIngredientUnit = document.getElementById('recipeIngredientUnit');
  var recipeQuery = '';
  var recipeFilter = 'all';
  var recipeSuggestionCursor = 0;
  var recipeSuggestionId = null;
  var recipeMultipliers = {};
  var cookingRecipe = null;
  var cookingWakeLock = null;

  function recipeReadiness(ingredients) {
    var total = ingredients.length;
    var have = ingredients.filter(function (i) { return !!i.have; }).length;
    var missing = total - have;
    return { total: total, have: have, missing: missing, ratio: total ? have / total : 0 };
  }

  function recipeMatches(r) {
    var ingredients = parseIngredients(r);
    var readiness = recipeReadiness(ingredients);
    var hay = (r.title + ' ' + ingredients.map(function (i) { return i.name; }).join(' ')).toLowerCase();
    if (recipeQuery && hay.indexOf(recipeQuery) === -1) return false;
    if (recipeFilter === 'ready') return readiness.total > 0 && readiness.missing === 0;
    if (recipeFilter === 'close') return readiness.missing > 0 && readiness.missing <= 2;
    return true;
  }

  function rankedRecipes(recipes) {
    return recipes.slice().sort(function (a, b) {
      var ar = recipeReadiness(parseIngredients(a));
      var br = recipeReadiness(parseIngredients(b));
      return ar.missing - br.missing || br.ratio - ar.ratio || br.total - ar.total || a.title.localeCompare(b.title, 'fr');
    });
  }

  function renderRecipeOracle(recipes) {
    var title = document.getElementById('recipeSuggestionTitle');
    var meta = document.getElementById('recipeSuggestionMeta');
    var openBtn = document.getElementById('recipeSuggestionOpen');
    var ranked = rankedRecipes(recipes);
    if (!ranked.length) {
      recipeSuggestionId = null;
      title.textContent = 'Racine cherche ce que tu peux cuisiner sans te disperser.';
      meta.textContent = 'Ajoute tes recettes : la meilleure option apparaîtra ici.';
      openBtn.disabled = true;
      return;
    }
    recipeSuggestionCursor = recipeSuggestionCursor % ranked.length;
    var choice = ranked[recipeSuggestionCursor];
    var readiness = recipeReadiness(parseIngredients(choice));
    recipeSuggestionId = choice.id;
    title.textContent = choice.title;
    if (!readiness.missing) meta.textContent = 'Tout est déjà là. Tu peux commencer sans passer par les courses.';
    else if (readiness.missing === 1) meta.textContent = 'Il manque une seule chose : c’est la branche la plus facile à terminer.';
    else meta.textContent = readiness.missing + ' ingrédients manquent sur ' + readiness.total + ' — la meilleure option disponible.';
    openBtn.disabled = false;
  }

  function renderIngredientDraft() {
    var el = document.getElementById('recipeIngredientDraft');
    el.innerHTML = '';
    recipeDraftIngredients.forEach(function (ing, idx) {
      var chip = document.createElement('span');
      chip.className = 'ingredient-chip';
      chip.appendChild(document.createTextNode(formatIngredientLabel(ing)));
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'ingredient-chip-x';
      x.title = 'Retirer cet ingrédient';
      x.setAttribute('aria-label', 'Retirer cet ingrédient');
      x.appendChild(icon('x', 'icon-inline'));
      x.addEventListener('click', function () {
        recipeDraftIngredients.splice(idx, 1);
        renderIngredientDraft();
      });
      chip.appendChild(x);
      el.appendChild(chip);
    });
  }

  function addDraftIngredient() {
    var v = recipeIngredientInput.value.trim();
    if (!v) return;
    var qty = recipeIngredientQty.value ? Number(recipeIngredientQty.value) : null;
    recipeDraftIngredients.push({ name: v, have: false, qty: qty && qty > 0 ? qty : null, unit: recipeIngredientUnit.value });
    recipeIngredientInput.value = '';
    recipeIngredientQty.value = '';
    renderIngredientDraft();
    recipeIngredientInput.focus();
  }
  document.getElementById('recipeIngredientAdd').addEventListener('click', addDraftIngredient);
  recipeIngredientInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addDraftIngredient(); }
  });
  recipeIngredientQty.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addDraftIngredient(); }
  });

  document.getElementById('recipeSave').addEventListener('click', function () {
    var titleInput = document.getElementById('recipeTitle');
    var title = titleInput.value.trim();
    if (!title) { toast('Donne un nom à la recette'); titleInput.focus(); return; }
    if (!recipeDraftIngredients.length) { toast('Ajoute au moins un ingrédient'); recipeIngredientInput.focus(); return; }
    RA.createRecipe({ title: title, ingredients: recipeDraftIngredients }).then(function () {
      if (window.RAUniverse) window.RAUniverse.emit('create', document.querySelector('.recipe-form'));
      titleInput.value = '';
      recipeDraftIngredients = [];
      renderIngredientDraft();
      toast('Recette créée');
      loadRecipes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  function parseIngredients(r) {
    try { return JSON.parse(r.ingredients || '[]'); } catch (e) { return []; }
  }

  function formatMissingList(title, ingredients, scale) {
    var missing = ingredients.filter(function (i) { return !i.have; });
    if (!missing.length) return null;
    var lines = ['Liste de courses' + (title ? ' — ' + title : '') + ' :'];
    missing.forEach(function (i) { lines.push('* ' + formatIngredientLabel(i, scale)); });
    return lines.join('\n');
  }

  function ingredientSection(name) {
    var n = name.toLowerCase();
    if (/(pomme|poire|banane|orange|citron|fraise|framboise|tomate|concombre|courgette|aubergine|poivron|oignon|ail|pomme de terre|carotte|poireau|chou|brocoli|épinard|salade|radis|champignon|avocat|herbe|persil|basilic)/.test(n)) return 'Fruits et légumes';
    if (/(lait|crème|beurre|œuf|oeuf|yaourt|fromage|mozzarella|parmesan|feta|poulet|bœuf|boeuf|porc|jambon|saumon|poisson|crevette)/.test(n)) return 'Frais';
    if (/(surgelé|surgelée|glace)/.test(n)) return 'Surgelés';
    return 'Placard et autres';
  }

  function aggregateMissingList(recipes) {
    var grouped = {};
    recipes.forEach(function (r) {
      var scale = recipeMultipliers[r.id] || 1;
      parseIngredients(r).filter(function (i) { return !i.have; }).forEach(function (i) {
        var unit = i.unit || 'piece';
        var key = i.name.trim().toLowerCase() + '|' + unit;
        if (!grouped[key]) grouped[key] = { name: i.name.trim(), unit: unit, qty: i.qty ? 0 : null, section: ingredientSection(i.name) };
        if (i.qty && grouped[key].qty !== null) grouped[key].qty += Number(i.qty) * scale;
        else if (!i.qty) grouped[key].qty = null;
      });
    });
    var items = Object.keys(grouped).map(function (key) { return grouped[key]; });
    if (!items.length) return null;
    var order = ['Fruits et légumes', 'Frais', 'Surgelés', 'Placard et autres'];
    var lines = ['Courses intelligentes :'];
    order.forEach(function (section) {
      var sectionItems = items.filter(function (i) { return i.section === section; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
      if (!sectionItems.length) return;
      lines.push('', section);
      sectionItems.forEach(function (i) { lines.push('• ' + formatIngredientLabel(i, 1)); });
    });
    return lines.join('\n');
  }

  function shareText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Liste copiée — colle-la où tu veux l\'envoyer'); });
    } else {
      toast('Impossible de copier automatiquement sur cet appareil');
    }
  }

  function renderRecipeCard(r) {
    var ingredients = parseIngredients(r);
    var readiness = recipeReadiness(ingredients);
    var multiplier = recipeMultipliers[r.id] || 1;

    var card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.recipeId = r.id;

    var head = document.createElement('div');
    head.className = 'recipe-card-head';
    var title = document.createElement('span');
    title.className = 'recipe-title';
    title.textContent = r.title;
    head.appendChild(title);

    var scaleWrap = document.createElement('label');
    scaleWrap.className = 'recipe-scale';
    scaleWrap.appendChild(document.createTextNode('Quantités'));
    var scaleSelect = document.createElement('select');
    scaleSelect.setAttribute('aria-label', 'Multiplier les quantités de ' + r.title);
    [1, 2, 3, 4].forEach(function (value) {
      var scaleOption = document.createElement('option');
      scaleOption.value = String(value);
      scaleOption.textContent = '×' + value;
      scaleOption.selected = value === multiplier;
      scaleSelect.appendChild(scaleOption);
    });
    scaleSelect.addEventListener('change', function () {
      recipeMultipliers[r.id] = Number(scaleSelect.value);
      renderRecipesView();
    });
    scaleWrap.appendChild(scaleSelect);

    var editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Renommer';
    editBtn.setAttribute('aria-label', 'Renommer');
    editBtn.appendChild(icon('pencil'));
    editBtn.addEventListener('click', function () {
      var newTitle = prompt('Renommer la recette :', r.title);
      if (!newTitle || !newTitle.trim() || newTitle.trim() === r.title) return;
      RA.updateRecipe(r.id, { title: newTitle.trim() }).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    head.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Mettre à la corbeille';
    delBtn.setAttribute('aria-label', 'Mettre à la corbeille');
    delBtn.appendChild(icon('x'));
    delBtn.addEventListener('click', function () {
      if (window.RAUniverse) window.RAUniverse.emit('delete', card);
      card.classList.add('removing');
      setTimeout(function () {
        RA.deleteRecipe(r.id).then(function () {
          loadRecipes();
          toast('Mis à la corbeille', 'Annuler', function () {
            RA.restoreRecipe(r.id).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
          });
        }).catch(function (err) { toast('Erreur : ' + err.message); card.classList.remove('removing'); });
      }, 190);
    });
    head.appendChild(delBtn);

    var readinessEl = document.createElement('div');
    readinessEl.className = 'recipe-readiness';
    var readinessTrack = document.createElement('div');
    readinessTrack.className = 'recipe-readiness-track';
    readinessTrack.style.setProperty('--recipe-ready', Math.round(readiness.ratio * 100) + '%');
    var readinessBar = document.createElement('span');
    readinessTrack.appendChild(readinessBar);
    readinessEl.appendChild(readinessTrack);
    var readinessCopy = document.createElement('small');
    readinessCopy.textContent = readiness.missing ? readiness.missing + ' à trouver' : 'prête à cuisiner';
    readinessEl.appendChild(readinessCopy);
    readinessEl.appendChild(scaleWrap);
    head.appendChild(readinessEl);
    card.appendChild(head);

    var list = document.createElement('div');
    list.className = 'recipe-ingredients';
    ingredients.forEach(function (ing, idx) {
      var row = document.createElement('div');
      row.className = 'recipe-ingredient-row' + (ing.have ? ' have' : '');
      var checkLabel = document.createElement('label');
      checkLabel.className = 'recipe-ingredient-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!ing.have;
      cb.addEventListener('change', function () {
        var next = ingredients.map(function (x, i) { return i === idx ? { name: x.name, have: cb.checked, qty: x.qty, unit: x.unit } : x; });
        RA.updateRecipe(r.id, { ingredients: next }).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      checkLabel.appendChild(cb);
      var name = document.createElement('span');
      name.textContent = formatIngredientLabel(ing, multiplier);
      checkLabel.appendChild(name);
      row.appendChild(checkLabel);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'ingredient-remove';
      rm.appendChild(icon('x', 'icon-inline'));
      rm.title = 'Retirer cet ingrédient';
      rm.setAttribute('aria-label', 'Retirer cet ingrédient');
      rm.addEventListener('click', function (e) {
        e.preventDefault();
        var next = ingredients.filter(function (_, i) { return i !== idx; });
        RA.updateRecipe(r.id, { ingredients: next }).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(rm);
      list.appendChild(row);
    });
    card.appendChild(list);

    var addRow = document.createElement('div');
    addRow.className = 'recipe-ingredient-add-row small';
    var addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'field ingredient-name-field';
    addInput.setAttribute('list', 'ingredientDatalist');
    addInput.placeholder = 'Ajouter un ingrédient…';
    var addQty = document.createElement('input');
    addQty.type = 'number';
    addQty.className = 'field qty-field';
    addQty.placeholder = 'Qté';
    addQty.min = '0';
    addQty.step = '0.1';
    var addUnit = document.createElement('select');
    addUnit.className = 'field unit-field';
    ['piece', 'g', 'kg'].forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u === 'piece' ? 'pièce' : u;
      addUnit.appendChild(opt);
    });
    var addQtyGroup = document.createElement('div');
    addQtyGroup.className = 'qty-unit-group';
    addQtyGroup.appendChild(addQty);
    addQtyGroup.appendChild(addUnit);
    var addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.type = 'button';
    addBtn.title = 'Ajouter l\'ingrédient';
    addBtn.appendChild(icon('plus'));
    function addIngredientHere() {
      var v = addInput.value.trim();
      if (!v) return;
      var qty = addQty.value ? Number(addQty.value) : null;
      var next = ingredients.concat([{ name: v, have: false, qty: qty && qty > 0 ? qty : null, unit: addUnit.value }]);
      RA.updateRecipe(r.id, { ingredients: next }).then(function () { loadRecipes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    }
    addBtn.addEventListener('click', addIngredientHere);
    addInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addIngredientHere(); } });
    addQty.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addIngredientHere(); } });
    addRow.appendChild(addInput);
    addRow.appendChild(addQtyGroup);
    addRow.appendChild(addBtn);
    card.appendChild(addRow);

    var missingText = formatMissingList(r.title, ingredients, multiplier);
    var footer = document.createElement('div');
    footer.className = 'recipe-actions';
    var cookBtn = document.createElement('button');
    cookBtn.className = 'btn btn-primary';
    cookBtn.appendChild(icon('pot'));
    cookBtn.appendChild(document.createTextNode(' Mode cuisine'));
    cookBtn.addEventListener('click', function () { openCookingMode(r); });
    footer.appendChild(cookBtn);
    if (missingText) {
      var shareBtn = document.createElement('button');
      shareBtn.className = 'btn';
      shareBtn.appendChild(icon('cart'));
      shareBtn.appendChild(document.createTextNode(' Ce qui manque'));
      shareBtn.addEventListener('click', function () { shareText(missingText); });
      footer.appendChild(shareBtn);
    } else if (ingredients.length) {
      var okMsg = document.createElement('span');
      okMsg.className = 'recipe-complete-msg';
      okMsg.appendChild(icon('check', 'icon-inline'));
      okMsg.appendChild(document.createTextNode(' tu as tout à la maison !'));
      footer.appendChild(okMsg);
    }
    card.appendChild(footer);

    return card;
  }

  var cookingModal = document.getElementById('cookingModal');
  var cookingList = document.getElementById('cookingIngredients');

  function updateCookingProgress() {
    var boxes = cookingList.querySelectorAll('input[type="checkbox"]');
    var done = cookingList.querySelectorAll('input[type="checkbox"]:checked').length;
    var total = boxes.length;
    var percent = total ? Math.round(done / total * 100) : 0;
    document.getElementById('cookingProgress').textContent = done === total && total
      ? 'Tout est prêt. Tu peux cuisiner sans perdre le fil.'
      : done + ' sur ' + total + ' ingrédients préparés';
    document.getElementById('cookingProgressBar').style.width = percent + '%';
  }

  function openCookingMode(r) {
    cookingRecipe = r;
    var ingredients = parseIngredients(r);
    var multiplier = recipeMultipliers[r.id] || 1;
    document.getElementById('cookingTitle').textContent = r.title;
    cookingList.innerHTML = '';
    ingredients.forEach(function (ing) {
      var row = document.createElement('label');
      row.className = 'cooking-ingredient';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', function () {
        row.classList.toggle('done', cb.checked);
        updateCookingProgress();
      });
      var copy = document.createElement('span');
      copy.textContent = formatIngredientLabel(ing, multiplier);
      row.appendChild(cb);
      row.appendChild(copy);
      cookingList.appendChild(row);
    });
    document.getElementById('cookingWakeLock').disabled = !('wakeLock' in navigator);
    document.getElementById('cookingWakeLock').textContent = 'wakeLock' in navigator ? 'Garder l’écran allumé' : 'Écran allumé indisponible';
    updateCookingProgress();
    cookingModal.classList.add('show');
    if (window.RAUniverse) window.RAUniverse.emit('focus', cookingModal.querySelector('.cooking-modal-card'));
  }

  function releaseCookingWakeLock() {
    if (!cookingWakeLock) return;
    cookingWakeLock.release().catch(function () {});
    cookingWakeLock = null;
    document.getElementById('cookingWakeLock').textContent = 'Garder l’écran allumé';
  }

  function closeCookingMode() {
    cookingModal.classList.remove('show');
    releaseCookingWakeLock();
    cookingRecipe = null;
  }

  document.getElementById('cookingClose').addEventListener('click', closeCookingMode);
  cookingModal.addEventListener('click', function (e) { if (e.target === cookingModal) closeCookingMode(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cookingRecipe) closeCookingMode(); });
  document.getElementById('cookingDone').addEventListener('click', function () {
    if (window.RAUniverse) window.RAUniverse.emit('harvest', cookingModal.querySelector('.cooking-modal-card'));
    toast('Cuisine terminée — la boucle est fermée');
    closeCookingMode();
  });
  document.getElementById('cookingCopy').addEventListener('click', function () {
    if (!cookingRecipe) return;
    var missing = formatMissingList(cookingRecipe.title, parseIngredients(cookingRecipe), recipeMultipliers[cookingRecipe.id] || 1);
    if (!missing) { toast('Tu as déjà tout à la maison'); return; }
    shareText(missing);
  });
  document.getElementById('cookingWakeLock').addEventListener('click', function () {
    if (!('wakeLock' in navigator)) return;
    if (cookingWakeLock) { releaseCookingWakeLock(); return; }
    navigator.wakeLock.request('screen').then(function (lock) {
      cookingWakeLock = lock;
      document.getElementById('cookingWakeLock').textContent = 'Écran maintenu allumé';
      lock.addEventListener('release', function () {
        cookingWakeLock = null;
        document.getElementById('cookingWakeLock').textContent = 'Garder l’écran allumé';
      });
    }).catch(function () { toast('Impossible de maintenir l’écran allumé'); });
  });

  function renderRecipesView() {
    var grid = document.getElementById('recipeGrid');
    grid.innerHTML = '';
    var allRecipes = state.recipes || [];
    var visible = allRecipes.filter(recipeMatches);
    document.getElementById('recipeEmpty').style.display = allRecipes.length ? 'none' : 'block';
    visible.forEach(function (r) { grid.appendChild(renderRecipeCard(r)); });
    if (allRecipes.length && !visible.length) {
      var noMatch = document.createElement('div');
      noMatch.className = 'recipe-filter-empty';
      noMatch.textContent = 'Aucune recette dans cette direction. Change le filtre ou la recherche.';
      grid.appendChild(noMatch);
    }
    renderRecipeOracle(allRecipes);
  }

  function loadRecipes() {
    return RA.listRecipes().then(function (data) {
      state.recipes = data.recipes;
      renderRecipesView();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  document.getElementById('shoppingListBtn').addEventListener('click', function () {
    var list = aggregateMissingList(state.recipes || []);
    if (!list) { toast('Rien à acheter — tout est déjà à la maison !'); return; }
    shareText(list);
  });

  document.getElementById('recipeSearch').addEventListener('input', function (e) {
    recipeQuery = e.target.value.trim().toLowerCase();
    renderRecipesView();
  });
  document.querySelectorAll('[data-recipe-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      recipeFilter = btn.dataset.recipeFilter;
      document.querySelectorAll('[data-recipe-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderRecipesView();
    });
  });
  document.getElementById('recipeSurprise').addEventListener('click', function () {
    if (!(state.recipes || []).length) { toast('Ajoute d’abord une recette'); return; }
    recipeSuggestionCursor += 1;
    renderRecipeOracle(state.recipes);
    if (window.RAUniverse) window.RAUniverse.emit('view', document.querySelector('.recipe-oracle'));
  });
  document.getElementById('recipeSuggestionOpen').addEventListener('click', function () {
    var recipe = (state.recipes || []).find(function (r) { return r.id === recipeSuggestionId; });
    if (recipe) openCookingMode(recipe);
  });
