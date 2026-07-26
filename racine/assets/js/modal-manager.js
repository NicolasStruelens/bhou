// Racine v55 — comportement commun des dialogues : focus, clavier et verrouillage du fond.
(function () {
  var selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  var openers = new WeakMap();
  var knownOpen = new WeakSet();
  var lockedScrollY = 0;

  function visibleModals() {
    return Array.prototype.slice.call(document.querySelectorAll('.modal-backdrop.show'));
  }

  function focusables(modal) {
    return Array.prototype.slice.call(modal.querySelectorAll(selector)).filter(function (el) {
      return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null;
    });
  }

  function lockPage() {
    if (document.body.classList.contains('modal-open')) return;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('modal-open');
    document.body.style.top = '-' + lockedScrollY + 'px';
    var shell = document.querySelector('.app-shell');
    if (shell) shell.inert = true;
  }

  function unlockPage() {
    if (!document.body.classList.contains('modal-open')) return;
    var shell = document.querySelector('.app-shell');
    if (shell) shell.inert = false;
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

  function focusModal(modal) {
    var dialog = modal.querySelector('[role="dialog"]') || modal;
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    var targets = focusables(modal);
    (targets[0] || dialog).focus({ preventScroll: true });
  }

  function syncModals() {
    var open = visibleModals();
    if (open.length) lockPage();
    open.forEach(function (modal) {
      modal.setAttribute('aria-hidden', 'false');
      if (!knownOpen.has(modal)) {
        knownOpen.add(modal);
        openers.set(modal, document.activeElement);
        window.setTimeout(function () {
          if (modal.classList.contains('show')) focusModal(modal);
        }, 0);
      }
    });
    document.querySelectorAll('.modal-backdrop:not(.show)').forEach(function (modal) {
      modal.setAttribute('aria-hidden', 'true');
      if (!knownOpen.has(modal)) return;
      knownOpen.delete(modal);
      var opener = openers.get(modal);
      openers.delete(modal);
      if (!open.length) {
        unlockPage();
        if (opener && document.contains(opener) && opener.offsetParent !== null) {
          opener.focus({ preventScroll: true });
        } else {
          var fallback = opener && opener.closest && opener.closest('#atelierDropdown')
            ? document.getElementById('atelierToggle')
            : null;
          if (fallback) fallback.focus({ preventScroll: true });
        }
      }
    });
    if (open.length) {
      var shell = document.querySelector('.app-shell');
      if (shell) shell.inert = true;
      var top = open[open.length - 1];
      if (!top.contains(document.activeElement)) focusModal(top);
    }
  }

  document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
    modal.setAttribute('aria-hidden', modal.classList.contains('show') ? 'false' : 'true');
  });

  new MutationObserver(syncModals).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  document.addEventListener('keydown', function (event) {
    var open = visibleModals();
    if (!open.length) return;
    var modal = open[open.length - 1];
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      modal.classList.remove('show');
      return;
    }
    if (event.key !== 'Tab') return;
    var targets = focusables(modal);
    if (!targets.length) {
      event.preventDefault();
      focusModal(modal);
      return;
    }
    var first = targets[0];
    var last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }, true);
})();
