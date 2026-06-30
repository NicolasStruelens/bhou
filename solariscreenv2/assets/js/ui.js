// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Helpers UI (format, toasts, DOM)
// Script classique (file:// OK). Global : window.SSUI
// ═══════════════════════════════════════════════════════════
(function () {
  const eur = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
  const nf2 = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtEur = (n) => eur.format(Number(n) || 0);
  const fmt2   = (n) => nf2.format(Number(n) || 0);
  const r2     = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const el = (id) => document.getElementById(id);
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [].slice.call((root || document).querySelectorAll(sel));

  function setText(id, v) { const n = el(id); if (n) n.textContent = v; }
  function setVal(id, v)  { const n = el(id); if (n) n.value = v == null ? '' : v; }
  function getVal(id)     { return el(id) ? el(id).value : ''; }
  function getNum(id, def){ const v = parseFloat(el(id) && el(id).value); return isNaN(v) ? (def || 0) : v; }
  function getInt(id, def){ const v = parseInt(el(id) && el(id).value, 10); return isNaN(v) ? (def || 0) : v; }

  function toastHost() {
    let h = document.getElementById('toasts');
    if (!h) { h = document.createElement('div'); h.id = 'toasts'; document.body.appendChild(h); }
    return h;
  }
  function toast(message, type, ms) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = message;
    toastHost().appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transition = 'opacity .25s';
      setTimeout(function () { t.remove(); }, 250);
    }, ms || 3200);
  }

  function generateDevisId() {
    const d = new Date();
    const ymd = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return ymd + Math.floor(1000 + Math.random() * 9000);
  }

  const qp = (key) => new URLSearchParams(location.search).get(key);

  window.SSUI = {
    fmtEur: fmtEur, fmt2: fmt2, r2: r2, fmtDate: fmtDate,
    el: el, $: $, $$: $$,
    setText: setText, setVal: setVal, getVal: getVal, getNum: getNum, getInt: getInt,
    toast: toast, generateDevisId: generateDevisId, qp: qp,
  };
})();
