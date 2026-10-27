// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LES STATISTIQUES (page Statistiques, onglet « L'activité »)
// Script classique (file:// OK). Global : window.SSStats
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// La page calculait tout dans son HTML, et plusieurs chiffres ne disaient pas ce qu'ils comptaient :
// « Performance par vendeur » affichait les COMMISSIONS, « Marge interne » était la somme des deux
// commissions, un bon d'intervention passait pour une vente signée (podium, taux), un dossier encore
// en cours comptait comme un échec dans les sources. Les règles vivent ici, en fonctions PURES
// testées (`tests/stats.test.html`) — la paie, elle, reste dans `remuneration.js` (règle 30).
// Règle 51 de CLAUDE.md.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  const r2 = function (x) { return Math.round((Number(x) || 0) * 100) / 100; };
  const ATTENTE = ['envoye_client', 'relance_1', 'relance_2'];
  const SIGNES = ['signe', 'termine'];
  const quantite = function (it) {
    // La règle de l'ARGENT (absent = 1, zéro écrit = 0, jamais un négatif) — jamais `quantite || 1`.
    if (window.SSRemu && window.SSRemu.quantiteDe) return window.SSRemu.quantiteDe(it);
    const q = it && it.quantite;
    if (q === undefined || q === null || q === '') return 1;
    const n = Number(q);
    return isFinite(n) && n > 0 ? n : (isFinite(n) ? 0 : 1);
  };
  const paye = function (f) { return ((f && f.paiements) || []).reduce(function (s, p) { return s + (Number(p.montant) || 0); }, 0); };
  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // ── LES DATES ───────────────────────────────────────────────────────────────────────────────
  /** Le JOUR local d'une date : une chaîne « AAAA-MM-JJ » telle quelle, un horodatage converti en
   *  heure LOCALE (règle 18) — un devis signé à 0 h 30 le 1er novembre est signé en novembre, pas en
   *  octobre comme le dirait l'heure UTC. '' si illisible. */
  function jourDe(x) {
    if (!x) return '';
    const s = String(x);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d) ? '' : U().isoDate(d);
  }
  function plusJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return U().isoDate(d); }
  /** Le même jour, n ans plus tôt ; un 29 février sans 29 février devient le 28. */
  function anneesAvant(iso, n) {
    const y = Number(iso.slice(0, 4)) - (n || 1), md = iso.slice(5);
    const bis = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return y + '-' + (md === '02-29' && !bis ? '02-28' : md);
  }
  const MOIS_NOM = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* ── A — UNE PÉRIODE POUR TOUTE L'ACTIVITÉ ───────────────────────────────────────────────────
     Les chiffres étaient « depuis toujours, hors archives » : le CA signé BAISSAIT quand on rangeait
     un dossier, et « combien cette année ? » n'avait pas de réponse. Chaque période porte sa
     comparaison : la MÊME période l'an passé (la pose de screens est saisonnière — comparer octobre
     à septembre ne dirait rien), arrêtée au même jour. « Tout » n'a rien à quoi se comparer.
     ⚠️ La PAIE n'a pas de période : ce qui est dû l'est depuis le début (règle 30). */
  const PERIODES = [
    { cle: 'mois', libelle: 'Ce mois' }, { cle: 'annee', libelle: 'Cette année' },
    { cle: '12m', libelle: '12 mois' }, { cle: 'tout', libelle: 'Tout' },
  ];
  function periode(cle, auj) {
    const a = auj || U().aujourdhui();
    const y = a.slice(0, 4), m = Number(a.slice(5, 7));
    if (cle === 'mois') {
      const debut = a.slice(0, 8) + '01';
      return { cle: cle, debut: debut, fin: a, libelle: MOIS_NOM[m - 1] + ' ' + y,
        avant: { debut: anneesAvant(debut), fin: anneesAvant(a), libelle: MOIS_NOM[m - 1] + ' ' + (Number(y) - 1) } };
    }
    if (cle === '12m') {
      return { cle: cle, debut: plusJours(anneesAvant(a), 1), fin: a, libelle: '12 derniers mois',
        avant: { debut: plusJours(anneesAvant(a, 2), 1), fin: anneesAvant(a), libelle: '12 mois d’avant' } };
    }
    if (cle === 'tout') return { cle: cle, debut: '', fin: a, libelle: 'depuis le début', avant: null };
    return { cle: 'annee', debut: y + '-01-01', fin: a, libelle: y,
      avant: { debut: (Number(y) - 1) + '-01-01', fin: anneesAvant(a), libelle: String(Number(y) - 1) } };
  }
  /** Dans la période : bornes comprises. Un jour illisible n'y est jamais. */
  function dans(x, per) {
    const j = jourDe(x);
    return !!j && !!per && (!per.debut || j >= per.debut) && j <= per.fin;
  }

  // ── CE QU'EST UN DOSSIER ────────────────────────────────────────────────────────────────────
  /** Un BON D'INTERVENTION (dépannage déjà réalisé) n'a jamais été proposé : il n'y avait rien à
   *  gagner ni à perdre (règles 7 et 11). Il comptait dans le podium et dans le taux de conversion
   *  (ESSAI-15 : « 3 devis signés » pour Yannick, dont un dépannage fait). */
  function estIntervention(d) { return !!d && d.type_document === 'depannage' && (d.depannage_mode || 'realise') === 'realise'; }
  /** Une OFFRE qu'un client peut signer ou refuser. Un devis informatif n'a pas de bloc de
   *  signature : il ne se gagne pas, et il traînait « en attente » pour toujours. */
  function estVente(d) { return !!d && !estIntervention(d) && !d.informatif; }
  const estSigne = function (d) { return SIGNES.indexOf(d && d.statut) >= 0; };
  function montant(d) { return r2((d && d.calculs && d.calculs.total_ttc) || (d && d.ttc) || (d && d.total_ttc) || 0); }
  /** Le vendeur principal — 'nicolas', 'yannick' ou '' (non renseigné, et c'est DIT, jamais deviné). */
  function vendeur(d) {
    const s = (d && d.pricing_v2 && d.pricing_v2.material && d.pricing_v2.material.sellers && d.pricing_v2.material.sellers.principal) || (d && d.seller_principal) || '';
    return s === 'nicolas' || s === 'yannick' ? s : '';
  }
  function dateSignature(d) { return jourDe(U().dateSignature(d)); }
  /** Un brouillon n'est jamais parti ; un devis annulé sans avoir été envoyé non plus. */
  function aEteEnvoye(d) {
    if (!d || d.statut === 'brouillon') return false;
    if (d.statut === 'annule') return (d.statut_history || []).some(function (h) { return h && ATTENTE.indexOf(h.statut) >= 0; }) || !!d.date_envoi;
    return true;
  }
  function dateEnvoi(d) { return aEteEnvoye(d) ? jourDe(U().dateEnvoiOf(d)) : ''; }
  function dateRefus(d) {
    const h = (d && d.statut_history) || [];
    for (let i = h.length - 1; i >= 0; i--) if (h[i] && h[i].statut === 'refuse') return jourDe(h[i].date);
    return jourDe(d && d.date_modification);
  }
  function nomClient(d) { const c = (d && d.client) || {}; return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Client sans nom'; }

  /* ── LES CHIFFRES DE LA PÉRIODE ──────────────────────────────────────────────────────────────
     Tout se compte par l'ÉVÉNEMENT (signé ce jour-là, refusé ce jour-là, payé ce jour-là), archives
     COMPRISES : archiver est un rangement d'affichage, pas un événement commercial — c'est ce qui
     faisait baisser le CA signé quand on rangeait un dossier soldé. Le tableau de bord, lui, garde
     son « CA signé » des dossiers VIVANTS (règle 40) : ce sont deux questions, donc deux libellés. */
  function chiffres(liste, factures, per) {
    const L = (liste || []).filter(Boolean);
    const F = (factures || []).filter(Boolean);
    const ventes = L.filter(estVente);
    const signes = ventes.filter(function (d) { return estSigne(d) && dans(dateSignature(d), per); });
    const interventions = L.filter(function (d) { return estIntervention(d) && estSigne(d) && dans(dateSignature(d), per); });
    const refuses = ventes.filter(function (d) { return d.statut === 'refuse' && dans(dateRefus(d), per); });
    const envoyes = ventes.filter(function (d) { return dans(dateEnvoi(d), per); });
    const tranches = signes.length + refuses.length;
    const somme = function (l) { return r2(l.reduce(function (s, d) { return s + montant(d); }, 0)); };
    let encaisse = 0;
    F.forEach(function (f) { (f.paiements || []).forEach(function (p) { if (dans(p.date, per)) encaisse += Number(p.montant) || 0; }); });
    const du = F.reduce(function (s, f) { return s + U().duFacture(f, F); }, 0);
    const retard = F.filter(function (f) { return U().factureEnRetard(f, F); });
    return {
      signe: somme(signes), nbSignes: signes.length,
      interventions: { nb: interventions.length, montant: somme(interventions) },
      refuses: { nb: refuses.length, montant: somme(refuses) },
      envoyes: envoyes.length,
      enAttente: envoyes.filter(function (d) { return ATTENTE.indexOf(d.statut) >= 0; }).length,
      // Sur les dossiers TRANCHÉS (signés + refusés) : un dossier pas encore décidé n'est pas un échec.
      taux: tranches ? Math.round(signes.length / tranches * 100) : null, tranches: tranches,
      encaisse: r2(encaisse),
      facture: r2(F.filter(function (f) { return dans(f.date, per); }).reduce(function (s, f) { return s + (Number(f.total_ttc) || 0); }, 0)),
      // Ce qui est dû se lit AUJOURD'HUI, quelle que soit la période (règle 4).
      du: r2(du), retard: r2(retard.reduce(function (s, f) { return s + U().duFacture(f, F); }, 0)), nbRetard: retard.length,
    };
  }
  /** L'évolution face à la même période l'an passé. null quand il n'y a rien à comparer. */
  function evolution(cur, avant, enPoints) {
    if (avant === null || avant === undefined || cur === null || cur === undefined) return null;
    if (enPoints) return { points: Math.round(cur - avant) };
    if (!avant) return cur ? { nouveau: true } : null;
    return { pct: Math.round((cur - avant) / avant * 100) };
  }

  /* ── C — LES VENTES PAR VENDEUR ──────────────────────────────────────────────────────────────
     Ce que chacun a VENDU (devis signés dont il est le vendeur principal), pas ses commissions : la
     section « Performance par vendeur » affichait les commissions (les 18/5 se partagent sur CHAQUE
     devis), à côté d'un nombre de devis compté par vendeur principal — deux mesures différentes sous
     un même titre. Un devis signé SANS vendeur a sa ligne : le podium le faisait disparaître. */
  function vendeurs(liste, per) {
    const L = (liste || []).filter(estVente);
    const out = {};
    ['nicolas', 'yannick', ''].forEach(function (q) { out[q] = { qui: q, nb: 0, montant: 0, refuses: 0, taux: null }; });
    L.forEach(function (d) {
      const v = out[vendeur(d)];
      if (estSigne(d) && dans(dateSignature(d), per)) { v.nb++; v.montant = r2(v.montant + montant(d)); }
      else if (d.statut === 'refuse' && dans(dateRefus(d), per)) v.refuses++;
    });
    const res = ['nicolas', 'yannick'].map(function (q) { return out[q]; });
    if (out[''].nb || out[''].refuses) res.push(out['']);
    res.forEach(function (v) { v.taux = v.nb + v.refuses ? Math.round(v.nb / (v.nb + v.refuses) * 100) : null; });
    const max = Math.max.apply(null, res.map(function (v) { return v.montant; }));
    const enTete = res.filter(function (v) { return v.qui && v.montant === max && max > 0; });
    res.forEach(function (v) { v.enTete = enTete.length === 1 && enTete[0] === v; });
    return res;
  }

  /* ── C — CE QU'ON VEND ───────────────────────────────────────────────────────────────────────
     Les ouvertures des devis SIGNÉS de la période, à leur valeur catalogue HT. L'ancienne répartition
     additionnait les brouillons et les refusés (« Screen 47 850 € » dont une bonne part jamais
     vendue). Une ligne sans type est nommée « sans type » ; une quantité nulle ne compte pas. */
  function ventesParType(liste, per) {
    const parType = {};
    (liste || []).filter(function (d) { return estVente(d) && estSigne(d) && dans(dateSignature(d), per); }).forEach(function (d) {
      (d.items || []).forEach(function (it) {
        const q = quantite(it);
        if (!(q > 0)) return;
        const t = (it && it.type) || '';
        const x = parType[t] || (parType[t] = { type: t, qte: 0, valeur: 0, dossiers: {} });
        x.qte += q; x.valeur = r2(x.valeur + (Number(it.prix_catalogue_ht) || 0) * q); x.dossiers[d.id] = 1;
      });
    });
    return Object.keys(parType).map(function (k) { const x = parType[k]; return { type: x.type, qte: x.qte, valeur: x.valeur, dossiers: Object.keys(x.dossiers).length }; })
      .sort(function (a, b) { return (b.valeur - a.valeur) || (b.qte - a.qte); });
  }

  /* ── D — DU PREMIER CONTACT À LA SIGNATURE ───────────────────────────────────────────────────
     Combien de demandes, de devis envoyés, de signatures dans la période ; le délai HABITUEL entre
     l'envoi et la signature (la médiane : un dossier signé après six mois ne doit pas faire croire
     qu'on signe en trois semaines) ; et combien ont signé sans qu'on ait eu à relancer. */
  function mediane(l) {
    const s = l.slice().sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }
  /** Les relances parties AVANT la signature : celles du registre, ou à défaut les étapes du statut. */
  function relancesAvant(d, jour) {
    const reg = ((d && d.relances) || []).filter(function (r) { return r && r.date && !r.implied && jourDe(r.date) <= jour; }).length;
    const hist = {};
    ((d && d.statut_history) || []).forEach(function (h) { if (h && /^relance_/.test(h.statut) && jourDe(h.date) <= jour) hist[h.statut] = 1; });
    return Math.max(reg, Object.keys(hist).length);
  }
  function entonnoir(liste, rdvs, per) {
    const ventes = (liste || []).filter(estVente);
    const signes = ventes.filter(function (d) { return estSigne(d) && dans(dateSignature(d), per); });
    const delais = [];
    let sansRelance = 0;
    signes.forEach(function (d) {
      const s = dateSignature(d), e = dateEnvoi(d);
      if (e && s >= e) delais.push(U().joursEntre(e, s));
      if (!relancesAvant(d, s)) sansRelance++;
    });
    // Ce qui attend une réponse AUJOURD'HUI (dossiers vivants) : la photo du moment, sans période.
    const enCours = { envoye_client: 0, relance_1: 0, relance_2: 0 };
    ventes.forEach(function (d) { if (!d.archive && enCours[d.statut] !== undefined) enCours[d.statut]++; });
    return {
      demandes: (rdvs || []).filter(function (r) { return r && dans(r.date_creation, per); }).length,
      envoyes: ventes.filter(function (d) { return dans(dateEnvoi(d), per); }).length,
      signes: signes.length, delai: mediane(delais), mesures: delais.length, sansRelance: sansRelance, enCours: enCours,
    };
  }

  /* ── D — D'OÙ VIENNENT LES CLIENTS QUI SIGNENT ───────────────────────────────────────────────
     Une demande se rattache à son devis par la règle de `attente.js` (règle 17 : lien explicite, ou
     même client) — l'ancien calcul ne lisait que `rdv.devis_id`, donc un devis fait au simulateur
     après la visite n'était jamais reconnu. ⚠️ Le lien « même client » n'est retenu ici que pour un
     devis créé APRÈS la demande : un vieux devis du même client n'est pas la suite de cette demande.
     Et une demande ENCORE EN COURS n'est ni un succès ni un échec : « Site web 0/1 · 0 % » pour une
     demande arrivée le matin même faisait croire que la source ne rapportait rien. */
  function devisDeDemande(r, liste) {
    const A = window.SSAttente;
    if (!A || !A.devisDeRdv) {
      return (liste || []).filter(function (d) { return d && ((r.devis_id && d.id === r.devis_id) || (d.rdv_id && d.rdv_id === r.id)); })[0] || null;
    }
    const lien = A.devisDeRdv(r, liste);
    if (!lien) return null;
    if (lien.lien === 'probable' && jourDe(lien.devis.date_creation) < jourDe(r.date_creation)) return null;
    return lien.devis;
  }
  function sources(liste, rdvs, per) {
    const parSrc = {};
    (rdvs || []).filter(function (r) { return r && dans(r.date_creation, per); }).forEach(function (r) {
      const nom = String(r.source || '').trim() || 'Non précisée';
      const k = sansAccents(nom);
      const s = parSrc[k] || (parSrc[k] = { source: nom, demandes: 0, devis: 0, signes: 0, perdus: 0, enCours: 0, montant: 0, vus: {} });
      s.demandes++;
      const d = devisDeDemande(r, liste);
      if (d) s.devis++;
      if (d && estSigne(d)) {
        // Deux demandes peuvent mener au même devis : la signature (et son montant) ne compte qu'une fois.
        if (!s.vus[d.id]) { s.vus[d.id] = 1; s.signes++; s.montant = r2(s.montant + montant(d)); }
      } else if ((d && (d.statut === 'refuse' || d.statut === 'annule')) || (!d && r.statut === 'annule')) s.perdus++;
      else s.enCours++;
    });
    return Object.keys(parSrc).map(function (k) {
      const s = parSrc[k]; delete s.vus;
      s.taux = s.signes + s.perdus ? Math.round(s.signes / (s.signes + s.perdus) * 100) : null;
      return s;
    }).sort(function (a, b) { return (b.signes - a.signes) || (b.demandes - a.demandes) || a.source.localeCompare(b.source); });
  }

  /* ── G — CE QUI SE PERD SANS UN MOT ──────────────────────────────────────────────────────────
     Trois listes DISJOINTES, sur les dossiers vivants : les devis expirés sans réponse (30 jours
     après l'envoi, la règle du tableau de bord), ceux en relance 2 qui ne le sont pas encore, et les
     refus de la période par raison. ⚠️ Un dossier MIS EN ATTENTE (règle 38) n'est pas « sans un mot » :
     le client a répondu, il revient vers nous — il n'est dans aucune des deux premières listes. */
  function pertes(liste, per, auj) {
    const a = auj || U().aujourdhui();
    const vivants = (liste || []).filter(function (d) { return estVente(d) && !d.archive; });
    const ligne = function (d, info) { return { id: d.id, nom: nomClient(d), montant: montant(d), info: info }; };
    const enAttente = function (d) { return U().attenteCourante && !!U().attenteCourante(d) && U().attenteClient(d).active; };
    const expires = [], relance2 = [];
    vivants.forEach(function (d) {
      if (ATTENTE.indexOf(d.statut) < 0 || d.client_accepted || enAttente(d)) return;
      const e = dateEnvoi(d), j = e ? U().joursEntre(e, a) : 0;
      if (j >= 30) expires.push(ligne(d, 'envoyé il y a ' + j + ' j'));
      else if (d.statut === 'relance_2') relance2.push(ligne(d, 'envoyé il y a ' + j + ' j'));
    });
    const parRaison = {};
    (liste || []).filter(function (d) { return estVente(d) && d.statut === 'refuse' && dans(dateRefus(d), per); }).forEach(function (d) {
      const r = String(d.raison_refus || '').trim() || 'Raison non dite';
      (parRaison[r] = parRaison[r] || []).push(ligne(d, 'refusé le ' + U().fmtDate(dateRefus(d))));
    });
    const tri = function (l) { return l.sort(function (x, y) { return y.montant - x.montant; }); };
    const somme = function (l) { return r2(l.reduce(function (s, x) { return s + x.montant; }, 0)); };
    return {
      expires: { dossiers: tri(expires), montant: somme(expires) },
      relance2: { dossiers: tri(relance2), montant: somme(relance2) },
      refus: Object.keys(parRaison).map(function (r) { return { raison: r, dossiers: tri(parRaison[r]), montant: somme(parRaison[r]) }; })
        .sort(function (x, y) { return (y.dossiers.length - x.dossiers.length) || (y.montant - x.montant); }),
    };
  }

  /* ── E — LES GRAPHES ─────────────────────────────────────────────────────────────────────────
     Les mois montrés suivent la période : de janvier au mois en cours pour « Cette année », les douze
     derniers sinon (un mois seul ne fait pas un graphe), vingt-quatre pour « Tout ». Chaque mois porte
     sa valeur ET celle du même mois l'an passé (en pointillés à l'écran). */
  function moisDuGraphe(per, auj) {
    const a = auj || U().aujourdhui();
    const n = per && per.cle === 'annee' ? Number(a.slice(5, 7)) : (per && per.cle === 'tout' ? 24 : 12);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1 - i, 1);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return out;
  }
  const moisAvant = function (k) { return (Number(k.slice(0, 4)) - 1) + k.slice(4); };
  function parMois(liste, factures, mois) {
    const cles = {};
    (mois || []).forEach(function (k) { cles[k] = 1; cles[moisAvant(k)] = 1; });
    const signe = {}, encaisse = {};
    Object.keys(cles).forEach(function (k) { signe[k] = 0; encaisse[k] = 0; });
    (liste || []).filter(function (d) { return estVente(d) && estSigne(d); }).forEach(function (d) {
      const k = dateSignature(d).slice(0, 7);
      if (signe[k] !== undefined) signe[k] = r2(signe[k] + montant(d));
    });
    (factures || []).forEach(function (f) {
      ((f && f.paiements) || []).forEach(function (p) { const k = jourDe(p.date).slice(0, 7); if (encaisse[k] !== undefined) encaisse[k] = r2(encaisse[k] + (Number(p.montant) || 0)); });
    });
    return (mois || []).map(function (k) {
      return { mois: k, signe: signe[k], signeAvant: signe[moisAvant(k)], encaisse: encaisse[k], encaisseAvant: encaisse[moisAvant(k)] };
    });
  }
  /** Un montant qui tient au-dessus d'une barre de 28 px : « 850 », « 2,1 k », « 10 k », « 125 k ». */
  function court(n) {
    const v = Math.round(Number(n) || 0);
    if (Math.abs(v) < 1000) return String(v);
    const k = v / 1000;
    return (Math.abs(k) < 10 ? (Math.round(k * 10) / 10).toLocaleString('fr-BE') : Math.round(k).toLocaleString('fr-BE')) + ' k';
  }
  const MOIS_COURT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  function libelleMois(k) { return MOIS_COURT[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4); }

  // ── LES CLIENTS ET LES VILLES DE LA PÉRIODE ─────────────────────────────────────────────────
  /** Les clients qui ont SIGNÉ dans la période, archives comprises (l'argent ne s'archive pas). La clé
   *  est celle du CRM (`clientKeyOf`) : deux « Client sans nom » ne se fondent plus en un seul. */
  function topClients(liste, per, n) {
    const par = {};
    (liste || []).filter(function (d) { return estVente(d) && estSigne(d) && dans(dateSignature(d), per); }).forEach(function (d) {
      const c = d.client || {};
      const k = (c.nom || c.prenom) ? U().clientKeyOf(c.prenom, c.nom) : 'id:' + d.id;
      const x = par[k] || (par[k] = { cle: k, nom: nomClient(d), nb: 0, montant: 0, id: d.id });
      x.nb++; x.montant = r2(x.montant + montant(d));
    });
    return Object.keys(par).map(function (k) { return par[k]; }).sort(function (a, b) { return b.montant - a.montant; }).slice(0, n || 8);
  }
  /** Les devis ENVOYÉS de la période par commune, et ce qui y a été signé. « Nivelles » et « NIVELLES »
   *  sont la même commune : on regroupe sans casse ni accents, et on affiche l'écriture la plus courante. */
  function villes(liste, per, n) {
    const par = {};
    (liste || []).filter(function (d) { return estVente(d) && dans(dateEnvoi(d), per); }).forEach(function (d) {
      const v = String((d.client && d.client.adresse && d.client.adresse.ville) || '').trim();
      if (!v) return;
      const k = sansAccents(v);
      const x = par[k] || (par[k] = { ville: v, graphies: {}, envoyes: 0, signes: 0, montant: 0 });
      x.graphies[v] = (x.graphies[v] || 0) + 1;
      x.envoyes++;
      if (estSigne(d)) { x.signes++; x.montant = r2(x.montant + montant(d)); }
    });
    return Object.keys(par).map(function (k) {
      const x = par[k];
      x.ville = Object.keys(x.graphies).sort(function (a, b) { return x.graphies[b] - x.graphies[a]; })[0];
      delete x.graphies;
      return x;
    }).sort(function (a, b) { return (b.envoyes - a.envoyes) || (b.montant - a.montant); }).slice(0, n || 8);
  }

  window.SSStats = {
    PERIODES: PERIODES, MOIS_NOM: MOIS_NOM,
    jourDe: jourDe, anneesAvant: anneesAvant, periode: periode, dans: dans,
    estIntervention: estIntervention, estVente: estVente, vendeur: vendeur, montant: montant,
    dateEnvoi: dateEnvoi, dateRefus: dateRefus, dateSignature: dateSignature,
    chiffres: chiffres, evolution: evolution, vendeurs: vendeurs, ventesParType: ventesParType,
    mediane: mediane, relancesAvant: relancesAvant, entonnoir: entonnoir,
    devisDeDemande: devisDeDemande, sources: sources, pertes: pertes,
    moisDuGraphe: moisDuGraphe, parMois: parMois, court: court, libelleMois: libelleMois,
    topClients: topClients, villes: villes, paye: paye,
  };
})();
