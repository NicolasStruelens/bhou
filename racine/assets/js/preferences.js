// Racine — synchronisation légère des préférences entre appareils
// Les clés suivies restent en localStorage pour un rendu instantané au chargement (pas d'attente
// réseau avant peinture) ; ce module les pousse vers D1 à chaque changement et les rapatrie au
// démarrage, pour que deux appareils finissent par converger. Best-effort : jamais bloquant hors-ligne.

var SYNCED_PREF_KEYS = [
  'racine_spaces',
  'racine_space_colors',
  'racine_morning_review',
  'racine_reminders_enabled',
  'racine_reminder_days',
];

function pushPreference(key, value) {
  var patch = {};
  patch[key] = value;
  RA.setPreferences(patch).catch(function () {});
}

function onPreferencesSynced() {
  if (typeof renderSpaceBar === 'function') renderSpaceBar();
  var morningReviewToggle = document.getElementById('morningReviewToggle');
  if (morningReviewToggle) morningReviewToggle.checked = localStorage.getItem('racine_morning_review') === '1';
  var reminderToggle = document.getElementById('reminderToggle');
  if (reminderToggle) reminderToggle.classList.toggle('active', localStorage.getItem('racine_reminders_enabled') === '1');
}

function syncPreferencesFromServer() {
  return RA.getPreferences().then(function (data) {
    var prefs = data.preferences || {};
    var changed = false;
    SYNCED_PREF_KEYS.forEach(function (key) {
      if (key in prefs && localStorage.getItem(key) !== prefs[key]) {
        localStorage.setItem(key, prefs[key]);
        changed = true;
      }
    });
    if (changed) onPreferencesSynced();
  }).catch(function () {});
}
