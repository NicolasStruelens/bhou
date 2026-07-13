// Racine — rappels : rappel global (jours d'inactivité) + rappel daté par note
  // ================= RAPPELS =================

  var REMINDER_KEY = 'racine_reminders_enabled';
  var REMINDER_DAYS_KEY = 'racine_reminder_days';
  var NOTIFIED_KEY = 'racine_notified_map';
  var reminderToggle = document.getElementById('reminderToggle');

  function reminderDays() { return Number(localStorage.getItem(REMINDER_DAYS_KEY) || 3); }

  function checkReminders() {
    var notifiedMap = {};
    try { notifiedMap = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch (e) {}
    var today = new Date().toDateString();
    var notifiedChanged = false;
    var canNotify = 'Notification' in window && Notification.permission === 'granted';

    // rappels datés précis, sur une note donnée — indépendants du réglage global
    var due = state.notes.filter(function (n) { return n.remind_at && n.remind_at <= Date.now(); });
    var dueToNotify = due.filter(function (n) { return notifiedMap['r:' + n.id] !== today; });
    if (dueToNotify.length) {
      if (canNotify) {
        dueToNotify.forEach(function (n) { new Notification('Racine — rappel', { body: n.title }); });
      }
      dueToNotify.forEach(function (n) { notifiedMap['r:' + n.id] = today; });
      notifiedChanged = true;
      toast(dueToNotify.length === 1 ? 'Rappel : ' + dueToNotify[0].title : dueToNotify.length + ' rappels programmés sont arrivés à échéance');
    }

    // rappel global (épinglés / tâches en attente depuis plus de X jours)
    if (localStorage.getItem(REMINDER_KEY) === '1') {
      var days = reminderDays();
      var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      var overdue = state.notes.filter(function (n) {
        var relevant = n.pinned || (n.kind === 'todo' && !n.done);
        return relevant && n.created_at <= cutoff;
      });
      if (overdue.length) {
        var toNotify = overdue.filter(function (n) { return notifiedMap[n.id] !== today; });
        if (toNotify.length && canNotify) {
          var body = toNotify.slice(0, 3).map(function (n) { return '• ' + n.title; }).join('\n')
            + (toNotify.length > 3 ? '\n… et ' + (toNotify.length - 3) + ' autre(s)' : '');
          new Notification('Racine — ' + toNotify.length + ' chose(s) à ne pas oublier', { body: body });
        }
        toNotify.forEach(function (n) { notifiedMap[n.id] = today; });
        if (toNotify.length) notifiedChanged = true;
        toast(overdue.length + ' élément(s) en attente depuis plus de ' + days + ' jour(s)');
      }
    }

    if (notifiedChanged) localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedMap));
  }

  if (localStorage.getItem(REMINDER_KEY) === '1') reminderToggle.classList.add('active');

  reminderToggle.addEventListener('click', function () {
    var enabled = localStorage.getItem(REMINDER_KEY) === '1';
    if (enabled) {
      localStorage.setItem(REMINDER_KEY, '0');
      pushPreference(REMINDER_KEY, '0');
      reminderToggle.classList.remove('active');
      toast('Rappels désactivés');
      return;
    }
    if (!('Notification' in window)) {
      toast('Notifications non supportées par ce navigateur');
    }
    var input = prompt('Te rappeler après combien de jours si une idée/tâche épinglée n\'est pas traitée ?', String(reminderDays()));
    if (input === null) return;
    var days = Math.max(1, Number(input) || 3);
    localStorage.setItem(REMINDER_DAYS_KEY, String(days));
    localStorage.setItem(REMINDER_KEY, '1');
    pushPreference(REMINDER_DAYS_KEY, String(days));
    pushPreference(REMINDER_KEY, '1');
    reminderToggle.classList.add('active');
    toast('Rappels activés (tous les ' + days + ' jours)');
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(function () { checkReminders(); });
    } else {
      checkReminders();
    }
  });

  setInterval(checkReminders, 30 * 60 * 1000);


  // ================= RAPPEL DATÉ (par note) =================

  var remindModal = document.getElementById('remindModal');
  var remindNoteTitle = document.getElementById('remindNoteTitle');
  var remindInput = document.getElementById('remindInput');
  var remindTargetId = null;

  function toLocalInputValue(ts) {
    var d = new Date(ts - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function openRemindModal(n) {
    remindTargetId = n.id;
    remindNoteTitle.textContent = '« ' + n.title + ' »';
    remindInput.value = n.remind_at ? toLocalInputValue(n.remind_at) : '';
    remindModal.classList.add('show');
  }

  document.getElementById('remindClose').addEventListener('click', function () { remindModal.classList.remove('show'); });
  remindModal.addEventListener('click', function (e) { if (e.target === remindModal) remindModal.classList.remove('show'); });
  document.getElementById('remindSave').addEventListener('click', function () {
    if (!remindInput.value) { toast('Choisis une date'); return; }
    var ts = new Date(remindInput.value).getTime();
    RA.updateNote(remindTargetId, { remind_at: ts }).then(function () {
      remindModal.classList.remove('show');
      toast('Rappel programmé');
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });
  document.getElementById('remindClear').addEventListener('click', function () {
    RA.updateNote(remindTargetId, { remind_at: null }).then(function () {
      remindModal.classList.remove('show');
      loadNotes();
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  });

