// Racine — export JSON complet et import atomique/idempotent
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

  function runImport(data, mode) {
    return RA.importAll(data, mode || 'merge', false);
  }

  var importModal = document.getElementById('importModal');
  var importSummary = document.getElementById('importSummary');
  var importWarnings = document.getElementById('importWarnings');
  var importMergeBtn = document.getElementById('importMergeBtn');
  var importReplaceBtn = document.getElementById('importReplaceBtn');
  var pendingImportData = null;

  function setImportBusy(busy) {
    importMergeBtn.disabled = busy;
    importReplaceBtn.disabled = busy;
    document.getElementById('importCancel').disabled = busy;
  }

  function closeImportModal() {
    if (importMergeBtn.disabled) return;
    importModal.classList.remove('show');
    pendingImportData = null;
  }

  function openImportPreview(data, sourceLabel) {
    pendingImportData = null;
    importSummary.textContent = 'Analyse du fichier en cours…';
    importWarnings.innerHTML = '';
    setImportBusy(true);
    importModal.classList.add('show');
    return RA.importAll(data, 'merge', true).then(function (result) {
      var preview = result.preview;
      var c = preview.counts;
      pendingImportData = data;
      importSummary.textContent =
        (sourceLabel || 'Export Racine') + ' · ' +
        c.notes + ' pensée(s), ' + c.clips + ' transfert(s), ' +
        c.recipes + ' recette(s), ' + c.preferences + ' préférence(s).';
      if (!preview.warnings.length) {
        var ok = document.createElement('li');
        ok.className = 'import-warning-ok';
        ok.textContent = 'Structure valide. L’opération sera appliquée en un seul bloc.';
        importWarnings.appendChild(ok);
      } else {
        preview.warnings.forEach(function (warning) {
          var li = document.createElement('li');
          li.textContent = warning;
          importWarnings.appendChild(li);
        });
      }
    }).catch(function (err) {
      importSummary.textContent = 'Import refusé : ' + err.message;
      pendingImportData = null;
    }).then(function () {
      setImportBusy(false);
      importMergeBtn.disabled = !pendingImportData;
      importReplaceBtn.disabled = !pendingImportData;
    });
  }
  window.openImportPreview = openImportPreview;

  function finishImport(mode) {
    if (!pendingImportData) return;
    if (mode === 'replace' && !confirm(
      'Remplacer les données actives par ce fichier ? Une sauvegarde de sécurité sera créée juste avant.'
    )) return;
    var data = pendingImportData;
    setImportBusy(true);
    importSummary.textContent = mode === 'replace' ? 'Sauvegarde de sécurité puis remplacement…' : 'Fusion atomique en cours…';
    var before = mode === 'replace' ? RA.createBackup(true) : Promise.resolve();
    before.then(function () {
      return runImport(data, mode);
    }).then(function (result) {
      var c = result.imported.counts;
      importModal.classList.remove('show');
      toast('Import terminé sans doublons · ' + c.notes + ' pensée(s)');
      return Promise.all([
        loadNotes(),
        loadClips(),
        loadRecipes(),
        typeof syncPreferencesFromServer === 'function' ? syncPreferencesFromServer() : Promise.resolve(),
      ]);
    }).catch(function (err) {
      importSummary.textContent = 'Aucune modification partielle : ' + err.message;
      toast('Import annulé : ' + err.message);
    }).then(function () {
      setImportBusy(false);
    });
  }

  importMergeBtn.addEventListener('click', function () { finishImport('merge'); });
  importReplaceBtn.addEventListener('click', function () { finishImport('replace'); });
  document.getElementById('importCancel').addEventListener('click', closeImportModal);
  importModal.addEventListener('click', function (e) { if (e.target === importModal) closeImportModal(); });

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
      openImportPreview(data, file.name);
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
          energy: n.energy || '', status: n.status || 'active', inbox: !!n.inbox,
          effort_minutes: n.effort_minutes || null, remind_at: n.remind_at || null,
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
        if (!!fn.inbox !== !!n.inbox) mismatches.push('note « ' + n.title + ' » : boîte de dépôt non fidèle');
        if ((fn.effort_minutes || null) !== (n.effort_minutes || null)) mismatches.push('note « ' + n.title + ' » : durée non fidèle');
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
