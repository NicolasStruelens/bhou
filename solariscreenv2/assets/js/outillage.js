// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — OUTILLAGE & RÉFÉRENCES (page Outillage)
// Script classique (file:// OK). Global : window.SSOutil
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// Le carnet de références sert à deux moments : au COMPTOIR (retrouver la bonne vis, la montrer,
// la commander) et AVANT UNE POSE (ce qu'il faut emporter, ce qui manque). Les règles vivent ici
// en fonctions PURES, testées par `tests/outillage.test.html` ; la page ne fait que dessiner.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };

  // Les catégories : une seule liste (règle 10). « Autre » recueille aussi les références sans
  // catégorie — la page les rangeait déjà là, et le formulaire affichait « Visserie » à la place.
  const CATS = ['Visserie & boulonnerie', 'Chevilles & fixations', 'Perçage & découpe', 'Électroportatif', 'Mesure & traçage',
    'Consommables', 'Quincaillerie', 'Sécurité / EPI', 'Autre'];
  const categorieDe = function (o) { return (o && CATS.indexOf(o.categorie) >= 0) ? o.categorie : 'Autre'; };

  // Un prix plus vieux que ça se dit : au comptoir, on ne paie pas le prix d'il y a un an.
  // N'ouvrir que des liens http(s) — jamais un javascript: ou data: collé par erreur.
  const urlSure = function (u) { const t = String(u || '').trim(); return /^https?:\/\//i.test(t) ? t : ''; };
  const PRIX_ANCIEN_J = 180;

  // ── A — La recherche ─────────────────────────────────────────────────────────────────────────
  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  /** Une référence telle qu'on la lit sur une boîte : sans espaces, points, tirets ni barres. */
  function compacte(s) { return sansAccents(s).replace(/[\s.\-_/]+/g, ''); }
  /** Chaque mot doit se trouver, dans n'importe quel ordre (« vis inox 40 »), sans tenir compte des
   *  accents. Et une référence tapée d'un bloc (« 0179440 ») trouve « 0179 4 40 » : c'est comme ça
   *  qu'on la recopie depuis une étiquette. */
  function correspond(o, q) {
    const qs = sansAccents(q).trim();
    if (!qs) return true;
    const a = (o && o.autre) || {};
    const texte = sansAccents([o.nom, o.reference, o.fournisseur, o.categorie, o.notes, a.fournisseur, a.reference].filter(Boolean).join(' '));
    if (qs.split(/\s+/).every(function (m) { return texte.indexOf(m) >= 0; })) return true;
    const qc = compacte(q);
    return qc.length >= 3 && [o.reference, a.reference].some(function (r) { return r && compacte(r).indexOf(qc) >= 0; });
  }

  // ── Les prix ─────────────────────────────────────────────────────────────────────────────────
  /** Lit un prix comme on le tape en Belgique. « 1 234,50 » valait 1 € (la lecture s'arrêtait à
   *  l'espace des milliers), sans un mot. Renvoie { ok, valeur } : vide = pas de prix (ok) ; ce
   *  qu'on ne sait pas lire est REFUSÉ, jamais arrondi en silence. */
  function lirePrix(txt) {
    let s = String(txt == null ? '' : txt).replace(/[\s  €]/g, '');
    if (!s) return { ok: true, valeur: null };
    const v = s.lastIndexOf(','), p = s.lastIndexOf('.');
    if (v >= 0 && p >= 0) s = v > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (v >= 0) s = s.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, valeur: null };
    return { ok: true, valeur: Math.round(parseFloat(s) * 100) / 100 };
  }
  function fmtPrix(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    return Number(n).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  /** Le prix dans le champ, tel qu'on le relira : « 12,90 » et pas « 12.9 ». */
  function prixChamp(n) { return (n == null || n === '' || isNaN(Number(n))) ? '' : Number(n).toFixed(2).replace('.', ','); }
  function joursDepuis(iso, ref) {
    const d = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const r = ref || U().aujourdhui();
    return Math.max(0, Math.round((new Date(r + 'T12:00:00') - new Date(d + 'T12:00:00')) / 86400000));
  }

  /* ── F — Où l'acheter, et à quel prix ──────────────────────────────────────────────────────────
     Le fournisseur principal (les champs à plat, comme avant) et un second (`autre`). Quand les deux
     ont un prix, le moins cher est marqué ; un prix noté il y a plus de six mois est dit ancien. */
  function offres(o, ref) {
    const res = [];
    const pousse = function (rang, x) {
      if (!x || !(x.fournisseur || x.prix != null || x.url || x.reference)) return;
      const age = joursDepuis(x.prix_le, ref);
      res.push({ rang: rang, fournisseur: x.fournisseur || '', reference: x.reference || '', prix: x.prix == null ? null : Number(x.prix),
        prix_le: x.prix_le || '', url: urlSure(x.url), ageJ: age,
        ancien: age != null && age > PRIX_ANCIEN_J, moinsCher: false });
    };
    pousse('principal', o);
    pousse('autre', o && o.autre);
    const avecPrix = res.filter(function (x) { return x.prix != null && isFinite(x.prix); });
    if (avecPrix.length === 2 && avecPrix[0].prix !== avecPrix[1].prix) {
      (avecPrix[0].prix < avecPrix[1].prix ? avecPrix[0] : avecPrix[1]).moinsCher = true;
    }
    return res;
  }
  /** La date d'un prix change quand le PRIX change, pas quand on corrige une note. */
  function datePrix(nouveau, ancien, ancienneDate, aujourdhui) {
    if (nouveau == null) return '';
    if (ancien != null && Number(ancien) === Number(nouveau) && ancienneDate) return ancienneDate;
    return aujourdhui || U().aujourdhui();
  }

  // ── D — À racheter ───────────────────────────────────────────────────────────────────────────
  /** La liste de courses, par fournisseur (là où l'on va) ; « Sans fournisseur » ferme la marche. */
  function aRacheter(items) {
    const groupes = {};
    (items || []).filter(function (o) { return o && o.racheter; }).forEach(function (o) {
      const f = String(o.fournisseur || '').trim() || '';
      (groupes[f] = groupes[f] || []).push(o);
    });
    return Object.keys(groupes).sort(function (a, b) {
      if (!a) return 1; if (!b) return -1;
      return a.localeCompare(b, 'fr');
    }).map(function (f) {
      return { fournisseur: f || 'Sans fournisseur', lignes: groupes[f].sort(function (x, y) { return String(x.nom).localeCompare(String(y.nom), 'fr'); }) };
    });
  }

  // ── C — Les photos encore dans la base ───────────────────────────────────────────────────────
  const estInline = function (p) { return typeof p === 'string' && p.slice(0, 5) === 'data:'; };
  /** Ce qui pèse encore dans la ligne de la base (et dans le cache du téléphone). */
  function photosInline(items) {
    let n = 0, refs = 0, octets = 0;
    (items || []).forEach(function (o) {
      const l = ((o && o.photos) || []).filter(estInline);
      if (l.length) { refs++; n += l.length; octets += l.reduce(function (s, p) { return s + p.length; }, 0); }
    });
    return { photos: n, references: refs, octets: octets };
  }

  /* ── E — Les kits de pose et « ce qu'il faut emporter » ────────────────────────────────────────
     Un kit dit, pour un type d'ouverture (ou pour tout chantier), quelles références emporter et
     combien : « par ouverture » (4 vis par screen) ou « par chantier » (1 cartouche de silicone).
     Les ouvertures se comptent avec la règle de l'argent (`SSRemu.ouverturesParType`, qui lit
     `quantiteDe`) : un zéro écrit vaut zéro, un négatif ne retire rien — pas de copie locale. */
  const POUR = ['', 'screen', 'volet_roulant', 'tente_solaire'];
  function libellePour(pour) { return pour ? ((U().TYPE_FORMES[pour] || [])[1] || U().TYPE_LABEL[pour] || pour) : 'Tout chantier'; }
  function ouvertures(devis) { return window.SSRemu.ouverturesParType(devis); }
  function kitsPour(devis, kits) {
    const par = ouvertures(devis);
    const total = Object.keys(par).reduce(function (s, k) { return s + par[k]; }, 0);
    return (kits || []).filter(function (k) { return k && (k.pour ? par[k.pour] > 0 : total > 0); });
  }
  /** @returns { ouvertures: {type: n}, kits: [kit], lignes: [{ref, item, nom, reference, qte, detail[]}] }
   *  Une même référence dans deux kits ne fait qu'UNE ligne (les quantités s'additionnent). Une
   *  référence supprimée depuis reste listée, nommée « référence supprimée » : on ne fait pas
   *  disparaître une ligne de la liste de chargement sans le dire. */
  function aEmporter(devis, kits, items) {
    const par = ouvertures(devis);
    const total = Object.keys(par).reduce(function (s, k) { return s + par[k]; }, 0);
    const choisis = kitsPour(devis, kits);
    const parRef = {}, ordre = [];
    choisis.forEach(function (k) {
      (k.lignes || []).forEach(function (l) {
        const q = Number(l.qte);
        if (!l || !l.ref || !(q > 0)) return;
        const n = l.par === 'chantier' ? 1 : (k.pour ? (par[k.pour] || 0) : total);
        const qte = l.par === 'chantier' ? q : q * n;
        if (!(qte > 0)) return;
        if (!parRef[l.ref]) { parRef[l.ref] = { ref: l.ref, qte: 0, detail: [] }; ordre.push(l.ref); }
        parRef[l.ref].qte += qte;
        parRef[l.ref].detail.push(l.par === 'chantier' ? k.nom + ' : ' + q : k.nom + ' : ' + q + ' × ' + n);
      });
    });
    const lignes = ordre.map(function (id) {
      const it = (items || []).filter(function (o) { return o && o.id === id; })[0] || null;
      return Object.assign(parRef[id], { item: it, nom: it ? it.nom : 'Référence supprimée', reference: it ? (it.reference || '') : '' });
    });
    return { ouvertures: par, kits: choisis, lignes: lignes };
  }
  /** Les poses à venir (trois semaines), pour préparer le chargement. Un dépannage n'a pas
   *  d'ouvertures (règle 7), une pose faite est sortie du planning. */
  function posesAVenir(liste, ref, jours) {
    const r = ref || U().aujourdhui();
    const d = new Date(r + 'T12:00:00'); d.setDate(d.getDate() + (jours || 21));
    const fin = U().isoDate(d);
    return (liste || []).filter(function (x) {
      if (!x || x.archive || String(x.type_document || '') === 'depannage') return false;
      if (['signe', 'termine'].indexOf(x.statut) < 0) return false;
      if (U().isPoseDone && U().isPoseDone(x)) return false;
      const dp = String((x.chantier && x.chantier.date_pose) || '').slice(0, 10);
      return dp >= r && dp <= fin;
    }).sort(function (a, b) { return String(a.chantier.date_pose).localeCompare(String(b.chantier.date_pose)); });
  }

  window.SSOutil = {
    CATS: CATS, POUR: POUR, PRIX_ANCIEN_J: PRIX_ANCIEN_J, urlSure: urlSure,
    categorieDe: categorieDe, sansAccents: sansAccents, compacte: compacte, correspond: correspond,
    lirePrix: lirePrix, fmtPrix: fmtPrix, prixChamp: prixChamp, joursDepuis: joursDepuis,
    offres: offres, datePrix: datePrix, aRacheter: aRacheter, estInline: estInline, photosInline: photosInline,
    libellePour: libellePour, kitsPour: kitsPour, aEmporter: aEmporter, posesAVenir: posesAVenir,
  };
})();
