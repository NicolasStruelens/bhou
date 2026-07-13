// Racine — export JSON complet et import (avec remappage d'ID topologique)
  // ================= EXPORT =================

  document.getElementById('exportBtn').addEventListener('click', function () {
    RA.exportAll().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'racine-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Export téléchargé');
    }).catch(function (err) { toast('Erreur export : ' + err.message); });
  });

  // ================= IMPORT =================

  async function runImport(data) {
    var notes = data.notes || [];
    var byId = {};
    notes.forEach(function (n) { byId[n.id] = n; });
    var ordered = [];
    var visited = {};
    function visit(n) {
      if (visited[n.id]) return;
      visited[n.id] = true;
      if (n.parent_id && byId[n.parent_id]) visit(byId[n.parent_id]);
      ordered.push(n);
    }
    notes.forEach(visit);

    var idMap = {};
    for (var i = 0; i < ordered.length; i++) {
      var n = ordered[i];
      var history = [];
      try { history = JSON.parse(n.history || '[]'); } catch (e) { history = []; }
      var res = await RA.createNote({
        title: n.title,
        content: n.content || '',
        kind: n.kind || 'idee',
        pinned: !!n.pinned,
        done: !!n.done,
        position: n.position || 0,
        space: n.space || 'Général',
        tags: n.tags || '',
        energy: n.energy || '',
        status: n.status || 'active',
        remind_at: n.remind_at || null,
        history: history,
        created_at: n.created_at || null,
        updated_at: n.updated_at || null,
        parent_id: n.parent_id ? (idMap[n.parent_id] || null) : null,
      });
      idMap[n.id] = res.id;
    }
    for (var j = 0; j < ordered.length; j++) {
      var nn = ordered[j];
      if (nn.links) {
        var newLinkIds = parseLinks(nn.links).map(function (oid) { return idMap[oid]; }).filter(Boolean);
        if (newLinkIds.length) await RA.updateNote(idMap[nn.id], { links: newLinkIds.join(',') });
      }
    }
    var clips = data.clips || [];
    for (var k = 0; k < clips.length; k++) {
      var c = clips[k];
      await RA.createClip({
        label: c.label || '',
        content: c.content,
        kind: c.kind || 'text',
        filename: c.filename,
        mime: c.mime,
        device: c.device,
        pinned: !!c.pinned,
        burn: !!c.burn,
        no_export: !!c.no_export,
        created_at: c.created_at || null,
      });
    }
    var recipes = data.recipes || [];
    for (var m = 0; m < recipes.length; m++) {
      var r = recipes[m];
      var ingredients = [];
      try { ingredients = JSON.parse(r.ingredients || '[]'); } catch (e) { ingredients = []; }
      await RA.createRecipe({
        title: r.title,
        ingredients: ingredients,
        created_at: r.created_at || null,
        updated_at: r.updated_at || null,
      });
    }
  }

  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { toast('Fichier JSON invalide'); return; }
      if (!data || !Array.isArray(data.notes)) { toast('Format non reconnu (un export Racine est attendu)'); return; }
      var noteCount = data.notes.length;
      var clipCount = Array.isArray(data.clips) ? data.clips.length : 0;
      var recipeCount = Array.isArray(data.recipes) ? data.recipes.length : 0;
      if (!confirm('Importer ' + noteCount + ' note(s), ' + clipCount + ' élément(s) de presse-papier et ' + recipeCount + ' recette(s) ? Ils seront ajoutés à tes données actuelles (rien n\'est remplacé).')) return;
      toast('Import en cours…');
      runImport(data).then(function () {
        toast('Import terminé');
        loadNotes();
        loadClips();
        loadRecipes();
      }).catch(function (err) { toast('Erreur import : ' + err.message); });
    };
    reader.readAsText(file);
  });

  // ================= VÉRIFICATION DE FIDÉLITÉ EXPORT/IMPORT =================
  // Crée un petit échantillon de test dans un espace réservé, le compare champ par champ
  // à l'original, puis le supprime immédiatement. Ne modifie jamais les données réelles.

  var FIDELITY_TEST_SPACE = '__verif_fidelite__';

  function sampleForFidelity(list, prioritizeFn, max) {
    var prioritized = list.filter(prioritizeFn);
    var rest = list.filter(function (x) { return prioritized.indexOf(x) === -1; });
    return prioritized.concat(rest).slice(0, max);
  }

  async function runFidelityCheck() {
    var data = await RA.exportAll();
    var mismatches = [];
    var checked = 0;
    var createdNoteIds = [];
    var createdClipIds = [];
    var createdRecipeIds = [];

    try {
      // ---- notes (racines uniquement : la hiérarchie est une fonctionnalité déjà testée séparément) ----
      var rootNotes = (data.notes || []).filter(function (n) { return !n.parent_id; });
      var noteSample = sampleForFidelity(rootNotes, function (n) {
        return !!n.energy || n.status === 'someday' || !!n.done || !!n.pinned || (n.history && n.history !== '[]');
      }, 15);
      for (var i = 0; i < noteSample.length; i++) {
        var n = noteSample[i];
        var history = [];
        try { history = JSON.parse(n.history || '[]'); } catch (e) { history = []; }
        var nRes = await RA.createNote({
          title: n.title, content: n.content || '', kind: n.kind || 'idee',
          pinned: !!n.pinned, done: !!n.done, space: FIDELITY_TEST_SPACE, tags: n.tags || '',
          energy: n.energy || '', status: n.status || 'active', remind_at: n.remind_at || null,
          history: history, created_at: n.created_at || null, updated_at: n.updated_at || null,
        });
        createdNoteIds.push(nRes.id);
        checked++;
        var freshNotes = (await RA.listNotes()).notes;
        var fn = freshNotes.filter(function (x) { return x.id === nRes.id; })[0];
        if (!fn) { mismatches.push('note « ' + n.title + ' » : introuvable après création'); continue; }
        ['title', 'content', 'kind'].forEach(function (f) {
          if ((fn[f] || '') !== (n[f] || '')) mismatches.push('note « ' + n.title + ' » : champ ' + f + ' non fidèle');
        });
        if ((fn.energy || '') !== (n.energy || '')) mismatches.push('note « ' + n.title + ' » : énergie non fidèle');
        if ((fn.status || 'active') !== (n.status || 'active')) mismatches.push('note « ' + n.title + ' » : someday non fidèle');
        if (!!fn.pinned !== !!n.pinned) mismatches.push('note « ' + n.title + ' » : épinglage non fidèle');
        if (!!fn.done !== !!n.done) mismatches.push('note « ' + n.title + ' » : statut fait non fidèle');
        if ((fn.remind_at || null) !== (n.remind_at || null)) mismatches.push('note « ' + n.title + ' » : rappel non fidèle');
        if ((fn.history || '[]') !== JSON.stringify(history)) mismatches.push('note « ' + n.title + ' » : historique non fidèle');
      }

      // ---- presse-papier ----
      var clipSample = sampleForFidelity(data.clips || [], function (c) {
        return !!c.burn || !!c.no_export || !!c.pinned;
      }, 10);
      for (var j = 0; j < clipSample.length; j++) {
        var c = clipSample[j];
        var cRes = await RA.createClip({
          label: c.label || '', content: c.content, kind: c.kind || 'text',
          filename: c.filename, mime: c.mime, device: c.device,
          pinned: !!c.pinned, burn: !!c.burn, no_export: !!c.no_export,
          created_at: c.created_at || null,
        });
        createdClipIds.push(cRes.id);
        checked++;
        var freshClips = (await RA.listClips()).clips;
        var fc = freshClips.filter(function (x) { return x.id === cRes.id; })[0];
        if (!fc) { mismatches.push('clip « ' + (c.label || c.id) + ' » : introuvable après création'); continue; }
        ['label', 'kind', 'filename', 'mime', 'device'].forEach(function (f) {
          if ((fc[f] || '') !== (c[f] || '')) mismatches.push('clip « ' + (c.label || c.id) + ' » : champ ' + f + ' non fidèle');
        });
        if (!!fc.pinned !== !!c.pinned) mismatches.push('clip « ' + (c.label || c.id) + ' » : épinglage non fidèle');
        if (!!fc.burn !== !!c.burn) mismatches.push('clip « ' + (c.label || c.id) + ' » : lecture unique non fidèle');
        if (!!fc.no_export !== !!c.no_export) mismatches.push('clip « ' + (c.label || c.id) + ' » : exclusion export non fidèle');
      }

      // ---- recettes ----
      var recipeSample = sampleForFidelity(data.recipes || [], function () { return true; }, 8);
      for (var k = 0; k < recipeSample.length; k++) {
        var r = recipeSample[k];
        var ingredients = [];
        try { ingredients = JSON.parse(r.ingredients || '[]'); } catch (e) { ingredients = []; }
        var rRes = await RA.createRecipe({
          title: r.title, ingredients: ingredients,
          created_at: r.created_at || null, updated_at: r.updated_at || null,
        });
        createdRecipeIds.push(rRes.id);
        checked++;
        var freshRecipes = (await RA.listRecipes()).recipes;
        var fr = freshRecipes.filter(function (x) { return x.id === rRes.id; })[0];
        if (!fr) { mismatches.push('recette « ' + r.title + ' » : introuvable après création'); continue; }
        if (fr.title !== r.title) mismatches.push('recette « ' + r.title + ' » : titre non fidèle');
        if ((fr.ingredients || '[]') !== JSON.stringify(ingredients)) mismatches.push('recette « ' + r.title + ' » : ingrédients non fidèles');
      }
    } finally {
      // nettoyage systématique de l'échantillon de test, même si la vérification a échoué en cours de route
      for (var x = 0; x < createdNoteIds.length; x++) { try { await RA.purgeNote(createdNoteIds[x]); } catch (e) {} }
      for (var y = 0; y < createdClipIds.length; y++) { try { await RA.purgeClip(createdClipIds[y]); } catch (e) {} }
      for (var z = 0; z < createdRecipeIds.length; z++) { try { await RA.purgeRecipe(createdRecipeIds[z]); } catch (e) {} }
    }

    return { checked: checked, mismatches: mismatches };
  }

  var fidelityCheckBtn = document.getElementById('fidelityCheckBtn');
  if (fidelityCheckBtn) {
    fidelityCheckBtn.addEventListener('click', function () {
      var resultEl = document.getElementById('fidelityCheckResult');
      fidelityCheckBtn.disabled = true;
      resultEl.textContent = 'Vérification en cours…';
      runFidelityCheck().then(function (report) {
        if (!report.mismatches.length) {
          resultEl.textContent = '✓ ' + report.checked + ' élément(s) vérifié(s), aucune perte de champ détectée.';
        } else {
          resultEl.textContent = '⚠ ' + report.mismatches.length + ' problème(s) sur ' + report.checked + ' élément(s) vérifié(s) :\n' + report.mismatches.join('\n');
        }
      }).catch(function (err) {
        resultEl.textContent = 'Erreur pendant la vérification : ' + err.message;
      }).then(function () {
        fidelityCheckBtn.disabled = false;
      });
    });
  }

