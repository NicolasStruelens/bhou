// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — CARTE DES CHANTIERS : la géographie des dossiers
// Script classique (file:// OK). Global : window.SSCarte
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 26/10/2026, propositions A à G choisies par Nicolas)
// La carte ne savait dire qu'une chose : « où sont les devis ». Elle dit maintenant OÙ ALLER et
// QUOI Y FAIRE — la tournée de la semaine, ce qui attend autour d'un chantier, les réalisations
// proches d'un prospect, les secteurs où l'on vend. Les calculs vivent ici, en fonctions PURES,
// pour être testables (`tests/carte.test.html`) ; la page ne fait que dessiner.
// Deux fonctions seulement touchent au monde extérieur, et sont isolées pour être remplacées
// dans les tests : `nominatim()` (placer une adresse) et `localiser()` (la position de l'appareil).
(function () {
  'use strict';

  const RAYON_TERRE_KM = 6371;

  /** Distance à vol d'oiseau, en km. Suffisante pour « à moins de 10 km » : on ne calcule pas
   *  un trajet, on repère des voisins. */
  function distanceKm(a, b) {
    if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return Infinity;
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // ── Adresses ──────────────────────────────────────────────────────────────────────────────────
  const sansAccent = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  const net = function (s) { return sansAccent(String(s == null ? '' : s).trim()).toLowerCase().replace(/\s+/g, ' '); };
  /** Clé d'une adresse complète : « Rue de l'Église » et « rue de l’eglise » sont la même. */
  function cleAdresse(adr) {
    const a = adr || {};
    return [a.rue, a.numero, a.code_postal, a.ville].map(net).join('|').replace(/[’']/g, "'");
  }
  function cleCommune(adr) { const a = adr || {}; return net(a.code_postal) + '|' + net(a.ville); }
  function aUneRue(adr) { return !!String((adr && adr.rue) || '').trim(); }
  /** Une adresse se place si l'on connaît au moins la commune (code postal ou ville). */
  function localisable(adr) { return !!(String((adr && adr.ville) || '').trim() || String((adr && adr.code_postal) || '').trim()); }
  /** La phrase envoyée au géocodeur : « Rue Haute 3, 1180 Uccle, Belgique ». */
  function requete(adr) {
    const a = adr || {};
    const rue = ((a.rue || '') + ' ' + (a.numero || '')).trim();
    const loc = ((a.code_postal || '') + ' ' + (a.ville || '')).trim();
    return [rue, loc, 'Belgique'].filter(Boolean).join(', ');
  }
  function texteAdresse(adr) {
    const a = adr || {};
    return [((a.rue || '') + ' ' + (a.numero || '')).trim(), ((a.code_postal || '') + ' ' + (a.ville || '')).trim()].filter(Boolean).join(', ');
  }

  // ── La mémoire des positions (partagée par la Carte et le Portfolio) ──────────────────────
  /* Une adresse placée l'est UNE fois, sur l'appareil : la commune (`c:`), puis la rue (`a:`) quand
     OpenStreetMap l'a trouvée. Les clés vivent ICI pour que la Carte et le Portfolio lisent la même
     mémoire — deux écritures de la même clé finiraient par ne plus se répondre (règle 10). */
  const CLE_GEO = 'ss_geo_adresses';
  function cleGeoAdresse(adr) { return 'a:' + cleAdresse(adr); }
  function cleGeoCommune(adr) { return 'c:' + cleCommune(adr); }
  function lireGeo() {
    try { return JSON.parse(localStorage.getItem(CLE_GEO) || '{}') || {}; } catch (e) { return {}; }
  }
  function ecrireGeo(geo) { try { localStorage.setItem(CLE_GEO, JSON.stringify(geo || {})); } catch (e) {} }
  /** La meilleure position connue d'une adresse : la rue si elle a été trouvée, sinon la commune. */
  function positionDans(geo, adr) {
    if (!localisable(adr)) return null;
    const x = (geo || {})[cleGeoAdresse(adr)];
    if (x && x.p === 'adresse') return { lat: x.lat, lon: x.lon, precis: true };
    const c = (geo || {})[cleGeoCommune(adr)];
    return c ? { lat: c.lat, lon: c.lon, precis: false } : null;
  }

  // ── Un point par client ───────────────────────────────────────────────────────────────────────
  /** Réunit les dossiers d'un même client en UN point (règle : un client à deux devis n'est pas
   *  deux clients). Son adresse est celle de son dossier le plus RÉCENT qui en porte une ; son
   *  action est la plus lourde de ses dossiers — le même poids que « À faire maintenant ».
   *  @param entrees [{ id, cle, nom, adresse, date, action, poids, realise, prospect, … }] */
  function grouper(entrees) {
    const parCle = new Map();
    (entrees || []).forEach(function (e) {
      if (!e || !e.cle) return;
      if (!parCle.has(e.cle)) parCle.set(e.cle, []);
      parCle.get(e.cle).push(e);
    });
    const out = [];
    parCle.forEach(function (liste, cle) {
      const tri = liste.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      const avecAdr = tri.filter(function (e) { return localisable(e.adresse); })[0] || tri[0];
      let tete = null;
      tri.forEach(function (e) { if ((e.poids || 0) > ((tete && tete.poids) || 0)) tete = e; });
      out.push({
        cle: cle, nom: avecAdr.nom || tri[0].nom || 'Sans nom', adresse: avecAdr.adresse || {}, tel: avecAdr.tel || '',
        entrees: tri, action: tete ? tete.action : null, poids: tete ? tete.poids : 0, href: tete ? tete.href : (tri[0].href || ''),
        realise: tri.some(function (e) { return !!e.realise; }), prospect: tri.some(function (e) { return !!e.prospect; }),
      });
    });
    return out.sort(function (a, b) { return (b.poids - a.poids) || String(a.nom).localeCompare(String(b.nom)); });
  }

  /** Des points au MÊME endroit (deux clients d'une commune placés à la commune) s'écartent en
   *  spirale, toujours dans le même ordre : l'ancienne carte les décalait AU HASARD, donc les
   *  points bougeaient à chaque chargement, et un client à deux devis ressemblait à deux voisins.
   *  `pos` reste la vraie position (pour les distances) ; `vue` est celle qu'on dessine. */
  function ecarter(points) {
    const groupes = new Map();
    (points || []).forEach(function (p) {
      if (!p || !p.pos) return;
      const k = p.pos.lat.toFixed(4) + ',' + p.pos.lon.toFixed(4);
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(p);
    });
    groupes.forEach(function (liste) {
      liste.sort(function (a, b) { return String(a.cle).localeCompare(String(b.cle)); });
      liste.forEach(function (p, i) {
        if (!i) { p.vue = { lat: p.pos.lat, lon: p.pos.lon }; return; }
        const angle = i * 2.399963;            // angle d'or : la spirale ne se recouvre jamais
        const r = 0.0011 * Math.sqrt(i);       // ~120 m au premier cran
        p.vue = { lat: p.pos.lat + r * Math.sin(angle), lon: p.pos.lon + r * Math.cos(angle) * 1.55 };
      });
    });
    return points;
  }

  // ── Autour de… / réalisations proches ─────────────────────────────────────────────────────────
  /** Les points à moins de `rayonKm` d'un centre, du plus proche au plus loin.
   *  @param garder  filtre facultatif (p) => bool ; `exclure` = la clé du point de départ. */
  function autourDe(centre, points, rayonKm, garder, exclure) {
    return (points || [])
      .filter(function (p) { return p && p.pos && p.cle !== exclure && (!garder || garder(p)); })
      .map(function (p) { return { p: p, km: distanceKm(centre, p.pos) }; })
      .filter(function (x) { return x.km <= rayonKm; })
      .sort(function (a, b) { return a.km - b.km; });
  }
  /** Combien de chantiers RÉALISÉS (posés, terminés) chez d'autres clients près de ce point.
   *  Un NOMBRE, jamais des noms : c'est un argument de vente, pas une liste de voisins à donner. */
  function realisationsProches(point, points, rayonKm) {
    if (!point || !point.pos) return 0;
    return autourDe(point.pos, points, rayonKm || 2, function (p) { return p.realise; }, point.cle).length;
  }

  // ── Secteurs ──────────────────────────────────────────────────────────────────────────────────
  const ATTENTE = ['envoye_client', 'relance_1', 'relance_2'];
  /** Par commune : où l'on signe, où l'on perd. TOUT l'historique (archives comprises) : un
   *  secteur se juge sur des années, pas sur ce qui est encore actif. Les brouillons n'y sont pas. */
  function secteurs(entrees) {
    const par = new Map();
    (entrees || []).forEach(function (e) {
      if (!e || !e.statut || e.statut === 'brouillon' || !localisable(e.adresse)) return;
      const k = cleCommune(e.adresse);
      if (!par.has(k)) par.set(k, { cle: k, cp: String(e.adresse.code_postal || '').trim(), ville: String(e.adresse.ville || '').trim(), adresse: e.adresse, signes: 0, refuses: 0, attente: 0, caSigne: 0, dossiers: 0 });
      const s = par.get(k);
      s.dossiers++;
      if (e.statut === 'signe' || e.statut === 'termine') { s.signes++; s.caSigne += Number(e.ttc) || 0; }
      else if (e.statut === 'refuse') s.refuses++;
      else if (ATTENTE.indexOf(e.statut) >= 0) s.attente++;
    });
    return Array.from(par.values()).map(function (s) {
      const tranches = s.signes + s.refuses;
      s.taux = tranches ? Math.round((s.signes / tranches) * 100) : null;   // null = rien de tranché
      s.caSigne = Math.round(s.caSigne * 100) / 100;
      return s;
    }).sort(function (a, b) { return (b.caSigne - a.caSigne) || (b.signes - a.signes) || a.ville.localeCompare(b.ville); });
  }

  // ── Tournée ───────────────────────────────────────────────────────────────────────────────────
  /** Les rendez-vous d'une période rangés par jour et NUMÉROTÉS dans l'ordre de la journée.
   *  Les blocages de temps n'ont pas de lieu : ils n'y sont pas. Les événements arrivent déjà
   *  triés par SSPlanning (date, puis heure). */
  function tournee(evs) {
    const jours = [];
    (evs || []).forEach(function (e) {
      if (!e || e.source === 'indispo') return;
      let j = jours[jours.length - 1];
      if (!j || j.date !== e.date) { j = { date: e.date, arrets: [] }; jours.push(j); }
      j.arrets.push({ n: j.arrets.length + 1, ev: e });
    });
    return jours;
  }

  // ── Le monde extérieur (remplacés dans les tests) ────────────────────────────────────────────
  /** Place UNE adresse chez OpenStreetMap (Nominatim). Choix de Nicolas le 26/10/2026, en sachant
   *  que l'adresse sort de l'ERP — jusque-là seuls code postal et ville sortaient.
   *  ⚠️ Règles d'usage de Nominatim : une requête par seconde au plus, et on MÉMORISE la réponse
   *  (la page le fait, sur l'appareil). @return { lat, lon } | null (introuvable) ; rejette si réseau. */
  async function nominatim(q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=be&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const x = Array.isArray(j) && j[0];
    return x ? { lat: parseFloat(x.lat), lon: parseFloat(x.lon) } : null;
  }
  /** La position de l'appareil. Elle ne quitte pas l'appareil : rien ne l'envoie nulle part. */
  function localiser() {
    return new Promise(function (ok, ko) {
      if (!navigator.geolocation) { ko(new Error('Localisation indisponible sur cet appareil')); return; }
      navigator.geolocation.getCurrentPosition(function (p) { ok({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        function (e) { ko(e); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    });
  }

  window.SSCarte = {
    distanceKm: distanceKm,
    CLE_GEO: CLE_GEO, cleGeoAdresse: cleGeoAdresse, cleGeoCommune: cleGeoCommune, lireGeo: lireGeo, ecrireGeo: ecrireGeo, positionDans: positionDans,
    cleAdresse: cleAdresse, cleCommune: cleCommune, aUneRue: aUneRue, localisable: localisable,
    requete: requete, texteAdresse: texteAdresse,
    grouper: grouper, ecarter: ecarter, autourDe: autourDe, realisationsProches: realisationsProches,
    secteurs: secteurs, tournee: tournee,
    nominatim: nominatim, localiser: localiser,
  };
})();
