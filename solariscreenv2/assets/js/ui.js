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

  // ── Copier-coller rapide (nom/tél/email/adresse/prix depuis les fiches) ──
  function legacyCopy(value, done, fail) {
    try {
      const ta = document.createElement('textarea');
      ta.value = value; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? done() : fail();
    } catch (e) { fail(); }
  }
  function copyText(text, label) {
    const value = String(text == null ? '' : text).trim();
    if (!value) return;
    const done = () => toast((label ? label + ' copié' : 'Copié') + ' ✓', 'ok', 1800);
    const fail = () => toast('Impossible de copier — sélectionne le texte manuellement.', 'warn');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => legacyCopy(value, done, fail));
    } else {
      legacyCopy(value, done, fail);
    }
  }
  // Encode une valeur pour l'injecter en toute sécurité dans un attribut onclick="..." inline
  function jsAttr(v) { return JSON.stringify(String(v == null ? '' : v)).replace(/"/g, '&quot;'); }

  // Redimensionne/compresse une photo avant stockage (les devis sont sauvés en JSON
  // dans D1 — une photo de téléphone non compressée (plusieurs Mo) peut à elle seule
  // faire dépasser la taille max d'une ligne et faire échouer l'enregistrement serveur).
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600; quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = function () { reject(reader.error || new Error('Lecture impossible')); };
      reader.onload = function () {
        const img = new Image();
        img.onerror = function () { reject(new Error('Image invalide')); };
        img.onload = function () {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Normalisation d'un devis (résumé API ou cache local complet) ──
  // Centralisé ici : évite de dupliquer cette fonction dans chaque page.
  function normDevis(d) {
    return {
      id: d.id,
      nom: d.client_nom || (d.client && d.client.nom) || '',
      prenom: d.client_prenom || (d.client && d.client.prenom) || '',
      statut: d.statut || 'brouillon',
      ttc: d.total_ttc || (d.calculs && d.calculs.total_ttc) || 0,
      date_creation: d.date_creation || '',
      date_modification: d.date_modification || d.date_creation || '',
      photos: d.photos_count || (d.metadata && d.metadata.photos_count) || 0,
      comments: d.comments_count || (d.comments && d.comments.length) || 0,
      archive: !!d.archive,
      informatif: !!d.informatif,
      portfolio: !!d.portfolio,
      nicolas_net: Number(d.nicolas_net) || (d.calculs && Number(d.calculs.nicolas_net)) || 0,
      yannick_net: Number(d.yannick_net) || (d.calculs && Number(d.calculs.yannick_net)) || 0,
    };
  }

  // ── Icônes SVG (trait fin, currentColor) — remplace les emojis partout ──
  const ICONS = {
    search:     '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    edit:       '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    filetext:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    copy:       '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    users:      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    grid:       '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/><line x1="16" x2="16" y1="14" y2="18"/>',
    camera:     '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    message:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    save:       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    lock:       '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    lockopen:   '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    window:     '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/>',
    coin:       '<circle cx="12" cy="12" r="9"/><path d="M9 8.5c1-1.2 2.2-1.5 3.5-1.5a4 4 0 0 1 0 8c-1.3 0-2.5-.3-3.5-1.5"/><line x1="6" y1="10" x2="12" y2="10"/><line x1="6" y1="13" x2="12" y2="13"/>',
    x:          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check:      '<polyline points="20 6 9 17 4 12"/>',
    chevrondown:'<polyline points="6 9 12 15 18 9"/>',
    arrowleft:  '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    sliders:    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    list:       '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    warning:    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    image:      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    phone:      '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
    user:       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    grid9:      '<circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/>',
  };
  function icon(name, size) {
    const s = size || 16;
    const body = ICONS[name] || '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;flex-shrink:0">' + body + '</svg>';
  }

  window.SSUI = {
    fmtEur: fmtEur, fmt2: fmt2, r2: r2, fmtDate: fmtDate,
    el: el, $: $, $$: $$,
    setText: setText, setVal: setVal, getVal: getVal, getNum: getNum, getInt: getInt,
    toast: toast, generateDevisId: generateDevisId, qp: qp,
    normDevis: normDevis, icon: icon, compressImage: compressImage,
    copyText: copyText, jsAttr: jsAttr,
  };
  // Raccourci global utilisable directement dans les attributs onclick="..." inline
  window.ssCopy = function (text, label) { copyText(text, label); };
})();
