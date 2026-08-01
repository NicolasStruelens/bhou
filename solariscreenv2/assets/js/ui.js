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
  async function uploadPhotoDataUrl(dataUrl, ownerId) {
    try {
      if (!window.SS || !window.SS.uploadPhoto) return dataUrl;
      const blob = await (await fetch(dataUrl)).blob();
      const url = await window.SS.uploadPhoto(ownerId, blob);
      return url || dataUrl;
    } catch (e) { return dataUrl; }
  }
  async function compressAndUploadPhoto(file, ownerId, maxDim, quality) {
    const dataUrl = await compressImage(file, maxDim, quality);
    return uploadPhotoDataUrl(dataUrl, ownerId);
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
      item_types: d.item_types || (d.items ? [...new Set(d.items.map(i => i.type).filter(Boolean))] : []),
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
   * @param {object} opts { onDelete:'nomDeFonction', onReply:'nomDeFonction', compact:true }
   *                      onDelete/onReply reçoivent l'id de la note ; omis = bouton absent.
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
    const rep = (opts.onReply && a.cls === 'client')
      ? `<button type="button" class="ss-cmt-reply" onclick="event.stopPropagation();${opts.onReply}('${id}')">${icon('reply', 12)} Répondre au client</button>` : '';
    return `<div class="ss-cmt ${a.cls === 'client' ? 'is-client' : ''} ${type === 'important' ? 'is-important' : ''} ${type === 'question' ? 'is-question' : ''}">
      <span class="ss-cmt-av ${a.cls}" aria-hidden="true">${a.ini}</span>
      <div class="ss-cmt-main">
        <div class="ss-cmt-head">
          <span class="ss-cmt-who">${escHtml(a.label)}</span>
          ${chips.join('')}
          <time class="ss-cmt-when" title="${escHtml(fmtDateTime(c.date))}">${escHtml(relTime(c.date))}</time>
          ${del}
        </div>
        <div class="ss-cmt-text">${escHtml(c.text)}</div>
        ${rep}
      </div>
    </div>`;
  }
  /** Le fil complet, du plus ancien au plus récent (sens de lecture d'une conversation). */
  function commentsHtml(list, opts) {
    opts = opts || {};
    const arr = (list || []).slice().sort((x, y) => String(x.date).localeCompare(String(y.date)));
    if (!arr.length) return `<div class="ss-cmt-empty">${escHtml(opts.empty || 'Aucune note pour l’instant.')}</div>`;
    return arr.map(c => commentHtml(c, opts)).join('');
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

  window.SSUI = {
    fmtEur: fmtEur, fmt2: fmt2, r2: r2, fmtDate: fmtDate,
    fmtDateTime: fmtDateTime, relTime: relTime, escHtml: escHtml,
    commentAuthor: commentAuthor, commentHtml: commentHtml, commentsHtml: commentsHtml,
    parseMail: parseMail, mailHtml: mailHtml, mailsHtml: mailsHtml,
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
