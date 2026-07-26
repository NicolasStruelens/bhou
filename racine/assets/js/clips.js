// Racine — presse-papier universel : QR, envoi, rendu des cartes, détection de type, partage public, expiration
  // ================= QR (modale) =================

  var qrModal = document.getElementById('qrModal');
  var qrImage = document.getElementById('qrImage');
  document.getElementById('qrClose').addEventListener('click', function () { qrModal.classList.remove('show'); });
  qrModal.addEventListener('click', function (e) { if (e.target === qrModal) qrModal.classList.remove('show'); });

  function openQr(url, sensitive) {
    if (sensitive) {
      navigator.clipboard.writeText(url).catch(function () {});
      toast('QR externe désactivé pour protéger ce lien — lien copié');
      return;
    }
    qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    qrModal.classList.add('show');
  }


  // ================= CLIPS =================

  var clipFileData = null;
  var clipQuery = '';
  var clipFilter = 'all';

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

    RA.createClip(payload).then(function (result) {
      if (window.RAUniverse) window.RAUniverse.emit('create', document.querySelector('.clip-form'));
      document.getElementById('clipContent').value = '';
      document.getElementById('clipLabel').value = '';
      document.getElementById('clipFile').value = '';
      document.getElementById('clipBurn').checked = false;
      document.getElementById('clipNoExport').checked = false;
      clipFileData = null;
      updateClipSafety();
      loadClips();
      toast(result.protected_secret
        ? 'Secret protégé : 1 h, lecture unique, jamais exporté'
        : 'Envoyé — récupérable sur tes autres appareils');
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

  // ---------- détection automatique du type de contenu ----------
  function detectClipType(text) {
    if (!text) return null;
    var t = text.trim();
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(t) ||
        /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|authorization)\s*[:=]\s*\S+/i.test(t) ||
        /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) {
      return { label: 'probable secret', secret: true };
    }
    if (/^https?:\/\/\S+$/.test(t)) {
      try {
        var url = new URL(t);
        var sensitiveKeys = ['token', 'key', 'secret', 'password', 'signature', 'sig', 'access_token', 'api_key'];
        if (sensitiveKeys.some(function (key) { return (url.searchParams.get(key) || '').length >= 8; })) {
          return { label: 'probable secret', secret: true };
        }
      } catch (e) {}
      return { label: 'URL', secret: false };
    }
    if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(t)) { try { JSON.parse(t); return { label: 'JSON', secret: false }; } catch (e) {} }
    if (/^(sudo\s|ssh\s|curl\s|git\s|npm\s|docker\s|powershell|\$\s|>\s)/i.test(t) || /^[A-Za-z0-9_.\/-]+\s+--?[a-z]/.test(t)) return { label: 'commande', secret: false };
    var looksSecret = t.indexOf('\n') === -1 && t.length >= 8 && t.length <= 100
      && /[A-Za-z]/.test(t) && /[0-9]/.test(t) && !/\s/.test(t);
    if (looksSecret) return { label: 'probable secret', secret: true };
    return null;
  }

  function clipTypeKey(c) {
    if (c.kind === 'file') return 'file';
    if (c.type_hint) return c.type_hint;
    var detected = detectClipType(c.preview);
    if (!detected) return 'text';
    if (detected.label === 'URL') return 'url';
    if (detected.label === 'commande') return 'command';
    if (detected.label === 'probable secret') return 'secret';
    if (detected.label === 'JSON') return 'json';
    return 'text';
  }

  function updateClipSafety() {
    var text = document.getElementById('clipContent').value;
    var detected = detectClipType(text);
    var hint = document.getElementById('clipSafetyHint');
    var sensitive = detected && detected.secret;
    hint.classList.toggle('hidden', !sensitive);
    var applyBtn = document.getElementById('clipSafetyApply');
    if (!sensitive) {
      applyBtn.textContent = 'Protéger automatiquement';
      return;
    }
    document.getElementById('clipSafetyTitle').textContent = 'Ce texte ressemble à un secret';
    document.getElementById('clipSafetyText').textContent = 'Protection automatique obligatoire : expiration 1 h, lecture unique et exclusion des sauvegardes.';
    document.getElementById('clipTtl').value = '3600000';
    document.getElementById('clipBurn').checked = true;
    document.getElementById('clipNoExport').checked = true;
    applyBtn.textContent = 'Protection appliquée';
  }

  document.getElementById('clipContent').addEventListener('input', updateClipSafety);
  document.getElementById('clipSafetyApply').addEventListener('click', function () {
    document.getElementById('clipTtl').value = '3600000';
    document.getElementById('clipBurn').checked = true;
    document.getElementById('clipNoExport').checked = true;
    document.getElementById('clipSafetyApply').textContent = 'Protection appliquée';
    if (window.RAUniverse) window.RAUniverse.emit('focus', document.getElementById('clipSafetyHint'));
    toast('Protégé : 1 h, lecture unique, jamais exporté');
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    return (bytes / 1024).toFixed(1) + ' Ko';
  }

  function typeLabel(typeKey) {
    return {
      url: 'URL',
      json: 'JSON',
      command: 'commande',
      secret: 'probable secret',
    }[typeKey] || null;
  }

  function consumeAfterUse(c) {
    if (!c.burn) return Promise.resolve(false);
    return RA.consumeClip(c.id).then(function () {
      return loadClips().then(function () { return true; });
    });
  }

  function renderClip(c) {
    var typeKey = clipTypeKey(c);
    var card = document.createElement('div');
    card.className = 'clip-card clip-' + typeKey + (c.pinned ? ' pinned' : '');
    card.dataset.clipId = c.id;
    card.dataset.clipType = typeKey;

    var head = document.createElement('div');
    head.className = 'clip-card-head';

    var headLeft = document.createElement('div');
    headLeft.className = 'clip-card-head-left';
    var pinBtn = document.createElement('button');
    pinBtn.className = 'clip-pin-btn' + (c.pinned ? ' active' : '');
    pinBtn.appendChild(icon('star'));
    pinBtn.title = c.pinned ? 'Retirer des favoris' : 'Mettre en favori';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    pinBtn.addEventListener('click', function () {
      RA.updateClip(c.id, { pinned: !c.pinned }).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    headLeft.appendChild(pinBtn);
    var label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier' : 'Texte');
    headLeft.appendChild(label);

    var detectedLabel = typeLabel(typeKey);
    if (detectedLabel) {
      var typeBadge = document.createElement('span');
      typeBadge.className = 'clip-badge' + (typeKey === 'secret' ? ' secret' : '');
      if (typeKey === 'secret') typeBadge.appendChild(icon('warning', 'icon-inline'));
      typeBadge.appendChild(document.createTextNode((typeKey === 'secret' ? ' ' : '') + detectedLabel));
      headLeft.appendChild(typeBadge);
    }
    if (c.burn) {
      var burnBadge = document.createElement('span');
      burnBadge.className = 'clip-badge burn';
      burnBadge.appendChild(icon('flame', 'icon-inline'));
      burnBadge.appendChild(document.createTextNode(' lecture unique'));
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
    delBtn.appendChild(icon('x'));
    delBtn.title = 'Mettre à la corbeille';
    delBtn.setAttribute('aria-label', 'Mettre à la corbeille');
    delBtn.addEventListener('click', function () {
      if (window.RAUniverse) window.RAUniverse.emit('delete', card);
      card.classList.add('removing');
      setTimeout(function () {
        RA.deleteClip(c.id).then(function () {
          loadClips();
          toast('Mis à la corbeille', 'Annuler', function () {
            RA.restoreClip(c.id).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); });
          });
        }).catch(function (err) { toast('Erreur : ' + err.message); card.classList.remove('removing'); });
      }, 190);
    });
    head.appendChild(delBtn);
    card.appendChild(head);

    var preview = document.createElement('div');
    var isLong = c.kind !== 'file' && (c.preview_truncated || (c.preview && c.preview.length > 280));
    preview.className = 'clip-preview' + (isLong ? '' : ' expanded');
    if (c.kind === 'file') {
      preview.appendChild(icon('paperclip', 'icon-inline'));
      preview.appendChild(document.createTextNode(' ' + c.filename + ' · ' + formatSize(c.size)));
    } else if (typeKey === 'secret') {
      preview.className = 'clip-preview secret-mask';
      preview.title = 'Cliquer pour afficher pendant 5 secondes';
      preview.setAttribute('aria-label', 'Secret masqué. Cliquer pour afficher pendant cinq secondes.');
      preview.addEventListener('click', function () {
        if (preview.classList.contains('revealed')) {
          preview.classList.remove('revealed');
          preview.textContent = '';
          return;
        }
        RA.getClip(c.id).then(function (data) {
          preview.textContent = data.clip.content;
          preview.classList.add('revealed');
          setTimeout(function () {
            preview.classList.remove('revealed');
            preview.textContent = '';
            consumeAfterUse(c).catch(function () {});
          }, 5000);
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
    } else {
      preview.textContent = c.preview || '';
    }
    if (isLong && typeKey !== 'secret') preview.addEventListener('click', function () { preview.classList.toggle('expanded'); });
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
          return Promise.resolve();
        } else {
          return navigator.clipboard.writeText(data.clip.content);
        }
      }).then(function () {
        toast(c.burn ? 'Copié — transfert à lecture unique consommé' : 'Copié dans le presse-papier');
        return consumeAfterUse(c);
      }).catch(function (err) { toast('Erreur : ' + err.message); });
    });
    actions.appendChild(copyBtn);

    if (typeKey === 'url') {
      var openBtn = document.createElement('button');
      openBtn.className = 'btn';
      openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', function () {
        var a = document.createElement('a');
        a.href = c.preview;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      });
      actions.appendChild(openBtn);
    }

    if (typeKey === 'json') {
      var formatBtn = document.createElement('button');
      formatBtn.className = 'btn';
      formatBtn.textContent = 'Formater JSON';
      formatBtn.addEventListener('click', function () {
        RA.getClip(c.id).then(function (data) {
          return navigator.clipboard.writeText(JSON.stringify(JSON.parse(data.clip.content), null, 2));
        }).then(function () {
          toast('JSON formaté et copié');
          return consumeAfterUse(c);
        }).catch(function () {
          toast('Impossible de formater ce JSON');
        });
      });
      actions.appendChild(formatBtn);
    }

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
          return c.burn ? RA.consumeClip(c.id) : RA.deleteClip(c.id);
        }).then(function () {
          loadClips();
          if (c.burn) {
            toast('Copié et supprimé définitivement (lecture unique)');
          } else {
            toast('Copié et mis à la corbeille', 'Annuler', function () { RA.restoreClip(c.id).then(loadClips).catch(function (err) { toast('Erreur : ' + err.message); }); });
          }
        }).catch(function (err) { toast('Erreur : ' + err.message); });
      });
      actions.appendChild(copyDelBtn);
    }

    var shareBtn = document.createElement('button');
    shareBtn.className = 'btn';
    shareBtn.textContent = c.share_token && c.share_expires_at > Date.now() ? 'Partagé' : 'Partager';
    shareBtn.title = 'Créer un lien public temporaire à usage unique (accessible sans mot de passe, 24h max)';
    shareBtn.addEventListener('click', function () {
      if (c.share_token && c.share_expires_at > Date.now()) {
        RA.updateClip(c.id, { share: false }).then(function () { toast('Partage révoqué'); loadClips(); });
        return;
      }
      RA.updateClip(c.id, { share: true, share_ttl_ms: 60 * 60 * 1000 }).then(function (res) {
        var url = location.origin + '/share.html#' + res.share_token;
        navigator.clipboard.writeText(url).catch(function () {});
        toast('Lien public à usage unique créé et copié (expire dans 1 h)');
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
    noExportInput.disabled = typeKey === 'secret';
    noExportInput.addEventListener('change', function () {
      RA.updateClip(c.id, { no_export: noExportInput.checked }).then(function () { toast(noExportInput.checked ? 'Exclu des exports' : 'Inclus dans les exports'); });
    });
    exportBtn2.appendChild(noExportInput);
    exportBtn2.appendChild(icon('ban', 'icon-inline'));
    exportBtn2.appendChild(document.createTextNode(' export'));
    actions.appendChild(exportBtn2);

    var qrBtn = document.createElement('button');
    qrBtn.className = 'btn btn-icon';
    qrBtn.textContent = 'QR';
    qrBtn.title = 'Ouvrir sur un autre appareil via QR code';
    qrBtn.addEventListener('click', function () {
      openQr(location.origin + '/app.html?clip=' + c.id, typeKey === 'secret');
    });
    actions.appendChild(qrBtn);

    var linkBtn = document.createElement('button');
    linkBtn.className = 'btn btn-icon';
    linkBtn.appendChild(icon('link'));
    linkBtn.title = 'Copier le lien direct';
    linkBtn.setAttribute('aria-label', 'Copier le lien direct');
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
      shareQr.addEventListener('click', function () { openQr(shareInput.value, true); });
      shareRow.appendChild(shareQr);
      card.appendChild(shareRow);
    }

    return card;
  }

  function clipMatches(c) {
    var type = clipTypeKey(c);
    var hay = ((c.label || '') + ' ' + (c.preview || '') + ' ' + (c.filename || '') + ' ' + (c.device || '') + ' ' + type).toLowerCase();
    if (clipQuery && hay.indexOf(clipQuery) === -1) return false;
    if (clipFilter === 'pinned') return !!c.pinned;
    if (clipFilter !== 'all') return type === clipFilter;
    return true;
  }

  function renderClipOverview(clips) {
    var favorites = clips.filter(function (c) { return !!c.pinned; }).length;
    var secrets = clips.filter(function (c) { return clipTypeKey(c) === 'secret'; }).length;
    var soon = clips.filter(function (c) { return c.expires_at && c.expires_at > Date.now() && c.expires_at - Date.now() < 6 * 60 * 60 * 1000; }).length;
    var bits = [clips.length + (clips.length > 1 ? ' transferts' : ' transfert')];
    if (favorites) bits.push(favorites + (favorites > 1 ? ' favoris' : ' favori'));
    if (secrets) bits.push(secrets + (secrets > 1 ? ' secrets masqués' : ' secret masqué'));
    if (soon) bits.push(soon + (soon > 1 ? ' expirent bientôt' : ' expire bientôt'));
    document.getElementById('clipOverview').textContent = bits.join(' · ');
  }

  function renderClipsView() {
    var clips = state.clips || [];
    var visible = clips.filter(clipMatches);
    var grid = document.getElementById('clipGrid');
    grid.innerHTML = '';
    document.getElementById('clipEmpty').style.display = clips.length ? 'none' : 'block';
    document.getElementById('clipCount').textContent = clips.length ? clips.length : '';
    visible.forEach(function (c) { grid.appendChild(renderClip(c)); });
    if (clips.length && !visible.length) {
      var noMatch = document.createElement('div');
      noMatch.className = 'clip-filter-empty';
      noMatch.textContent = 'Aucun transfert ici. Change le filtre ou la recherche.';
      grid.appendChild(noMatch);
    }
    renderClipOverview(clips);
    updateClipCountdowns();
  }

  function loadClips() {
    return RA.listClips().then(function (data) {
      state.clips = data.clips;
      renderClipsView();
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
      updateClipSafety();
      toast('Collé depuis le presse-papier');
    }).catch(function () {
      toast('Autorisation refusée pour lire le presse-papier');
    });
  });

  document.getElementById('clipSearch').addEventListener('input', function (e) {
    clipQuery = e.target.value.trim().toLowerCase();
    renderClipsView();
  });
  document.querySelectorAll('[data-clip-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      clipFilter = btn.dataset.clipFilter;
      document.querySelectorAll('[data-clip-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderClipsView();
    });
  });
  document.getElementById('clipCopyLatest').addEventListener('click', function () {
    var latest = (state.clips || []).filter(function (c) { return c.kind !== 'file'; }).slice().sort(function (a, b) { return b.created_at - a.created_at; })[0];
    if (!latest) { toast('Aucun texte récent à copier'); return; }
    RA.getClip(latest.id).then(function (data) {
      return navigator.clipboard.writeText(data.clip.content);
    }).then(function () {
      toast('Dernier transfert copié');
      if (window.RAUniverse) window.RAUniverse.emit('link', document.getElementById('clipCopyLatest'));
      return consumeAfterUse(latest);
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });
