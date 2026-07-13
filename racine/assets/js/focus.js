// Racine — mode Focus (une chose à la fois : épinglés + tâches ouvertes)
  // ================= MODE FOCUS =================

  var focusModal = document.getElementById('focusModal');
  var focusQueue = [];
  var focusIndex = 0;
  var focusOverflowCount = 0;
  var FOCUS_DAILY_LIMIT = 7; // une session Focus raisonnable, pas une nouvelle liste culpabilisante

  function focusCandidates() {
    var now = Date.now();
    var pool = state.notes.filter(function (n) {
      if (n.status === 'someday') return false; // le parking mental ne doit jamais s'imposer en Focus
      if (n.energy === 'attente') return false; // bloqué sur quelqu'un d'autre : rien à faire maintenant
      if (!(n.pinned || (n.kind === 'todo' && !n.done))) return false;
      // si un filtre d'énergie est actif ailleurs dans l'app, Focus le respecte aussi
      if (state.filterEnergy && n.energy && n.energy !== state.filterEnergy) return false;
      return true;
    });

    pool.sort(function (a, b) {
      var aOverdue = a.remind_at && a.remind_at <= now;
      var bOverdue = b.remind_at && b.remind_at <= now;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      var aUrgent = a.energy === 'urgent';
      var bUrgent = b.energy === 'urgent';
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
      return a.created_at - b.created_at;
    });

    focusOverflowCount = Math.max(0, pool.length - FOCUS_DAILY_LIMIT);
    return pool.slice(0, FOCUS_DAILY_LIMIT);
  }

  function showFocusCard() {
    if (focusIndex >= focusQueue.length) {
      focusModal.classList.remove('show');
      toast(focusOverflowCount > 0
        ? 'Session terminée — ' + focusOverflowCount + ' autre(s) chose(s) attendront la prochaine fois'
        : 'Rien de plus en attente — bien joué !');
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
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

