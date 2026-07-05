// Racine — presse-papier universel : QR, envoi, rendu des cartes, détection de type, partage public, expiration
  // ================= QR (modale) =================

  var qrModal = document.getElementById('qrModal');
  var qrImage = document.getElementById('qrImage');
  document.getElementById('qrClose').addEventListener('click', function () { qrModal.classList.remove('show'); });
  qrModal.addEventListener('click', function (e) { if (e.target === qrModal) qrModal.classList.remove('show'); });

  function openQr(url) {
    qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    qrModal.classList.add('show');
  }


  // ================= CLIPS =================

  var clipFileData = null;

  document.getElementById('clipFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { clipFileData = null; return; }
    if (file.size > 800 * 1024) {
      toast('Fichier trop volumineux (max ~800 Ko)');
      e.target.value = '';
      clipFileData = null;
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      clipFileData = { content: reader.result, filename: file.name, mime: file.type };
      toast('Fichier prêt : ' + file.name);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('clipSend').addEventListener('click', function () {
    var label = document.getElementById('clipLabel').value.trim();
    var ttl = document.getElementById('clipTtl').value;
    var burn = document.getElementById('clipBurn').checked;
    var noExport = document.getElementById('clipNoExport').checked;
    var device = navigator.platform || '';
    var payload;

    if (clipFileData) {
      payload = {
        label: label,
        content: clipFileData.content,
        kind: 'file',
        filename: clipFileData.filename,
        mime: clipFileData.mime,
        device: device,
      };
    } else {
      var text = document.getElementById('clipContent').value;
      if (!text.trim()) { toast('Rien à envoyer'); return; }
      payload = { label: label, content: text, kind: 'text', device: device };
    }
    if (ttl) payload.ttl_ms = Number(ttl);
    payload.burn = burn;
    payload.no_export = noExport;

    RA.createClip(payload).then(function () {
      document.getElementById('clipContent').value = '';
      document.getElementById('clipLabel').value = '';
      document.getElementById('clipFile').value = '';
      document.getElementById('clipBurn').checked = false;
      document.getElementById('clipNoExport').checked = false;
      clipFileData = null;
      loadClips();
      toast('Envoyé — récupérable sur tes autres appareils');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  // ---------- détection automatique du type de contenu ----------
  function detectClipType(text) {
    if (!text) return null;
    var t = text.trim();
    if (/^https?:\/\/\S+$/.test(t)) return { label: 'URL', secret: false };
    if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(t)) { try { JSON.parse(t); return { label: 'JSON', secret: false }; } catch (e) {} }
    if (/^(sudo\s|ssh\s|curl\s|git\s|npm\s|docker\s|powershell|\$\s|>\s)/i.test(t) || /^[A-Za-z0-9_.\/-]+\s+--?[a-z]/.test(t)) return { label: 'commande', secret: false };
    var looksSecret = t.indexOf('\n') === -1 && t.length >= 8 && t.length <= 100
      && /[A-Za-z]/.test(t) && /[0-9]/.test(t) && !/\s/.test(t);
    if (looksSecret) return { label: 'probable secret', secret: true };
    return null;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    return (bytes / 1024).toFixed(1) + ' Ko';
  }

  function renderClip(c) {
    var card = document.createElement('div');
    card.className = 'clip-card' + (c.pinned ? ' pinned' : '');
    card.dataset.clipId = c.id;

    var head = document.createElement('div');
    head.className = 'clip-card-head';

    var headLeft = document.createElement('div');
    headLeft.className = 'clip-card-head-left';
    var pinBtn = document.createElement('button');
    pinBtn.className = 'clip-pin-btn' + (c.pinned ? ' active' : '');
    pinBtn.textContent = '★';
    pinBtn.title = c.pinned ? 'Retirer des favoris' : 'Mettre en favori';
    pinBtn.addEventListener('click', function () {
      RA.updateClip(c.id, { pinned: !c.pinned }).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    headLeft.appendChild(pinBtn);
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    headLeft.appendChild(label);

    var detected = c.kind === 'file' ? null : detectClipType(c.preview);
    if (detected) {
      var typeBadge = document.createElement('span');
      typeBadge.className = 'clip-badge' + (detected.secret ? ' secret' : '');
      typeBadge.textContent = detected.secret ? '⚠ ' + detected.label : detected.label;
      headLeft.appendChild(typeBadge);
    }
    if (c.burn) {
      var burnBadge = document.createElement('span');
      burnBadge.className = 'clip-badge burn';
      burnBadge.textContent = '🔥 lecture unique';
      headLeft.appendChild(burnBadge);
    }
    if (c.device) {
      var deviceEl = document.createElement('span');
      deviceEl.className = 'clip-device';
      deviceEl.textContent = c.device;
      headLeft.appendChild(deviceEl);
    }
    head.appendChild(headLeft);

    var delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Mettre à la corbeille';
    delBtn.addEventListener('click', function () {
      RA.deleteClip(c.id).then(function () {
        loadClips();
        toast('Mis à la corbeille', 'Annuler', function () {
          RA.restoreClip(c.id).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); });
        });
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    head.appendChild(delBtn);
    card.appendChild(head);

    var preview = document.createElement('div');
    var isLong = c.kind !== 'file' && c.preview && c.preview.length > 280;
    preview.className = 'clip-preview' + (isLong ? '' : ' expanded');
    preview.textContent = c.kind === 'file' ? ('📎 ' + c.filename + ' · ' + formatSize(c.size)) : (c.preview || '');
    if (isLong) preview.addEventListener('click', function () { preview.classList.toggle('expanded'); });
    card.appendChild(preview);

    var meta = document.createElement('div');
    meta.className = 'clip-meta';
    var dateSpan = document.createElement('span');
    dateSpan.textContent = new Date(c.created_at).toLocaleString('fr-FR');
    meta.appendChild(dateSpan);
    var expirySpan = document.createElement('span');
    if (c.expires_at) {
      expirySpan.className = 'clip-countdown';
      expirySpan.dataset.expires = c.expires_at;
    }
    meta.appendChild(expirySpan);
    card.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'clip-actions';
    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary';
    copyBtn.textContent = c.kind === 'file' ? 'Télécharger' : 'Copier';
    copyBtn.addEventListener('click', function () {
      RA.getClip(c.id).then(function (data) {
        if (data.clip.kind === 'file') {
          var a = document.createElement('a');
          a.href = data.clip.content;
          a.download = data.clip.filename || 'fichier';
          a.click();
        } else {
          navigator.clipboard.writeText(data.clip.content).then(function () {
            toast('Copié dans le presse-papier');
          });
        }
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(copyBtn);

    if (c.kind !== 'file') {
      var copyDelBtn = document.createElement('button');
      copyDelBtn.className = 'btn';
      copyDelBtn.textContent = 'Copier puis supprimer';
      copyDelBtn.title = 'Copie le contenu puis met immédiatement l\'entrée à la corbeille';
      copyDelBtn.addEventListener('click', function () {
        RA.getClip(c.id).then(function (data) {
          return navigator.clipboard.writeText(data.clip.content);
        }).then(function () {
          toast('Copié — suppression…');
          return RA.deleteClip(c.id);
        }).then(function () {
          loadClips();
          toast('Copié et mis à la corbeille', 'Annuler', function () { RA.restoreClip(c.id).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); }); });
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      actions.appendChild(copyDelBtn);
    }

    var shareBtn = document.createElement('button');
    shareBtn.className = 'btn';
    shareBtn.textContent = c.share_token && c.share_expires_at > Date.now() ? 'Partagé' : 'Partager';
    shareBtn.title = 'Créer un lien public temporaire (accessible sans mot de passe, 24h max)';
    shareBtn.addEventListener('click', function () {
      if (c.share_token && c.share_expires_at > Date.now()) {
        RA.updateClip(c.id, { share: false }).then(function () { toast('Partage révoqué'); loadClips(); });
        return;
      }
      RA.updateClip(c.id, { share: true, share_ttl_ms: 60 * 60 * 1000 }).then(function (res) {
        var url = location.origin + '/share.html#' + res.share_token;
        navigator.clipboard.writeText(url).catch(function () {});
        toast('Lien public créé et copié (expire dans 1h)');
        loadClips();
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(shareBtn);

    var exportBtn2 = document.createElement('label');
    exportBtn2.className = 'clip-check-label';
    exportBtn2.title = 'Ne jamais inclure dans un export ou une sauvegarde';
    var noExportInput = document.createElement('input');
    noExportInput.type = 'checkbox';
    noExportInput.checked = !!c.no_export;
    noExportInput.addEventListener('change', function () {
      RA.updateClip(c.id, { no_export: noExportInput.checked }).then(function () { toast(noExportInput.checked ? 'Exclu des exports' : 'Inclus dans les exports'); });
    });
    exportBtn2.appendChild(noExportInput);
    exportBtn2.appendChild(document.createTextNode('🚫 export'));
    actions.appendChild(exportBtn2);

    var qrBtn = document.createElement('button');
    qrBtn.className = 'btn';
    qrBtn.textContent = 'QR';
    qrBtn.title = 'Ouvrir sur un autre appareil via QR code';
    qrBtn.addEventListener('click', function () {
      openQr(location.origin + '/app.html?clip=' + c.id);
    });
    actions.appendChild(qrBtn);

    var linkBtn = document.createElement('button');
    linkBtn.className = 'btn';
    linkBtn.textContent = '🔗';
    linkBtn.title = 'Copier le lien direct';
    linkBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(location.origin + '/app.html?clip=' + c.id).then(function () {
        toast('Lien copié');
      });
    });
    actions.appendChild(linkBtn);

    card.appendChild(actions);

    if (c.share_token && c.share_expires_at > Date.now()) {
      var shareRow = document.createElement('div');
      shareRow.className = 'share-row';
      var shareInput = document.createElement('input');
      shareInput.readOnly = true;
      shareInput.value = location.origin + '/share.html#' + c.share_token;
      shareInput.addEventListener('click', function () { shareInput.select(); });
      shareRow.appendChild(shareInput);
      var shareQr = document.createElement('button');
      shareQr.className = 'btn';
      shareQr.textContent = 'QR';
      shareQr.addEventListener('click', function () { openQr(shareInput.value); });
      shareRow.appendChild(shareQr);
      card.appendChild(shareRow);
    }

    return card;
  }

  function loadClips() {
    return RA.listClips().then(function (data) {
      state.clips = data.clips;
      var grid = document.getElementById('clipGrid');
      grid.innerHTML = '';
      document.getElementById('clipEmpty').style.display = data.clips.length ? 'none' : 'block';
      document.getElementById('clipCount').textContent = data.clips.length ? data.clips.length : '';
      data.clips.forEach(function (c) { grid.appendChild(renderClip(c)); });
      updateClipCountdowns();
      if (document.getElementById('view-today').classList.contains('active')) renderToday();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  function updateClipCountdowns() {
    document.querySelectorAll('.clip-countdown').forEach(function (el) {
      var ms = Number(el.dataset.expires) - Date.now();
      if (ms <= 0) {
        el.textContent = 'expiré';
        var card = el.closest('.clip-card');
        if (card && !card.classList.contains('expiring')) {
          card.classList.add('expiring');
          setTimeout(function () { loadClips(); }, 1400);
        }
        return;
      }
      var mins = Math.round(ms / 60000);
      if (mins < 60) el.textContent = 'expire dans ' + mins + ' min';
      else if (mins < 24 * 60) el.textContent = 'expire dans ' + Math.round(mins / 60) + ' h';
      else el.textContent = 'expire dans ' + Math.round(mins / 1440) + ' j';
    });
  }
  setInterval(updateClipCountdowns, 30000);

  document.getElementById('clipPaste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast('Ton navigateur ne permet pas de lire le presse-papier automatiquement');
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (!text) { toast('Le presse-papier est vide'); return; }
      document.getElementById('clipContent').value = text;
      toast('Collé depuis le presse-papier');
    }).catch(function () {
      toast('Autorisation refusée pour lire le presse-papier');
    });
  });

