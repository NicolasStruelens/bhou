// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — ATTENTE : la source unique du « QUI DOIT AGIR »
// Script classique (file:// OK). Global : window.SSAttente
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
// Quatre modules savaient déjà dire « ça attend quelqu'un » — les demandes de RDV avec leur brief
// « À traiter », le planning avec ses conflits et ses rendez-vous orphelins, le SAV avec ses
// tickets ouverts, les Échanges avec leur `awaiting`. Aucun ne parlait aux trois autres.
// Pour savoir ce qui l'attendait, il fallait donc ouvrir quatre écrans. Personne ne le fait, et
// c'est exactement là que les choses se perdent : « par téléphone, par mail ou par SMS, après ça
// se perd, aucune décision n'est prise et on reste sans rien faire ».
//
// LA RÈGLE QUE CE MODULE IMPOSE
// Une chose sans NOM dessus n'avance pas : chacun croit que l'autre s'en occupe.
// Une chose sans DATE n'est jamais urgente.
// Donc : ce qui n'a personne passe devant tout le reste, et l'ancienneté finit par gêner.
//
// Fonctions PURES (sauf `charger()`), testées dans `tests/attente.test.html`.
(function () {
  'use strict';

  const SSUI = window.SSUI || {};

  // ── Seuils. Nommés et rassemblés : un délai métier enfoui dans une condition finit toujours
  //    par diverger d'un écran à l'autre. Ceux des leads viennent de rdv.html, qui les avait
  //    déjà éprouvés — on ne les réinvente pas, on les déménage ici.
  const SEUILS = {
    LEAD_ATTENTION_H: 4,      // contact entrant que personne n'a pris
    LEAD_CRITIQUE_H: 24,      // … un client qui attend un jour appelle le concurrent
    CONTACT_RELANCE_J: 2,     // demande sans rendez-vous fixé
    SAV_SANS_SUITE_J: 3,      // ticket ouvert qui n'a pas bougé
    ATTENTE_LONGUE_J: 3,      // une question qui dort
    ATTENTE_TRES_LONGUE_J: 7, // … et qui devient gênante
  };

  // Urgence : 3 = personne ne s'en occupe ou c'est cassé, 0 = simple rappel.
  const URGENCE = { CRITIQUE: 3, HAUTE: 2, MOYENNE: 1, BASSE: 0 };
  const URGENCE_LABEL = { 3: 'Critique', 2: 'Urgent', 1: 'À faire', 0: 'Pour info' };

  const SOURCES = {
    rdv:       { label: 'Demande',   icone: 'bellphone', couleur: 'var(--accent)' },
    planning:  { label: 'Planning',  icone: 'calendar',  couleur: 'var(--accent-2)' },
    sav:       { label: 'SAV',       icone: 'warning',   couleur: 'var(--danger)' },
    echange:   { label: 'Échange',   icone: 'message',   couleur: 'var(--warn)' },
  };

  // ── Temps ─────────────────────────────────────────────────────────────────────────────────
  // Toujours en dates locales : `toISOString().slice(0,10)` renvoie une date UTC, donc LA VEILLE
  // entre minuit et 2 h du matin en heure d'été belge.
  function aujourdhui() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function demain() {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function heuresDepuis(iso) {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 3600000)) : 0;
  }
  function joursDepuis(iso) { return Math.floor(heuresDepuis(iso) / 24); }
  /** « 3 h », « 5 j » — l'ancienneté doit se lire d'un coup d'œil, c'est elle qui gêne. */
  function age(iso) {
    const h = heuresDepuis(iso);
    if (h < 1) return 'à l’instant';
    if (h < 24) return h + ' h';
    return Math.floor(h / 24) + ' j';
  }
  /** « depuis 3 j » pour ce qui traîne, « dans 2 j » pour ce qui vient. Tout n'est pas en retard :
   *  un rendez-vous de la semaine prochaine affiché « depuis à l'instant » ne veut rien dire. */
  function delai(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    const ecart = Date.now() - t;
    if (ecart >= 0) return 'depuis ' + age(iso);
    const h = Math.ceil(-ecart / 3600000);
    return h < 24 ? 'dans ' + h + ' h' : 'dans ' + Math.round(h / 24) + ' j';
  }

  function nomClient(c) {
    const o = c || {};
    return ((o.prenom || '') + ' ' + (o.nom || '')).trim() || 'Sans nom';
  }
  function cleClient(c) {
    const o = c || {};
    const n = String(o.nom || '').trim().toLowerCase();
    const p = String(o.prenom || '').trim().toLowerCase();
    return (n || p) ? (n + '|' + p).replace(/\s+/g, ' ') : '';
  }

  /** Le devis qui correspond à une demande de RDV.
   *  • lien EXPLICITE : `devis.rdv_id` (posé par « Créer le devis ») ou `rdv.devis_id` ;
   *  • lien PROBABLE : même client, pour un devis établi directement au simulateur.
   *  Sans ce rapprochement, une demande visitée dont le devis a été fait ailleurs restait
   *  « en attente du devis » POUR TOUJOURS — l'ERP ne pouvait pas savoir qu'il était parti. */
  function devisDeRdv(rdv, devis) {
    if (!rdv) return null;
    const liste = devis || [];
    const explicite = liste.filter(function (d) {
      return (rdv.devis_id && String(d.id) === String(rdv.devis_id))
          || (d.rdv_id && String(d.rdv_id) === String(rdv.id));
    })[0];
    if (explicite) return { devis: explicite, lien: 'explicite' };
    const cle = cleClient(rdv.client);
    if (!cle) return null;
    // Le plus RÉCENT : un client peut avoir plusieurs devis, c'est celui qui suit la visite
    // qui nous intéresse.
    const proches = liste.filter(function (d) { return d && !d.archive && cleClient(d.client) === cle; })
      .sort(function (a, b) { return String(b.date_creation || '').localeCompare(String(a.date_creation || '')); });
    return proches.length ? { devis: proches[0], lien: 'probable' } : null;
  }

  /** Fabrique un élément d'attente. `qui` vide = PERSONNE, et c'est le cas le plus grave. */
  function item(o) {
    return {
      id: o.id, source: o.source, ref: o.ref || '', sousref: o.sousref || '',
      qui: o.qui || '',
      titre: o.titre || '', quoi: o.quoi || '', detail: o.detail || '',
      // `nature` : pour un élément du planning, dit s'il s'agit d'une pose ou d'un dépannage —
      // les deux ne s'attribuent pas dans le même champ du dossier.
      nature: o.nature || '',
      depuis: o.depuis || '', urgence: o.urgence == null ? URGENCE.MOYENNE : o.urgence,
      href: o.href || '',
      // `peutPrendre` : l'attribution peut se faire d'un clic depuis l'écran commun, sans passer
      // par la fiche. C'est ce saut d'écran qui casse le geste et fait qu'on remet à plus tard.
      peutPrendre: !!o.peutPrendre,
      devis_id: o.devis_id || '', rdv_id: o.rdv_id || '', sujet_id: o.sujet_id || '', ticket_id: o.ticket_id || '',
    };
  }

  // ── DEMANDES DE RDV ───────────────────────────────────────────────────────────────────────
  // Règles reprises telles quelles du brief de rdv.html, qui les avait déjà éprouvées.
  /** Signale un devis resté en brouillon pour cette demande. Renvoie `true` si un devis a été
   *  trouvé (brouillon ou non) — l'appelant sait alors qu'il n'a plus à en réclamer un. */
  function devisEnBrouillon(r, devis, out, nom, href) {
    const lien = devisDeRdv(r, devis);
    if (!lien) return false;
    if (String(lien.devis.statut || 'brouillon') === 'brouillon') {
      out.push(item({
        id: 'rdv:' + r.id + ':devisbrouillon', source: 'rdv', ref: r.id, rdv_id: r.id,
        devis_id: lien.devis.id,
        qui: r.assigned_to || '', titre: nom, quoi: 'Devis commencé, pas encore envoyé',
        detail: 'Devis #' + lien.devis.id + (lien.lien === 'probable' ? ' (rapproché par le nom du client)' : ''),
        depuis: lien.devis.date_modification || r.date_modification,
        href: 'vue.html?id=' + encodeURIComponent(lien.devis.id), urgence: URGENCE.HAUTE,
      }));
    }
    return true;
  }

  function depuisRdv(rdvs, devis) {
    const out = [];
    const auj = aujourdhui(), dem = demain();
    (rdvs || []).forEach(function (r) {
      if (!r || r.statut === 'annule') return;
      const nom = nomClient(r.client);
      const href = 'rdv.html?open=' + encodeURIComponent(r.id);
      // Une demande CONVERTIE a quitté le circuit : l'affaire vit dans le devis, et les relances
      // du devis prennent le relais. Une seule exception se rattrape ici — le devis est resté en
      // brouillon : la demande est classée, le travail semble fait, et personne ne revient voir
      // qu'il n'est jamais parti.
      if (r.statut === 'converti') { devisEnBrouillon(r, devis, out, nom, href); return; }
      if (!r.assigned_to) {
        const h = heuresDepuis(r.date_creation);
        out.push(item({
          id: 'rdv:' + r.id + ':nonpris', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: '', titre: nom, quoi: 'Personne ne l’a prise en charge',
          detail: r.projet || r.source || '', depuis: r.date_creation, href: href, peutPrendre: true,
          urgence: h >= SEUILS.LEAD_CRITIQUE_H ? URGENCE.CRITIQUE : (h >= SEUILS.LEAD_ATTENTION_H ? URGENCE.HAUTE : URGENCE.MOYENNE),
        }));
      }
      if (r.awaiting) {
        const dernier = (r.comments || []).slice().reverse().filter(function (c) { return c.ask; })[0];
        out.push(item({
          id: 'rdv:' + r.id + ':reponse', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: r.awaiting, titre: nom, quoi: 'Une réponse t’est demandée',
          detail: dernier ? String(dernier.text).slice(0, 120) : '',
          depuis: (dernier && dernier.date) || r.date_modification, href: href, urgence: URGENCE.HAUTE,
        }));
      }
      if (r.statut === 'rdv_fixe' && r.date_rdv && String(r.date_rdv).slice(0, 10) === dem) {
        out.push(item({
          id: 'rdv:' + r.id + ':demain', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: r.assigned_to || '', titre: nom, quoi: 'Visite demain — penser au rappel',
          depuis: r.date_modification, href: href, urgence: URGENCE.HAUTE,
        }));
      }
      // « À recontacter » ne vaut que si QUELQU'UN s'en occupe déjà. Sans personne dessus, la ligne
      // ci-dessus dit la même chose et appelle le même geste : deux lignes pour un seul client
      // font douter de toute la liste.
      if (r.assigned_to && ['nouveau', 'a_contacter'].indexOf(r.statut) >= 0 && !r.date_rdv) {
        if (joursDepuis(r.date_creation) >= SEUILS.CONTACT_RELANCE_J) {
          out.push(item({
            id: 'rdv:' + r.id + ':recontacter', source: 'rdv', ref: r.id, rdv_id: r.id,
            qui: r.assigned_to, titre: nom, quoi: 'À recontacter — aucun rendez-vous fixé',
            depuis: r.date_creation, href: href, urgence: URGENCE.HAUTE,
          }));
        }
      }
      if (r.statut === 'rdv_fixe' && r.date_rdv && String(r.date_rdv).slice(0, 10) < auj) {
        out.push(item({
          id: 'rdv:' + r.id + ':passee', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: r.assigned_to || '', titre: nom, quoi: 'Visite passée — et le devis ?',
          depuis: r.date_rdv, href: href, urgence: URGENCE.HAUTE,
        }));
      }
      // Après la visite, c'est le DEVIS qui fait avancer l'affaire : on regarde son état RÉEL au
      // lieu de supposer. Un devis déjà parti ne doit plus être réclamé — avant, « en attente du
      // devis » restait affiché pour toujours, puisque rien ne reliait la demande au devis.
      if (r.statut === 'visite' && !devisEnBrouillon(r, devis, out, nom, href)) {
        out.push(item({
          id: 'rdv:' + r.id + ':sansdevis', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: r.assigned_to || '', titre: nom, quoi: 'Visité, en attente du devis',
          depuis: r.date_modification, href: href, urgence: URGENCE.MOYENNE,
        }));
      }
      if (r.rappel_date && r.rappel_date <= auj) {
        out.push(item({
          id: 'rdv:' + r.id + ':rappel', source: 'rdv', ref: r.id, rdv_id: r.id,
          qui: r.assigned_to || '', titre: nom, quoi: 'Rappel prévu aujourd’hui',
          depuis: r.rappel_date, href: href, urgence: URGENCE.MOYENNE,
        }));
      }
    });
    return out;
  }

  // ── SAV ───────────────────────────────────────────────────────────────────────────────────
  // Le SAV n'avait NI responsable NI échéance : un ticket ouvert n'attendait personne nommément.
  // C'est le cas le plus grave — un client mécontent, et rien ne dit qui s'en occupe.
  function depuisSav(devis) {
    const out = [];
    (devis || []).forEach(function (d) {
      if (!d || d.archive) return;
      (d.sav_tickets || []).forEach(function (t) {
        if (!t || t.statut === 'resolu') return;
        const nom = nomClient(d.client);
        const j = joursDepuis(t.date_creation);
        const sansPersonne = !t.pour;
        out.push(item({
          id: 'sav:' + d.id + ':' + t.id, source: 'sav', ref: d.id, devis_id: d.id, ticket_id: t.id,
          qui: t.pour || '', titre: nom,
          quoi: sansPersonne ? 'Ticket SAV sans responsable' : (t.statut === 'en_cours' ? 'Ticket SAV en cours' : 'Ticket SAV ouvert'),
          detail: String(t.description || '').slice(0, 120),
          depuis: t.date_creation, href: 'vue.html?id=' + encodeURIComponent(d.id) + '#sav', peutPrendre: true,
          urgence: sansPersonne && j >= SEUILS.SAV_SANS_SUITE_J ? URGENCE.CRITIQUE
                 : (sansPersonne ? URGENCE.HAUTE : (j >= SEUILS.SAV_SANS_SUITE_J ? URGENCE.HAUTE : URGENCE.MOYENNE)),
        }));
      });
    });
    return out;
  }

  // ── PLANNING ──────────────────────────────────────────────────────────────────────────────
  // Lit le moteur du temps plutôt que de recalculer : un conflit doit se dire de la même façon
  // dans le planning et ici, sinon les deux écrans finiront par se contredire.
  /** @param options.inclureVisites  L'écran commun les EXCLUT (les demandes de RDV les signalent
   *   déjà, et une liste qui se répète perd la confiance qu'on lui accorde) ; le planning, lui,
   *   les inclut : c'est son écran, une visite orpheline doit y rester visible. */
  function depuisPlanning(evenements, devisAPlanifier, reglages, options, devisACommander) {
    const P = window.SSPlanning;
    if (!P) return [];                     // planning.js absent : on saute, on ne devine pas
    const avecVisites = !!(options && options.inclureVisites);
    const garder = function (e) { return e.source !== 'indispo' && (avecVisites || e.source !== 'visite'); };
    const out = [];
    const auj = aujourdhui();
    const futurs = (evenements || []).filter(function (e) { return e.date >= auj; });

    futurs.filter(function (e) { return garder(e) && !e.qui.length; }).forEach(function (e) {
      out.push(item({
        id: 'plan:' + e.id + ':orphelin', source: 'planning', ref: e.ref,
        devis_id: e.source === 'visite' ? '' : e.ref, rdv_id: e.source === 'visite' ? e.ref : '',
        nature: e.source,
        qui: '', titre: e.titre, quoi: 'Rendez-vous sans personne attribuée',
        detail: (P.NATURES[e.source] || {}).label + ' le ' + (SSUI.fmtDate ? SSUI.fmtDate(e.date) : e.date),
        depuis: e.date, href: e.href, peutPrendre: true, urgence: URGENCE.CRITIQUE,
      }));
    });
    P.conflits(futurs, reglages).forEach(function (c) {
      out.push(item({
        id: 'plan:conflit:' + c.qui + ':' + c.date + ':' + c.a.id + ':' + c.b.id, source: 'planning',
        qui: c.qui, titre: c.a.titre + ' / ' + c.b.titre,
        quoi: 'Deux rendez-vous à la même heure',
        detail: (SSUI.fmtDate ? SSUI.fmtDate(c.date) : c.date) + ' — ' + c.a.titre + ' et ' + c.b.titre,
        depuis: c.date, href: 'planning.html?vue=jour&date=' + c.date, urgence: URGENCE.CRITIQUE,
      }));
    });
    (evenements || []).filter(function (e) { return garder(e) && e.date < auj; }).forEach(function (e) {
      out.push(item({
        id: 'plan:' + e.id + ':passe', source: 'planning', ref: e.ref,
        devis_id: e.source === 'visite' ? '' : e.ref, rdv_id: e.source === 'visite' ? e.ref : '',
        nature: e.source,
        qui: e.qui[0] || '', titre: e.titre, quoi: 'Rendez-vous passé sans suite',
        detail: (P.NATURES[e.source] || {}).label + ' du ' + (SSUI.fmtDate ? SSUI.fmtDate(e.date) : e.date),
        depuis: e.date, href: e.href, peutPrendre: !e.qui.length, urgence: URGENCE.HAUTE,
      }));
    });
    (devisAPlanifier || []).forEach(function (d) {
      out.push(item({
        id: 'plan:' + d.id + ':aplanifier', source: 'planning', ref: d.id, devis_id: d.id,
        qui: '', titre: nomClient(d.client), quoi: 'Matériel reçu, pose à planifier',
        detail: (SSUI.resumeDevis && SSUI.resumeDevis(d)) || '',
        depuis: d.date_modification, href: 'planning.html', urgence: URGENCE.HAUTE,
      }));
    });
    /* La contrepartie : un chantier signé dont le matériel n'est pas commandé. Sans cette ligne,
       conditionner la pose à la réception créerait un angle mort — un devis signé et oublié ne
       serait plus réclamé par personne. Et c'est la bonne action à montrer : sur un dossier qui
       n'est pas parti chez le fournisseur, ce qu'il faut faire, c'est commander. */
    (devisACommander || []).forEach(function (d) {
      out.push(item({
        id: 'plan:' + d.id + ':acommander', source: 'planning', ref: d.id, devis_id: d.id,
        qui: '', titre: nomClient(d.client), quoi: 'Chantier signé, matériel pas commandé',
        detail: (SSUI.resumeDevis && SSUI.resumeDevis(d)) || '',
        depuis: d.date_modification, href: 'vue.html?id=' + encodeURIComponent(d.id) + '#commande',
        urgence: URGENCE.HAUTE,
      }));
    });
    return out;
  }

  // ── ÉCHANGES ──────────────────────────────────────────────────────────────────────────────
  const QUOI_SUJET = {
    question: 'Attend une réponse',
    afaire:   'À faire',
    idee:     'À faire',          // une idée n'arrive ici que si quelqu'un s'en est chargé
    attente:  'En attente d’un tiers',
  };
  function depuisSujets(sujets) {
    const out = [];
    const auj = aujourdhui();
    (sujets || []).forEach(function (s) {
      if (!s || s.statut === 'fait') return;
      const enRetard = s.echeance && s.echeance < auj;
      const j = joursDepuis(s.date_modification);
      // Un sujet que personne n'attend ET qui n'a pas d'échéance n'est pas une attente : c'est une
      // idée en réserve. Elle a sa place dans les Échanges, pas dans la liste de ce qui bloque.
      if (!s.awaiting && !enRetard) return;
      let urg = URGENCE.MOYENNE;
      if (enRetard || j >= SEUILS.ATTENTE_TRES_LONGUE_J) urg = URGENCE.CRITIQUE;
      else if (j >= SEUILS.ATTENTE_LONGUE_J) urg = URGENCE.HAUTE;
      out.push(item({
        id: 'suj:' + s.id, source: 'echange', ref: s.id, sujet_id: s.id,
        devis_id: s.devis_id || '',
        qui: s.awaiting || '', titre: s.titre,
        // Le libellé suit la NATURE : « Attend une réponse » sur une tâche qu'on vient de prendre
        // est faux, et ça se voyait dès qu'une idée de la réserve devenait une tâche.
        quoi: enRetard ? 'En retard sur l’échéance' : (QUOI_SUJET[s.kind] || 'Attend une réponse'),
        detail: [s.client_nom, s.corps].filter(Boolean).join(' — ').slice(0, 140),
        depuis: s.date_modification, href: 'echanges.html#suj-' + encodeURIComponent(s.id),
        peutPrendre: !s.awaiting, urgence: urg,
      }));
    });
    return out;
  }

  // ── Assemblage ────────────────────────────────────────────────────────────────────────────
  /** Toutes les attentes, triées. `sources` = { rdvs, devis, evenements, aPlanifier, sujets, reglages } */
  function construire(sources) {
    const s = sources || {};
    return trier([]
      .concat(depuisRdv(s.rdvs, s.devis))
      .concat(depuisSav(s.devis))
      .concat(depuisPlanning(s.evenements, s.aPlanifier, s.reglages, null, s.aCommander))
      .concat(depuisSujets(s.sujets)));
  }

  /** Ce qui n'a PERSONNE passe devant, puis l'urgence, puis le plus ancien.
   *  Cet ordre est le cœur de l'outil : sans nom dessus, une tâche n'avance pas. */
  function trier(items) {
    return items.slice().sort(function (a, b) {
      const an = a.qui ? 1 : 0, bn = b.qui ? 1 : 0;
      if (an !== bn) return an - bn;
      if (a.urgence !== b.urgence) return b.urgence - a.urgence;
      return String(a.depuis || '').localeCompare(String(b.depuis || ''));
    });
  }

  function pourQui(items, qui) {
    return (items || []).filter(function (i) { return i.qui === qui; });
  }
  function sansPersonne(items) {
    return (items || []).filter(function (i) { return !i.qui; });
  }
  /** Ce qui concerne quelqu'un : ce qui l'attend, PLUS ce que personne n'a pris. */
  function concerne(items, qui) {
    return (items || []).filter(function (i) { return !i.qui || i.qui === qui; });
  }

  function compter(items) {
    const c = { total: (items || []).length, sansPersonne: 0, critique: 0, parSource: {} };
    (items || []).forEach(function (i) {
      if (!i.qui) c.sansPersonne++;
      if (i.urgence >= URGENCE.CRITIQUE) c.critique++;
      c.parSource[i.source] = (c.parSource[i.source] || 0) + 1;
    });
    return c;
  }

  // ── Chargement (seule fonction non pure) ──────────────────────────────────────────────────
  /** Rassemble les quatre sources. Chacune tombe à vide en silence : une liste amputée reste
   *  plus utile qu'une page blanche, et c'est justement l'écran qu'on ouvre en premier. */
  async function charger() {
    const SS = window.SS || {};
    const P = window.SSPlanning;
    const [rdvs, sujets, plan] = await Promise.all([
      SS.listRdv ? SS.listRdv().catch(function () { return []; }) : [],
      SS.listSujets ? SS.listSujets().catch(function () { return []; }) : [],
      P ? P.charger().catch(function () { return null; }) : Promise.resolve(null),
    ]);
    const devis = (plan && plan.sources && plan.sources.devis)
      || (SS.listDevis ? await SS.listDevis().catch(function () { return []; }) : []);
    const sources = {
      rdvs: rdvs || [], sujets: sujets || [], devis: devis || [],
      evenements: (plan && plan.evenements) || [],
      aPlanifier: (plan && plan.aPlanifier) || [],
      aCommander: (plan && plan.aCommander) || [],
      reglages: (plan && plan.reglages) || null,
    };
    return { sources: sources, items: construire(sources) };
  }

  window.SSAttente = {
    SEUILS: SEUILS, URGENCE: URGENCE, URGENCE_LABEL: URGENCE_LABEL, SOURCES: SOURCES,
    aujourdhui: aujourdhui, demain: demain,
    heuresDepuis: heuresDepuis, joursDepuis: joursDepuis, age: age, delai: delai,
    depuisRdv: depuisRdv, depuisSav: depuisSav, depuisPlanning: depuisPlanning, depuisSujets: depuisSujets,
    devisDeRdv: devisDeRdv, cleClient: cleClient,
    construire: construire, trier: trier,
    pourQui: pourQui, sansPersonne: sansPersonne, concerne: concerne, compter: compter,
    charger: charger,
  };
})();
