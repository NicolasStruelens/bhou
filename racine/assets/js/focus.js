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

  function estimatedMinutes(n) {
    if (n.effort_minutes) return Number(n.effort_minutes);
    if (n.energy === '2min') return 2;
    if (n.energy === 'facile') return 10;
    if (n.energy === 'profond') return 30;
    return 15;
  }

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
      if (n.done) return false;
      if (n.status === 'someday') return false; // le parking mental ne doit jamais s'imposer en Focus
      if (n.energy === 'attente') return false; // bloqué sur quelqu'un d'autre : rien à faire maintenant
      if (!(n.pinned || (n.kind === 'todo' && !n.done))) return false;
      // énergie choisie pour cette session (ou, à défaut, le filtre global de recherche s'il est actif)
      var wantedEnergy = focusSessionEnergy || state.filterEnergy;
      if (wantedEnergy && (n.energy || '') !== wantedEnergy) return false;
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

    var selected = [];
    var remaining = focusSessionMinutes;
    pool.forEach(function (n) {
      var duration = estimatedMinutes(n);
      if (duration <= remaining) {
        selected.push(n);
        remaining = Math.max(0, remaining - duration);
      }
    });
    focusOverflowCount = Math.max(0, pool.length - selected.length);
    return selected;
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
    var remainingMinutes = focusQueue.slice(focusIndex).reduce(function (sum, x) { return sum + estimatedMinutes(x); }, 0);
    document.getElementById('focusProgress').textContent = (focusIndex + 1) + ' / ' + focusQueue.length + ' · ≈ ' + estimatedMinutes(n) + ' min · ' + remainingMinutes + ' min restantes';
  }

  document.getElementById('focusModeBtn').addEventListener('click', function () {
    if (window.RAUniverse) window.RAUniverse.emit('focus', document.getElementById('focusModeBtn'));
    focusIntro.classList.remove('hidden');
    focusQueueView.classList.add('hidden');
    focusModal.classList.add('show');
  });
  document.getElementById('focusStart').addEventListener('click', function () {
    focusQueue = focusCandidates();
    focusIndex = 0;
    if (!focusQueue.length) { toast('Rien ne tient vraiment dans ' + focusSessionMinutes + ' min pour cette énergie. Choisis un autre cadre.'); return; }
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
  document.getElementById('focusReject').addEventListener('click', function () {
    var rejected = focusQueue.splice(focusIndex, 1)[0];
    toast('« ' + rejected.title + ' » écartée de cette session');
    showFocusCard();
  });
  document.getElementById('focusDone').addEventListener('click', function () {
    var n = focusQueue[focusIndex];
    var completion = window.RAHarvest ? window.RAHarvest.complete(n, null) : RA.updateNote(n.id, { done: true }).then(loadNotes);
    completion.then(function (result) {
      if (result && result.guided) { focusModal.classList.remove('show'); return; }
      focusIndex++;
      showFocusCard();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });
