// Racine — mode Focus (une chose à la fois : épinglés + tâches ouvertes)
  // ================= MODE FOCUS =================

  var focusModal = document.getElementById('focusModal');
  var focusQueue = [];
  var focusIndex = 0;

  function focusCandidates() {
    return state.notes
      .filter(function (n) { return n.pinned || (n.kind === 'todo' && !n.done); })
      .sort(function (a, b) { return a.created_at - b.created_at; });
  }

  function showFocusCard() {
    if (focusIndex >= focusQueue.length) {
      focusModal.classList.remove('show');
      toast('Rien de plus en attente — bien joué !');
      return;
    }
    var n = focusQueue[focusIndex];
    document.getElementById('focusKind').textContent = n.kind === 'todo' ? 'À faire' : (n.kind === 'idee' ? 'Idée' : 'Note');
    document.getElementById('focusTitle').textContent = n.title;
    var contentEl = document.getElementById('focusContent');
    contentEl.innerHTML = '';
    if (n.content) renderRichText(contentEl, n.content);
    document.getElementById('focusSpace').textContent = effectiveSpace(n);
    document.getElementById('focusProgress').textContent = (focusIndex + 1) + ' / ' + focusQueue.length;
  }

  document.getElementById('focusModeBtn').addEventListener('click', function () {
    focusQueue = focusCandidates();
    focusIndex = 0;
    if (!focusQueue.length) { toast('Rien à traiter — tout est calme.'); return; }
    focusModal.classList.add('show');
    showFocusCard();
  });
  document.getElementById('focusClose').addEventListener('click', function () { focusModal.classList.remove('show'); });
  focusModal.addEventListener('click', function (e) { if (e.target === focusModal) focusModal.classList.remove('show'); });
  document.getElementById('focusSkip').addEventListener('click', function () {
    focusIndex++;
    showFocusCard();
  });
  document.getElementById('focusDone').addEventListener('click', function () {
    var n = focusQueue[focusIndex];
    RA.updateNote(n.id, { done: true }).then(function () {
      loadNotes();
      focusIndex++;
      showFocusCard();
    });
  });

