// Racine — initialisation finale : doit être chargé en dernier (déclenche les premiers appels API)
  // ================= INIT =================

  function initFromQuery() {
    var params = new URLSearchParams(location.search);
    // partage entrant (Android/Chrome : Web Share Target — non supporté par iOS Safari)
    var sharedText = params.get('shared_text') || params.get('shared_url');
    if (sharedText) {
      openDepositModal(sharedText.slice(0, 500));
      toast('Contenu partagé prêt à être déposé');
      return;
    }
    // La Clairière est l'entrée normale. Les liens directs restent prioritaires.
    var requestedTab = params.get('tab');
    if (['today', 'notes', 'graph', 'clips', 'recipes', 'reminders', 'trash'].indexOf(requestedTab) !== -1) switchTab(requestedTab);
    else if (!params.get('focus') && !params.get('clip')) switchTab('today');
    if (params.get('focus') === 'capture') openDepositModal();
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
  syncPreferencesFromServer();
  if (navigator.onLine) {
    OfflineQueue.flush().then(function (synced) {
      if (synced > 0) { loadNotes(); loadClips(); loadRecipes(); toast(synced + ' action(s) synchronisée(s) depuis la dernière session hors-ligne'); }
    });
  }
