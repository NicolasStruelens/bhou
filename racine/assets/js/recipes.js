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

  function formatIngredientLabel(ing) {
    if (!ing.qty) return ing.name;
    if (ing.unit === 'g' || ing.unit === 'kg') return formatQty(ing.qty) + ' ' + ing.unit + ' ' + ing.name;
    return formatQty(ing.qty) + ' ' + ing.name;
  }

  var recipeDraftIngredients = [];
  var recipeIngredientInput = document.getElementById('recipeIngredientInput');
  var recipeIngredientQty = document.getElementById('recipeIngredientQty');
  var recipeIngredientUnit = document.getElementById('recipeIngredientUnit');

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

  function formatMissingList(title, ingredients) {
    var missing = ingredients.filter(function (i) { return !i.have; });
    if (!missing.length) return null;
    var lines = ['Liste de courses' + (title ? ' — ' + title : '') + ' :'];
    missing.forEach(function (i) { lines.push('* ' + formatIngredientLabel(i)); });
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

    var card = document.createElement('div');
    card.className = 'recipe-card';

    var head = document.createElement('div');
    head.className = 'recipe-card-head';
    var title = document.createElement('span');
    title.className = 'recipe-title';
    title.textContent = r.title;
    head.appendChild(title);

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
    card.appendChild(head);

    var list = document.createElement('div');
    list.className = 'recipe-ingredients';
    ingredients.forEach(function (ing, idx) {
      var row = document.createElement('label');
      row.className = 'recipe-ingredient-row' + (ing.have ? ' have' : '');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!ing.have;
      cb.addEventListener('change', function () {
        var next = ingredients.map(function (x, i) { return i === idx ? { name: x.name, have: cb.checked, qty: x.qty, unit: x.unit } : x; });
        RA.updateRecipe(r.id, { ingredients: next }).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(cb);
      var name = document.createElement('span');
      name.textContent = formatIngredientLabel(ing);
      row.appendChild(name);
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

    var missingText = formatMissingList(r.title, ingredients);
    var footer = document.createElement('div');
    footer.className = 'recipe-actions';
    if (missingText) {
      var shareBtn = document.createElement('button');
      shareBtn.className = 'btn btn-primary';
      shareBtn.appendChild(icon('cart'));
      shareBtn.appendChild(document.createTextNode(' Copier / partager ce qui manque'));
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

  function loadRecipes() {
    return RA.listRecipes().then(function (data) {
      state.recipes = data.recipes;
      var grid = document.getElementById('recipeGrid');
      grid.innerHTML = '';
      document.getElementById('recipeEmpty').style.display = data.recipes.length ? 'none' : 'block';
      data.recipes.forEach(function (r) { grid.appendChild(renderRecipeCard(r)); });
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  document.getElementById('shoppingListBtn').addEventListener('click', function () {
    var lines = ['Liste de courses :'];
    var seen = {};
    state.recipes.forEach(function (r) {
      parseIngredients(r).filter(function (i) { return !i.have; }).forEach(function (i) {
        var key = i.name.trim().toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        lines.push('* ' + formatIngredientLabel(i));
      });
    });
    if (lines.length === 1) { toast('Rien à acheter — tout est déjà à la maison !'); return; }
    shareText(lines.join('\n'));
  });
