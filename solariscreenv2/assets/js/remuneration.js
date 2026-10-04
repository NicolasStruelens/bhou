/* ═══════════════════════════════════════════════════════════════════════════════════════════
   RÉMUNÉRATION (window.SSRemu) — ce que Nicolas et Yannick doivent encaisser.

   POURQUOI UN MOTEUR SÉPARÉ, ET PUR
   Depuis le début de SolariScreen, personne n'a rien prélevé. Le jour où l'on se paie, le
   chiffre doit être JUSTE : c'est de l'argent réel, et une erreur ici ne se rattrape pas en
   rechargeant la page. Comme « calc.js » et « planning.js », ce fichier ne touche à rien — il
   reçoit des devis, des factures et des réglages, et il renvoie des nombres. Il est protégé
   par « tests/remuneration.test.html ».

   ⚠️ CE QUE J'AI CRU, ET QUI ÉTAIT FAUX — à lire avant de modifier ce fichier.
   Première version écrite le 04/10/2026 : elle ajoutait une PRIME NETTE de 50 € par screen et
   de 100 € par tente, par-dessus la commission. C'était un DOUBLE PAIEMENT. Les 50 € existent
   déjà dans l'ERP depuis toujours : la ligne « Tech 1 » vaut 125 € BRUT par ouverture
   (« config.js », prix.tech1_gross) et le diviseur brut→net vaut 2,5 —
   soit 125 / 2,5 = **50 € net par ouverture**, exactement le chiffre que Nicolas a donné. Le
   simulateur l'affiche même en clair (« Tech 1 : 125 € brut / 50 € net »).
   Et 280 = 125 + 125 + 30 : la pose facturée au client EST déjà découpée en paie de Tech 1,
   paie de Tech 2 et outillage. Le modèle n'avait rien à inventer, il fallait juste le LIRE.
   La leçon est la même que partout ici : **comprendre ce qui existe avant d'ajouter.**

   LES SIX RÈGLES, toutes décidées avec Nicolas le 04/10/2026

   1. **LA RÉMUNÉRATION SUIT L'ARGENT REÇU.** Elle n'est acquise qu'au prorata de ce que le
      CLIENT a réellement payé : acompte encaissé = part acquise, solde encaissé = le reste.
      On ne se paie pas sur de l'argent qu'on n'a pas. C'est aussi ce qui rend le chiffre
      utilisable : ce qu'il annonce est disponible en banque.

   2. **RIEN N'EST JAMAIS RECALCULÉ.** Commission (« calculs.nicolas_net ») comme paie de pose
      (« calculs.tech1_total ») ont été figées avec les taux du jour où le devis a été établi
      (règle 1 du guide). Les recalculer ici ferait bouger la rémunération d'un dossier signé
      le jour où l'on change une marge — exactement ce que l'ERP s'interdit partout ailleurs.
      Le diviseur brut→net lui-même est relu sur le devis, jamais pris dans les réglages du jour.

   3. **LA PAIE DE POSE VA À CELUI QUI A POSÉ — nommément, et sans partage.** « Tech 1 » et
      « Tech 2 » sont deux lignes d'argent DISTINCTES (elles peuvent porter des quantités
      différentes) : « pricing_v2.pose » dit qui est l'un et qui est l'autre, et chacun reçoit
      SA ligne. Un partage à parts égales serait faux dès que les deux quantités diffèrent.

   4. **CE QU'ON NE SAIT PAS N'EST À PERSONNE.** Si l'on ignore qui a posé, la paie de pose
      n'est attribuée à personne : elle va provisoirement à la société et le dossier est
      SIGNALÉ. Un outil de rémunération qui devine se met à promettre de l'argent qui n'existe
      pas — c'est la faute qui coûte le plus cher ici.

   5. **UN DEVIS REFUSÉ OU ANNULÉ NE DOIT RIEN.** Sans cette règle, un devis refusé de 30 000 €
      continuerait d'afficher une commission due.

   6. **L'ÉCART SE SIGNALE, IL NE SE PAIE PAS.** Nicolas veut 50 € net par screen ou volet et
      100 € net par tente solaire. Les screens y sont déjà (125 € brut). Les tentes, NON : elles
      sortent aussi à 125 € brut, donc 50 € net — la moitié de ce qu'il veut. La bonne réponse
      est de CHIFFRER la prochaine tente à 250 € brut, pas d'ajouter ici 50 € qui ne sont nulle
      part dans le devis ni dans ce que le client a payé. Le moteur calcule donc l'écart et le
      dit (« manque_net »), sans jamais le compter comme dû.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  const num = function (v) { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  const GENS = ['nicolas', 'yannick'];

  /* Ce que Nicolas veut toucher EN NET par ouverture posée. Ce ne sont pas des primes à verser :
     c'est la CIBLE contre laquelle on mesure ce que le devis a réellement budgété (règle 6).
     « tablier_volet » n'y figure pas volontairement : c'est une PIÈCE de rechange, pas une
     ouverture posée. */
  const CIBLE_DEFAUT = { screen: 50, volet_roulant: 50, tente_solaire: 100 };

  /* Diviseur brut→net historique. Même valeur que « SSConf.TAUX_HISTORIQUES.net_divisor » : un
     devis sans taux stockés a été établi avec celui-là. On ne lit PAS les réglages du jour
     (règle 2) — et on ne passe pas par SSConf, pour que le moteur reste pur et testable. */
  const DIVISEUR_HISTORIQUE = 2.5;

  function cibleNette(reglages) {
    const r = (reglages && reglages.remu && reglages.remu.cible) || null;
    const t = Object.assign({}, CIBLE_DEFAUT);
    if (!r) return t;
    Object.keys(CIBLE_DEFAUT).forEach(function (k) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') t[k] = num(r[k]);
    });
    return t;
  }

  /** Le diviseur brut→net DU DEVIS, jamais celui du jour (règle 2). */
  function diviseurNet(devis) {
    const d = num(devis && devis.pricing_v2 && devis.pricing_v2.rates && devis.pricing_v2.rates.net_divisor);
    return d > 0 ? d : DIVISEUR_HISTORIQUE;
  }

  function net(brut, devis) { return r2(num(brut) / diviseurNet(devis)); }

  /** Qui a posé ? « pricing_v2.pose = { tech1, tech2 } », chacun 'nicolas' | 'yannick' | 'externe'.
   *  Renvoie null tant que RIEN n'est renseigné — c'est ce null qui déclenche le signalement
   *  (règle 4). 'externe' des deux côtés est une réponse VALIDE : la pose est sous-traitée, elle
   *  ne vous revient pas. À ne pas confondre avec « pas renseigné ». */
  function poseurs(devis) {
    const p = (devis && devis.pricing_v2 && devis.pricing_v2.pose) || null;
    if (!p || (!p.tech1 && !p.tech2)) return null;
    const ok = function (x) { return x === 'nicolas' || x === 'yannick' ? x : ''; };
    return { tech1: ok(p.tech1), tech2: ok(p.tech2) };
  }

  /** Les ouvertures d'un devis, par type et par quantité. « items » sur une fiche complète,
   *  « items_min » dans une liste — le tableau de bord ne charge jamais les items entiers. */
  function ouverturesParType(devis) {
    const src = (devis && devis.items && devis.items.length) ? devis.items : ((devis && devis.items_min) || []);
    const par = {};
    src.forEach(function (it) {
      if (!it || !it.type) return;
      par[it.type] = (par[it.type] || 0) + (num(it.quantite) || 1);
    });
    return par;
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

  function vide() {
    return { commission_brut: 0, commission_net: 0, pose_brut: 0, pose_net: 0, total_brut: 0, total_net: 0 };
  }

  /**
   * L'ÉCART entre ce que Nicolas veut toucher par ouverture et ce que le devis a budgété.
   * Ne se paie pas : se signale (règle 6). Le budget de pose est réparti au prorata des
   * ouvertures, parce que le devis chiffre « Tech 1 » à l'ouverture sans distinguer les types.
   */
  function ecartDe(devis, posePaieNette, reglages) {
    const cible = cibleNette(reglages);
    const par = ouverturesParType(devis);
    const types = Object.keys(par).filter(function (t) { return num(cible[t]) > 0; });
    const ouvertures = types.reduce(function (s, t) { return s + par[t]; }, 0);
    if (!ouvertures) return { attendu_net: 0, budgete_net: r2(posePaieNette), manque_net: 0, detail: [] };

    // Ce que le devis paie réellement par ouverture, toutes ouvertures confondues.
    const parOuverture = posePaieNette / ouvertures;
    let attendu = 0, manque = 0;
    const detail = types.map(function (t) {
      const u = num(cible[t]);
      const ecartUnitaire = Math.max(0, u - parOuverture);
      attendu += u * par[t];
      manque += ecartUnitaire * par[t];
      return {
        type: t, qte: par[t], cible_unitaire: u,
        budgete_unitaire: r2(parOuverture), manque: r2(ecartUnitaire * par[t]),
      };
    }).filter(function (x) { return x.manque > 0.004; });

    return { attendu_net: r2(attendu), budgete_net: r2(posePaieNette), manque_net: r2(manque), detail: detail };
  }

  /**
   * Le détail d'UN dossier.
   * @param devis     le devis complet (ou une ligne de liste : items_min suffit)
   * @param factures  toutes les factures (on filtre sur devis_id)
   * @param reglages  pour la cible nette par ouverture
   */
  function parDossier(devis, factures, reglages) {
    const d = devis || {};
    const calc = d.calculs || {};
    const statut = d.statut || 'brouillon';
    // Règle 5 : un dossier refusé ou annulé ne doit rien.
    const actif = statut !== 'refuse' && statut !== 'annule';

    const du = {
      nicolas: vide(), yannick: vide(),
      societe: { pose_brut: 0, pose_net: 0, outillage_brut: 0, outillage_net: 0 },
    };
    const incomplet = [];
    let ecart = { attendu_net: 0, budgete_net: 0, manque_net: 0, detail: [] };

    if (actif) {
      // ── Commissions : lues sur le devis, jamais recalculées (règle 2) ──
      du.nicolas.commission_brut = r2(calc.nicolas_gross);
      du.nicolas.commission_net = r2(calc.nicolas_net);
      du.yannick.commission_brut = r2(calc.yannick_gross);
      du.yannick.commission_net = r2(calc.yannick_net);

      // ── Paie de pose : chacun reçoit SA ligne, pas une moitié (règle 3) ──
      const lignes = [
        { qui: null, brut: r2(calc.tech1_total) },
        { qui: null, brut: r2(calc.tech2_total) },
      ];
      const qui = poseurs(d);
      if (qui) { lignes[0].qui = qui.tech1; lignes[1].qui = qui.tech2; }

      let posePaieNetteAttribuee = 0;
      lignes.forEach(function (l) {
        const n = net(l.brut, d);
        if (l.qui) {
          du[l.qui].pose_brut = r2(du[l.qui].pose_brut + l.brut);
          du[l.qui].pose_net = r2(du[l.qui].pose_net + n);
          posePaieNetteAttribuee += n;
        } else {
          // Règle 4 (non renseigné) ou pose sous-traitée : la société porte le montant.
          du.societe.pose_brut = r2(du.societe.pose_brut + l.brut);
          du.societe.pose_net = r2(du.societe.pose_net + n);
        }
      });
      // Le dossier n'est signalé que si de l'argent de pose attend vraiment une attribution.
      if (qui === null && du.societe.pose_brut > 0) incomplet.push('pose');

      du.societe.outillage_brut = r2(calc.tools_total);
      du.societe.outillage_net = net(calc.tools_total, d);

      // ── Le contrôle : 50 € net par screen, 100 € par tente (règle 6) ──
      ecart = ecartDe(d, posePaieNetteAttribuee, reglages);
    }

    GENS.forEach(function (g) {
      du[g].total_brut = r2(du[g].commission_brut + du[g].pose_brut);
      du[g].total_net = r2(du[g].commission_net + du[g].pose_net);
    });

    // ── Part encaissée (règle 1) ──
    const totalTtc = r2(calc.total_ttc);
    const encaisse = actif ? encaisseDe(d.id, factures) : 0;
    const part = totalTtc > 0 ? Math.min(1, Math.max(0, encaisse / totalTtc)) : 0;

    const acquis = {};
    GENS.forEach(function (g) { acquis[g] = r2(du[g].total_net * part); });

    return {
      id: d.id, actif: actif, statut: statut,
      total_ttc: totalTtc, encaisse: encaisse, part: Math.round(part * 1000) / 1000,
      diviseur_net: diviseurNet(d),
      du: du, acquis: acquis,
      ecart: ecart,
      incomplet: incomplet,
    };
  }

  /**
   * Le cumul sur tous les dossiers, moins ce qui a déjà été prélevé.
   * @param dossiers      les résultats de parDossier
   * @param prelevements  [{ qui, montant, date }] — les retraits réellement effectués
   */
  function cumul(dossiers, prelevements) {
    const out = { dossiers_incomplets: 0, en_attente: 0, manque_net: 0 };
    GENS.forEach(function (g) { out[g] = { du_brut: 0, du_net: 0, acquis: 0, preleve: 0, reste: 0 }; });

    (dossiers || []).forEach(function (x) {
      if (!x) return;
      GENS.forEach(function (g) {
        out[g].du_brut = r2(out[g].du_brut + x.du[g].total_brut);
        out[g].du_net = r2(out[g].du_net + x.du[g].total_net);
        out[g].acquis = r2(out[g].acquis + x.acquis[g]);
      });
      out.manque_net = r2(out.manque_net + ((x.ecart && x.ecart.manque_net) || 0));
      if (x.incomplet && x.incomplet.length) {
        out.dossiers_incomplets++;
        // Ce que ce dossier garde en suspens tant que la pose n'est pas renseignée.
        out.en_attente = r2(out.en_attente + x.du.societe.pose_net);
      }
    });

    (prelevements || []).forEach(function (p) {
      if (!p || GENS.indexOf(p.qui) === -1) return;
      out[p.qui].preleve = r2(out[p.qui].preleve + num(p.montant));
    });

    GENS.forEach(function (g) { out[g].reste = r2(out[g].acquis - out[g].preleve); });
    return out;
  }

  window.SSRemu = {
    GENS: GENS,
    CIBLE_DEFAUT: CIBLE_DEFAUT,
    DIVISEUR_HISTORIQUE: DIVISEUR_HISTORIQUE,
    cibleNette: cibleNette,
    diviseurNet: diviseurNet,
    poseurs: poseurs,
    ouverturesParType: ouverturesParType,
    encaisseDe: encaisseDe,
    ecartDe: ecartDe,
    parDossier: parDossier,
    cumul: cumul,
  };
})();
