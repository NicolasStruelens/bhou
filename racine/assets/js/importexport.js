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
      var res = await RA.createNote({
        title: n.title,
        content: n.content || '',
        kind: n.kind || 'idee',
        pinned: !!n.pinned,
        position: n.position || 0,
        space: n.space || 'Général',
        tags: n.tags || '',
        parent_id: n.parent_id ? (idMap[n.parent_id] || null) : null,
      });
      idMap[n.id] = res.id;
      if (n.done) await RA.updateNote(res.id, { done: true });
      if (n.remind_at) await RA.updateNote(res.id, { remind_at: n.remind_at });
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
      if (!confirm('Importer ' + noteCount + ' note(s) et ' + clipCount + ' élément(s) de presse-papier ? Ils seront ajoutés à tes données actuelles (rien n\'est remplacé).')) return;
      toast('Import en cours…');
      runImport(data).then(function () {
        toast('Import terminé');
        loadNotes();
        loadClips();
      }).catch(function (err) { toast('Erreur import : ' + err.message); });
    };
    reader.readAsText(file);
  });

