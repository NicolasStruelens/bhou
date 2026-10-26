// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LA VITRINE (portfolio de réalisations)
// Script classique (file:// OK). Global : window.SSVitrine
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 26/10/2026, propositions A à G choisies par Nicolas)
// Le portfolio est ce qu'on MONTRE aux prospects : en visite, sur un téléphone, ou en PDF. Ce qui
// en sort doit donc être lisible par un client — jamais une référence de commande fournisseur,
// jamais le nom d'un autre client. Les règles vivent ici, en fonctions PURES, pour être testables
// (`tests/portfolio.test.html`) ; la page ne fait que dessiner.
(function () {
  'use strict';

  const sansAccent = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  const produits = function (p) { return p || window.SSProducts || null; };

  /* ── Couleurs lisibles par un client ─────────────────────────────────────────────────────────
     Le nuancier écrit la référence de COMMANDE Harol : « 7016 — Gris anthracite · réf. 7m16st
     (laque texturée) ». Sur une vitrine qu'on montre aux prospects, la référence fournisseur n'a
     rien à faire (même raison que l'encadré du devis, règle 31). */
  function sansReference(v) { return String(v == null ? '' : v).replace(/\s*·\s*r[ée]f\..*$/i, '').trim(); }
  /** Code RAL d'une couleur de caisson, ou null. */
  function ralDe(v, p) { const P = produits(p); return (P && P.ralCode) ? P.ralCode(sansReference(v)) : null; }
  /** « 7016 Gris anthracite » — le code (c'est ce que le client retrouve sur un nuancier) et le nom. */
  function couleurLisible(v, p) {
    const s = sansReference(v);
    if (!s) return '';
    const P = produits(p), code = ralDe(s, P);
    if (code && P.ralNom) { const nom = P.ralNom(code); return nom ? code + ' ' + nom : code; }
    return s.replace(/\s+[—–-]\s+/, ' ');
  }
  /** La toile d'un screen : c'est elle qui se voit le plus, elle passe AVANT la couleur du caisson. */
  function toileLisible(v) { return sansReference(v).replace(/\s+[—–-]\s+/, ' '); }

  // ── Les réalisations d'un devis ───────────────────────────────────────────────────────────────
  // Le journal de chantier ne montre que ce qui est beau : « en cours » et « terminé ». « Avant »
  // ne sort QUE dans la comparaison avant / après ; « problème » et « réserve », jamais.
  const PHASES_VITRINE = ['pendant', 'apres'];
  /** Une réalisation par ouverture photographiée, plus une « Chantier / pose » pour le journal.
   *  Les photos MASQUÉES (`portfolio_masquees`) sortent ; la COUVERTURE choisie
   *  (`portfolio_couvertures[cle]`) passe en tête. `photosToutes` garde tout, pour pouvoir choisir. */
  function entreesDe(d, opts) {
    if (!d) return [];
    const o = opts || {};
    const masquees = new Set(Array.isArray(d.portfolio_masquees) ? d.portfolio_masquees : []);
    const couv = (d.portfolio_couvertures && typeof d.portfolio_couvertures === 'object') ? d.portfolio_couvertures : {};
    const cl = d.client || {}, adr = cl.adresse || {};
    const base = {
      devisId: d.id, adresse: adr, ville: String(adr.ville || '').trim(), cp: String(adr.code_postal || '').trim(),
      client: [cl.prenom, cl.nom].filter(Boolean).join(' '), date: d.date_modification || d.date_creation || '',
    };
    const ranger = function (urls, cle) {
      const v = urls.filter(function (u) { return !masquees.has(u); });
      const c = couv[cle], i = c ? v.indexOf(c) : -1;
      if (i > 0) { v.splice(i, 1); v.unshift(c); }
      return v;
    };
    const out = [];
    (d.items || []).forEach(function (it, i) {
      const toutes = (it.photos || []).filter(Boolean);
      if (!toutes.length) return;
      const cle = 'item:' + i;
      out.push(Object.assign({}, base, {
        cle: d.id + '|' + cle, cleDevis: cle, type: it.type || '', modele: it.modele || '', variante: it.variante || '',
        couleur: couleurLisible(it.couleur || it.couleur_lame, o.produits), ral: ralDe(it.couleur || it.couleur_lame, o.produits),
        toile: toileLisible(it.toile || it.toile_couleur), photosToutes: toutes, photos: ranger(toutes, cle), couverture: couv[cle] || '', paire: null,
      }));
    });
    const journal = (d.chantier_photos || []).filter(function (e) { return e && e.url; }).slice()
      .sort(function (a, b) { return String((a.date || '') + (a.date_creation || '')).localeCompare(String((b.date || '') + (b.date_creation || ''))); });
    const vitrine = journal.filter(function (e) { return PHASES_VITRINE.indexOf(e.phase) >= 0; }).map(function (e) { return e.url; });
    if (vitrine.length) {
      const premier = function (phase) { const x = journal.filter(function (e) { return e.phase === phase && !masquees.has(e.url); })[0]; return x ? x.url : ''; };
      const av = premier('avant'), ap = premier('apres');
      out.push(Object.assign({}, base, {
        cle: d.id + '|chantier', cleDevis: 'chantier', type: 'chantier', modele: '', variante: '', couleur: '', ral: null, toile: '',
        photosToutes: vitrine, photos: ranger(vitrine, 'chantier'), couverture: couv.chantier || '',
        // C — la comparaison n'existe que si les DEUX photos existent : une moitié vide ne compare rien.
        paire: (av && ap) ? { avant: av, apres: ap } : null,
      }));
    }
    return out;
  }

  /** Les diapositives du mode présentation : pour chaque réalisation, la comparaison d'abord (c'est
   *  l'argument le plus fort), puis ses photos, couverture en tête. */
  function diapos(entrees) {
    const out = [];
    (entrees || []).forEach(function (e, ie) {
      if (e.paire) out.push({ type: 'paire', entree: ie, avant: e.paire.avant, apres: e.paire.apres });
      (e.photos || []).forEach(function (src, ip) { out.push({ type: 'photo', entree: ie, src: src, n: ip + 1, total: e.photos.length }); });
    });
    return out;
  }

  /** F — les teintes de caisson présentes, de la plus fréquente à la plus rare. */
  function teintes(entrees, p) {
    const P = produits(p), par = new Map();
    (entrees || []).forEach(function (e) {
      if (!e.ral) return;
      if (!par.has(e.ral)) par.set(e.ral, { code: e.ral, nom: (P && P.ralNom && P.ralNom(e.ral)) || e.ral, hex: (P && P.ralHex && P.ralHex(e.ral)) || '', n: 0 });
      par.get(e.ral).n++;
    });
    return Array.from(par.values()).sort(function (a, b) { return (b.n - a.n) || a.code.localeCompare(b.code); });
  }

  /** La recherche, sans accents : « ecaussinnes » trouve « Écaussinnes ». */
  function correspond(e, q, libelleType) {
    const mots = sansAccent(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const foin = sansAccent([libelleType ? libelleType(e.type) : e.type, e.modele, e.variante, e.couleur, e.toile, e.ville, e.cp, e.client].join(' '));
    return mots.every(function (m) { return foin.indexOf(m) >= 0; });
  }

  /** G — ce qui manque à la vitrine : les chantiers POSÉS qui n'y sont pas. Avec des photos, ils sont
   *  prêts à y entrer ; sans photo, c'est une photo à prendre la prochaine fois qu'on passe.
   *  Lu sur la LISTE des devis (`photos_count`, `chantier_photos_count`) : aucun devis rechargé. */
  function manquants(liste, estPose) {
    const prets = [], sansPhoto = [];
    (liste || []).forEach(function (d) {
      if (!d || d.archive || d.portfolio || String(d.type_document || '') === 'depannage') return;
      if (!(d.statut === 'termine' || (estPose && estPose(d)))) return;
      const n = (Number(d.photos_count) || 0) + (Number(d.chantier_photos_count) || 0);
      (n > 0 ? prets : sansPhoto).push(d);
    });
    const recent = function (a, b) { return String(b.date_modification || '').localeCompare(String(a.date_modification || '')); };
    return { prets: prets.sort(recent), sansPhoto: sansPhoto.sort(recent) };
  }

  /** Un devis a-t-il de quoi entrer dans la vitrine ? Même règle que le bouton de la fiche devis. */
  function montrable(d) {
    if (!d) return false;
    const ouvertures = (d.items || []).some(function (it) { return (it.photos || []).length > 0; });
    const chantier = (d.chantier_photos || []).some(function (e) { return e && e.url && PHASES_VITRINE.indexOf(e.phase) >= 0; });
    return ouvertures || chantier;
  }

  window.SSVitrine = {
    sansReference: sansReference, ralDe: ralDe, couleurLisible: couleurLisible, toileLisible: toileLisible,
    PHASES_VITRINE: PHASES_VITRINE, entreesDe: entreesDe, diapos: diapos, teintes: teintes,
    correspond: correspond, manquants: manquants, montrable: montrable,
  };
})();
