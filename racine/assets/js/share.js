(function () {
  var card = document.getElementById('shareCard');
  var statusEl = document.getElementById('shareStatus');

  var token = location.hash.slice(1);
  if (!token) {
    statusEl.className = 'share-error';
    statusEl.textContent = 'Lien invalide : aucun jeton de partage trouvé.';
    return;
  }

  RA.getPublicClip(token).then(function (data) {
    var c = data.clip;
    card.innerHTML = '';
    var label = document.createElement('div');
    label.className = 'share-label';
    label.textContent = c.label || (c.kind === 'file' ? 'Fichier partagé' : 'Texte partagé');
    card.appendChild(label);

    if (c.kind === 'file') {
      var a = document.createElement('a');
      a.className = 'share-download-btn';
      a.href = c.content;
      a.download = c.filename || 'fichier';
      a.textContent = 'Télécharger ' + (c.filename || '');
      card.appendChild(a);
    } else {
      var content = document.createElement('div');
      content.className = 'share-content';
      content.textContent = c.content;
      card.appendChild(content);

      var copyBtn = document.createElement('button');
      copyBtn.className = 'share-copy-btn';
      copyBtn.textContent = 'Copier';
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(c.content).then(function () {
          copyBtn.textContent = 'Copié !';
          setTimeout(function () { copyBtn.textContent = 'Copier'; }, 1800);
        });
      });
      card.appendChild(copyBtn);
    }
  }).catch(function (err) {
    statusEl.className = 'share-error';
    statusEl.textContent = err.message === 'ce lien de partage a expiré' || err.message === 'expired'
      ? 'Ce lien a expiré.'
      : 'Élément introuvable (lien déjà utilisé, révoqué ou expiré).';
    card.innerHTML = '';
    card.appendChild(statusEl);
  });
})();
