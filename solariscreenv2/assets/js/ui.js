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

  // ── Déport des photos vers R2 (au lieu du dataURL base64 inline dans le blob devis) ──
  // Ne touche PAS compressImage (toujours un dataURL en sortie, aucun appelant existant cassé) :
  // on ajoute l'upload PAR-DESSUS, avec repli automatique sur le dataURL si ça échoue (hors-ligne,
  // bucket R2 non lié…) — une photo n'est jamais perdue, juste pas toujours déportée.
  // ⚠️ Le repli sur le dataURL ne doit JAMAIS être silencieux. C'est ce silence qui a laissé le
  // devis de Pierre Depaepe accumuler 1,69 Mo de photos en clair dans la base sans que personne
  // ne s'en aperçoive — jusqu'à ce qu'un enregistrement échoue en production. La photo reste
  // gardée (on ne perd rien), mais l'écran le dit et le devis pourra être allégé plus tard.
  async function uploadPhotoDataUrl(dataUrl, ownerId) {
    try {
      if (!window.SS || !window.SS.uploadPhoto) { signalerRepliPhoto('stockage indisponible'); return dataUrl; }
      const blob = await (await fetch(dataUrl)).blob();
      const url = await window.SS.uploadPhoto(ownerId, blob);
      if (!url) { signalerRepliPhoto('le serveur n’a pas accepté la photo'); return dataUrl; }
      return url;
    } catch (e) { signalerRepliPhoto(e && e.message ? e.message : 'erreur réseau'); return dataUrl; }
  }
  // Un seul avertissement par salve : ajouter 5 photos hors-ligne ne doit pas empiler 5 bulles.
  let dernierRepli = 0;
  function signalerRepliPhoto(raison) {
    try { window.dispatchEvent(new CustomEvent('ss-photo-repli', { detail: { raison: raison } })); } catch (e) {}
    const now = Date.now();
    if (now - dernierRepli < 4000) return;
    dernierRepli = now;
    toast('Photo gardée dans le devis, pas envoyée au stockage (' + raison + '). Le devis va s’alourdir — allège-le depuis le tableau de bord quand la connexion revient.', 'warn', 9000);
  }
  async function compressAndUploadPhoto(file, ownerId, maxDim, quality) {
    const dataUrl = await compressImage(file, maxDim, quality);
    return uploadPhotoDataUrl(dataUrl, ownerId);
  }
  /** Une photo encore stockée en clair DANS le devis (par opposition à une URL vers R2). */
  const estPhotoInline = (p) => typeof p === 'string' && p.slice(0, 5) === 'data:';
  /**
   * Déporte vers R2 toutes les photos encore en clair d'un devis, et remplace chaque image par son
   * URL. Ne touche à RIEN d'autre, n'enregistre pas (l'appelant décide) et laisse en place toute
   * photo dont l'envoi échoue — une image n'est jamais perdue, au pire elle reste où elle est.
   * Renvoie { deportees, echecs, octets } (octets = poids retiré du devis).
   */
  async function deporterPhotos(devis) {
    let deportees = 0, echecs = 0, octets = 0;
    // Déporte un tableau de chaînes en place (ouvertures, photos d'un ticket SAV).
    async function traiterTableau(tab) {
      for (let i = 0; i < (tab || []).length; i++) {
        if (!estPhotoInline(tab[i])) continue;
        const poids = tab[i].length;
        const url = await uploadPhotoDataUrl(tab[i], devis.id);
        if (estPhotoInline(url)) { echecs++; continue; }   // l'envoi a échoué : on garde l'original
        tab[i] = url; deportees++; octets += poids;
      }
    }
    for (const it of (devis && devis.items) || []) await traiterTableau(it.photos);
    // Journal de chantier : la photo est un objet { url, note, phase, date }. Le repli silencieux
    // frappait ici aussi — et c'est même le gros morceau sur un dossier qui a été posé.
    for (const e of (devis && devis.chantier_photos) || []) {
      if (!estPhotoInline(e && e.url)) continue;
      const poids = e.url.length;
      const url = await uploadPhotoDataUrl(e.url, devis.id);
      if (estPhotoInline(url)) { echecs++; continue; }
      e.url = url; deportees++; octets += poids;
    }
    for (const t of (devis && devis.sav_tickets) || []) await traiterTableau(t && t.photos);
    return Object.assign({ deportees, echecs, octets }, poidsInline(devis));
  }
  /**
   * Où pèse ce devis, en octets d'images encore stockées en clair. Sert à EXPLIQUER quand il n'y a
   * rien à déporter : « 0 devis allégé ✓ » sur un bandeau qui reste affiché ne veut rien dire.
   * `signature` et `reception` sont comptés à part et JAMAIS déportés : la signature est affichée
   * sur la page publique du devis (espace client), qui n'est pas derrière Cloudflare Access — une
   * URL de stockage y serait une image cassée chez le client.
   */
  function poidsInline(devis) {
    const d = devis || {};
    const somme = (arr) => (arr || []).reduce((s, p) => s + (estPhotoInline(p) ? p.length : 0), 0);
    const ouvertures = (d.items || []).reduce((s, it) => s + somme(it.photos), 0);
    const chantier = (d.chantier_photos || []).reduce((s, e) => s + (estPhotoInline(e && e.url) ? e.url.length : 0), 0);
    const sav = (d.sav_tickets || []).reduce((s, t) => s + somme(t && t.photos), 0);
    const signatures = (estPhotoInline(d.signature && d.signature.image) ? d.signature.image.length : 0)
      + (estPhotoInline(d.reception && d.reception.image) ? d.reception.image.length : 0);
    return { restant: { ouvertures, chantier, sav, signatures } };
  }

  // ── Compteur « odomètre » : la valeur défile de 0 jusqu'au chiffre réel ──────────────────
  // Esprit instrument de mesure : un relevé qui se stabilise, pas un chiffre qui apparaît.
  // `format` reçoit la valeur intermédiaire et renvoie le texte à afficher (fmtEur, arrondi…).
  // Courbe easeOutCubic : rapide au départ, freinage net à l'arrivée.
  // ⚠️ Respecte `prefers-reduced-motion` : dans ce cas la valeur finale est posée directement.
  function countUp(node, value, opts) {
    if (!node) return;
    opts = opts || {};
    const format = opts.format || function (v) { return String(Math.round(v)); };
    const duration = opts.duration || 620;
    const target = Number(value) || 0;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // ⚠️ CORRECTNESS AVANT ESTHÉTIQUE : requestAnimationFrame ne s'exécute PAS tant que l'onglet
    // est en arrière-plan. Sans ce garde, ouvrir le tableau de bord dans un onglet non actif
    // laissait le compteur figé sur sa PREMIÈRE frame — soit « 0,00 € » affiché à la place d'un
    // vrai montant. Un chiffre faux est bien pire qu'une absence d'animation.
    const hidden = document.visibilityState && document.visibilityState !== 'visible';
    // Animer une variation minuscule (ou nulle) n'apporte rien et fait clignoter l'affichage.
    if (reduced || hidden || !target || Math.abs(target) < 0.005) { node.textContent = format(target); return; }
    // Un re-rendu peut relancer l'animation sur le même nœud : on annule la précédente.
    if (node._ssCountRaf) cancelAnimationFrame(node._ssCountRaf);
    if (node._ssCountTimer) clearTimeout(node._ssCountTimer);
    const finish = function () {
      if (node._ssCountRaf) { cancelAnimationFrame(node._ssCountRaf); node._ssCountRaf = null; }
      node._ssCountTimer = null;
      node.textContent = format(target);
    };
    // Filet de sécurité : quoi qu'il arrive (onglet masqué en cours de route, frames perdues),
    // la valeur exacte est posée après la durée prévue.
    node._ssCountTimer = setTimeout(finish, duration + 250);
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = format(target * eased);
      if (p < 1) node._ssCountRaf = requestAnimationFrame(step);
      else finish();
    })(t0);
  }

  // ── Anime tous les .kpi-value d'un conteneur en « odomètre » ────────────────────────────
  // Générique pour TOUTES les pages à KPI : lit le texte déjà rendu (montant €, entier ou %)
  // et le rejoue de 0 à sa valeur — aucune page n'a besoin de restructurer son template.
  // Les textes non numériques (« 12/33 », « — », un nom de client) sont laissés tels quels.
  function animateKpis(root) {
    (root || document).querySelectorAll('.kpi-value').forEach(function (node) {
      const txt = (node.textContent || '').trim();
      // Montant « 24 854,07 € » (séparateurs de milliers : espace, insécable, fine, point)
      let m = txt.match(/^([\d\s  .]+(?:,\d+)?)\s*€$/);
      if (m) {
        const val = parseFloat(m[1].replace(/[\s  .]/g, '').replace(',', '.'));
        if (isFinite(val)) countUp(node, val, { format: fmtEur });
        return;
      }
      // Pourcentage « 38 % »
      m = txt.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
      if (m) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (isFinite(val)) countUp(node, val, { format: function (v) { return Math.round(v) + ' %'; } });
        return;
      }
      // Entier simple « 25 »
      if (/^\d{1,6}$/.test(txt)) countUp(node, parseInt(txt, 10), { format: function (v) { return String(Math.round(v)); } });
    });
  }

  // ── Mini-courbe « sparkline » (SVG inline, trait fin façon relevé sismique) ─────────────
  // Renvoie '' si la série est trop courte ou entièrement nulle (pas de courbe mensongère).
  // La couleur suit currentColor : on la pilote depuis le conteneur (ex. or du KPI Encaissé).
  function sparkline(values, opts) {
    opts = opts || {};
    const w = opts.width || 116, h = opts.height || 26, p = 3;
    const vals = (values || []).map(Number);
    if (vals.length < 2 || !vals.some(function (v) { return v > 0; })) return '';
    const max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    const span = (max - min) || 1;
    const pts = vals.map(function (v, i) {
      const x = p + (i * (w - 2 * p)) / (vals.length - 1);
      const y = h - p - ((v - min) / span) * (h - 2 * p);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    const last = pts[pts.length - 1].split(',');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" style="display:block;">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.2" fill="currentColor"/></svg>';
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
      poids: Number(d.poids) || 0,   // octets occupés en base — repère les devis à alléger
      comments: d.comments_count || (d.comments && d.comments.length) || 0,
      archive: !!d.archive,
      informatif: !!d.informatif,
      portfolio: !!d.portfolio,
      nicolas_net: Number(d.nicolas_net) || (d.calculs && Number(d.calculs.nicolas_net)) || 0,
      yannick_net: Number(d.yannick_net) || (d.calculs && Number(d.calculs.yannick_net)) || 0,
      seller_principal: d.seller_principal || (d.pricing_v2 && d.pricing_v2.material && d.pricing_v2.material.sellers && d.pricing_v2.material.sellers.principal) || 'nicolas',
      acompte_pct: (d.acompte_pct != null) ? d.acompte_pct : ((d.pricing_v2 && d.pricing_v2.acompte_pct != null) ? d.pricing_v2.acompte_pct : ((d.calculs && d.calculs.acompte_pct != null) ? d.calculs.acompte_pct : null)),
      note: d.pricing_note || (d.pricing_v2 && d.pricing_v2.note) || '',
      statut_history: d.statut_history || [],
      ville: (d.client && d.client.adresse && d.client.adresse.ville) || '',
      // Adresse complète : le raccourci « Itinéraire » du tableau de bord a besoin de la rue, pas
      // seulement de la ville (une commune ne mène le poseur qu'au centre du village).
      adresse: (d.client && d.client.adresse) || {},
      telephone: (d.client && d.client.telephone) || '',
      email: (d.client && d.client.email) || '',
      chantier: d.chantier || null,
      commande_statut: (d.commande && d.commande.statut) || d.commande_statut || '',
      reception_date: (d.reception && d.reception.date) || d.reception_date || '',
      checklist: d.checklist || null,
      raison_refus: d.raison_refus || '',
      probabilite: d.probabilite || '',
      client_accepted: !!d.client_accepted,
      client_accepted_at: d.client_accepted_at || '',
      client_declined: !!d.client_declined,
      client_question_open: !!d.client_question_open,
      // Toujours un NOMBRE : l'API liste renvoie déjà un compteur, mais le cache local garde le
      // tableau d'horodatages → on prend sa longueur pour que `review_views > 0` marche partout.
      review_views: Array.isArray(d.review_views) ? d.review_views.length : (Number(d.review_views) || 0),
      // Un lien espace client a-t-il été créé ? (distinguer « jamais ouvert » de « pas de lien »).
      has_review_link: (d.has_review_link != null) ? !!d.has_review_link
        : (!!d.review_token || (Array.isArray(d.review_views) && d.review_views.length > 0)),
      sav_tickets: d.sav_tickets || [],
      chantier_photos_count: d.chantier_photos_count || (d.chantier_photos ? d.chantier_photos.length : 0),
      date_envoi: d.date_envoi || '',
      relances: d.relances || [],
      // Nature du document. Absente = devis, forme historique de tous les enregistrements
      // antérieurs au dépannage : c'est ce défaut qui rend le changement rétro-compatible.
      type_document: d.type_document || 'devis',
      depannage_mode: d.depannage_mode || '',
      depannage_suite: d.depannage_suite || (d.depannage && d.depannage.suite) || '',
      item_types: d.item_types || (d.items ? [...new Set(d.items.map(i => i.type).filter(Boolean))] : []),
      // Projection allégée des ouvertures fournie par /api/devis (sans les photos) : elle sert
      // uniquement à repérer les informations manquantes dans une LISTE. Repli sur `items`
      // quand l'objet est complet (cache hors ligne, devis fraîchement enregistré) — sans ce
      // repli, cette liste blanche perdrait les ouvertures et le signalement resterait muet.
      items_min: d.items_min || d.items || [],
    };
  }

  // ── Dimensions d'une ouverture (source unique, partagée par tous les documents) ──
  // Une TENTE SOLAIRE (store banne) se mesure en LARGEUR × PROJECTION (l'avancée) : la hauteur
  // n'a aucun sens pour ce produit. Tous les autres types se mesurent en largeur × hauteur.
  // ⚠️ On branche sur le TYPE, jamais sur la présence de la valeur : les anciens devis de tentes
  // gardent une hauteur parasite en base, qui ne doit plus jamais être affichée.
  function isTenteSolaire(it) { return !!it && it.type === 'tente_solaire'; }
  function dimsOf(it) {
    if (!it) return '';
    if (isTenteSolaire(it)) {
      return (it.largeur && it.projection) ? `${it.largeur} × ${it.projection} mm (l × proj.)` : '';
    }
    return (it.largeur && it.hauteur) ? `${it.largeur} × ${it.hauteur} mm` : '';
  }

  // ── Jalons du cycle de vie (partagés par agenda / vue / dashboard : ils doivent TOUS dire la même chose) ──
  // POSE FAITE = PV de réception signé OU étape fournisseur « Posé ». On ne se fie PLUS à statut==='termine'
  // (un devis peut être marqué terminé alors que la pose n'est pas faite — ex. données importées).
  // Marche sur le blob complet (reception.image / commande.statut) ET sur le résumé de liste dénormalisé
  // (reception_date / commande_statut).
  function isPoseDone(d) {
    if (!d) return false;
    const recDone = !!(d.reception && d.reception.image) || !!d.reception_date;
    const cmdPose = (d.commande && d.commande.statut === 'pose') || d.commande_statut === 'pose';
    return recDone || cmdPose;
  }

  // ── Détection de conflit d'édition (2 utilisateurs sur le même devis) ──
  // Appelée quand SS.saveDevis() renvoie { conflict: true } (voir api.js) : quelqu'un d'autre a déjà
  // enregistré une version plus récente entre le chargement de la fiche et cette sauvegarde. On ne
  // choisit JAMAIS à sa place — l'utilisateur tranche entre recharger (sûr) ou écraser (voulu).
  function showSaveConflict(onForce) {
    const reload = confirm(
      "⚠ Ce devis a été modifié par quelqu'un d'autre (Nicolas ou Yannick) pendant que tu travaillais dessus.\n\n" +
      "OK = recharger sa version la plus récente (plus sûr, tu perds tes modifications en cours)\n" +
      "Annuler = enregistrer quand même TA version par-dessus la sienne"
    );
    if (reload) location.reload();
    else if (onForce) onForce();
  }

  // ── Météo chantier (Open-Meteo, gratuit, sans clé — géocodage par ville + prévision 16j) ──
  const _geoCache = {};
  // Géocode en préférant le CODE POSTAL quand il est disponible : contrairement au nom de ville
  // (saisie libre, fautes d'orthographe/variantes possibles — ex: "Chapelle-les-Herlaimont" au lieu
  // du vrai "Chapelle-lez-Herlaimont", qui fait échouer toute recherche par nom), un code postal belge
  // est sans ambiguïté. zippopotam.us est gratuit, sans clé, et couvre les codes postaux belges.
  // Distance à vol d'oiseau entre deux points (km) — formule haversine. Assez précise pour
  // trancher « qui est le plus proche » à l'échelle d'un déplacement (la route réelle est ~20-30 %
  // plus longue, mais dans le même ordre pour les deux vendeurs → le classement ne change pas).
  function distanceKm(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(function (v) { return v == null || isNaN(v); })) return null;
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function geocodeVille(ville, codePostal) {
    if (!ville && !codePostal) return null;
    const key = codePostal ? 'cp:' + String(codePostal).trim() : 'v:' + String(ville).trim().toLowerCase();
    let loc = _geoCache[key];
    if (loc !== undefined) return loc;
    loc = null;
    if (codePostal) {
      try {
        const r = await fetch('https://api.zippopotam.us/BE/' + encodeURIComponent(String(codePostal).trim()));
        if (r.ok) {
          const data = await r.json();
          const p = data.places && data.places[0];
          if (p) loc = { latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude) };
        }
      } catch (e) {}
    }
    if (!loc && ville) {
      try {
        // Le paramètre correct de l'API est "countryCode", pas "country" — avec "country=BE" le filtre
        // était silencieusement ignoré et une ville homonyme plus peuplée à l'étranger (ex: Waterloo,
        // USA/Canada) pouvait passer devant la vraie ville belge. Vérifié directement sur l'API.
        const geo = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(ville) + '&countryCode=BE&count=1').then(r => r.json());
        loc = (geo.results && geo.results[0]) || null;
      } catch (e) {}
    }
    _geoCache[key] = loc;
    return loc;
  }
  function weatherLabel(code) {
    if (code === 0) return 'Ciel clair';
    if ([1, 2, 3].includes(code)) return 'Partiellement nuageux';
    if ([45, 48].includes(code)) return 'Brouillard';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Bruine';
    if ([61, 63, 65, 66, 67].includes(code)) return 'Pluie';
    if ([71, 73, 75, 77].includes(code)) return 'Neige';
    if ([80, 81, 82].includes(code)) return 'Averses';
    if ([95, 96, 99].includes(code)) return 'Orage';
    return 'Météo incertaine';
  }
  async function fetchWeather(ville, dateStr, codePostal) {
    if ((!ville && !codePostal) || !dateStr) return null;
    const days = Math.round((new Date(dateStr) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
    if (days < 0 || days > 15) return null; // hors couverture de la prévision gratuite (16 jours)
    try {
      const loc = await geocodeVille(ville, codePostal);
      if (!loc) return null;
      const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBrussels&forecast_days=16`).then(r => r.json());
      const idx = (fc.daily && fc.daily.time || []).indexOf(dateStr);
      if (idx < 0) return null;
      return { code: fc.daily.weathercode[idx], tmax: fc.daily.temperature_2m_max[idx], tmin: fc.daily.temperature_2m_min[idx], label: weatherLabel(fc.daily.weathercode[idx]) };
    } catch (e) { return null; }
  }
  // Nom d'icône SVG (voir ICONS) correspondant à un code météo WMO.
  function weatherIconName(code) {
    if (code === 0 || code === 1) return 'sun';
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    return 'cloud'; // 2,3 (nuageux) + 45,48 (brouillard) + repli
  }
  // Météo ACTUELLE (conditions du moment) pour une ville/code postal — pour la fiche devis.
  async function fetchCurrentWeather(ville, codePostal) {
    if (!ville && !codePostal) return null;
    try {
      const loc = await geocodeVille(ville, codePostal);
      if (!loc) return null;
      const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&timezone=auto`).then(r => r.json());
      const c = fc && fc.current;
      if (!c) return null;
      return { code: c.weather_code, temp: c.temperature_2m, label: weatherLabel(c.weather_code) };
    } catch (e) { return null; }
  }
  // Météo ACTUELLE à partir de coordonnées GPS (géolocalisation navigateur) — pour le dashboard.
  async function fetchCurrentWeatherByCoords(latitude, longitude) {
    try {
      const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`).then(r => r.json());
      const c = fc && fc.current;
      if (!c) return null;
      return { code: c.weather_code, temp: c.temperature_2m, label: weatherLabel(c.weather_code) };
    } catch (e) { return null; }
  }
  // Géocodage inverse (coordonnées → nom de ville) via BigDataCloud (gratuit, sans clé, CORS ok).
  async function reverseGeocodeCity(latitude, longitude) {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=fr`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.city || d.locality || d.principalSubdivision || null;
    } catch (e) { return null; }
  }

  // Clé d'appariement client (même normalisation que clients.html) — centralisée ici
  // pour que dashboard/vue puissent retrouver une fiche CRM sans la dupliquer.
  function clientKeyOf(prenom, nom) {
    return (String(nom || '').trim() + '|' + String(prenom || '').trim()).toLowerCase().replace(/\s+/g, ' ');
  }

  // Depuis quand un devis est-il dans SON statut actuel (basé sur statut_history,
  // repli sur date_modification pour les devis créés avant l'ajout de l'historique).
  function daysInCurrentStatus(d) {
    const hist = d.statut_history || [];
    let anchor = d.date_modification || d.date_creation;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].statut === d.statut) { anchor = hist[i].date; break; }
    }
    if (!anchor) return 0;
    const ms = Date.now() - new Date(anchor).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }

  // ── Icônes SVG (trait fin, currentColor) — remplace les emojis partout ──
  const ICONS = {
    // Enveloppe et maillon : indispensables aux raccourcis « écrire au client » / « lien espace client ».
    mail:       '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/>',
    link:       '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    route:      '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h5a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5"/>',
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
    chevronright: '<polyline points="9 18 15 12 9 6"/>',
    chevrondown:'<polyline points="6 9 12 15 18 9"/>',
    arrowleft:  '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    sliders:    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    list:       '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    warning:    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    image:      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    phone:      '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
    user:       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    info:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    grid9:      '<circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/>',
    clock:      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    tag:        '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z"/><circle cx="8" cy="8.5" r="1"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    hammer:     '<path d="M14.5 12.5 22 20"/><path d="m18 4-8.5 8.5"/><path d="M6.5 6.5 2 11l5 5 4.5-4.5"/><path d="m2 11 4-4"/>',
    pin:        '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    sparkle:    '<path d="M12 2.6l1.7 4.9a1 1 0 0 0 .6.6l4.9 1.7-4.9 1.7a1 1 0 0 0-.6.6L12 17l-1.7-4.9a1 1 0 0 0-.6-.6L4.8 9.8l4.9-1.7a1 1 0 0 0 .6-.6z"/><path d="M19 15l.6 1.7 1.7.6-1.7.6L19 19.6l-.6-1.7-1.7-.6 1.7-.6z"/>',
    sun:        '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    cloud:      '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    rain:       '<line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>',
    snow:       '<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/>',
    storm:      '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/>',
    eye:        '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    help:       '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    reply:      '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    // ── Familles d'accessoires (catalogue Suppléments) ──
    remote:     '<rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="7" r="1.6"/><line x1="9.5" y1="12" x2="14.5" y2="12"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/><line x1="9.5" y1="19" x2="14.5" y2="19"/>',
    switchbtn:  '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/>',
    sensor:     '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4"/><path d="M16.2 16.2a6 6 0 0 0 0-8.4"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2"/><path d="M19.1 19.1a10 10 0 0 0 0-14.2"/>',
    cable:      '<path d="M4 4v6a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v2"/><line x1="2" y1="4" x2="6" y2="4"/><line x1="18" y1="20" x2="22" y2="20"/>',
    box:        '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5"/><line x1="12" y1="12" x2="12" y2="21"/>',
    motor:      '<rect x="3" y="8" width="13" height="8" rx="1.5"/><path d="M16 10.5h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3z"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="9.5" y1="8" x2="9.5" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/>',
    anchor:     '<path d="M5 5h5v5"/><path d="M5 5v14h14"/><path d="M19 19V9h-5"/>',
  };
  function icon(name, size) {
    const s = size || 16;
    const body = ICONS[name] || '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;flex-shrink:0">' + body + '</svg>';
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     FIL DE COMMENTAIRES — composant PARTAGÉ
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Les notes s'affichaient dans quatre écrans (fiche devis, tableau de bord, CRM, demandes de
     RDV) avec quatre balisages et quatre styles différents : une amélioration devait être
     recopiée quatre fois, et les écarts finissaient toujours par apparaître. Tout passe désormais
     par ce rendu unique — corriger ici corrige partout.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  const CMT_AUTHORS = {
    nicolas: { label: 'Nicolas', ini: 'NI', cls: 'nicolas' },
    yannick: { label: 'Yannick', ini: 'YA', cls: 'yannick' },
    client: { label: 'Client', ini: 'CL', cls: 'client' },
  };
  function commentAuthor(key) {
    const k = String(key || 'nicolas').trim().toLowerCase();
    if (CMT_AUTHORS[k]) return CMT_AUTHORS[k];
    return { label: k ? k.charAt(0).toUpperCase() + k.slice(1) : '—', ini: (k.slice(0, 2) || '—').toUpperCase(), cls: 'autre' };
  }
  /** « 24/07/2026 à 14:32 » — l'heure compte : deux notes du même jour n'ont plus le même repère. */
  function fmtDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso || '');
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' à ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  /** Repère court et lisible : « à l'instant », « il y a 3 h », « hier », « il y a 5 j », puis la date. */
  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return 'il y a ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const j = Math.round(h / 24);
    if (j === 1) return 'hier';
    if (j < 8) return 'il y a ' + j + ' j';
    return fmtDate(iso);
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  /**
   * Une note du fil.
   * @param {object} c    { id, author, text, type, date, visible_client, ask, kind }
   * @param {object} opts { onDelete:'nomDeFonction', onEdit:'nomDeFonction', onReply:'nomDeFonction', compact:true }
   *                      onDelete/onEdit/onReply reçoivent l'id de la note ; omis = bouton absent.
   */
  function commentHtml(c, opts) {
    opts = opts || {};
    const a = commentAuthor(c.author);
    const type = String(c.type || 'note').toLowerCase();
    const chips = [];
    if (type === 'question') chips.push('<span class="ss-cmt-chip q">' + icon('help', 10) + ' question</span>');
    if (type === 'important') chips.push('<span class="ss-cmt-chip i">' + icon('warning', 10) + ' important</span>');
    if (c.visible_client) chips.push('<span class="ss-cmt-chip v">' + icon('eye', 10) + ' vu par le client</span>');
    if (c.kind === 'decision') chips.push('<span class="ss-cmt-chip d">' + icon('check', 10) + ' décision</span>');
    if (c.ask) chips.push('<span class="ss-cmt-chip q">' + icon('clock', 10) + ' réponse attendue de ' + escHtml(commentAuthor(c.ask).label) + '</span>');
    const id = escHtml(c.id || '');
    const del = (opts.onDelete && id)
      ? `<button type="button" class="ss-cmt-del" title="Supprimer cette note" aria-label="Supprimer cette note"
           onclick="event.stopPropagation();${opts.onDelete}('${id}')">${icon('trash', 13)}</button>` : '';
    // Un message du CLIENT n'est jamais modifiable ici — le serveur le refuse aussi (403).
    const mod = (opts.onEdit && id && a.cls !== 'client')
      ? `<button type="button" class="ss-cmt-mod" title="Modifier cette note" aria-label="Modifier cette note"
           onclick="event.stopPropagation();${opts.onEdit}('${id}')">${icon('edit', 13)}</button>` : '';
    // Une note corrigée le dit : sans ce repère, le fil raconterait une version réécrite de l'histoire.
    const retouche = c.edited
      ? `<span class="ss-cmt-maj" title="Modifiée le ${escHtml(fmtDateTime(c.edited))}">modifiée</span>` : '';
    const rep = (opts.onReply && a.cls === 'client')
      ? `<button type="button" class="ss-cmt-reply" onclick="event.stopPropagation();${opts.onReply}('${id}')">${icon('reply', 12)} Répondre au client</button>` : '';
    // Réponse INTERNE (Nicolas ↔ Yannick). Distincte de « Répondre au client » ci-dessus, qui
    // publie la réponse dans l'espace client — les deux ne s'affichent jamais sur la même note.
    const repInterne = (opts.onReplyNote && id && a.cls !== 'client')
      ? `<button type="button" class="ss-cmt-reply" onclick="event.stopPropagation();${opts.onReplyNote}('${id}')">${icon('reply', 12)} Répondre</button>` : '';
    // Citation du message auquel on répond. `opts.parents` est la table id → note construite par
    // commentsHtml : on relit le texte d'origine à CHAQUE affichage plutôt que de le recopier au
    // moment de la réponse, pour qu'une note modifiée ou supprimée ne laisse pas une citation
    // mensongère dans le fil.
    let cite = '';
    if (c.reply_to) {
      const p = opts.parents && opts.parents[c.reply_to];
      cite = p
        ? `<button type="button" class="ss-cmt-quote" onclick="event.stopPropagation();window.SSUI.gotoComment('${escHtml(c.reply_to)}')"
             title="Aller au message d'origine">${icon('reply', 11)} <b>${escHtml(commentAuthor(p.author).label)}</b> ${escHtml(String(p.text || '').replace(/\s+/g, ' ').slice(0, 90))}${String(p.text || '').length > 90 ? '…' : ''}</button>`
        : `<span class="ss-cmt-quote is-gone">${icon('reply', 11)} message d’origine supprimé</span>`;
    }
    return `<div class="ss-cmt ${a.cls === 'client' ? 'is-client' : ''} ${type === 'important' ? 'is-important' : ''} ${type === 'question' ? 'is-question' : ''} ${c.reply_to ? 'is-reply' : ''}"
                 data-cmt-id="${id}">
      <span class="ss-cmt-av ${a.cls}" aria-hidden="true">${a.ini}</span>
      <div class="ss-cmt-main">
        <div class="ss-cmt-head">
          <span class="ss-cmt-who">${escHtml(a.label)}</span>
          ${chips.join('')}
          ${retouche}
          <time class="ss-cmt-when" title="${escHtml(fmtDateTime(c.date))}">${escHtml(relTime(c.date))}</time>
          ${mod}${del}
        </div>
        ${cite}
        <div class="ss-cmt-text">${escHtml(c.text)}</div>
        ${rep}${repInterne}
      </div>
    </div>`;
  }
  /** Amène le message d'origine à l'écran et le souligne brièvement (clic sur une citation). */
  function gotoComment(id) {
    const e = document.querySelector('[data-cmt-id="' + String(id).replace(/"/g, '') + '"]');
    if (!e) return;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    e.classList.add('ss-cmt-flash');
    setTimeout(() => e.classList.remove('ss-cmt-flash'), 1600);
  }
  /** Le fil complet, du plus ancien au plus récent (sens de lecture d'une conversation). */
  function commentsHtml(list, opts) {
    opts = opts || {};
    const arr = (list || []).slice().sort((x, y) => String(x.date).localeCompare(String(y.date)));
    // `empty: ''` (chaîne vide) = n'affiche RIEN, volontairement. Le `||` d'origine retombait sur
    // le texte par défaut puisqu'une chaîne vide est « falsy » — un appelant ne pouvait donc pas
    // choisir le silence. On distingue maintenant « non précisé » (défaut) de « vide » (rien).
    if (!arr.length) {
      const txt = opts.empty === undefined ? 'Aucune note pour l’instant.' : String(opts.empty);
      return txt ? `<div class="ss-cmt-empty">${escHtml(txt)}</div>` : '';
    }
    // Table des messages d'origine, pour que chaque réponse puisse citer le sien. On garde l'ordre
    // CHRONOLOGIQUE (pas d'arborescence) : le fil reste un journal de chantier qui se lit de haut
    // en bas, et la citation suffit à rattacher visuellement une réponse à son message.
    const parents = {};
    arr.forEach(c => { if (c.id) parents[c.id] = c; });
    const o = Object.assign({}, opts, { parents });
    return arr.map(c => commentHtml(c, o)).join('');
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     ÉCHANGES E-MAIL ARCHIVÉS SUR LA FICHE CLIENT
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Nicolas colle un mail brut, l'outil en déduit tout seul l'expéditeur, l'objet, la date et le
     SENS de l'échange. Le pari : si archiver demande de remplir cinq champs, personne ne le fait
     au bout de trois semaines. Un collage, un bouton — c'est tout.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  // Nos propres adresses : elles servent à deviner si le mail a été REÇU du client ou ENVOYÉ.
  function nosAdresses() {
    const co = window.SS_COMPANY || {};
    const l = [co.email, co.email2, 'info@solariscreen.be', 'service@solariscreen.be']
      .filter(Boolean).join(' ').toLowerCase();
    return l.split(/[\s,;]+/).filter(x => x.indexOf('@') > 0);
  }
  /**
   * Analyse un mail collé : reconnaît les en-têtes Outlook et Gmail, en français comme en anglais.
   * Tolérant par construction — tout ce qu'il ne comprend pas reste simplement dans le corps.
   * @returns { de, objet, date_mail, sens, texte }
   */
  function parseMail(brut) {
    const src = String(brut == null ? '' : brut).replace(/\r\n/g, '\n');
    const lignes = src.split('\n');
    const res = { de: '', objet: '', date_mail: '', sens: '', texte: src.trim() };
    const MOTIFS = [
      { champ: 'de', re: /^\s*(?:de|from|exp[ée]diteur)\s*:\s*(.+)$/i },
      { champ: 'objet', re: /^\s*(?:objet|subject|sujet)\s*:\s*(.+)$/i },
      { champ: 'date_mail', re: /^\s*(?:envoy[ée]|sent|date|re[çc]u\s+le)\s*:\s*(.+)$/i },
    ];
    // On ne cherche les en-têtes que dans les 25 premières lignes : au-delà, c'est du corps de
    // message (une citation « De : … » plus bas ne doit pas écraser l'expéditeur réel).
    let derniereEntete = -1;
    const limite = Math.min(lignes.length, 25);
    for (let i = 0; i < limite; i++) {
      for (const m of MOTIFS) {
        const r = lignes[i].match(m.re);
        if (r && !res[m.champ]) { res[m.champ] = r[1].trim(); derniereEntete = i; }
      }
    }
    // Format Gmail : « Le mar. 29 juil. 2026 à 14:32, Jean Dupont <jean@x.be> a écrit : »
    if (!res.de) {
      for (let i = 0; i < limite; i++) {
        const g = lignes[i].match(/^\s*Le\s+(.{6,60}?),\s*(.+?)\s*a\s+écrit\s*:/i);
        if (g) { res.date_mail = res.date_mail || g[1].trim(); res.de = g[2].trim(); derniereEntete = Math.max(derniereEntete, i); break; }
      }
    }
    // À défaut d'en-tête « De : », on prend la première adresse e-mail rencontrée.
    if (!res.de) {
      const a = src.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (a) res.de = a[0];
    }
    // Sens : si l'expéditeur est l'une de nos adresses, c'est nous qui avons écrit.
    const deBas = res.de.toLowerCase();
    res.sens = nosAdresses().some(a => deBas.indexOf(a) >= 0) ? 'envoye' : 'recu';
    // On retire le bloc d'en-têtes reconnu EN TÊTE du message : il est déjà affiché proprement
    // au-dessus de la carte, le répéter dans le corps ne fait qu'ajouter du bruit.
    if (derniereEntete >= 0) {
      const reste = lignes.slice(derniereEntete + 1).join('\n').trim();
      if (reste) res.texte = reste;
    }
    return res;
  }
  const MAIL_SENS = {
    recu: { label: 'Reçu du client', court: 'Reçu', cls: 'recu', ic: 'download' },
    envoye: { label: 'Envoyé au client', court: 'Envoyé', cls: 'envoye', ic: 'upload' },
  };
  /**
   * Une carte d'échange. `opts.onDelete` / `opts.onOpenDevis` reçoivent l'id ; omis = pas de bouton.
   * `opts.devisLabel(id)` permet d'afficher « devis #… » avec le libellé de l'appelant.
   */
  function mailHtml(m, opts) {
    opts = opts || {};
    const s = MAIL_SENS[m.sens === 'envoye' ? 'envoye' : 'recu'];
    const id = escHtml(m.id || '');
    const quand = m.date_mail ? escHtml(m.date_mail) : relTime(m.date);
    const del = (opts.onDelete && id)
      ? `<button type="button" class="ss-mail-del" title="Supprimer cet échange" aria-label="Supprimer cet échange"
           onclick="event.stopPropagation();${opts.onDelete}('${id}')">${icon('trash', 13)}</button>` : '';
    const devis = (m.devis_id && opts.onOpenDevis)
      ? `<button type="button" class="ss-mail-devis" title="Ouvrir le devis rattaché"
           onclick="event.stopPropagation();${opts.onOpenDevis}('${escHtml(m.devis_id)}')">${icon('filetext', 10)} devis #${escHtml(m.devis_id)}</button>`
      : (m.devis_id ? `<span class="ss-mail-devis">${icon('filetext', 10)} devis #${escHtml(m.devis_id)}</span>` : '');
    return `<article class="ss-mail ${s.cls}">
      <header class="ss-mail-head">
        <span class="ss-mail-sens">${icon(s.ic, 11)} ${s.court}</span>
        <span class="ss-mail-objet" title="${escHtml(m.objet || '(sans objet)')}">${escHtml(m.objet || '(sans objet)')}</span>
        <time class="ss-mail-date" title="Archivé le ${escHtml(fmtDateTime(m.date))}">${quand}</time>
        ${del}
      </header>
      <div class="ss-mail-meta">${m.de ? escHtml(m.de) : 'expéditeur inconnu'} · archivé par ${escHtml(commentAuthor(m.par).label)}${devis ? ' · ' + devis : ''}</div>
      <div class="ss-mail-corps">${escHtml(m.texte)}</div>
      <button type="button" class="ss-mail-plus" onclick="this.previousElementSibling.classList.toggle('ouvert');this.textContent=this.previousElementSibling.classList.contains('ouvert')?'Replier':'Tout afficher';">Tout afficher</button>
    </article>`;
  }
  /** Le fil complet — du plus RÉCENT au plus ancien : sur un échange, c'est le dernier qui compte. */
  function mailsHtml(list, opts) {
    opts = opts || {};
    const arr = (list || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!arr.length) return `<div class="ss-cmt-empty">${escHtml(opts.empty || 'Aucun échange archivé pour l’instant.')}</div>`;
    return arr.map(m => mailHtml(m, opts)).join('');
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     NUANCIER RAL — champ couleur PARTAGÉ (simulateur PC + Mode Terrain)
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Taper « 7016 » sans voir la teinte oblige à rouvrir le nuancier papier à chaque devis.
     Le champ affiche donc une pastille de la couleur + son nom en clair, et un bouton ouvre
     le nuancier Harol complet (111 coloris du BR_Coloris 2026) avec recherche.
     La saisie libre reste entière : un RAL hors nuancier Harol s'écrit à la main et reçoit
     quand même sa pastille — la table couvre les 213 RAL Classic.
     Le rendu initial peint la pastille directement dans le HTML : aucun écran n'a besoin de
     « réveiller » le composant après un re-rendu, seules les MODIFICATIONS passent par les
     écouteurs délégués ci-dessous.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  function ralApercu(v) {
    const P = window.SSProducts;
    if (!P || !P.ralCode) return { hex: null, nom: '', code: null, harol: false };
    const code = P.ralCode(v);
    return { hex: code ? P.ralHex(v) : null, nom: code ? P.ralNom(v) : '', code: code, harol: !!(code && P.ralHarol(v)) };
  }
  /** Pastille + légende — recalculées à l'identique au rendu et à la frappe. */
  function ralSwAttrs(a) {
    return a.hex ? ' style="--ral:' + a.hex + '"' : ' data-vide="1"';
  }
  function ralNoteTexte(a, saisie) {
    if (!String(saisie || '').trim()) return 'Aucune couleur choisie';
    if (!a.code) return 'Référence libre — pas de RAL reconnu';
    return a.nom + (a.harol ? '' : ' — hors nuancier Harol');
  }
  /**
   * @param o {f, label, value, placeholder, span} — `f` alimente data-f, donc la collecte
   *          des écrans reste strictement inchangée (le champ RESTE un <input> simple).
   */
  function ralFieldHtml(o) {
    const v = o.value || '';
    const a = ralApercu(v);
    return '<div class="field ral-field"' + (o.span ? ' style="grid-column:span ' + o.span + ';"' : '') + '>' +
      '<label class="label">' + escHtml(o.label || 'Couleur (RAL)') + '</label>' +
      '<div class="ral-row">' +
        '<span class="ral-sw" data-ral-sw' + ralSwAttrs(a) + ' aria-hidden="true"></span>' +
        '<input class="input ral-input" data-ral data-f="' + escHtml(o.f) + '" list="dl-couleurs" value="' + escHtml(v) + '"' +
          ' placeholder="' + escHtml(o.placeholder || 'Ex: 7016 — Gris anthracite') + '">' +
        '<button type="button" class="ral-open" data-ral-open title="Ouvrir le nuancier Harol" aria-label="Ouvrir le nuancier Harol">' + icon('grid', 15) + '</button>' +
      '</div>' +
      '<div class="ral-note" data-ral-note>' + escHtml(ralNoteTexte(a, v)) + '</div>' +
    '</div>';
  }
  function ralMajChamp(input) {
    const champ = input.closest('.ral-field'); if (!champ) return;
    const a = ralApercu(input.value);
    const sw = champ.querySelector('[data-ral-sw]');
    const note = champ.querySelector('[data-ral-note]');
    if (sw) {
      if (a.hex) { sw.style.setProperty('--ral', a.hex); sw.removeAttribute('data-vide'); }
      else { sw.style.removeProperty('--ral'); sw.setAttribute('data-vide', '1'); }
    }
    if (note) note.textContent = ralNoteTexte(a, input.value);
  }
  document.addEventListener('input', e => {
    if (e.target && e.target.matches && e.target.matches('[data-ral]')) ralMajChamp(e.target);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ral-open]');
    if (!b) return;
    const input = b.closest('.ral-field').querySelector('[data-ral]');
    if (input) ouvrirNuancier(input);
  });

  let _ralModal = null, _ralCible = null, _ralDetail = null;
  /** Une ligne de RÉFÉRENCE : c'est elle qui porte le code de commande Harol. */
  function refHtml(c) {
    const P = window.SSProducts;
    const secs = (c.sections || []).map(s => P.SECTION_L[s]).filter(Boolean);
    return '<button type="button" class="ral-ref" data-ral-ref="' + c.i + '">' +
      '<span class="sw"' + (c.hex ? ' style="--ral:' + c.hex + '"' : ' data-vide="1"') + '></span>' +
      '<span class="rf-tx">' +
        '<span class="rf-l1"><b>' + escHtml(c.cmds[0]) + '</b>' +
          (c.cmds.length > 1 ? '<span class="rf-alt">' + escHtml(c.cmds.slice(1).join(' · ')) + '</span>' : '') + '</span>' +
        '<span class="rf-l2">' + escHtml(c.code) + (/^\d{4}$/.test(c.code) ? ' ' + escHtml(c.nom) : '') +
          ' — ' + escHtml(c.desc) + '</span>' +
      '</span>' +
      '<span class="rf-meta"><span class="rf-fin f-' + c.finCode + '">' + escHtml(c.finition) + '</span>' +
        '<span class="rf-cl">classe ' + c.classe + '</span>' +
        (secs.length ? '<span class="rf-sec" title="' + escHtml(secs.join(' · ')) + '">' + escHtml(secs.map(x => x.split(' ')[0]).join(' · ')) + '</span>' : '') +
        (c.poudre ? '<span class="rf-pd" title="Code de poudre">' + escHtml(c.poudre) + '</span>' : '') +
      '</span></button>';
  }
  function ralCellules(q) {
    const P = window.SSProducts; if (!P) return '';
    const req = String(q || '').trim();

    // ── Recherche : elle porte sur TOUT (code couleur, code de commande, nom, finition,
    //    classe, code de poudre) et rend directement les RÉFÉRENCES, pas les couleurs :
    //    c'est ainsi qu'un « 9T07 » tapé au clavier tombe sur sa ligne. ──
    if (req && P.chercheColoris) {
      const res = P.chercheColoris(req);
      if (!res.length) {
        return '<div class="ral-vide">Rien ne correspond à « ' + escHtml(req) + ' » dans le nuancier Harol.<br>' +
          'Tu peux quand même écrire la référence à la main dans le champ — elle sera reprise telle quelle sur le devis.</div>';
      }
      return '<div class="ral-sep">' + res.length + ' référence' + (res.length > 1 ? 's' : '') + ' — cliquer pour choisir</div>' +
        '<div class="ral-refs">' + res.map(refHtml).join('') + '</div>';
    }

    // ── Détail d'une couleur : toutes ses références (satiné / mat / laque texturée…) ──
    if (_ralDetail && P.colorisDuCode) {
      const refs = P.colorisDuCode(_ralDetail);
      const e = P.RAL_TABLE[_ralDetail];
      const titre = _ralDetail + (e ? ' — ' + e[0] : '');
      return '<button type="button" class="ral-retour" data-ral-retour>' + icon('arrowleft', 13) + ' Toutes les couleurs</button>' +
        '<div class="ral-sep">' + escHtml(titre) + ' — ' + refs.length + ' référence' + (refs.length > 1 ? 's' : '') + '</div>' +
        '<div class="ral-refs">' + refs.map(refHtml).join('') + '</div>';
    }

    // ── Vue par défaut : la grille de couleurs ──
    const cur = _ralCible ? P.ralCode(_ralCible.value) : null;
    const cell = c => {
      const e = P.RAL_TABLE[c];
      const n = P.colorisDuCode ? P.colorisDuCode(c).length : 0;
      return '<button type="button" class="ral-cell' + (c === cur ? ' on' : '') + '" data-ral-pick="' + c + '"' +
        ' title="' + escHtml(c + ' ' + e[0] + (n ? ' — ' + n + ' référence(s) Harol' : '')) + '">' +
        '<span class="sw"' + (e[1] ? ' style="--ral:' + e[1] + '"' : ' data-vide="1"') + '></span>' +
        '<span class="tx"><span class="cd">' + c + (n ? '<i>' + n + '</i>' : '') + '</span>' +
        '<span class="nm">' + escHtml(e[0]) + '</span></span></button>';
    };
    const harol = P.ralListeHarol();
    const autres = Object.keys(P.RAL_TABLE).filter(c => harol.indexOf(c) < 0).sort();
    const familles = P.colorisCodes ? P.colorisCodes().filter(c => !P.RAL_TABLE[c]) : [];
    let h = '<div class="ral-sep">Nuancier Harol — ' + harol.length + ' couleurs, ' +
      (window.SSProducts.HAROL_COLORIS || []).length + ' références</div><div class="ral-grid">' + harol.map(cell).join('') + '</div>';
    if (familles.length) {
      h += '<div class="ral-sep">Familles hors RAL (aucune teinte à afficher)</div><div class="ral-refs">' +
        familles.map(f => '<button type="button" class="ral-ref" data-ral-pick="' + escHtml(f) + '">' +
          '<span class="sw" data-vide="1"></span><span class="rf-tx"><span class="rf-l1"><b>' + escHtml(f) + '</b></span>' +
          '<span class="rf-l2">' + P.colorisDuCode(f).length + ' référence(s)</span></span></button>').join('') + '</div>';
    }
    if (autres.length) h += '<div class="ral-sep">Autres RAL Classic — hors nuancier Harol, à confirmer (supplément possible)</div><div class="ral-grid">' + autres.map(cell).join('') + '</div>';
    return h;
  }
  function ouvrirNuancier(input) {
    _ralCible = input;
    if (!_ralModal) {
      _ralModal = document.createElement('div');
      _ralModal.className = 'ral-modal';
      _ralModal.innerHTML =
        '<div class="ral-panel" role="dialog" aria-modal="true" aria-label="Nuancier RAL">' +
          '<div class="ral-head"><span class="ral-title">Nuancier</span>' +
            '<button type="button" class="ral-x" data-ral-close aria-label="Fermer">' + icon('x', 16) + '</button></div>' +
          '<div class="ral-search"><input class="input" id="ralQ" placeholder="Chercher : 7016, anthracite, 9T07, mat, classe 2…" autocomplete="off"></div>' +
          '<div class="ral-body"></div>' +
          '<div class="ral-foot">Teintes indicatives (rendu écran) — le nuancier physique Harol fait foi. Le <b>code de commande</b> affiché est celui à reprendre sur le portail Harol.</div>' +
        '</div>';
      document.body.appendChild(_ralModal);
      const remplir = (valeur) => {
        _ralCible.value = valeur;
        ralMajChamp(_ralCible);
        _ralCible.dispatchEvent(new Event('input', { bubbles: true }));
        _ralCible.dispatchEvent(new Event('change', { bubbles: true }));
        fermerNuancier();
      };
      _ralModal.addEventListener('click', ev => {
        if (ev.target === _ralModal || ev.target.closest('[data-ral-close]')) return fermerNuancier();
        const P = window.SSProducts;
        if (ev.target.closest('[data-ral-retour]')) { _ralDetail = null; return majNuancier(); }
        // Une RÉFÉRENCE : on remplit avec son code de commande — c'est ce qu'on tape chez Harol.
        const r = ev.target.closest('[data-ral-ref]');
        if (r && _ralCible) return remplir(P.colorisLabel(P.coloris(+r.getAttribute('data-ral-ref'))));
        // Une COULEUR : on ouvre le détail de ses finitions, sauf s'il n'y en a qu'une seule.
        const p = ev.target.closest('[data-ral-pick]');
        if (p && _ralCible) {
          const code = p.getAttribute('data-ral-pick');
          const refs = (P.colorisDuCode ? P.colorisDuCode(code) : []);
          if (refs.length === 1) return remplir(P.colorisLabel(refs[0]));
          if (refs.length > 1) { _ralDetail = code; return majNuancier(); }
          return remplir(P.ralLabel(code));   // RAL hors nuancier Harol : aucune référence
        }
      });
      _ralModal.querySelector('#ralQ').addEventListener('input', ev => {
        if (ev.target.value.trim()) _ralDetail = null;   // une recherche sort de la vue détail
        majNuancier();
      });
      document.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && _ralModal && _ralModal.classList.contains('open')) fermerNuancier();
      });
    }
    _ralModal.querySelector('#ralQ').value = '';
    _ralDetail = null;
    majNuancier();
    _ralModal.classList.add('open');
    // Sur mobile on NE met PAS le focus dans la recherche : le clavier mangerait la moitié
    // du nuancier alors que l'usage courant est de taper directement sur une pastille.
    if (window.innerWidth > 720) setTimeout(() => _ralModal.querySelector('#ralQ').focus(), 30);
  }
  function majNuancier() {
    if (!_ralModal) return;
    const corps = _ralModal.querySelector('.ral-body');
    corps.innerHTML = ralCellules(_ralModal.querySelector('#ralQ').value);
    corps.scrollTop = 0;
  }
  function fermerNuancier() { if (_ralModal) _ralModal.classList.remove('open'); _ralCible = null; _ralDetail = null; }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     CATALOGUE D'ACCESSOIRES — sélecteur PARTAGÉ
     ═══════════════════════════════════════════════════════════════════════════════════════════
     149 références : une liste déroulante devenait illisible. Recherche + filtre par famille +
     vignette produit. La vignette est cherchée dans assets/img/acc/ ; tant qu'un visuel manque,
     l'icône de la famille tient la place — la mise en page ne bouge pas quand on en ajoute un.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  const ACC_ICONS = {
    'Télécommande': 'remote', 'Interrupteur': 'switchbtn', 'Capteur': 'sensor', 'Câble': 'cable',
    'Récepteur / box': 'box', 'Moteur': 'motor', 'Horloge': 'clock', 'Solaire': 'sun',
    'Fixation': 'anchor', 'Accessoire de finition': 'grid', 'Divers': 'tag',
  };
  /** Visuel produit : nom de fichier déduit de la marque/gamme citée dans le libellé. */
  // Une entrée par visuel RÉELLEMENT présent dans assets/img/acc/ : une entrée sans fichier
  // déclencherait une requête 404 par ligne affichée. Ajouter un visuel = déposer le PNG
  // (120 px, fond blanc) et ajouter sa ligne ici.
  const ACC_VISUELS = [
    [/\bsituo\b/i, 'situo'], [/\bsmoove\b/i, 'smoove'], [/\bnina\b/i, 'nina'], [/\bamy\b/i, 'amy'],
    [/\beolis\b/i, 'eolis'], [/\bsoliris\b/i, 'soliris'], [/\bysia\b/i, 'ysia'], [/\bsunis\b/i, 'sunis'],
    [/\btahoma\b/i, 'tahoma'], [/connexoon|connectivity kit/i, 'connexoon'],
    [/\bchronis\b/i, 'chronis'], [/\bthermis\b/i, 'thermis'],
    [/\btelis\b/i, 'telis'], [/\bkeytis\b/i, 'keytis'],
    [/sunea|maestria|altea/i, 'sunea'],
  ];
  function accVisuel(label) {
    const t = String(label || '');
    for (const [re, f] of ACC_VISUELS) if (re.test(t)) return '../assets/img/acc/' + f + '.png';
    return null;
  }
  function accVignetteHtml(o) {
    const img = accVisuel(o.label);
    const ic = icon(ACC_ICONS[o.cat] || 'tag', 20);
    // onerror : si le visuel n'a pas encore été ajouté, on retombe sur l'icône de famille
    // au lieu d'afficher une image cassée.
    return '<span class="acc-vig">' + (img
      ? '<img src="' + img + '" alt="" loading="lazy" onerror="this.replaceWith(this.nextElementSibling||document.createComment(1))"><span class="acc-ic">' + ic + '</span>'
      : '<span class="acc-ic">' + ic + '</span>') + '</span>';
  }

  let _accModal = null, _accCb = null, _accCat = '';
  function accListeHtml(q) {
    const P = window.SSProducts; if (!P || !P.chercheAccessoires) return '';
    const res = P.chercheAccessoires(q, _accCat);
    if (!res.length) return '<div class="acc-vide">Aucun accessoire ne correspond. Le bouton « Ajouter un supplément (libre) » reste disponible pour tout ce qui n\'est pas au tarif.</div>';
    return '<div class="acc-liste">' + res.map(o =>
      '<button type="button" class="acc-row" data-acc="' + escHtml(o.ref || o.label) + '">' +
        accVignetteHtml(o) +
        '<span class="acc-tx"><span class="acc-lbl">' + escHtml(o.label) + '</span>' +
        '<span class="acc-meta">' + escHtml(o.cat) + (o.ref ? ' · réf. ' + escHtml(o.ref) : '') + '</span></span>' +
        '<span class="acc-prix">' + fmtEur(o.price) + '</span>' +
      '</button>').join('') + '</div>';
  }
  function accChipsHtml() {
    const P = window.SSProducts; if (!P || !P.CATALOG_CATS) return '';
    return ['', ...P.CATALOG_CATS].map(c =>
      '<button type="button" class="acc-chip' + (c === _accCat ? ' on' : '') + '" data-acc-cat="' + escHtml(c) + '">' +
      (c || 'Toutes') + '</button>').join('');
  }
  function accRafraichir() {
    _accModal.querySelector('.ral-body').innerHTML = accListeHtml(_accModal.querySelector('#accQ').value);
    _accModal.querySelector('.acc-chips').innerHTML = accChipsHtml();
  }
  /** @param onPick fonction appelée avec l'accessoire choisi ({label, price, ref, cat}) */
  function ouvrirCatalogue(onPick) {
    _accCb = onPick; _accCat = '';
    if (!_accModal) {
      _accModal = document.createElement('div');
      _accModal.className = 'ral-modal acc-modal';
      _accModal.innerHTML =
        '<div class="ral-panel" role="dialog" aria-modal="true" aria-label="Catalogue d\'accessoires">' +
          '<div class="ral-head"><span class="ral-title">Accessoires — tarif Harol</span>' +
            '<button type="button" class="ral-x" data-acc-close aria-label="Fermer">' + icon('x', 16) + '</button></div>' +
          '<div class="ral-search"><input class="input" id="accQ" placeholder="Chercher : situo, capteur vent, 068558…" autocomplete="off">' +
            '<div class="acc-chips"></div></div>' +
          '<div class="ral-body"></div>' +
          '<div class="ral-foot">Prix d\'achat HTVA au tarif Harol 03/2026 — la marge s\'applique ensuite comme sur un supplément libre.</div>' +
        '</div>';
      document.body.appendChild(_accModal);
      _accModal.addEventListener('click', ev => {
        if (ev.target === _accModal || ev.target.closest('[data-acc-close]')) return fermerCatalogue();
        const chip = ev.target.closest('[data-acc-cat]');
        if (chip) { _accCat = chip.getAttribute('data-acc-cat'); return accRafraichir(); }
        const row = ev.target.closest('[data-acc]');
        if (row && _accCb) {
          const cle = row.getAttribute('data-acc');
          const o = window.SSProducts.CATALOG_OPTIONS.find(x => (x.ref || x.label) === cle);
          if (o) _accCb(o);
          fermerCatalogue();
        }
      });
      _accModal.querySelector('#accQ').addEventListener('input', () => accRafraichir());
      document.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && _accModal && _accModal.classList.contains('open')) fermerCatalogue();
      });
    }
    _accModal.querySelector('#accQ').value = '';
    accRafraichir();
    _accModal.classList.add('open');
    if (window.innerWidth > 720) setTimeout(() => _accModal.querySelector('#accQ').focus(), 30);
  }
  function fermerCatalogue() { if (_accModal) _accModal.classList.remove('open'); _accCb = null; }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     CADENCE DE RELANCE — source UNIQUE
     ═══════════════════════════════════════════════════════════════════════════════════════════
     La même cadence était implémentée DEUX FOIS : dans la fiche devis et dans le tableau de
     bord. Tant que les deux copies étaient identiques, tout allait bien — mais elles sont
     déployées dans des fichiers séparés. Une mise en ligne partielle (fiche à jour, tableau de
     bord resté en arrière) suffisait à ce que la fiche affiche « R1 ✓ » pendant que le tableau
     de bord réclamait encore « Relance 1 à envoyer ». Symptôme incompréhensible côté utilisateur,
     et impossible à reproduire en local puisque le local, lui, était cohérent.
     Le calcul vit désormais ICI seulement : les deux écrans ne PEUVENT plus se contredire.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  // Devis informatif : J+5 / J+12 / J+21 · devis après visite : J+4 / J+9 / J+21.
  // Cadence par défaut. Réglable (Paramètres → Utilisation) : elle dépend de la façon de
  // travailler, pas d'une vérité technique. On relit les réglages À CHAQUE appel plutôt que de
  // figer au chargement — une cadence modifiée doit s'appliquer sans recharger toutes les pages.
  const RELANCE_PLAN_DEFAUT = {
    informatif: [{ n: 1, j: 5 }, { n: 2, j: 12 }, { n: 3, j: 21 }],
    visite: [{ n: 1, j: 4 }, { n: 2, j: 9 }, { n: 3, j: 21 }],
  };
  function planRelance(kind) {
    const conf = window.SSConf && window.SSConf.get();
    const jours = conf && conf.usage && (kind === 'informatif' ? conf.usage.relance_informatif : conf.usage.relance_visite);
    if (!Array.isArray(jours) || jours.length !== 3) return RELANCE_PLAN_DEFAUT[kind];
    return jours.map((j, i) => ({ n: i + 1, j: Number(j) }));
  }
  const RELANCE_PLAN = RELANCE_PLAN_DEFAUT;   // conservé : d'anciens appels le lisent directement
  // Le statut « Relance 1 / 2 » vaut relance faite : c'est la façon la plus naturelle de la
  // noter, et l'ignorer faisait réclamer indéfiniment la même relance.
  const STATUT_RELANCE_N = { relance_1: 1, relance_2: 2 };
  const STATUT_RANK = { envoye_client: 0, relance_1: 1, relance_2: 2 };
  const jour = iso => String(iso || '').slice(0, 10);
  function joursEntre(de, a) { return Math.round((new Date(a + 'T00:00:00Z') - new Date(de + 'T00:00:00Z')) / 86400000); }
  function plusJours(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  /**
   * Date d'envoi de référence : valeur saisie > 1er passage à « envoyé » > date de création.
   * ⚠️ JAMAIS `date_modification` : elle change à chaque édition (et à l'enregistrement d'une
   * relance) — la cadence se réinitialiserait toute seule.
   */
  function dateEnvoiOf(d) {
    if (d.date_envoi) return jour(d.date_envoi);
    const h = (d.statut_history || []).filter(x => x.statut === 'envoye_client').map(x => x.date).sort();
    if (h.length) return jour(h[0]);
    return jour(d.date_creation || d.date_modification);
  }
  /** État complet de la cadence : ce qui est fait, ce qui est dû, et quand. */
  function relanceEtat(d) {
    const kind = d && d.informatif ? 'informatif' : 'visite';
    const plan = planRelance(kind);
    const envoi = dateEnvoiOf(d || {});
    const today = new Date().toISOString().slice(0, 10);
    const done = ((d && d.relances) || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
    let doneMax = done.reduce((m, r) => Math.max(m, r.n || 0), 0);
    // Plancher par le statut : un devis marqué « Relance 2 » a forcément vu partir R1 et R2.
    // Purement calculé à l'affichage — aucune écriture, donc les dossiers déjà bloqués se
    // débloquent d'eux-mêmes à la première ouverture.
    const nStatut = STATUT_RELANCE_N[d && d.statut] || 0;
    for (let i = doneMax + 1; i <= nStatut; i++) done.push({ n: i, date: null, implied: true });
    doneMax = Math.max(doneMax, nStatut);
    const step = plan.find(s => s.n === doneMax + 1) || null;   // null = les 3 relances sont faites
    const due = step && envoi ? plusJours(envoi, step.j) : null;
    return {
      kind: kind, plan: plan, envoi: envoi, today: today, done: done, doneMax: doneMax, step: step,
      jours: envoi ? joursEntre(envoi, today) : 0,
      due: due,
      retard: !!(step && due && due <= today),
      joursRetard: (step && due) ? joursEntre(due, today) : 0,
      epuise: !step,
    };
  }
  function relancesFaites(d) { return relanceEtat(d).doneMax; }
  function relanceDue(d) { return relanceEtat(d).retard; }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     CE QUI RESTE DÛ SUR UNE FACTURE — définition UNIQUE, partagée
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Trois écrans calculaient l'argent dû chacun de leur côté (facturation, statistiques, tableau
     de bord). En ajoutant les notes de crédit, la même erreur serait apparue aux trois endroits :
     une facture annulée continuait d'être réclamée. La règle vit donc ici, une fois.
     Une note de crédit porte un total NÉGATIF et n'est jamais « due » elle-même ; elle éteint la
     facture qu'elle désigne (`avoir_de`). */
  function paiementsSum(f) { return ((f && f.paiements) || []).reduce((s, p) => s + (Number(p.montant) || 0), 0); }
  function avoirsSur(factures, id) {
    return (factures || [])
      .filter(f => f && f.type === 'avoir' && f.avoir_de === id)
      .reduce((s, f) => s + Math.abs(Number(f.total_ttc) || 0), 0);
  }
  /** Montant encore réclamable sur cette facture, notes de crédit déduites. 0 pour un avoir. */
  function duFacture(f, factures) {
    if (!f || f.type === 'avoir') return 0;
    const reste = (Number(f.total_ttc) || 0) - paiementsSum(f) - avoirsSur(factures, f.id);
    return Math.max(0, Math.round(reste * 100) / 100);
  }
  /** Facture éteinte par une (ou plusieurs) note(s) de crédit : elle ne se réclame plus. */
  function factureAnnulee(f, factures) {
    if (!f || f.type === 'avoir') return false;
    return avoirsSur(factures, f.id) >= (Number(f.total_ttc) || 0) - 0.005;
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     CHAMPS MANQUANTS — signalés du tableau de bord jusqu'à la fiche
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Une toile ou un RAL oublié pendant la visite ne se remarquait qu'au moment de passer la
     commande chez Harol — c'est-à-dire trop tard. Le même calcul (SSProducts.champsManquants)
     alimente désormais le tableau de bord, la fiche devis et le Mode Terrain : un seul endroit
     décide de ce qui est « bloquant », donc les trois écrans ne peuvent pas se contredire.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  /** @returns [{ i, type, emplacement, manque: [{k,l}] }] — une entrée par ouverture incomplète. */
  function manquantsDevis(d) {
    const P = window.SSProducts;
    if (!d || !P || !P.champsManquants) return [];
    // `items` sur une fiche complète, `items_min` dans une liste (le tableau de bord ne charge
    // jamais les items entiers — ils contiennent les photos).
    const src = (d.items && d.items.length) ? d.items : (d.items_min || []);
    return src.map((it, i) => ({
      i: i, type: it.type, emplacement: it.emplacement || '',
      manque: P.champsManquants(it),
    })).filter(x => x.manque.length);
  }
  function nbManquants(d) { return manquantsDevis(d).reduce((s, x) => s + x.manque.length, 0); }
  /** Pastille compacte pour une liste (tableau de bord). Rien à signaler → chaîne vide. */
  function badgeManquants(d) {
    const n = nbManquants(d);
    if (!n) return '';
    // Le libellé est isolé dans un <span> pour que le téléphone puisse n'afficher que
    // « ⚠ 3 » (voir dashboard.html) : sur une ligne de liste, ces mots mangeaient la moitié
    // de la place du nom du client. Le sens reste porté par la couleur et l'infobulle.
    return '<span class="badge badge-warn" title="Informations manquantes pour commander">' +
      icon('warning', 11) + ' ' + n + '<span class="bm-txt"> à compléter</span></span>';
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════════
     MÉMOIRE DE SAISIE — suggestions apprises au fil des devis
     ═══════════════════════════════════════════════════════════════════════════════════════════
     Les listes de suggestions étaient figées dans le catalogue. Tout ce que Nicolas tape
     réellement (un emplacement, une toile) est mémorisé localement et remonte en tête la fois
     suivante, classé par fréquence. Purement local : rien n'est envoyé au serveur, et ça
     fonctionne donc aussi hors ligne chez le client.
     ═══════════════════════════════════════════════════════════════════════════════════════════ */
  const LS_MEMO = 'ss_memo_saisie';
  const MEMO_MAX = 40;      // par champ — au-delà, la suggestion la moins utilisée sort
  const memo = {
    lire: function () { try { return JSON.parse(localStorage.getItem(LS_MEMO) || '{}'); } catch (e) { return {}; } },
    ajouter: function (champ, valeur) {
      const v = String(valeur || '').trim();
      if (!champ || v.length < 2 || v.length > 60) return;
      try {
        const tout = memo.lire();
        const m = tout[champ] || (tout[champ] = {});
        m[v] = (m[v] || 0) + 1;
        const cles = Object.keys(m);
        if (cles.length > MEMO_MAX) {
          cles.sort((a, b) => m[a] - m[b]).slice(0, cles.length - MEMO_MAX).forEach(k => delete m[k]);
        }
        localStorage.setItem(LS_MEMO, JSON.stringify(tout));
      } catch (e) { /* stockage plein : la saisie assistée n'est pas critique */ }
    },
    /** Valeurs apprises (les plus fréquentes d'abord) puis le catalogue, sans doublon. */
    suggestions: function (champ, base) {
      const m = memo.lire()[champ] || {};
      const appris = Object.keys(m).sort((a, b) => m[b] - m[a]);
      const vus = new Set(appris.map(x => x.toLowerCase()));
      return appris.concat((base || []).filter(x => !vus.has(String(x).toLowerCase())));
    },
  };
  // Capture automatique : tout champ portant data-memo="<nom>" nourrit la mémoire.
  document.addEventListener('change', e => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-memo]')) memo.ajouter(t.getAttribute('data-memo'), t.value);
  });
  /** Remplit un <datalist> avec les valeurs apprises + le catalogue. */
  function remplirDatalist(id, champ, base) {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = memo.suggestions(champ, base)
      .map(v => '<option value="' + String(v).replace(/"/g, '&quot;') + '">').join('');
  }

  window.SSUI = {
    fmtEur: fmtEur, fmt2: fmt2, r2: r2, fmtDate: fmtDate,
    fmtDateTime: fmtDateTime, relTime: relTime, escHtml: escHtml,
    commentAuthor: commentAuthor, commentHtml: commentHtml, commentsHtml: commentsHtml, gotoComment: gotoComment,
    parseMail: parseMail, mailHtml: mailHtml, mailsHtml: mailsHtml,
    ralFieldHtml: ralFieldHtml, ouvrirNuancier: ouvrirNuancier, ralApercu: ralApercu,
    ouvrirCatalogue: ouvrirCatalogue, accVisuel: accVisuel,
    manquantsDevis: manquantsDevis, nbManquants: nbManquants, badgeManquants: badgeManquants,
    RELANCE_PLAN: RELANCE_PLAN, planRelance: planRelance, STATUT_RELANCE_N: STATUT_RELANCE_N, STATUT_RANK: STATUT_RANK,
    relanceEtat: relanceEtat, relancesFaites: relancesFaites, relanceDue: relanceDue,
    avoirsSur: avoirsSur, duFacture: duFacture, factureAnnulee: factureAnnulee,
    deporterPhotos: deporterPhotos, estPhotoInline: estPhotoInline, poidsInline: poidsInline,
    dateEnvoiOf: dateEnvoiOf, joursEntre: joursEntre, plusJours: plusJours,
    memo: memo, remplirDatalist: remplirDatalist,
    el: el, $: $, $$: $$,
    setText: setText, setVal: setVal, getVal: getVal, getNum: getNum, getInt: getInt,
    toast: toast, generateDevisId: generateDevisId, qp: qp,
    normDevis: normDevis, isPoseDone: isPoseDone, isTenteSolaire: isTenteSolaire, dimsOf: dimsOf,
    showSaveConflict: showSaveConflict, icon: icon, compressImage: compressImage, countUp: countUp, animateKpis: animateKpis, sparkline: sparkline,
    compressAndUploadPhoto: compressAndUploadPhoto, uploadPhotoDataUrl: uploadPhotoDataUrl,
    copyText: copyText, jsAttr: jsAttr, daysInCurrentStatus: daysInCurrentStatus,
    clientKeyOf: clientKeyOf,
    fetchWeather: fetchWeather,
    fetchCurrentWeather: fetchCurrentWeather,
    fetchCurrentWeatherByCoords: fetchCurrentWeatherByCoords,
    reverseGeocodeCity: reverseGeocodeCity,
    weatherLabel: weatherLabel,
    weatherIconName: weatherIconName,
    geocodeVille: geocodeVille, distanceKm: distanceKm,
  };
  // Raccourci global utilisable directement dans les attributs onclick="..." inline
  window.ssCopy = function (text, label) { copyText(text, label); };

  // ── Confettis (petite pluie dorée — ex : devis signé) — Canvas plein écran, sans dépendance ──
  function ssConfetti(opts) {
    opts = opts || {};
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const W = () => window.innerWidth, H = () => window.innerHeight;
    function resize() { canvas.width = W() * DPR; canvas.height = H() * DPR; }
    resize();
    const colors = opts.colors || ['#ffd23f', '#ffcf33', '#f5b400', '#ffffff', '#7cc4ff'];
    const N = opts.count || 150;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * W(), y: -20 - Math.random() * H() * 0.5,
        vx: (Math.random() - 0.5) * 3.5, vy: 2 + Math.random() * 4,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 9,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    const start = performance.now(), DUR = opts.duration || 2600;
    function frame(now) {
      const t = now - start;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W(), H());
      const fade = t > DUR - 700 ? Math.max(0, (DUR - t) / 700) : 1;
      parts.forEach(p => {
        p.vy += 0.06; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < DUR) requestAnimationFrame(frame);
      else { canvas.remove(); window.removeEventListener('resize', resize); }
    }
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }
  window.ssConfetti = ssConfetti;
})();
