// Racine — mode Focus / "Agir" (une chose à la fois : choisis ton temps et ton énergie, puis avance)
  // ================= MODE FOCUS =================

  var focusModal = document.getElementById('focusModal');
  var focusIntro = document.getElementById('focusIntro');
  var focusQueueView = document.getElementById('focusQueueView');
  var focusTimeRow = document.getElementById('focusTimeRow');
  var focusEnergyRow = document.getElementById('focusEnergyRow');
  var focusQueue = [];
  var focusIndex = 0;
  var focusOverflowCount = 0;
  var focusSessionMinutes = 15;
  var focusSessionEnergy = '';

  // combien de choses est-il raisonnable de proposer pour ce temps disponible —
  // volontairement approximatif, pas une minuterie stricte
  var MINUTES_TO_LIMIT = { 5: 1, 15: 3, 30: 5, 60: 7 };

  focusTimeRow.querySelectorAll('.focus-choice').forEach(function (btn) {
    btn.addEventListener('click', function () {
      focusTimeRow.querySelectorAll('.focus-choice').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      focusSessionMinutes = Number(btn.dataset.minutes);
    });
  });
  focusTimeRow.querySelector('[data-minutes="15"]').classList.add('active');

  focusEnergyRow.querySelectorAll('.focus-choice').forEach(function (btn) {
    btn.addEventListener('click', function () {
      focusEnergyRow.querySelectorAll('.focus-choice').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      focusSessionEnergy = btn.dataset.energy;
    });
  });

  function focusCandidates() {
    var now = Date.now();
    var pool = state.notes.filter(function (n) {
      if (n.status === 'someday') return false; // le parking mental ne doit jamais s'imposer en Focus
      if (n.energy === 'attente') return false; // bloqué sur quelqu'un d'autre : rien à faire maintenant
      if (!(n.pinned || (n.kind === 'todo' && !n.done))) return false;
      // énergie choisie pour cette session (ou, à défaut, le filtre global de recherche s'il est actif)
      var wantedEnergy = focusSessionEnergy || state.filterEnergy;
      if (wantedEnergy && n.energy && n.energy !== wantedEnergy) return false;
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

    var limit = MINUTES_TO_LIMIT[focusSessionMinutes] || 3;
    focusOverflowCount = Math.max(0, pool.length - limit);
    return pool.slice(0, limit);
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
    focusIntro.classList.remove('hidden');
    focusQueueView.classList.add('hidden');
    focusModal.classList.add('show');
  });
  document.getElementById('focusStart').addEventListener('click', function () {
    focusQueue = focusCandidates();
    focusIndex = 0;
    if (!focusQueue.length) { toast('Rien à traiter pour ce temps/cette énergie — tout est calme.'); return; }
    focusIntro.classList.add('hidden');
    focusQueueView.classList.remove('hidden');
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
