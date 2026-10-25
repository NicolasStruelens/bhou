/* ═══════════════════════════════════════════════════════════════════════════════════════════
   LA PROCHAINE ACTION — ce qu'il faut faire, dossier par dossier (window.SSActions)
   Sortie du tableau de bord le 25/10/2026 pour que l'ASSISTANT (assets/js/assistant.js) réponde à
   « qu'est-ce que je dois faire ? » avec EXACTEMENT la règle de l'écran (règle 10 : deux codes
   qui répondent à la même question finissent toujours par répondre deux choses différentes).
   ⚠️ RIEN ICI NE LIT UNE VARIABLE DE PAGE. Les devis, factures, RDV et sujets sont fournis par
   l'appelant, et en FONCTIONS : le tableau de bord remplace ses listes à chaque rafraîchissement,
   une copie passée une fois pour toutes serait figée sur le premier chargement.
     const A = SSActions.creer({ factures: () => F, devis: () => D, rdv: () => R, sujets: () => S });
     A.prochaineAction(d)   A.actionsDuJour()   A.isAcompteUnpaid(d) …
   Les devis attendus sont ceux de SSUI.normDevis (aplatis : d.prenom, d.nom, d.ttc).
   Protégé par tests/dashboard.test.html (l'écran) et tests/assistant.test.html (le module seul).
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const WAITING_STATUSES = ['envoye_client', 'relance_1', 'relance_2'];
  const DEAD_STATUSES = ['refuse', 'annule'];

  function creer(sources) {
    const s = sources || {};
    const lire = (f) => () => (typeof f === 'function' && f()) || [];
    const src = { factures: lire(s.factures), devis: lire(s.devis), rdv: lire(s.rdv), sujets: lire(s.sujets) };
    const FACT = src.factures;
    const SSUI = window.SSUI;
    const relancesFaites = (d) => SSUI.relancesFaites(d);
    const relanceDue = (d) => SSUI.relanceDue(d);
    // Même règle que la page : jamais une valeur illisible, un tiret discret à la place.
    function safeDate(iso) {
      if (!iso) return '\u2014';
      return isNaN(new Date(iso).getTime()) ? '\u2014' : SSUI.fmtDate(iso);
    }
    // ── Paiement (acompte/solde) — lu depuis les factures liées au devis ──
    const paidSum = f => (f.paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
    function isPaymentOverdue(d) {
      const facs = FACT().filter(f => f.devis_id === d.id);
      if (!facs.length) return false;
      const today = SSUI.aujourdhui();
      // Même règle que ci-dessus : une facture éteinte par une note de crédit ne se réclame
      // plus, donc elle n'est jamais « en retard ». `duFacture` le sait, pas une soustraction.
      return facs.some(f => window.SSUI.duFacture(f, FACT()) > 0.005 && f.echeance && f.echeance < today);
    }
    // Devis signé (chantier pas encore posé) dont l'acompte n'a pas été intégralement reçu.
    function isAcompteUnpaid(d) {
      if (d.statut !== 'signe') return false;
      /* ⚠️ JAMAIS D'ACOMPTE SUR UN DÉPANNAGE (règle 7). Un dépannage signé sortait pourtant en
         « Acompte à encaisser » — 30 % d'un montant qui se règle en une fois — et gonflait le
         compteur des acomptes non payés. Trouvé en enquêtant sur le tableau de bord, 25/10/2026. */
      if (estDepannage(d)) return false;
      const facs = FACT().filter(f => f.devis_id === d.id);
      // L'acompte a pu être encaissé sur N'IMPORTE quelle facture (acompte dédiée, solde, totale, ou
      // via l'ancien ERP — ex. Ecole Du Bonheur : 9 539,05 € payés sur une facture « Solde »). On
      // crédite donc TOUJOURS le total réellement encaissé sur le devis, comparé au montant attendu.
      const totalPaid = facs.reduce((s, f) => s + paidSum(f), 0);
      // Une facture d'acompte ANNULÉE par une note de crédit ne fait plus partie de ce qui est
      // dû — sinon l'alerte « acompte non payé » reste allumée sur un dossier qu'on a soldé
      // exprès par un avoir.
      const acompteFacs = facs.filter(f => f.type === 'acompte' && !window.SSUI.factureAnnulee(f, FACT()));
      const due = acompteFacs.length
        ? acompteFacs.reduce((s, f) => s + (Number(f.total_ttc) || 0), 0)                 // montant de la/les facture(s) d'acompte
        : (d.ttc || 0) * ((d.acompte_pct != null) ? d.acompte_pct : 30) / 100;             // sinon, % attendu du TTC
      return due > 0 && totalPaid < due - 0.005;
    }
    // Devis signé avec une pose planifiée dans les 7 prochains jours (bientôt sur le terrain).
    /* ⚠️ UNE POSE À VENIR N'EST PAS FAITE, MÊME SI UN PV EXISTE DÉJÀ. Un chantier posé en deux fois
       (École du Bonheur : 28 screens, puis les 5 restants le 29/10) porte le PV de la PREMIÈRE pose :
       `isPoseDone` répondait « posé », la frise affichait « soldé ✓ » et personne n'était prévenu de
       préparer la seconde. Une date de pose dans le futur, c'est du travail qui vient. */
    function poseAVenir(d) {
      const p = d.chantier && d.chantier.date_pose;
      return !!p && String(p).slice(0, 10) >= SSUI.aujourdhui();
    }
    function isChantierAPreparer(d) {
      if (d.statut !== 'signe' || !d.chantier || !d.chantier.date_pose) return false;
      const days = Math.round((new Date(d.chantier.date_pose) - new Date(SSUI.aujourdhui())) / 86400000);
      return days >= 0 && days <= 7;
    }
    // Chantier POSÉ mais pas entièrement payé → le solde reste à encaisser (rappel visible même « terminé »,
    // sinon l'argent dû devient invisible une fois le devis marqué terminé).
    function isSoldeUnpaid(d) {
      if (!window.SSUI.isPoseDone(d)) return false;
      const ttc = Number(d.ttc) || 0;
      if (ttc <= 0) return false;
      const totalPaid = FACT().filter(f => f.devis_id === d.id).reduce((s, f) => s + paidSum(f), 0);
      return totalPaid < ttc - 0.005;
    }
    // Nombre de jours depuis le tout premier envoi au client (pas juste le statut courant —
    // une relance ne remet pas le compteur de validité CGV à zéro). CGV : devis valide 30 jours.
    function daysSinceSent(d) {
      const hist = d.statut_history || [];
      const first = hist.find(h => WAITING_STATUSES.includes(h.statut));
      const anchor = first ? first.date : (WAITING_STATUSES.includes(d.statut) ? d.date_creation : null);
      if (!anchor) return null;
      return Math.floor((Date.now() - new Date(anchor).getTime()) / 86400000);
    }
    function isDevisExpire(d) {
      // Un devis déjà ACCEPTÉ par le client (via le lien de suivi) n'est ni « expiré » ni « à relancer ».
      if (!WAITING_STATUSES.includes(d.statut) || d.client_accepted) return false;
      const days = daysSinceSent(d);
      return days !== null && days >= 30;
    }
    // ── « Prochaine action » : l'ERP dit quoi faire, dossier par dossier ────────────────────
    // Toute la logique métier existe déjà sous forme de prédicats (relance due, acompte impayé,
    // pose à planifier…) mais restait éparpillée dans les pastilles globales du briefing. Ici on
    // la condense en UNE phrase par ligne — l'ordre des tests EST l'ordre de priorité.
    // ── Les SIX familles d'action ───────────────────────────────────────────────
    // Le liseré se lit AVANT le texte : il doit dire « quel genre de travail ? » en un balayage.
    // Deux contraintes qui se contredisent, d'où cette table :
    //   • deux genres de travail ne partagent JAMAIS une couleur (règle 21) ;
    //   • le thème ne contient que SIX teintes vraiment distinctes sur 3 px de large.
    // En sombre, --accent-2 (#ffd23f) et --warn (#ffb020) sont deux jaunes à 12° d'écart, et ils
    // servaient à CINQ actions sur neuf : « Pose à planifier », « Acompte à encaisser » et
    // « Relance 2 » se ressemblaient tous. Le chantier est donc passé en VIOLET (--accent-3), la
    // seule sixième teinte franche du jeu, et l'or a quitté le liseré.
    // Neuf actions pour six familles : ce qui se regroupe se regroupe VOLONTAIREMENT — relancer un
    // devis et réclamer un acompte, c'est le même geste, pousser le client — et c'est le TEXTE,
    // toujours affiché à côté, qui dit lequel des deux.
    // L'icône est portée par l'ACTION, jamais déduite de la couleur : la déduire propageait chaque
    // collision de teinte au pictogramme, qui ne pouvait donc pas rattraper l'ambiguïté.
    // `cle` et `lib` servent au cockpit : le nom de la famille s'écrit sur la carte, au-dessus du
    // client — c'est lui qui dit, avant le texte, quel genre de travail attend.
    const FAM = {
      rien:     { cle: 'rien',     lib: 'En attente',        color: 'var(--text-subtle)', ic: 'chevronright' }, // la balle est chez le client
      ecrire:   { cle: 'ecrire',   lib: 'À rédiger',         color: 'var(--accent)',      ic: 'edit'         }, // à rédiger de mon côté
      pousser:  { cle: 'pousser',  lib: 'Pousser le client', color: 'var(--warn)',        ic: 'clock'        }, // relancer, réclamer
      perdre:   { cle: 'perdre',   lib: 'Ça se perd',        color: 'var(--danger)',      ic: 'warning'      }, // se perd si je ne fais rien
      gagne:    { cle: 'gagne',    lib: 'Gagné',             color: 'var(--ok)',          ic: 'check'        }, // gagné, reste à formaliser
      chantier: { cle: 'chantier', lib: 'Chantier',          color: 'var(--accent-3)',    ic: 'hammer'       }, // à organiser sur le terrain
    };
    // `hash` : ancre de la fiche où l'action s'exécute — présente = le chip devient cliquable.
    // `titre` : ce que dit l'infobulle quand la LIGNE ne peut pas tout dire. Une ligne de liste
    // a ~40 caractères utiles ; un motif de mise en attente en fait souvent trois fois plus, et
    // le tronquer sans le donner nulle part reviendrait à ne pas l'avoir écrit.
    const mk = (fam, txt, ic, hash, titre) => ({ txt: txt, color: fam.color, ic: ic || fam.ic, hash: hash || '', titre: titre || '', fam: fam.cle, lib: fam.lib });
    // Une DÉCLARATION de fonction, pas une constante : `isAcompteUnpaid`, écrite plus haut,
    // l'appelle — une constante posée sous la fonction qui l'utilise ne tient que par l'ordre
    // d'exécution (piège déjà payé, voir CLAUDE.md).
    function estDepannage(d) { return d.type_document === 'depannage'; }

    // Renvoie null quand il n'y a rien à faire (dossier clos, payé, refusé…).
    function prochaineAction(d) {
      // AVANT la sortie sur dossier clos : une question posée mérite une réponse même sur un devis
      // refusé ou archivé (c'était déjà le cas, le test vivait en double dans les deux appelants).
      if (d.client_question_open) return mk(FAM.ecrire, 'Question client — à répondre', 'message', '#question');
      if (d.archive || ['refuse', 'annule'].includes(d.statut)) return null;
      // Finir un devis m'incombe : c'est le BLEU des choses à rédiger. Le gris est réservé à ce qui
      // n'attend rien de moi. Les peindre pareil mêlait les deux extrêmes : ce que je dois faire,
      // et ce sur quoi je ne peux rien.
      if (d.statut === 'brouillon') return mk(FAM.ecrire, 'À finaliser et envoyer');
      /* ⚠️ LES LIBELLÉS D'ACTION TIENNENT EN ~32 CARACTÈRES : c'est la largeur de la colonne
         d'action. Plus longs, ils partaient en points de suspension — « Accepté par le client — à
         faire signer » se lisait « Accepté par le client — à f… ». Le détail (vues, motif) vit
         dans l'infobulle, sous la frise, et sur la carte du cockpit. */
      if (d.client_accepted && WAITING_STATUSES.includes(d.statut)) return mk(FAM.gagne, 'Accepté en ligne — à faire signer', null, '', 'Accepté par le client sur son espace en ligne — à faire signer');
      /* ⚠️ LA MISE EN ATTENTE PASSE AVANT LA RELANCE, et l'ordre EST le raisonnement : tant
         qu'elle est active, il n'y a rien à faire sur ce dossier — le client a dit quand il
         revient. C'est donc le GRIS (« la balle est chez le client »), pas l'ambre : un dossier
         qu'on a volontairement mis de côté ne doit pas peser dans la liste des choses à faire.
         Et le chip reste CLIQUABLE vers #relance — c'est là qu'on change d'avis. */
      const att = window.SSUI.attenteClient(d);
      if (att.active) {
        /* LE QUAND ICI, LE POURQUOI SOUS LA FRISE. Les deux sur une seule pastille ne tenaient pas
           dans la colonne : la fin partait en points de suspension, et « … · 28/ » coupait
           justement la date. La pastille dit quand on y revient (JJ/MM, l'année ne dit rien à
           quelques semaines) ; la légende de la frise porte le motif ; l'infobulle, les deux. */
        return mk(FAM.rien, `En attente · revoir le ${safeDate(att.revoir_le).slice(0, 5)}`,
          'clock', '#relance', `${att.texte}${att.motif ? ' \u2014 ' + att.motif : ''}`);
      }
      if (WAITING_STATUSES.includes(d.statut) && relanceDue(d)) {
        const faites = relancesFaites(d);
        // Un client qui a rouvert son devis plusieurs fois est chaud : dit en MOTS (infobulle, carte
        // du cockpit, légende de la frise) et non par une teinte de pastille à part — l'or employé
        // ici était celui du chantier, deux sens pour une couleur.
        const hot = d.review_views >= SEUIL_CHAUD();
        /* ⚠️ UNE ATTENTE ÉCHUE RAMÈNE SON MOTIF AVEC ELLE, et c'est tout l'intérêt du rappel :
           le jour où l'ERP redemande la relance, ce qu'il faut savoir c'est ce que le client
           avait dit. « Relance 2 à envoyer » tout seul, on a oublié depuis trois semaines. */
        /* Le motif s'écrit JUSTE À CÔTÉ, sous la frise (filAffaire), et en entier dans l'infobulle
           et sur la carte du cockpit : dans la pastille, il la faisait déborder. Même chose pour
           le client très intéressé, que la légende de la frise dit en or. */
        const details = [att.echue && att.motif ? `${att.texte} — ${att.motif}` : '',
                         hot ? `client très intéressé (${d.review_views} vues)` : ''].filter(Boolean).join(' · ');
        return mk(FAM.pousser, `Relance ${faites + 1} à envoyer`, null, '#relance',
          details ? `Relance ${faites + 1} à envoyer — ${details}` : '');
      }
      if (isDevisExpire(d)) return mk(FAM.perdre, 'Expiré — à relancer ou classer', null, '#relance', 'Devis expiré (plus de 30 jours) — à relancer ou à classer');
      if (isAcompteUnpaid(d)) return mk(FAM.pousser, 'Acompte à encaisser', 'coin');
      /* ⚠️ UN DÉPANNAGE N'A NI COMMANDE NI POSE (règle 7) : la suite ci-dessous ne le concerne pas.
         Une PROPOSITION de dépannage acceptée attend son intervention — c'est ça qu'on dit. Un bon
         d'intervention (travaux faits) n'attend plus que son paiement, que le badge de paiement
         porte déjà. */
      if (estDepannage(d)) {
        if (d.statut === 'signe' && d.depannage_mode === 'a_realiser') return mk(FAM.chantier, 'Intervention à réaliser', 'wrench');
        return WAITING_STATUSES.includes(d.statut) ? mk(FAM.rien, 'En attente de réponse client') : null;
      }
      /* ⚠️ ON NE RÉCLAME UNE DATE DE POSE QU'UNE FOIS LE MATÉRIEL REÇU (règle 15 ter). Le tableau
         de bord disait « Pose à planifier » sur tout chantier signé sans date — y compris un
         dossier jamais commandé, pendant que le planning, lui, réclamait la COMMANDE. Deux écrans,
         deux consignes sur le même dossier. On suit la même règle que le planning : à commander
         d'abord, la date ensuite, et rien à réclamer pendant que la balle est chez le fournisseur. */
      if (d.statut === 'signe' && !window.SSUI.isPoseDone(d) && !(d.chantier && d.chantier.date_pose)) {
        if (window.SSUI.etatCommande(d) === 'a_commander') return mk(FAM.chantier, 'Matériel à commander', 'box', '#commande');
        if (window.SSUI.materielRecu(d)) return mk(FAM.chantier, 'Matériel reçu — pose à planifier', 'calendar');
      }
      if (isChantierAPreparer(d)) return mk(FAM.chantier, 'Chantier à préparer');
      if (isSoldeUnpaid(d)) return mk(FAM.pousser, 'Solde à encaisser', 'coin');
      /* Posé, payé, rien à venir — mais toujours « signé » : il reste à le passer en TERMINÉ, et
         c'est ce qui le fait sortir de la liste du quotidien (« Actifs »). Sans cette consigne la
         ligne affichait « Signé » dans la colonne de l'action, la même chose que la pastille de
         statut juste à côté, et le dossier restait là sans que rien ne dise pourquoi. Poids FAIBLE :
         c'est du rangement, pas une urgence. */
      if (d.statut === 'signe' && window.SSUI.isPoseDone(d) && !poseAVenir(d) && isPaidFull(d)) {
        return Object.assign(mk(FAM.gagne, 'Posé et soldé — à clôturer', 'check', '', 'Posé et soldé — à passer en « Terminé »'), { rangement: true });
      }
      if (WAITING_STATUSES.includes(d.statut)) return mk(FAM.rien, 'En attente de réponse client');
      if (d.statut === 'signe' && !window.SSUI.isPoseDone(d) && !(d.chantier && d.chantier.date_pose)) {
        return mk(FAM.rien, 'Chez le fournisseur — ' + (window.SSUI.COMMANDE_LABEL[window.SSUI.etatCommande(d)] || '').toLowerCase());
      }
      return null;
    }
    /* Le POIDS d'une action, pour trier le cockpit et la liste « à faire d'abord ». Ce qui se perd
       et ce qui est gagné passent devant : un devis accepté en ligne qu'on ne fait pas signer, et
       un devis qui expire, sont les deux façons de perdre une affaire déjà faite. */
    const POIDS_FAM = { perdre: 5, gagne: 5, pousser: 3, chantier: 3, ecrire: 2, rien: 0 };
    function poidsAction(a, d) {
      if (!a) return 0;
      if (a.rangement) return 1;                             // clore un dossier fini : ça peut attendre
      if (a.hash === '#question') return 6;                  // un client qui attend une réponse
      return (POIDS_FAM[a.fam] || 0) + (isPaymentOverdue(d) ? 1 : 0) + (isChantierAPreparer(d) ? 1 : 0);
    }
    // Seuil « client chaud » : nombre de consultations de l'espace client à partir duquel on
    // considère le dossier comme brûlant. Réglable (Paramètres → Utilisation) car il dépend du
    // volume d'affaires — 5 vues n'ont pas le même sens sur 3 devis que sur 300.
    const SEUIL_CHAUD = () => {
      const c = window.SSConf && window.SSConf.get();
      const v = c && c.usage && Number(c.usage.seuil_lead_chaud);
      return (isFinite(v) && v > 0) ? v : 5;
    };

    function isPaidFull(d) {
      const facs = FACT().filter(f => f.devis_id === d.id);
      if (!facs.length) return false;
      const paid = facs.reduce((s, f) => s + paidSum(f), 0);
      return paid > 0 && paid >= d.ttc - 0.005;
    }

    const SOURCE_LIB = { rdv: 'Demande de RDV', sav: 'SAV', echange: 'Échange', planning: 'Planning' };
    const SOURCE_IC = { rdv: 'bellphone', sav: 'wrench', echange: 'message', planning: 'calendar' };
    const SOURCE_COUL = { rdv: 'var(--accent)', sav: 'var(--accent-3)', echange: 'var(--accent)', planning: 'var(--accent-3)' };
    function boutonAction(a) {
      if (a.rangement) return 'Clôturer';
      if (a.hash === '#relance') return 'Relancer';
      if (a.hash === '#question') return 'Répondre';
      if (a.hash === '#commande') return 'Commander';
      if (a.fam === 'gagne') return 'Faire signer';
      if (a.fam === 'ecrire') return 'Finaliser';
      if (a.ic === 'coin') return 'Voir le paiement';
      if (a.fam === 'chantier') return 'Organiser';
      return 'Ouvrir';
    }
    function actionsDuJour() {
      const visible = (src.devis() || []).filter(d => !d.archive);
      const out = [];
      const couverts = new Set();
      visible.forEach(d => {
        const a = prochaineAction(d);
        if (!a || a.fam === 'rien') return;                   // la balle est ailleurs : rien à faire
        couverts.add(d.id);
        out.push({
          cle: 'devis:' + d.id, qui: d.seller_principal || '',
          poids: poidsAction(a, d), depuis: d.date_modification || '',
          fam: a.ic === 'coin' ? 'Argent' : (a.lib || ''), ic: a.ic, couleur: a.color,
          nom: ((d.prenom || '') + ' ' + (d.nom || '')).trim() || 'Sans nom',
          // La carte a deux lignes de place : elle prend la phrase COMPLÈTE (vues, motif) quand
          // l'action en a une, là où la pastille de la liste doit tenir sur une.
          detail: a.titre || a.txt, titre: a.titre || a.txt,
          extra: d.ttc ? window.SSUI.fmtEur(d.ttc) : '', bouton: boutonAction(a),
          href: 'vue.html?id=' + encodeURIComponent(d.id) + (a.hash || ''),
        });
      });
      const ATT = window.SSAttente || null;
      if (ATT) {
        // attente.js lit le NOM du client dans `client` : les devis d'ici sont aplatis par
        // normDevis, d'où cette enveloppe — sans elle, chaque SAV s'appelait « Sans nom ».
        const avecClient = visible.map(d => Object.assign({}, d, { client: { prenom: d.prenom, nom: d.nom } }));
        const U = ATT.URGENCE;
        [].concat(ATT.depuisRdv(src.rdv() || [], avecClient), ATT.depuisSav(avecClient), ATT.depuisSujets(src.sujets() || [])).forEach(i => {
          if (i.devis_id && couverts.has(i.devis_id)) return;
          const quoi = i.quoi + (i.detail ? ' — ' + i.detail : '');
          out.push({
            cle: i.id, qui: i.qui || '',
            poids: i.urgence >= U.CRITIQUE ? 5.5 : (i.urgence >= U.HAUTE ? 3.5 : 2), depuis: i.depuis || '',
            fam: SOURCE_LIB[i.source] || 'À faire', ic: SOURCE_IC[i.source] || 'chevronright',
            couleur: i.qui ? (SOURCE_COUL[i.source] || 'var(--accent)') : 'var(--danger)',
            nom: i.titre || 'Sans titre', detail: quoi, titre: quoi,
            extra: i.depuis ? ATT.delai(i.depuis) : '', bouton: 'Voir', href: i.href || 'echanges.html',
          });
        });
      }
      // Les visites du jour : attente.js ne les porte pas (il prévient la VEILLE), l'ancienne bande
      // les comptait. Un rendez-vous chez le client aujourd'hui ne doit pas se découvrir à 14 h.
      const auj = SSUI.aujourdhui();
      (src.rdv() || []).filter(r => r.statut === 'rdv_fixe' && String(r.date_rdv || '').slice(0, 10) === auj).forEach(r => {
        const c = r.client || {};
        const heure = String(r.date_rdv || '').slice(11, 16);
        out.push({
          cle: 'visite:' + r.id, qui: r.assigned_to || '', poids: 4, depuis: r.date_rdv || '',
          fam: 'Visite aujourd’hui', ic: 'calendar', couleur: r.assigned_to ? 'var(--accent)' : 'var(--danger)',
          nom: ((c.prenom || '') + ' ' + (c.nom || '')).trim() || 'Sans nom',
          detail: 'Visite client' + (heure && heure !== '00:00' ? ' à ' + heure : '') + (r.projet ? ' — ' + r.projet : ''),
          titre: 'Visite client aujourd’hui', extra: '', bouton: 'Voir',
          href: 'rdv.html?open=' + encodeURIComponent(r.id),
        });
      });
      return out.sort((x, y) => ((x.qui ? 1 : 0) - (y.qui ? 1 : 0)) || (y.poids - x.poids) || String(x.depuis).localeCompare(String(y.depuis)));
    }

    /* ── « Actifs » = il reste quelque chose à faire ────────────────────────────────────────────
       Le filtre excluait seulement les refusés/annulés : les chantiers terminés ET encaissés
       restaient dans la liste du quotidien alors qu'il n'y a plus rien à en faire, et ils
       repoussaient vers le bas les dossiers qui, eux, demandent une action.
       Un dossier terminé mais NON soldé RESTE actif : il reste de l'argent à encaisser, et c'est
       précisément ce qu'on ne doit jamais perdre de vue. En l'absence de montant connu (ttc = 0),
       on considère le dossier comme non soldé — on préfère l'afficher à tort que le cacher à tort. */
    function totalEncaisse(d) {
      return FACT().filter(f => f.devis_id === d.id).reduce((s, f) => s + paidSum(f), 0);
    }
    function estSolde(d) {
      const ttc = Number(d.ttc) || 0;
      return ttc > 0 && totalEncaisse(d) >= ttc - 0.005;
    }
    function estClos(d) { return d.statut === 'termine' && estSolde(d); }
    function estActif(d) { return !DEAD_STATUSES.includes(d.statut) && !estClos(d); }

    /* ── LES CHIFFRES DU COCKPIT ────────────────────────────────────────────────────────────────
       Sortis de renderKPIs (tableau de bord) le 25/10/2026, pour la même raison que le reste :
       « combien j'ai signé ce mois ? » demandé à l'assistant doit donner le montant de l'écran.
       `mois` au format AAAA-MM ; le mois en cours par défaut. */
    function chiffres(mois) {
      const FACTURES = FACT();
      // Les KPIs de devis EXCLUENT les archivés (comme la page Stats) → un seul et même CA affiché partout.
      const active = src.devis().filter(d => !d.archive);
      const signes = active.filter(d => ['signe', 'termine'].includes(d.statut));
      const envoyes = active.filter(d => WAITING_STATUSES.includes(d.statut));
      const caSigne = signes.reduce((s, d) => s + d.ttc, 0);
      const caEnJeu = envoyes.reduce((s, d) => s + d.ttc, 0);
      // La date de signature vient de la même règle que le podium des Statistiques.
      const leMois = /^\d{4}-\d{2}$/.test(String(mois || '')) ? mois : SSUI.aujourdhui().slice(0, 7);
      const duMois = signes.filter(d => {
        const sd = SSUI.dateSignature(d);
        if (!sd) return false;
        const t = new Date(sd);
        return !isNaN(t) && SSUI.isoDate(t).slice(0, 7) === leMois;
      });
      const caMois = duMois.reduce((s, d) => s + d.ttc, 0);
      // Relu à chaque appel : l'objectif peut arriver du serveur après le premier affichage.
      const conf = (window.SSConf && window.SSConf.get()) || {};
      const objectif = Number(conf.usage && conf.usage.objectif_mensuel) || 0;
      const acceptes = envoyes.filter(d => d.client_accepted);
      const caAcceptes = acceptes.reduce((s, d) => s + d.ttc, 0);
      // CA réellement encaissé = somme des paiements reçus sur toutes les factures.
      const caEncaisse = FACTURES.reduce((s, f) => s + paidSum(f), 0);
      const totalFacture = FACTURES.reduce((s, f) => s + (Number(f.total_ttc) || 0), 0);
      // ⚠️ Le reste dû se calcule FACTURE PAR FACTURE (chaque reste plancheté à 0), jamais en
      // « total facturé − total encaissé » : un trop-perçu sur une facture viendrait effacer la
      // dette d'une autre. Et par `SSUI.duFacture`, seule à déduire les notes de crédit.
      const resteEncaisser = FACTURES.reduce((s, f) => s + SSUI.duFacture(f, FACTURES), 0);
      const auj = SSUI.aujourdhui();
      const enRetard = FACTURES.filter(f => f.echeance && f.echeance < auj)
        .reduce((s, f) => s + SSUI.duFacture(f, FACTURES), 0);
      const encPct = totalFacture > 0 ? Math.min(100, Math.round(caEncaisse / totalFacture * 100)) : 0;
      const nicolasNet = signes.reduce((s, d) => s + (d.nicolas_net || 0), 0);
      const yannickNet = signes.reduce((s, d) => s + (d.yannick_net || 0), 0);
      return { mois: leMois, signes, envoyes, caSigne, caEnJeu, duMois, caMois, objectif, acceptes, caAcceptes,
               caEncaisse, totalFacture, resteEncaisser, enRetard, encPct, nicolasNet, yannickNet };
    }

    /* ── LE BILAN D'UN CLIENT (ou de tout ensemble de devis) ─────────────────────────────────────
       Les MÊMES définitions que les chiffres du cockpit, appliquées aux seuls devis d'un client :
       la fiche client et le tableau de bord ne peuvent pas annoncer deux montants signés
       différents. La page Clients comptait les devis REFUSÉS dans son « CA » (un client qui avait
       refusé 50 000 € passait en tête) et les ARCHIVÉS dans son « CA signé » (25/10/2026).
       • signé / en cours : devis non archivés (comme le cockpit) ;
       • encaissé / reste dû : TOUTES les factures de ces devis — l'argent ne s'archive pas ;
       • action : la plus urgente de ses devis (même poids que « À faire maintenant »). */
    function bilanDevis(liste) {
      const L = liste || [];
      const ids = new Set(L.map(d => d.id));
      const FACTURES = FACT();
      const facs = FACTURES.filter(f => ids.has(f.devis_id));
      const vivants = L.filter(d => !d.archive);
      const signes = vivants.filter(d => ['signe', 'termine'].includes(d.statut));
      const enCours = vivants.filter(d => WAITING_STATUSES.includes(d.statut));
      let action = null, poids = -1;
      L.forEach(d => {
        const a = prochaineAction(d);
        if (!a) return;
        const p = poidsAction(a, d);
        if (p > poids) { poids = p; action = Object.assign({ devis_id: d.id }, a); }
      });
      return {
        signe: signes.reduce((s, d) => s + (Number(d.ttc) || 0), 0), nbSignes: signes.length,
        enCours: enCours.reduce((s, d) => s + (Number(d.ttc) || 0), 0), nbEnCours: enCours.length,
        encaisse: facs.reduce((s, f) => s + paidSum(f), 0),
        resteDu: facs.reduce((s, f) => s + SSUI.duFacture(f, FACTURES), 0),
        action,
      };
    }

    return {
      bilanDevis,
      paidSum, isPaymentOverdue, isAcompteUnpaid, poseAVenir, isChantierAPreparer, isSoldeUnpaid,
      daysSinceSent, isDevisExpire, isPaidFull, estDepannage, FAM, prochaineAction, poidsAction,
      SEUIL_CHAUD, boutonAction, actionsDuJour, chiffres, totalEncaisse, estSolde, estClos, estActif,
    };
  }

  window.SSActions = { creer: creer, WAITING_STATUSES: WAITING_STATUSES, DEAD_STATUSES: DEAD_STATUSES };
})();
