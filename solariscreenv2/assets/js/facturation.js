// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LA FACTURATION (page Facturation)
// Script classique (file:// OK). Global : window.SSFact
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// Les montants d'une facture, ce qu'il reste à facturer, ce qu'il faut relancer, comment répartir
// un virement : c'est de l'ARGENT, donc des fonctions PURES testées (`tests/facturation.test.html`).
// Ce qui est DÛ vit dans `ui.js` (`duFacture`, `statutFacture`, règle 4) ; les quantités suivent la
// règle de l'argent (`SSRemu.quantiteDe`) — jamais `quantite || 1` (piège déjà payé).
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  const quantite = function (it) { return window.SSRemu.quantiteDe(it); };
  const r2 = function (x) { return Math.round((Number(x) || 0) * 100) / 100; };
  const paye = function (f) { return ((f && f.paiements) || []).reduce(function (s, p) { return s + (Number(p.montant) || 0); }, 0); };
  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function plusJours(iso, n) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return U().isoDate(d); }

  // ── Ce qui est déjà facturé, et la part posée ────────────────────────────────────────────────
  /** Une note de crédit porte un total NÉGATIF : elle vient en déduction et rouvre le devis. */
  function dejaFacture(devisId, factures) {
    return r2((factures || []).filter(function (f) { return f && f.devis_id === devisId; })
      .reduce(function (s, f) { return s + (Number(f.total_ttc) || 0); }, 0));
  }
  /** Part du devis réellement posée, en fraction de sa VALEUR (pas du nombre d'ouvertures). */
  function partPosee(devis, poses) {
    const items = (devis && devis.items) || [];
    const n = function (it, i) { const q = quantite(it); return Math.max(0, Math.min(q, poses && poses[i] != null ? Number(poses[i]) || 0 : q)); };
    let total = 0, retenu = 0;
    items.forEach(function (it, i) { const pu = Number(it.prix_catalogue_ht) || 0; total += quantite(it) * pu; retenu += n(it, i) * pu; });
    // Sans prix unitaire, on compte les ouvertures — sinon 0/0 et une facture nulle sans explication.
    if (total <= 0) {
      let qT = 0, qR = 0;
      items.forEach(function (it, i) { qT += quantite(it); qR += n(it, i); });
      return qT > 0 ? qR / qT : 1;
    }
    return retenu / total;
  }

  /** Les montants d'une nouvelle facture. `saisie` = { unite: 'pct'|'eur', valeur, poses }.
   *  Jamais plus que ce qui reste à facturer ; `plafonne` dit quand on a dû réduire. */
  function montants(devis, factures, type, saisie) {
    const s = saisie || {};
    const c = (devis && devis.calculs) || {};
    const ttc = Number(c.total_ttc) || 0, ht = Number(c.total_ht) || 0, tva = Number(c.total_tva) || 0;
    const already = dejaFacture(devis && devis.id, factures);
    const remaining = Math.max(0, ttc - already);
    let factor = 0, voulu = null, part = 1;
    if (type === 'acompte') {
      voulu = s.unite === 'eur' ? (Number(s.valeur) || 0) : ttc * ((Number(s.valeur) || 0) / 100);
      factor = ttc > 0 ? Math.max(0, Math.min(voulu, remaining)) / ttc : 0;
    } else if (type === 'solde') {
      factor = ttc > 0 ? remaining / ttc : 0;
    } else if (type === 'partielle') {
      part = partPosee(devis, s.poses);
      factor = ttc > 0 ? Math.max(0, Math.min(ttc * part - already, remaining)) / ttc : 0;
    } else {   // totale : une facture unique, seulement si RIEN n'a encore été facturé
      factor = already > 0.005 ? 0 : 1;
    }
    return { total_ht: ht * factor, total_tva: tva * factor, total_ttc: ttc * factor, tva_pct: Number(c.tva_pct) || 6,
      factor: factor, already: already, ttc: ttc, remaining: remaining, voulu: voulu, part: part,
      plafonne: voulu != null && voulu - ttc * factor > 0.005 };
  }

  const fmtNombre = function (n) { return Number(n).toLocaleString('fr-BE', { maximumFractionDigits: 2 }); };
  /** Le libellé d'un acompte, tel que le CLIENT le lit sur sa facture. En euros, il imprimait
   *  « Acompte de 2000 % » (la valeur saisie, collée devant un « % ») ; plafonné, il annonçait un
   *  pourcentage que le montant ne faisait plus. Dans ces deux cas, on écrit le MONTANT. */
  function libelleAcompte(devis, a, saisie) {
    const quoi = devis && devis.type_document === 'depannage' ? 'dépannage' : 'devis';
    if (saisie && saisie.unite !== 'eur' && !a.plafonne) return 'Acompte de ' + fmtNombre(saisie.valeur) + ' % sur ' + quoi + ' N° ' + devis.id;
    return 'Acompte de ' + U().fmtEur(r2(a.total_ttc)) + ' TVAC sur ' + quoi + ' N° ' + devis.id;
  }
  /** Les lignes d'une facture. Les noms de produits viennent de `SSUI.TYPE_LABEL` (règle 10) ; les
   *  quantités de `quantiteDe` : une ligne à zéro n'est pas facturée « 1 », elle ne s'imprime pas. */
  function lignes(devis, type, a, saisie) {
    const quoi = devis.type_document === 'depannage' ? 'dépannage' : 'devis';
    if (type === 'totale') {
      const out = ((devis.items) || []).filter(function (it) { return quantite(it) > 0; }).map(function (it) {
        const q = quantite(it), pu = Number(it.prix_catalogue_ht) || 0;
        return { desc: (U().TYPE_LABEL[it.type] || it.type || 'Ouverture') + (it.modele ? ' — ' + it.modele : ''),
          sub: [it.moteur, it.emplacement].filter(Boolean).join(' · '), dims: U().dimsOf(it) || '—', qty: q, pu: pu, total: r2(pu * q) };
      });
      // Même structure que le devis : fournitures BRUTES + remise, pose BRUTE + remise.
      const c = devis.calculs || {};
      const rc = (c.remise_catalogue && c.remise_catalogue.amount) || 0;
      if (rc > 0) out.push({ desc: 'Remise commerciale', qty: 1, pu: -rc, total: -rc });
      if (c.install_total_brut > 0) out.push({ desc: 'Installation et pose', qty: 1, pu: c.install_total_brut, total: c.install_total_brut });
      const ri = ((c.remise_installation && c.remise_installation.amount) || 0) + ((c.remise_outillage && c.remise_outillage.amount) || 0);
      if (ri > 0) out.push({ desc: 'Remise commerciale', qty: 1, pu: -ri, total: -ri });
      (c.extra_lines || []).forEach(function (e) { out.push({ desc: e.label, qty: e.qty, pu: e.unit_price_ht, total: e.total_ht }); });
      const surplus = devis.pricing_v2 && devis.pricing_v2.surplus_difficulte;
      if (surplus > 0) out.push({ desc: 'Supplément accès difficile', qty: 1, pu: surplus, total: surplus });
      return out;
    }
    if (type === 'partielle') {
      const items = devis.items || [], poses = (saisie && saisie.poses) || [];
      let nPose = 0, nTot = 0;
      items.forEach(function (it, i) { const q = quantite(it); nTot += q; nPose += poses[i] != null ? Math.max(0, Math.min(q, Number(poses[i]) || 0)) : q; });
      return [{ desc: 'Travaux exécutés sur devis N° ' + devis.id + ' — ' + nPose + ' ouverture' + (nPose > 1 ? 's' : '') + ' posée' + (nPose > 1 ? 's' : '') + ' sur ' + nTot,
        sub: nTot > nPose ? 'Ouvertures posées à ce jour — le solde sera facturé après la pose des ' + (nTot - nPose) + ' restantes' : '',
        qty: 1, pu: r2(a.total_ht), total: r2(a.total_ht) }];
    }
    const desc = type === 'acompte' ? libelleAcompte(devis, a, saisie) : 'Solde sur ' + quoi + ' N° ' + devis.id;
    return [{ desc: desc, qty: 1, pu: r2(a.total_ht), total: r2(a.total_ht) }];
  }

  /* ── A — À facturer maintenant ────────────────────────────────────────────────────────────────
     Les mêmes faits que le tableau de bord (signature, pose faite, pourcentage d'acompte du devis,
     dépannage sans acompte — règle 7), mais la question est AUTRE : il ne s'agit pas de ce que le
     client doit, il s'agit de ce qu'on n'a pas encore FACTURÉ. Le tableau de bord dit « Acompte à
     encaisser » dans les deux cas ; ici on sépare « à facturer » de « à encaisser ». */
  function aFacturer(liste, factures, ref) {
    const auj = ref || U().aujourdhui();
    const out = [];
    (liste || []).forEach(function (d) {
      if (!d || d.archive || ['signe', 'termine'].indexOf(d.statut) < 0) return;
      const ttc = Number(d.ttc) || 0;
      if (ttc <= 0) return;
      const facs = (factures || []).filter(function (f) { return f && f.devis_id === d.id; });
      const net = dejaFacture(d.id, factures);
      const reste = r2(ttc - net);
      if (reste <= 0.005) return;
      if (d.type_document === 'depannage') {
        // Un dépannage se facture en une fois, une fois l'intervention faite.
        if (d.depannage_mode === 'realise' || d.statut === 'termine') out.push({ devis: d, type: net > 0.005 ? 'solde' : 'totale', libelle: 'Facturer l’intervention', montant: reste, ordre: 0 });
        return;
      }
      if (U().isPoseDone(d)) {
        // Une seconde pose prévue (chantier en deux fois) : on facture ce qui est posé, une fois.
        const encore = d.chantier && d.chantier.date_pose && String(d.chantier.date_pose).slice(0, 10) >= auj;
        if (encore) {
          if (!facs.some(function (f) { return f.type === 'partielle' && !U().factureAnnulee(f, factures); })) out.push({ devis: d, type: 'partielle', libelle: 'Facturer ce qui est posé', montant: null, ordre: 1 });
          return;
        }
        out.push({ devis: d, type: 'solde', libelle: 'Facturer le solde', montant: reste, ordre: 0 });
        return;
      }
      if (d.statut === 'signe') {
        const pct = d.acompte_pct != null ? Number(d.acompte_pct) : 30;
        const acomptes = facs.filter(function (f) { return f.type === 'acompte' && !U().factureAnnulee(f, factures); });
        const attendu = r2(ttc * pct / 100);
        if (pct > 0 && !acomptes.length && net < attendu - 0.005) {
          out.push({ devis: d, type: 'acompte', pct: pct, libelle: 'Facturer l’acompte de ' + fmtNombre(pct) + ' %', montant: r2(attendu - Math.max(0, net)), ordre: 2 });
        }
      }
    });
    return out.sort(function (a, b) { return (a.ordre - b.ordre) || String(b.devis.date_modification || '').localeCompare(String(a.devis.date_modification || '')); });
  }

  /* ── C — Par chantier ─────────────────────────────────────────────────────────────────────────
     Un dossier, c'est un acompte, un solde, parfois une note de crédit : lus séparément, ils ne
     disent pas si le chantier est réglé. Ici : le devis, ce qui est facturé (net des notes de
     crédit), encaissé, dû, et ce qui reste à facturer. */
  function parChantier(factures, liste) {
    const groupes = {};
    (factures || []).forEach(function (f) { if (!f) return; const k = f.devis_id || ('sans-devis:' + f.id); (groupes[k] = groupes[k] || []).push(f); });
    return Object.keys(groupes).map(function (k) {
      const fs = groupes[k].sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)); });
      const d = (liste || []).filter(function (x) { return x && x.id === k; })[0] || null;
      const devisTtc = d ? (Number(d.ttc) || 0) : null;
      const facture = r2(fs.reduce(function (s, f) { return s + (Number(f.total_ttc) || 0); }, 0));
      return {
        devisId: d ? k : (fs[0].devis_id || ''), devis: d, factures: fs, client: fs[fs.length - 1].client || {},
        devisTtc: devisTtc, facture: facture, encaisse: r2(fs.reduce(function (s, f) { return s + paye(f); }, 0)),
        du: r2(fs.reduce(function (s, f) { return s + U().duFacture(f, factures); }, 0)),
        enRetard: fs.some(function (f) { return U().factureEnRetard(f, factures); }),
        resteAFacturer: devisTtc != null ? Math.max(0, r2(devisTtc - facture)) : 0,
        derniere: fs.reduce(function (m, f) { return String(f.date || '') > m ? String(f.date) : m; }, ''),
      };
    }).sort(function (a, b) {
      return (b.enRetard - a.enRetard) || ((b.du > 0.005) - (a.du > 0.005)) || ((b.resteAFacturer > 0.005) - (a.resteAFacturer > 0.005))
        || b.derniere.localeCompare(a.derniere);
    });
  }

  /* ── D — Les relances de paiement, tracées ────────────────────────────────────────────────────
     Elles n'existaient que dans le client mail : impossible de savoir si on avait déjà relancé, ni
     quand. Chaque relance s'écrit par sa route ciblée ; la suivante est proposée une semaine après. */
  const RELANCE_ECART_J = 7;
  function relancesDe(f) {
    const l = ((f && f.relances) || []).slice().sort(function (a, b) { return String(a.le || '').localeCompare(String(b.le || '')); });
    const derniere = l.length ? String(l[l.length - 1].le || '').slice(0, 10) : '';
    return { n: l.length, derniere: derniere, prochaine: derniere ? plusJours(derniere, RELANCE_ECART_J) : '' };
  }
  function aRelancer(f, factures, ref) {
    if (!U().factureEnRetard(f, factures)) return false;
    const r = relancesDe(f);
    return !r.n || r.prochaine <= (ref || U().aujourdhui());
  }
  /** Le texte du rappel. Il réclame ce qui est DÛ (notes de crédit et paiements déduits) : il
   *  réclamait le total, y compris un montant déjà annulé. */
  function texteRelance(f, factures, co) {
    const cl = (f && f.client) || {};
    const du = U().duFacture(f, factures), nc = U().avoirsSur(factures, f.id), p = paye(f);
    const r = relancesDe(f);
    const deduit = nc > 0.005 || p > 0.005;
    const corps = 'Bonjour ' + [cl.prenom, cl.nom].filter(Boolean).join(' ') + ',\n\n'
      + 'Sauf erreur de notre part, la facture n°' + f.id + ' du ' + U().fmtDate(f.date) + ' (échéance le ' + U().fmtDate(f.echeance) + ') n’est pas encore réglée : '
      + 'il reste ' + U().fmtEur(du) + ' à percevoir'
      + (deduit ? ' (sur ' + U().fmtEur(Number(f.total_ttc) || 0) + (nc > 0.005 ? ', note de crédit de ' + U().fmtEur(nc) + ' déduite' : '') + (p > 0.005 ? (nc > 0.005 ? ' et ' : ', ') + U().fmtEur(p) + ' déjà reçus' : '') + ')' : '')
      + '.\n\nLe règlement peut être effectué sur le compte ' + ((co && co.iban) || '') + ' avec la communication « ' + f.id + ' ».\n\n'
      + 'Si le paiement a été effectué ces derniers jours, merci de ne pas tenir compte de ce message.\n\nBien à vous,\n' + ((co && co.name) || 'SolariScreen');
    return { sujet: (r.n ? 'Nouveau rappel de paiement' : 'Rappel de paiement') + ' — facture ' + f.id + ' (SolariScreen)', corps: corps, du: du };
  }

  /* ── E — Répartir un virement sur les factures du dossier ─────────────────────────────────────
     Le client règle l'acompte et le solde d'un seul virement : saisi sur la facture d'acompte, il
     faisait un trop-perçu (solde négatif) pendant que le solde restait « en retard ». La facture
     choisie d'abord, puis les autres du même dossier, de la plus ancienne à la plus récente, chacune
     jusqu'à ce qu'elle doit ; ce qui dépasse tout le dossier reste un EXCÉDENT, dit tel quel. */
  function repartir(montant, f0, factures) {
    const autres = (factures || []).filter(function (f) { return f && f !== f0 && f.id !== f0.id && f.type !== 'avoir' && f0.devis_id && f.devis_id === f0.devis_id; })
      .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)); });
    let reste = r2(montant);
    const out = [];
    [f0].concat(autres).forEach(function (f) {
      const du = U().duFacture(f, factures);
      if (du <= 0.005 || reste <= 0.005) return;
      const m = r2(Math.min(du, reste));
      out.push({ id: f.id, type: f.type, montant: m, du: du });
      reste = r2(reste - m);
    });
    return { lignes: out, excedent: reste };
  }

  // ── F — Le suivi SysCore / Falco ─────────────────────────────────────────────────────────────
  /** Toute pièce d'ici a sa pièce officielle là-bas, note de crédit comprise. */
  function sansFalco(factures) { return (factures || []).filter(function (f) { return f && !String(f.ref_externe || '').trim(); }); }

  /** La recherche : n°, référence Falco, client, n° de devis — sans tenir compte des accents. */
  function correspond(f, q) {
    const qs = sansAccents(q).trim();
    if (!qs) return true;
    const cl = (f && f.client) || {};
    const texte = sansAccents([f.id, f.ref_externe, cl.prenom, cl.nom, f.devis_id, f.avoir_de].filter(Boolean).join(' '));
    return qs.split(/\s+/).every(function (m) { return texte.indexOf(m) >= 0; });
  }

  /* ── G — L'export pour le comptable ───────────────────────────────────────────────────────────
     Un CSV qu'Excel ouvre tel quel (UTF-8 avec BOM, « ; », virgule décimale) : une ligne par pièce
     de la période, avec sa référence Falco — c'est elle qui permet le rapprochement. */
  const STATUT_EXPORT = { avoir: 'Note de crédit', annulee: 'Annulée', payee: 'Payée', partielle: 'Partiellement payée', impayee: 'À payer' };
  function csv(factures, du, au) {
    const toutes = factures || [];
    const rows = toutes.filter(function (f) { const d = String(f.date || ''); return (!du || d >= du) && (!au || d <= au); })
      .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)); });
    const num = function (n) { return r2(n).toFixed(2).replace('.', ','); };
    const cell = function (v) { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const tete = ['Numéro', 'Réf. SysCore/Falco', 'Type', 'Date', 'Échéance', 'Client', 'Devis', 'HT', 'TVA', 'TTC', 'Encaissé', 'Reste dû', 'Statut'];
    const corps = rows.map(function (f) {
      const st = U().statutFacture(f, toutes);
      const cl = f.client || {};
      return [f.id, f.ref_externe || '', (U().TYPE_FACTURE_LABEL[f.type] || f.type), f.date || '', f.type === 'avoir' ? '' : (f.echeance || ''),
        [cl.prenom, cl.nom].filter(Boolean).join(' '), f.devis_id || '', num(f.total_ht), num(f.total_tva), num(f.total_ttc), num(paye(f)),
        num(U().duFacture(f, toutes)), (U().factureEnRetard(f, toutes) ? 'En retard' : STATUT_EXPORT[st] || st)].map(cell).join(';');
    });
    return '﻿' + [tete.join(';')].concat(corps).join('\r\n');
  }

  window.SSFact = {
    RELANCE_ECART_J: RELANCE_ECART_J,
    sansAccents: sansAccents, dejaFacture: dejaFacture, partPosee: partPosee, montants: montants,
    libelleAcompte: libelleAcompte, lignes: lignes, aFacturer: aFacturer, parChantier: parChantier,
    relancesDe: relancesDe, aRelancer: aRelancer, texteRelance: texteRelance, repartir: repartir,
    sansFalco: sansFalco, correspond: correspond, csv: csv,
  };
})();
