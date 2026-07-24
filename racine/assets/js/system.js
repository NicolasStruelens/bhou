// Racine — modale état système, sauvegardes automatiques/manuelles
  // ================= ÉTAT SYSTÈME & SAUVEGARDES =================

  var systemModal = document.getElementById('systemModal');
  var systemInfo = document.getElementById('systemInfo');
  var backupList = document.getElementById('backupList');
  var APP_VERSION = '53';

  function statChip(value, label, warn) {
    var div = document.createElement('div');
    div.className = 'system-stat' + (warn ? ' warn' : '');
    var v = document.createElement('div'); v.className = 'value';
    if (value === 'ok' || value === 'fail') v.appendChild(icon(value === 'ok' ? 'check' : 'x'));
    else v.textContent = value;
    var l = document.createElement('div'); l.className = 'label'; l.textContent = label;
    div.appendChild(v); div.appendChild(l);
    return div;
  }

  function renderBackupList(backups) {
    backupList.innerHTML = '';
    if (!backups.length) {
      var p = document.createElement('p');
      p.className = 'modal-note no-margin-top';
      p.textContent = 'Aucune sauvegarde pour l\'instant.';
      backupList.appendChild(p);
      return;
    }
    backups.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'backup-item';
      var dateEl = document.createElement('div');
      dateEl.className = 'backup-date';
      dateEl.textContent = new Date(b.created_at).toLocaleString('fr-FR') + ' · ' + formatSize(b.size);
      row.appendChild(dateEl);

      var dlBtn = document.createElement('button');
      dlBtn.textContent = 'Télécharger';
      dlBtn.addEventListener('click', function () {
        RA.getBackup(b.id).then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'racine-backup-' + new Date(b.created_at).toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(dlBtn);

      var restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Restaurer';
      restoreBtn.addEventListener('click', function () {
        if (!confirm('Restaurer cette sauvegarde du ' + new Date(b.created_at).toLocaleString('fr-FR') + ' ? Son contenu sera ajouté à tes données actuelles (rien n\'est remplacé).')) return;
        RA.getBackup(b.id).then(function (data) {
          toast('Restauration en cours…');
          return runImport(data);
        }).then(function () {
          toast('Sauvegarde restaurée');
          loadNotes();
          loadClips();
          loadRecipes();
          systemModal.classList.remove('show');
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      row.appendChild(restoreBtn);

      backupList.appendChild(row);
    });
  }

  function refreshSystemModal() {
    systemInfo.innerHTML = '';
    Promise.all([RA.health(), RA.listBackups()]).then(function (results) {
      var h = results[0];
      var backups = results[1].backups;
      systemInfo.appendChild(statChip(h.db ? 'ok' : 'fail', 'Base de données', !h.db));
      systemInfo.appendChild(statChip('v' + APP_VERSION, 'Version app'));
      systemInfo.appendChild(statChip('v' + (h.schema_version || '?'), 'Schéma', h.schema_version !== h.schema_version_expected));
      systemInfo.appendChild(statChip(h.notes, 'Notes actives'));
      systemInfo.appendChild(statChip(h.clips, 'Clips actifs'));
      systemInfo.appendChild(statChip(h.reminders, 'Rappels programmés'));
      systemInfo.appendChild(statChip(h.last_backup ? new Date(h.last_backup).toLocaleDateString('fr-FR') : 'Aucune', 'Dernière sauvegarde', !h.last_backup));
      renderBackupList(backups);
    }).catch(function (err) {
      systemInfo.textContent = 'Erreur : ' + err.message;
    });
  }

  document.getElementById('systemBtn').addEventListener('click', function () {
    systemModal.classList.add('show');
    refreshSystemModal();
    refreshQuickCaptureInfo();
  });
  document.getElementById('systemClose').addEventListener('click', function () { systemModal.classList.remove('show'); });
  systemModal.addEventListener('click', function (e) { if (e.target === systemModal) systemModal.classList.remove('show'); });
  document.getElementById('backupNowBtn').addEventListener('click', function () {
    RA.createBackup().then(function () {
      toast('Sauvegarde créée');
      refreshSystemModal();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  // ---------- capture rapide (iOS Raccourcis/Siri) ----------
  var quickCaptureInfo = document.getElementById('quickCaptureInfo');

  function refreshQuickCaptureInfo() {
    quickCaptureInfo.textContent = 'Chargement…';
    RA.getQuickToken().then(function (data) {
      if (!data.token) {
        quickCaptureInfo.textContent = 'Aucun lien actif pour l\'instant.';
        return;
      }
      var url = location.origin + '/api/quick/' + data.token;
      quickCaptureInfo.textContent = url + ' (créé le ' + new Date(data.created_at).toLocaleString('fr-FR') + ')';
    }).catch(function (err) { quickCaptureInfo.textContent = 'Erreur : ' + err.message; });
  }

  document.getElementById('quickTokenCreateBtn').addEventListener('click', function () {
    RA.createQuickToken().then(function (data) {
      var url = location.origin + '/api/quick/' + data.token;
      navigator.clipboard.writeText(url).catch(function () {});
      toast('Nouveau lien généré et copié — l\'ancien est révoqué');
      refreshQuickCaptureInfo();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });
  document.getElementById('quickTokenRevokeBtn').addEventListener('click', function () {
    RA.revokeQuickToken().then(function () {
      toast('Lien révoqué');
      refreshQuickCaptureInfo();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  function autoBackupIfNeeded() {
    var today = new Date().toDateString();
    if (localStorage.getItem('racine_last_backup_date') === today) return;
    RA.createBackup().then(function () {
      localStorage.setItem('racine_last_backup_date', today);
    }).catch(function () {});
  }
