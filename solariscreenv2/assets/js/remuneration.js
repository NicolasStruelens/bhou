/* ═══════════════════════════════════════════════════════════════════════════════════════════
   RÉMUNÉRATION (window.SSRemu) — ce que NICOLAS doit encaisser.

   À QUOI SERT CE FICHIER, EXACTEMENT
   Nicolas n'a rien reçu depuis un an. Le jour où il s'assoit avec Yannick pour acter la
   question, il lui faut UN CHIFFRE INCONTESTABLE, dossier par dossier. C'est le seul but de ce
   module : produire ce chiffre. Comme « calc.js » et « planning.js », il ne touche à rien — il
   reçoit des devis, des factures et des réglages, et il renvoie des nombres. Il est protégé par
   « tests/remuneration.test.html ».

   ⚠️ IL EST ÉCRIT DU POINT DE VUE DE NICOLAS, ET C'EST VOULU.
   SolariScreen facture sous SysCore, et **Yannick est le patron** : ce qui lui revient, il en
   fait ce qu'il veut, ça ne se suit pas ici. Sa commission reste affichée parce qu'elle fait
   partie du partage de la marge et qu'elle doit être lisible — mais il n'y a ni « reste à
   toucher » ni prélèvement pour lui. Ne pas « symétriser » ce module en croyant bien faire.

   LES RÈGLES, telles que Nicolas les a actées avec Yannick (relevé le 04/10/2026)

   1. **LA PAIE DE POSE SE COMPTE EN OUVERTURES, PAS EN EUROS DU DEVIS.**
      50 € nets par screen ou volet roulant posé, 100 € nets par tente solaire, **multiplié par
      le nombre posé, quoi qu'il arrive**. C'est un tarif convenu entre eux, pas une part du
      devis : si un devis a été sous-chiffré, l'écart est pour la société, jamais pour Nicolas.
      ⚠️ C'est le point qui a changé le 04/10/2026, et il faut comprendre pourquoi la première
      version était fausse. Elle lisait « calculs.tech1_total » — la ligne « Technicien 1 » du
      devis, 125 € bruts, soit exactement 50 € nets (÷ 2,5). Ça TOMBE JUSTE sur un screen, et
      c'est ce qui rendait l'erreur invisible. Mais une tente est chiffrée elle aussi à 125 €
      bruts : lue sur le devis, elle ne payait que 50 € au lieu des 100 convenus. Le devis dit
      comment la pose est FINANCÉE ; il ne dit pas ce que Nicolas a négocié.

   2. **S'IL ÉTAIT SUR LE CHANTIER, IL TOUCHE TOUTES LES OUVERTURES.** Pas la moitié parce que
      Yannick était là aussi. Décidé explicitement : 10 screens à deux, c'est 500 € pour Nicolas.
      Ce que touche Yannick par-dessus est son affaire (voir plus haut).

   3. **LA PAIE DE POSE SUPPOSE QUE LA POSE A EU LIEU.** On s'appuie sur « SSUI.isPoseDone »
      (PV de réception signé, ou commande passée au statut « posé »), ET, à défaut, sur une date
      de pose DÉJÀ PASSÉE — sinon un chantier réellement fait mais dont le PV n'a pas été rempli
      disparaîtrait de la paie, en silence et au détriment de Nicolas. Un dossier signé sans
      aucun de ces deux signaux est SIGNALÉ, pas deviné.

   4. **LA COMMISSION VIENT DU DEVIS, elle n'est JAMAIS recalculée.** 18 % au vendeur, 5 % à
      l'autre — sauf répartition personnalisée (École du Bonheur était en moitié-moitié), et
      c'est précisément pour ça qu'on ne recalcule pas : « calculs.nicolas_net » porte ce qui a
      été réellement convenu sur CE devis, avec les taux du jour où il a été établi (règle 1 du
      guide).

   5. **QUI A POSÉ vit dans « chantier.equipe »**, la donnée qui existe déjà, traduite en
      personnes par « SSPlanning.quiDeEquipe » (règle 10 du guide : le vocabulaire vit à un seul
      endroit). Sans équipe renseignée, rien n'est attribué et le dossier est SIGNALÉ.
      ⚠️ « quiDeEquipe('') » retombe sur Nicolas — bon défaut pour un planning, désastreux ici :
      il lui attribuerait la paie de tous les chantiers non renseignés. Garde avant l'appel.

   6. **UN DEVIS REFUSÉ OU ANNULÉ NE DOIT RIEN.**

   7. **AUCUN PRORATA SUR LE TOTAL — et c'est le point le plus important de ce fichier.**
      Le DÉCLENCHEUR du paiement n'est pas acté : Yannick a parlé « de chaque CA de SysCore »,
      Nicolas ne sait pas à quelle fréquence, et c'est justement ce qu'ils doivent se dire.
      Tant que ce n'est pas décidé, ce module **n'invente pas de règle** : il annonce le TOTAL
      gagné, et donne à côté, en information, la part déjà couverte par l'argent que les clients
      ont réellement versé. Deux nombres, aucun arbitrage. Le jour où la règle sera actée, il n'y
      aura qu'à choisir lequel des deux pilote « reste à toucher ».
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  const num = function (v) { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  const MOI = 'nicolas';            // ce module est écrit de son point de vue (voir l'en-tête)
  const GENS = ['nicolas', 'yannick'];

  /* Le tarif de pose convenu, en NET et par ouverture posée. Ce n'est pas une part du devis :
     c'est ce que Nicolas touche, quoi que le devis ait chiffré (règle 1).
     ⚠️ « tablier_volet » en était EXCLU, à tort : j'avais raisonné qu'une PIÈCE de rechange n'est
     pas une ouverture posée. C'est faux. REMPLACER un tablier, c'est un déplacement et une pose,
     et Nicolas touche 50 € comme pour le reste. Corrigé le 04/10/2026, après qu'il a repéré
     lui-même un chantier terminé qui ne lui rapportait rien — d'où le signalement ajouté dans
     « detailPose » : un type sans tarif ne doit plus jamais valoir zéro en silence. */
  const TARIF_DEFAUT = {
    screen: 50, volet_roulant: 50, tablier_volet: 50, tente_solaire: 100,
    // Types HISTORIQUES : plus créables, mais présents sur d'anciens devis. À zéro, donc
    // SIGNALÉS s'ils remontent sur un chantier posé — et réglables, pour que l'avertissement
    // « ajoute un tarif dans les Réglages » désigne un champ qui existe vraiment.
    store_banne: 0, pergola: 0,
  };

  /* Diviseur brut→net historique, pour les devis sans taux stockés. Même valeur que
     « SSConf.TAUX_HISTORIQUES.net_divisor ». On ne lit PAS les réglages du jour (règle 4), et on
     ne passe pas par SSConf : le moteur doit rester pur et testable. */
  const DIVISEUR_HISTORIQUE = 2.5;

  function tarifPose(reglages) {
    const r = (reglages && reglages.remu && reglages.remu.pose) || null;
    const t = Object.assign({}, TARIF_DEFAUT);
    if (!r) return t;
    Object.keys(TARIF_DEFAUT).forEach(function (k) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') t[k] = num(r[k]);
    });
    return t;
  }

  /** Le diviseur brut→net DU DEVIS, jamais celui du jour (règle 4). */
  function diviseurNet(devis) {
    const d = num(devis && devis.pricing_v2 && devis.pricing_v2.rates && devis.pricing_v2.rates.net_divisor);
    return d > 0 ? d : DIVISEUR_HISTORIQUE;
  }

  /** Qui a posé, d'après « chantier.equipe ».
   *  null  = pas renseigné → à personne, et le dossier est signalé (règle 5) ;
   *  []    = pose sous-traitée, réponse VALIDE : Nicolas n'y était pas ;
   *  liste = nos poseurs. */
  function poseurs(devis) {
    const e = devis && devis.chantier && devis.chantier.equipe;
    if (!e) return null;                       // ⚠️ la garde de la règle 5 : surtout pas de défaut
    const P = window.SSPlanning;
    if (!P || !P.quiDeEquipe) return null;     // planning.js absent : on signale, on ne devine pas
    return P.quiDeEquipe(e);
  }

  /**
   * La pose a-t-elle eu lieu ? (règle 3)
   * @param aujourdhui  date du jour en « YYYY-MM-DD ». Injectée pour que les tests soient
   *                    reproductibles — et parce qu'un « aujourd'hui » calculé en UTC renvoie LA
   *                    VEILLE entre minuit et 2 h du matin en heure d'été belge (règle 18).
   * Renvoie { faite, certaine, datee }.
   *  • « certaine » distingue le fait ÉTABLI (PV de réception, commande au statut posé) de la
   *    date de pose passée, qui n'est qu'un indice — mais un indice qu'on retient, parce que
   *    l'ignorer ferait disparaître de la paie un chantier réellement fait dont le PV n'a pas
   *    été rempli.
   *  • « datee » dit qu'une date existe, passée OU à venir. Elle sépare « on ne sait pas si
   *    c'est posé » (à signaler) de « c'est prévu pour le 1er décembre » (rien à compléter,
   *    il n'y a qu'à attendre). Sans cette distinction, tout chantier planifié dans le futur
   *    apparaissait comme un dossier à corriger — et un écran qui réclame pour rien, on
   *    apprend très vite à ne plus le lire.
   */
  function poseFaite(devis, aujourdhui) {
    const d = devis || {};
    const U = window.SSUI;
    const date = String((d.chantier && d.chantier.date_pose) || '').slice(0, 10);
    const certaine = !!(U && U.isPoseDone ? U.isPoseDone(d) : false);
    if (certaine) return { faite: true, certaine: true, datee: !!date };
    const jour = String(aujourdhui || (U && U.aujourdhui ? U.aujourdhui() : '')).slice(0, 10);
    // Comparaison de chaînes « YYYY-MM-DD » : lexicographique = chronologique, aucun fuseau
    // horaire ne vient s'en mêler (règle 18 du guide).
    const passee = !!(date && jour && date <= jour);
    return { faite: passee, certaine: false, datee: !!date };
  }

  /**
   * La quantité d'une ouverture, telle qu'on PEUT la payer.
   * ⚠️ « num(it.quantite) || 1 » était faux sur deux cas, et le second coûtait de l'argent :
   *  • une quantité à ZÉRO devenait 1 — on payait 50 € pour une ouverture qui n'existe pas ;
   *  • une quantité NÉGATIVE passait telle quelle : −3 screens = −150 € de pose, soustraits du
   *    total. Et comme l'écran masque les dossiers qui ne rapportent rien, la ligne était
   *    INVISIBLE : le chiffre baissait sans qu'aucune ligne ne l'explique. C'est la pire forme
   *    d'erreur d'argent — fausse ET cachée.
   * Le repli à 1 reste pour le champ ABSENT : beaucoup d'items n'ont pas de « quantite », et
   * une ouverture sans quantité, c'est une ouverture. Mais un zéro ÉCRIT est une réponse.
   */
  function quantiteDe(it) {
    const q = parseFloat(it && it.quantite);
    if (!isFinite(q)) return 1;          // champ absent, vide ou illisible : une ouverture
    return q > 0 ? q : 0;                // zéro ou négatif : rien à payer, et JAMAIS de négatif
  }

  /** Les ouvertures d'un devis, par type et par quantité. « items » sur une fiche complète,
   *  « items_min » dans une liste — le tableau de bord ne charge jamais les items entiers. */
  function ouverturesParType(devis) {
    const src = (devis && devis.items && devis.items.length) ? devis.items : ((devis && devis.items_min) || []);
    const par = {};
    src.forEach(function (it) {
      if (!it || !it.type) return;
      par[it.type] = (par[it.type] || 0) + quantiteDe(it);
    });
    // Un type tombé à zéro ne doit pas laisser une ligne « 0 × Screen » dans le détail.
    Object.keys(par).forEach(function (t) { if (!(par[t] > 0)) delete par[t]; });
    return par;
  }

  /** Le détail de la paie de pose : une ligne par type d'ouverture tarifé.
   *  ⚠️ Les types SANS tarif sont renvoyés à part (« sans_tarif ») au lieu d'être ignorés. Un
   *  type qui vaut zéro en silence, c'est exactement ce qui a fait passer le tablier de volet
   *  inaperçu : Nicolas a dû repérer lui-même un chantier terminé qui ne lui rapportait rien.
   *  Les deux types historiques (store banne, pergola) ne sont plus créables mais existent sur
   *  d'anciens devis : le jour où l'un d'eux remonte, l'écran le dira. */
  function detailPose(devis, reglages) {
    const t = tarifPose(reglages);
    const par = ouverturesParType(devis);
    let total = 0;
    const detail = [], sansTarif = [];
    Object.keys(par).forEach(function (type) {
      const qte = par[type];
      const u = num(t[type]);
      if (u <= 0) { sansTarif.push({ type: type, qte: qte }); return; }
      detail.push({ type: type, qte: qte, unitaire: u, total: r2(qte * u) });
      total += qte * u;
    });
    return { detail: detail, total: r2(total), sans_tarif: sansTarif };
  }

  /**
   * Le détail de la commission, telle que le devis l'a figée (règle 4).
   * ⚠️ On ne RECALCULE rien : on explique un chiffre déjà écrit. C'est toute la différence
   * entre un détail et un second calcul — un second calcul finirait un jour par diverger du
   * premier, et c'est le premier qui a été montré au client.
   *
   * Renvoie { base, pct, principal, brut, net, remise, diviseur, calculee }
   *  • « base » : le catalogue BRUT, avant réduction commerciale, parce que c'est l'assiette du
   *    pourcentage. La réduction, elle, se déduit de la commission du vendeur principal et NON
   *    de l'assiette : on lit « 18 % de 12 500 €, moins 200 € de réduction », jamais
   *    « 18 % de 12 300 € ». Confondre les deux donnerait un taux faux à l'affichage.
   *  • « calculee » : ce devis porte-t-il un partage ? Un devis chiffré avant que le partage
   *    existe n'a AUCUN de ces champs : sa commission vaut zéro, en silence. C'est le même
   *    défaut que le tablier de volet — sauf qu'ici il se compte en centaines d'euros. On le
   *    SIGNALE donc, on ne le devine pas.
   */
  function detailCommission(devis) {
    const c = (devis && devis.calculs) || {};
    const connue = c.nicolas_net !== undefined || c.nicolas_gross !== undefined || c.nicolas_pct !== undefined;
    const base = c.total_catalog_ht_brut !== undefined ? c.total_catalog_ht_brut : c.total_catalog_ht;
    return {
      base: r2(base),
      pct: (c.nicolas_pct === undefined || c.nicolas_pct === null || c.nicolas_pct === '') ? null : num(c.nicolas_pct),
      principal: String(c.seller_principal || ''),
      brut: r2(c.nicolas_gross), net: r2(c.nicolas_net),
      remise: r2(c.remise_catalogue && c.remise_catalogue.amount),
      diviseur: diviseurNet(devis),
      calculee: connue,
    };
  }

  /** Encaissé sur un dossier : les paiements reçus sur ses factures, moins les avoirs émis.
   *  ⚠️ On ne lit PAS le total des factures — une facture émise n'est pas de l'argent reçu. */
  function encaisseDe(devisId, factures) {
    let recu = 0, avoirs = 0;
    (factures || []).forEach(function (f) {
      if (!f || f.devis_id !== devisId) return;
      if (f.type === 'avoir') { avoirs += Math.abs(num(f.total_ttc)); return; }
      recu += ((f.paiements) || []).reduce(function (s, p) { return s + num(p.montant); }, 0);
    });
    return r2(Math.max(0, recu - avoirs));
  }

  /**
   * Le détail d'UN dossier, du point de vue de Nicolas.
   * @param devis       le devis (une ligne de liste suffit : items_min et chantier y sont)
   * @param factures    toutes les factures (on filtre sur devis_id)
   * @param reglages    pour le tarif de pose
   * @param aujourdhui  « YYYY-MM-DD », facultatif (voir poseFaite)
   */
  function parDossier(devis, factures, reglages, aujourdhui) {
    const d = devis || {};
    const calc = d.calculs || {};
    const statut = d.statut || 'brouillon';
    // Règle 6 : un dossier refusé ou annulé ne doit rien.
    const actif = statut !== 'refuse' && statut !== 'annule';

    const incomplet = [];
    const qui = actif ? poseurs(d) : [];
    const etat = actif ? poseFaite(d, aujourdhui) : { faite: false, certaine: false };
    const jyEtais = !!(qui && qui.indexOf(MOI) >= 0);

    // ── Commissions : lues sur le devis, jamais recalculées (règle 4) ──
    const commission = {
      nicolas: { brut: actif ? r2(calc.nicolas_gross) : 0, net: actif ? r2(calc.nicolas_net) : 0 },
      yannick: { brut: actif ? r2(calc.yannick_gross) : 0, net: actif ? r2(calc.yannick_net) : 0 },
    };

    // ── Paie de pose : comptée en OUVERTURES (règles 1 et 2) ──
    const tarife = actif ? detailPose(d, reglages) : { detail: [], total: 0, sans_tarif: [] };
    const posePayee = (actif && jyEtais && etat.faite) ? tarife.total : 0;

    /* Un type sans tarif sur un chantier que Nicolas a POSÉ : il faut le dire. Ailleurs
       (sous-traité, posé par Yannick, pas encore posé) ça ne lui coûte rien, donc on se tait. */
    if (actif && jyEtais && etat.faite && tarife.sans_tarif.length) incomplet.push('tarif');

    if (actif && tarife.total > 0) {
      // Règle 5 : on ne devine pas qui a posé.
      if (qui === null) incomplet.push('equipe');
      // Règle 3 : chantier dont RIEN ne dit s'il a été posé — ni PV, ni commande posée, ni même
      // une date. Un chantier daté dans le futur n'est PAS à compléter : il est à venir.
      // Ne concerne que Nicolas : si la pose est sous-traitée ou faite par Yannick seul,
      // l'inconnue ne lui coûte rien.
      else if (jyEtais && !etat.faite && !etat.datee) incomplet.push('pose');
    }

    /* ⚠️ Un devis CHIFFRÉ — il a un total client — mais qui ne porte aucun partage. Sa
       commission vaut alors zéro sans que rien ne le dise, et c'est de l'argent de vente, pas
       50 € de pose. Le cas vient des devis établis avant que le partage soit figé dans le devis,
       et il ne se verrait nulle part : un dossier qui ne rapporte rien est masqué du tableau. */
    const comDetail = detailCommission(d);
    if (actif && !comDetail.calculee && num(calc.total_ttc) > 0) incomplet.push('commission');

    const totalNicolas = r2(commission.nicolas.net + posePayee);

    // ── L'encaissement : une INFORMATION, jamais un plafond (règle 7) ──
    const totalTtc = r2(calc.total_ttc);
    const encaisse = actif ? encaisseDe(d.id, factures) : 0;
    const part = totalTtc > 0 ? Math.min(1, Math.max(0, encaisse / totalTtc)) : 0;

    return {
      id: d.id, statut: statut, actif: actif,
      equipe: (d.chantier && d.chantier.equipe) || '',
      poseurs: qui, jy_etais: jyEtais,
      pose_faite: etat.faite, pose_certaine: etat.certaine, pose_datee: etat.datee,
      // Ce que la pose RAPPORTERAIT si elle est bien de Nicolas et bien faite : sert à chiffrer
      // ce qui est en suspens sur un dossier signalé, sans jamais le compter comme dû.
      pose_tarifee: tarife.total, pose_detail: tarife.detail, pose_sans_tarif: tarife.sans_tarif,
      pose: posePayee,
      commission: commission,
      commission_detail: comDetail,
      total: totalNicolas,
      yannick_commission_net: commission.yannick.net,
      total_ttc: totalTtc, encaisse: encaisse, part: Math.round(part * 1000) / 1000,
      couvert: r2(totalNicolas * part),
      diviseur_net: diviseurNet(d),
      incomplet: incomplet,
    };
  }

  /**
   * Le cumul sur tous les dossiers, moins ce qui a déjà été prélevé.
   * ⚠️ « reste » se calcule sur le TOTAL, pas sur la part couverte (règle 7) : tant que le
   * déclencheur n'est pas acté, le chiffre qui compte est ce qui a été gagné. « couvert » et
   * « en_attente_client » sont là pour la discussion, pas pour arbitrer à la place de Nicolas.
   */
  function cumul(dossiers, prelevements) {
    const out = {
      pose: 0, commission: 0, total: 0,
      couvert: 0, en_attente_client: 0,
      preleve: 0, reste: 0,
      yannick_commission: 0,
      dossiers: 0, dossiers_incomplets: 0, en_attente_equipe: 0, en_attente_pose: 0,
      sans_tarif: {}, commission_par_taux: {}, dossiers_sans_commission: 0,
    };

    (dossiers || []).forEach(function (x) {
      if (!x || !x.actif) return;
      out.dossiers++;
      out.pose = r2(out.pose + x.pose);
      out.commission = r2(out.commission + x.commission.nicolas.net);
      out.total = r2(out.total + x.total);
      out.couvert = r2(out.couvert + x.couvert);
      out.yannick_commission = r2(out.yannick_commission + x.yannick_commission_net);
      if (x.incomplet.length) out.dossiers_incomplets++;
      if (x.incomplet.indexOf('commission') >= 0) out.dossiers_sans_commission++;

      /* LE DÉTAIL DE LA COMMISSION, GROUPÉ PAR TAUX. C'est ce qui rend le chiffre discutable
         en face de Yannick : « 18 % sur trois dossiers, et 11,5 % sur École du Bonheur ». Un
         total de commission sans ses taux ne se vérifie pas, et un dossier à répartition
         personnalisée y devient parfaitement invisible — alors que c'est justement celui dont
         on se souvient.
         ⚠️ INVARIANT : la somme des groupes doit retomber sur « out.commission », au centime.
         D'où le groupe « taux inconnu » : un vieux devis qui porte un montant mais pas son
         pourcentage doit apparaître quelque part. Un détail qui ne retombe pas sur son total
         est pire que pas de détail — on cesse de croire les deux. */
      const cd = x.commission_detail;
      if (cd && (cd.net !== 0 || cd.base > 0)) {
        const cle = cd.pct === null ? 'inconnu' : String(cd.pct);
        const g = out.commission_par_taux[cle] ||
          (out.commission_par_taux[cle] = { pct: cd.pct, base: 0, brut: 0, net: 0, remise: 0, dossiers: 0 });
        g.base = r2(g.base + cd.base);
        g.brut = r2(g.brut + cd.brut);
        g.net = r2(g.net + cd.net);
        g.remise = r2(g.remise + cd.remise);
        g.dossiers++;
      }
      // Ce que ces dossiers garderaient en suspens — chiffré pour qu'on sache ce qu'on va
      // chercher en allant compléter, et séparé pour qu'on sache QUOI compléter.
      if (x.incomplet.indexOf('equipe') >= 0) out.en_attente_equipe = r2(out.en_attente_equipe + x.pose_tarifee);
      if (x.incomplet.indexOf('pose') >= 0) out.en_attente_pose = r2(out.en_attente_pose + x.pose_tarifee);
      // Les ouvertures posées dont le type n'a aucun tarif : on les NOMME, sinon on ne saurait
      // pas quoi aller régler dans les paramètres.
      (x.pose_sans_tarif || []).forEach(function (st) {
        if (x.incomplet.indexOf('tarif') < 0) return;
        out.sans_tarif[st.type] = (out.sans_tarif[st.type] || 0) + st.qte;
      });
    });
    out.en_attente_client = r2(out.total - out.couvert);

    (prelevements || []).forEach(function (p) {
      if (!p || p.qui !== MOI) return;        // Yannick est le patron : on ne suit pas ses retraits
      out.preleve = r2(out.preleve + num(p.montant));
    });
    out.reste = r2(out.total - out.preleve);
    return out;
  }

  window.SSRemu = {
    MOI: MOI,
    GENS: GENS,
    TARIF_DEFAUT: TARIF_DEFAUT,
    DIVISEUR_HISTORIQUE: DIVISEUR_HISTORIQUE,
    tarifPose: tarifPose,
    diviseurNet: diviseurNet,
    poseurs: poseurs,
    poseFaite: poseFaite,
    quantiteDe: quantiteDe,
    ouverturesParType: ouverturesParType,
    detailPose: detailPose,
    detailCommission: detailCommission,
    encaisseDe: encaisseDe,
    parDossier: parDossier,
    cumul: cumul,
  };
})();
