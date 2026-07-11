// Racine — recettes et listes de courses (ingrédients qu'on a déjà / qu'il faut acheter)
  // ================= RECETTES =================

  var recipeDraftIngredients = [];
  var recipeIngredientInput = document.getElementById('recipeIngredientInput');

  function renderIngredientDraft() {
    var el = document.getElementById('recipeIngredientDraft');
    el.innerHTML = '';
    recipeDraftIngredients.forEach(function (name, idx) {
      var chip = document.createElement('span');
      chip.className = 'ingredient-chip';
      chip.appendChild(document.createTextNode(name));
      var x = document.createElement('span');
      x.className = 'ingredient-chip-x';
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
    recipeDraftIngredients.push(v);
    recipeIngredientInput.value = '';
    renderIngredientDraft();
    recipeIngredientInput.focus();
  }
  document.getElementById('recipeIngredientAdd').addEventListener('click', addDraftIngredient);
  recipeIngredientInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addDraftIngredient(); }
  });

  document.getElementById('recipeSave').addEventListener('click', function () {
    var titleInput = document.getElementById('recipeTitle');
    var title = titleInput.value.trim();
    if (!title) { toast('Donne un nom à la recette'); titleInput.focus(); return; }
    if (!recipeDraftIngredients.length) { toast('Ajoute au moins un ingrédient'); recipeIngredientInput.focus(); return; }
    var ingredients = recipeDraftIngredients.map(function (name) { return { name: name, have: false }; });
    RA.createRecipe({ title: title, ingredients: ingredients }).then(function () {
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
    missing.forEach(function (i) { lines.push('- ' + i.name); });
    return lines.join('\n');
  }

  function shareText(text) {
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
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
    delBtn.appendChild(icon('x'));
    delBtn.addEventListener('click', function () {
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
        var next = ingredients.map(function (x, i) { return i === idx ? { name: x.name, have: cb.checked } : x; });
        RA.updateRecipe(r.id, { ingredients: next }).then(loadRecipes).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(cb);
      var name = document.createElement('span');
      name.textContent = ing.name;
      row.appendChild(name);
      var rm = document.createElement('span');
      rm.className = 'ingredient-remove';
      rm.appendChild(icon('x', 'icon-inline'));
      rm.title = 'Retirer cet ingrédient';
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
    addInput.className = 'field';
    addInput.placeholder = 'Ajouter un ingrédient…';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.type = 'button';
    addBtn.appendChild(icon('plus'));
    function addIngredientHere() {
      var v = addInput.value.trim();
      if (!v) return;
      var next = ingredients.concat([{ name: v, have: false }]);
      RA.updateRecipe(r.id, { ingredients: next }).then(function () { loadRecipes(); }).catch(function (err) { toast('Erreur : ' + err.message); });
    }
    addBtn.addEventListener('click', addIngredientHere);
    addInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addIngredientHere(); } });
    addRow.appendChild(addInput);
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
        lines.push('- ' + i.name);
      });
    });
    if (lines.length === 1) { toast('Rien à acheter — tout est déjà à la maison !'); return; }
    shareText(lines.join('\n'));
  });
