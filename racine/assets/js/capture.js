// Racine — capture rapide : kind/pin/énergie/someday, templates, palette de commandes, analyseur de date FR
  // ================= CAPTURE =================

  var kindSelect = document.getElementById('kindSelect');
  kindSelect.addEventListener('click', function (e) {
    var btn = e.target.closest('.kind-btn');
    if (!btn) return;
    state.kind = btn.dataset.kind;
    kindSelect.querySelectorAll('.kind-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });

  var pinToggle = document.getElementById('pinToggle');
  pinToggle.addEventListener('click', function () {
    state.pinned = !state.pinned;
    pinToggle.classList.toggle('active', state.pinned);
  });

  var energySelect = document.getElementById('energySelect');
  energySelect.addEventListener('click', function (e) {
    var btn = e.target.closest('.energy-btn');
    if (!btn) return;
    state.energy = state.energy === btn.dataset.energy ? '' : btn.dataset.energy;
    energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.energy === state.energy); });
  });

  var somedayToggle = document.getElementById('somedayToggle');
  somedayToggle.addEventListener('click', function () {
    state.someday = !state.someday;
    somedayToggle.classList.toggle('active', state.someday);
  });

  var TEMPLATES = {
    appel: { kind: 'todo', title: 'Appeler ', tags: '#appel', energy: 'facile' },
    bug: { kind: 'todo', title: 'Bug : ', tags: '#bug', energy: 'urgent' },
    business: { kind: 'idee', title: '', tags: '#business', energy: 'profond' },
    maison: { kind: 'todo', title: '', tags: '#maison', energy: '2min' },
    transfert: { kind: 'note', title: 'Commande à transférer : ', tags: '#transfert', energy: '' },
  };
  document.getElementById('templateRow').addEventListener('click', function (e) {
    var btn = e.target.closest('.template-btn');
    if (!btn) return;
    var t = TEMPLATES[btn.dataset.template];
    if (!t) return;
    state.kind = t.kind;
    kindSelect.querySelectorAll('.kind-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.kind === t.kind); });
    captureTags.value = t.tags;
    state.energy = t.energy;
    energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.energy === t.energy); });
    captureInput.value = t.title;
    captureBar.classList.toggle('has-value', !!t.title);
    captureInput.focus();
    captureInput.setSelectionRange(t.title.length, t.title.length);
  });

  var captureBar = document.getElementById('captureBar');
  var captureDetails = document.getElementById('captureDetails');
  var detailToggle = document.getElementById('detailToggle');
  var captureAdd = document.getElementById('captureAdd');

  detailToggle.addEventListener('click', function () {
    var open = captureDetails.classList.toggle('open');
    detailToggle.classList.toggle('active', open);
    detailToggle.textContent = open ? '− masquer les détails' : '+ ajouter des détails';
    if (open) captureDetails.focus();
  });

  captureInput.addEventListener('input', function () {
    captureBar.classList.toggle('has-value', !!captureInput.value.trim());
  });

  var captureTags = document.getElementById('captureTags');

  // ---------- analyseur de date en langage naturel (FR) ----------
  // utilisé par la commande /rappel et par la détection passive de mots de date dans la capture
  function parseNaturalDate(str) {
    var s = (str || '').toLowerCase();
    var now = new Date();
    var target = null;
    var m;
    if (/\bapr[eè]s[\s-]?demain\b/.test(s)) {
      target = new Date(now); target.setDate(target.getDate() + 2);
    } else if (/\bdemain\b/.test(s)) {
      target = new Date(now); target.setDate(target.getDate() + 1);
    } else if (/\baujourd'?hui\b/.test(s)) {
      target = new Date(now);
    } else if ((m = /\bdans\s+(\d+)\s*jours?\b/.exec(s))) {
      target = new Date(now); target.setDate(target.getDate() + Number(m[1]));
    } else {
      var days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      for (var i = 0; i < days.length; i++) {
        if (new RegExp('\\b' + days[i] + '\\b').test(s)) {
          target = new Date(now);
          var delta = (i - now.getDay() + 7) % 7;
          if (delta === 0) delta = 7;
          target.setDate(target.getDate() + delta);
          break;
        }
      }
    }
    if (!target) return null;
    var timeMatch = /\b(\d{1,2})h(\d{2})?\b/.exec(s);
    var hour = 9, min = 0;
    if (timeMatch) { hour = Math.min(23, Number(timeMatch[1])); min = timeMatch[2] ? Number(timeMatch[2]) : 0; }
    target.setHours(hour, min, 0, 0);
    return target.getTime();
  }

  // ---------- palette de commandes : /todo /idee /note /rappel <date> /espace X /tag X ----------
  function parseCaptureCommand(raw) {
    var result = { kind: null, remind_at: null, space: null, tags: [] };
    var text = raw;
    text = text.replace(/\/espace\s+([^\/]+)/i, function (_, g) { result.space = g.trim(); return ' '; });
    text = text.replace(/\/tag\s+([^\/]+)/i, function (_, g) { result.tags.push('#' + g.trim().replace(/^#/, '').split(/\s+/)[0]); return ' '; });
    text = text.replace(/\/rappel\s+([^\/]+)/i, function (_, g) {
      var ts = parseNaturalDate(g);
      if (ts) result.remind_at = ts;
      return ' ';
    });
    text = text.replace(/\/todo\b/i, function () { result.kind = 'todo'; return ' '; });
    text = text.replace(/\/idee\b/i, function () { result.kind = 'idee'; return ' '; });
    text = text.replace(/\/note\b/i, function () { result.kind = 'note'; return ' '; });
    result.title = text.replace(/\s+/g, ' ').trim();
    return result;
  }

  function submitCapture() {
    var raw = captureInput.value.trim();
    if (!raw) { captureInput.focus(); return; }
    var cmd = parseCaptureCommand(raw);
    var title = cmd.title;
    if (!title) { captureInput.focus(); return; }
    var remindAt = cmd.remind_at;
    if (!remindAt) {
      // détection passive : un mot de date dans le texte pose un rappel automatiquement, sans le retirer du titre
      remindAt = parseNaturalDate(title);
    }
    var notePayload = {
      title: title,
      content: captureDetails.value.trim(),
      kind: cmd.kind || state.kind,
      pinned: state.pinned,
      space: cmd.space || (state.activeSpace === OVERVIEW ? 'Général' : state.activeSpace),
      tags: parseTags(captureTags.value).concat(cmd.tags).join(' '),
      remind_at: remindAt || null,
      energy: state.energy,
      status: state.someday ? 'someday' : 'active',
      inbox: false,
    };
    RA.createNote(notePayload).then(function (res) {
      if (window.RAUniverse) window.RAUniverse.emit('create', captureBar);
      captureInput.value = '';
      captureDetails.value = '';
      captureTags.value = '';
      captureDetails.classList.remove('open');
      detailToggle.classList.remove('active');
      detailToggle.textContent = '+ ajouter des détails';
      state.pinned = false;
      pinToggle.classList.remove('active');
      state.energy = '';
      energySelect.querySelectorAll('.energy-btn').forEach(function (b) { b.classList.remove('active'); });
      state.someday = false;
      somedayToggle.classList.remove('active');
      captureBar.classList.remove('has-value');
      state.lastAddedId = res.id;
      if (cmd.space && knownSpaces().indexOf(cmd.space) === -1 && cmd.space !== 'Général') saveKnownSpace(cmd.space);
      if (res.queued) {
        optimisticDeposit(res.id, notePayload);
        toast('Pensée gardée hors-ligne — elle se synchronisera automatiquement');
      } else {
        if (remindAt) toast('Rappel posé pour ' + formatRemindAt(remindAt));
        loadNotes();
      }
    }).catch(function (err) { toast('Erreur : ' + err.message); });
  }

  captureInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitCapture();
  });
  captureDetails.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitCapture();
  });
  captureAdd.addEventListener('click', submitCapture);

  // ---------- Déposer : une pensée entre sans exiger de classement ----------
  var depositModal = document.getElementById('depositModal');
  var depositInput = document.getElementById('depositInput');

  function openDepositModal(initialText) {
    depositInput.value = initialText || '';
    depositModal.classList.add('show');
    setTimeout(function () { depositInput.focus(); }, 40);
  }

  function closeDepositModal() { depositModal.classList.remove('show'); }

  function depositPayload(raw) {
    var lines = raw.trim().split(/\r?\n/);
    var title = (lines.shift() || '').trim().slice(0, 500);
    return {
      title: title,
      content: lines.join('\n').trim(),
      kind: 'idee',
      inbox: true,
      position: Date.now(),
      space: 'Général',
    };
  }

  function optimisticDeposit(id, payload) {
    var now = Date.now();
    state.notes.unshift(Object.assign({
      id: id, parent_id: null, pinned: 0, done: 0, tags: '', links: '', energy: '',
      status: 'active', remind_at: null, history: '[]', effort_minutes: null,
      created_at: now, updated_at: now,
    }, payload));
    renderSpaceBar();
    renderNotesView();
    renderToday();
  }

  function saveDeposit() {
    var raw = depositInput.value.trim();
    if (!raw) { depositInput.focus(); return; }
    var payload = depositPayload(raw);
    if (!payload.title) return;
    document.getElementById('depositSave').disabled = true;
    RA.createNote(payload).then(function (res) {
      if (window.RAUniverse) window.RAUniverse.emit('create', depositModal.querySelector('.deposit-card'));
      closeDepositModal();
      depositInput.value = '';
      if (res.queued) {
        optimisticDeposit(res.id, payload);
        toast('Pensée gardée hors-ligne — elle se synchronisera automatiquement');
      } else {
        toast('Pensée déposée. Tu n’as rien d’autre à décider maintenant.');
        loadNotes();
      }
    }).catch(function (err) { toast('Erreur : ' + err.message); }).finally(function () {
      document.getElementById('depositSave').disabled = false;
    });
  }

  document.getElementById('depositClose').addEventListener('click', closeDepositModal);
  depositModal.addEventListener('click', function (e) { if (e.target === depositModal) closeDepositModal(); });
  document.getElementById('depositSave').addEventListener('click', saveDeposit);
  document.getElementById('depositExpand').addEventListener('click', function () {
    var raw = depositInput.value.trim();
    closeDepositModal();
    switchTab('notes');
    if (raw) {
      var payload = depositPayload(raw);
      captureInput.value = payload.title;
      captureDetails.value = payload.content;
      captureBar.classList.add('has-value');
      if (payload.content) {
        captureDetails.classList.add('open');
        detailToggle.classList.add('active');
        detailToggle.textContent = '− masquer les détails';
      }
    }
    setTimeout(function () { captureInput.focus(); }, 40);
  });
  depositInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDeposit();
    if (e.key === 'Escape') closeDepositModal();
  });
  document.getElementById('clairiereDeposit').addEventListener('click', function () { openDepositModal(); });
