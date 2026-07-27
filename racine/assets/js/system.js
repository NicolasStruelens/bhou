// Racine — modale état système, sauvegardes automatiques/manuelles
  // ================= ÉTAT SYSTÈME & SAUVEGARDES =================

  var systemModal = document.getElementById('systemModal');
  var systemInfo = document.getElementById('systemInfo');
  var backupList = document.getElementById('backupList');
  var APP_VERSION = '55.2';
  var BACKUP_PREVIEW_LIMIT = 3;

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

  function buildBackupRow(b) {
    var row = document.createElement('div');
    row.className = 'backup-item';
    var dateEl = document.createElement('div');
    dateEl.className = 'backup-date';
    dateEl.textContent = new Date(b.created_at).toLocaleString('fr-FR') + ' · ' + formatSize(b.size);
    row.appendChild(dateEl);

    var actions = document.createElement('div');
    actions.className = 'backup-item-actions';
    var dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'backup-action';
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
    actions.appendChild(dlBtn);

    var restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'backup-action';
    restoreBtn.textContent = 'Restaurer';
    restoreBtn.addEventListener('click', function () {
      RA.getBackup(b.id).then(function (data) {
        systemModal.classList.remove('show');
        return openImportPreview(data, 'Sauvegarde du ' + new Date(b.created_at).toLocaleString('fr-FR'));
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(restoreBtn);
    row.appendChild(actions);
    return row;
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

    backups.slice(0, BACKUP_PREVIEW_LIMIT).forEach(function (backup) {
      backupList.appendChild(buildBackupRow(backup));
    });

    var older = backups.slice(BACKUP_PREVIEW_LIMIT);
    if (!older.length) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'backup-more-toggle';
    toggle.setAttribute('aria-expanded', 'false');

    var archive = document.createElement('div');
    archive.className = 'backup-archive hidden';
    older.forEach(function (backup) { archive.appendChild(buildBackupRow(backup)); });

    function updateToggleLabel(open) {
      toggle.textContent = open
        ? 'Masquer les anciennes sauvegardes'
        : 'Voir ' + older.length + ' sauvegarde' + (older.length > 1 ? 's' : '') + ' plus ancienne' + (older.length > 1 ? 's' : '');
    }
    updateToggleLabel(false);
    toggle.addEventListener('click', function () {
      var open = archive.classList.contains('hidden');
      archive.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateToggleLabel(open);
    });
    backupList.appendChild(toggle);
    backupList.appendChild(archive);
  }

  function descendantsOf(id) {
    var found = [];
    var frontier = [id];
    var seen = {};
    seen[id] = true;
    while (frontier.length) {
      var current = frontier.shift();
      state.notes.forEach(function (note) {
        if (note.parent_id === current && !seen[note.id]) {
          seen[note.id] = true;
          found.push(note);
          frontier.push(note.id);
        }
      });
    }
    return found;
  }

  function renderDataHealth(serverHealth) {
    var panel = document.getElementById('dataHealth');
    panel.innerHTML = '';
    var doneOpen = state.notes.filter(function (note) {
      return !!note.done && state.notes.some(function (child) { return child.parent_id === note.id && !child.done; });
    }).length;
    var rootsWithoutAction = state.notes.filter(function (note) {
      if (note.parent_id || note.done || note.status === 'someday') return false;
      var branch = [note].concat(descendantsOf(note.id));
      return !branch.some(function (item) {
        return !item.done && item.status !== 'someday' && item.kind === 'todo';
      });
    }).length;
    var inbox = state.notes.filter(function (note) { return !!note.inbox && !note.done; }).length;
    var secretRisk = (state.clips || []).filter(function (clip) {
      return clip.type_hint === 'secret' && (!clip.burn || !clip.no_export || !clip.expires_at);
    }).length;
    var rows = [
      { count: inbox, label: 'pensée(s) encore dans le sas', tone: inbox ? 'attention' : 'ok' },
      { count: rootsWithoutAction, label: 'racine(s) sans prochaine action', tone: rootsWithoutAction ? 'attention' : 'ok' },
      { count: doneOpen || serverHealth.completed_with_open_children || 0, label: 'branche(s) terminée(s) avec enfant actif', tone: doneOpen ? 'attention' : 'ok' },
      { count: secretRisk, label: 'secret(s) insuffisamment protégé(s)', tone: secretRisk ? 'danger' : 'ok' },
    ];
    rows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'data-health-row ' + row.tone;
      var count = document.createElement('strong'); count.textContent = row.count;
      var label = document.createElement('span'); label.textContent = row.label;
      item.appendChild(count); item.appendChild(label); panel.appendChild(item);
    });
    var reminders = Number(serverHealth.completed_with_reminder || 0);
    var repair = document.getElementById('repairDataHealthBtn');
    var repairs = reminders + secretRisk;
    repair.classList.toggle('hidden', repairs === 0);
    repair.textContent = repairs ? 'Appliquer ' + repairs + ' correction(s) sûre(s)' : '';
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
      renderDataHealth(h);
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
    RA.createBackup(true).then(function () {
      toast('Sauvegarde créée');
      refreshSystemModal();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });
  document.getElementById('repairDataHealthBtn').addEventListener('click', function () {
    RA.repairDataHealth().then(function (result) {
      toast((result.reminders_cleared || 0) + ' rappel(s) éteint(s), ' + (result.secrets_protected || 0) + ' secret(s) protégé(s)');
      return loadNotes();
    }).then(function () {
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
      quickCaptureInfo.textContent = url + ' · expire le ' + new Date(data.expires_at).toLocaleDateString('fr-FR');
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
