// Racine — initialisation finale : doit être chargé en dernier (déclenche les premiers appels API)
  // ================= INIT =================

  function initFromQuery() {
    var params = new URLSearchParams(location.search);
    // partage entrant (Android/Chrome : Web Share Target — non supporté par iOS Safari)
    var sharedText = params.get('shared_text') || params.get('shared_url');
    if (sharedText) {
      switchTab('notes');
      captureInput.value = sharedText.slice(0, 500);
      captureBar.classList.add('has-value');
      captureInput.focus();
      toast('Contenu partagé prêt à être ajouté');
      return;
    }
    // revue matinale : si activée et qu'aucun lien direct ne demande un autre onglet, ouvrir sur Aujourd'hui
    if (!params.get('tab') && !params.get('focus') && !params.get('clip') && localStorage.getItem('racine_morning_review') === '1') {
      switchTab('today');
    }
    if (params.get('tab') === 'clips') switchTab('clips');
    if (params.get('tab') === 'today') switchTab('today');
    if (params.get('focus') === 'capture') { switchTab('notes'); captureInput.focus(); }
    var clipId = params.get('clip');
    if (clipId) {
      switchTab('clips');
      setTimeout(function () {
        var card = document.querySelector('[data-clip-id="' + clipId + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight');
          setTimeout(function () { card.classList.remove('highlight'); }, 2000);
        }
      }, 400);
    }
  }

  document.getElementById('captureBar').style.display = state.activeSpace === OVERVIEW ? 'none' : '';
  loadNotes();
  loadClips();
  loadRecipes();
  initFromQuery();
  autoBackupIfNeeded();
