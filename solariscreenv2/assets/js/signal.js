/* ═══════════════════════════════════════════════════════════════════════════════════════════
   SIGNAL — ce qui reste à remplir se voit, sans qu'on ait à le chercher.

   DEMANDE DE NICOLAS (10/10/2026) : « des effets sur les boîtes de dialogue, effet néon, dont
   on pourra changer la couleur dans les paramètres… pour attirer l'attention sur les choses
   pas remplies ».

   LE PROBLÈME RÉEL. Un VR150 porte 38 champs de configuration et 6 d'entre eux bloquent la
   commande chez Harol. Jusqu'ici ils n'étaient signalés que par du TEXTE — une liste
   d'avertissements dans le simulateur, des pastilles grises en Mode Terrain. Du texte qui
   parle d'un champ oblige à lire, puis à CHERCHER le champ. Entre les deux, on abandonne.
   Le signal se pose donc sur le champ lui-même : l'attention va à la chose à remplir, pas à
   un message qui en parle.

   ⚠️ TROIS DISCIPLINES, SANS LESQUELLES CE MODULE DEVIENDRAIT DU PAPIER PEINT.

   1. ON N'ALLUME QUE CE QUI BLOQUE LA COMMANDE (`SSProducts.CHAMPS_REQUIS`), soit ~6 champs
      par ouverture, jamais les 38. Choix de Nicolas, et c'est le bon : un signal qui montre
      tout ne montre rien. La source est celle qui alimente déjà les pastilles « incomplet »
      du Mode Terrain — un seul endroit, donc aucune divergence possible (règle 10).

   2. ON N'ALLUME QU'UNE OUVERTURE COMMENCÉE. Une ouverture neuve est VIDE par définition :
      l'allumer en entier, c'est accueillir chaque nouvelle ouverture par six champs en néon,
      et apprendre à ne plus les voir dès le deuxième devis. Dès qu'un seul champ bloquant est
      rempli, les autres s'allument — le signal dit alors un OUBLI, pas un début.

   3. LE MOUVEMENT MARQUE UN ÉVÉNEMENT, PAS UN ÉTAT. Un halo fixe se parcourt du regard ; une
      animation permanente se subit. Les effets animés existent parce que Nicolas les a
      demandés, mais le `viser()` — la pulsation d'arrivée quand on saute sur un champ — est
      une animation d'UNE seconde qui s'éteint seule. C'est la seule qui soit toujours juste.

   ⚠️ JAMAIS CHEZ LE CLIENT. Ce module ne se charge que sur les pages de saisie de `app/`. Il
   n'a rien à faire sur un devis, une facture, `devis-review.html` ni `track.html` — et une
   règle `@media print` le neutralise, au cas où une page d'édition finirait sur une imprimante.

   ⚠️ LA TEINTE A SES DEUX TONS `{ sombre, clair }`, comme les décors de fête, et pour la même
   raison payée : une couleur calibrée sur fond sombre devient illisible sur le thème clair,
   qui est celui réellement utilisé en production. Les tons clairs visent TOUS les thèmes
   clairs via `SSTheme.idsClairs()`, jamais le seul `light`.

   ⚠️ LA PALETTE ÉVITE LE VERT ET LE ROUGE, et ce n'est pas une question de goût : dans cet ERP
   la couleur porte du sens (règles 21 bis et 22). Un « à compléter » en vert se lirait comme
   un « c'est bon », en rouge comme une erreur. Les six teintes proposées sont toutes
   distinctes de `--ok` et de `--danger` dans les cinq thèmes.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CLE_EFFET = 'ss_signal_effet';
  const CLE_COULEUR = 'ss_signal_couleur';
  const STYLE_ID = 'ss-signal-style';
  const CLASSE = 'ss-signal';
  const CLASSE_VISE = 'ss-signal-vise';

  /* LES EFFETS — liste fermée. Un effet n'est pas un réglage libre : chacun a été dessiné pour
     rester lisible sur les cinq thèmes et sur un écran de téléphone en plein soleil. */
  const EFFETS = [
    { id: 'halo', nom: 'Halo', aide: 'Un halo net autour du champ. Fixe : il se parcourt du regard sans rien réclamer. C’est le plus calme, et celui qui tient quand il y a six champs allumés.' },
    { id: 'pouls', nom: 'Pouls', aide: 'Le même halo, qui respire lentement. On le repère de loin, au prix d’un peu de mouvement à l’écran.' },
    { id: 'lisere', nom: 'Liseré tournant', aide: 'Un filet de lumière qui fait le tour du champ. Le plus spectaculaire — à garder pour quand il n’y a qu’un ou deux champs en attente.' },
    { id: 'trait', nom: 'Trait souligné', aide: 'Un soulignement lumineux, sans halo. Discret : pour qui trouve le néon trop présent mais veut quand même voir où ça manque.' },
    { id: 'aucun', nom: 'Aucun', aide: 'Rien n’est mis en avant. Les avertissements écrits restent, eux : on ne perd aucune information, seulement la mise en lumière.' },
  ];

  /* LES TEINTES — deux tons chacune, et aucune n'empiète sur le vert « c'est bon » ni sur le
     rouge « erreur ». « Suit le thème » reprend `--warn`, la couleur que l'ERP emploie déjà
     pour « la balle est dans notre camp » : c'est exactement ce que dit un champ à remplir. */
  const COULEURS = [
    { id: 'theme', nom: 'Suit le thème', ton: { sombre: 'var(--warn)', clair: 'var(--warn)' } },
    { id: 'ambre', nom: 'Ambre', ton: { sombre: '#ffb020', clair: '#b06a00' } },
    { id: 'cyan', nom: 'Cyan', ton: { sombre: '#28e0ff', clair: '#0077a0' } },
    { id: 'azur', nom: 'Azur', ton: { sombre: '#5aa9f5', clair: '#1565c0' } },
    { id: 'violet', nom: 'Violet', ton: { sombre: '#b388ff', clair: '#6a3fc0' } },
    { id: 'magenta', nom: 'Magenta', ton: { sombre: '#ff5fc8', clair: '#a8197a' } },
    { id: 'or', nom: 'Or', ton: { sombre: '#ffd400', clair: '#8a6000' } },
  ];

  const EFFET_DEFAUT = 'halo';
  const COULEUR_DEFAUT = 'theme';
  /* ⚠️ VOLONTAIREMENT HORS DES DEUX LISTES : `SUIVRE` ne désigne aucun effet ni aucune
     couleur, il désigne l'ABSENCE de choix local. Le mettre dans `EFFETS` en ferait une valeur
     enregistrable, donc un appareil pourrait se retrouver avec l'effet « societe », qui n'a
     aucune feuille de style — et plus rien ne s'allumerait, sans la moindre erreur. */
  const SUIVRE = 'societe';

  /* ── TROIS NIVEAUX, ET L'ORDRE EST TOUT ───────────────────────────────────────
     1. le choix de CET APPAREIL, s'il en a fait un ;
     2. sinon le DÉFAUT DE LA SOCIÉTÉ, enregistré au serveur par celui qui décide ;
     3. sinon le repli écrit ici, pour qu'un appareil hors-ligne et jamais configuré affiche
        quand même quelque chose de juste.
     Demande de Nicolas, 10/10/2026 : « les changements ne doivent pas être opérés serveur,
     comme ça c'est régi par celui qui décide ? ». Réponse : le défaut, oui ; le réglage, non.
     ⚠️ UN DÉFAUT N'EST PAS UNE CONSIGNE, et la nuance est tout l'intérêt du montage. En
     serveur SEUL, Yannick changerait la couleur depuis son Android et l'écran de Nicolas
     changerait au milieu d'un devis, sans qu'il sache pourquoi. Et la lisibilité dépend de
     l'écran qu'on a sous les yeux : un halo calibré sur un moniteur de bureau est trop discret
     sur un téléphone en plein soleil. Ce qui doit être RÉGI — quels champs bloquent une
     commande — l'est déjà, dans `CHAMPS_REQUIS`, et personne ne peut le changer d'ici. */

  /** La valeur choisie SUR CET APPAREIL, ou `null` s'il n'a jamais choisi. */
  function choixAppareil(cle, liste) {
    try {
      const v = localStorage.getItem(cle);
      return liste.some(function (x) { return x.id === v; }) ? v : null;
    } catch (e) { return null; }
  }

  /** Le défaut de la société, lu dans les réglages serveur (cache synchrone de `SSConf`). */
  function defautSociete(nom, liste, repli) {
    try {
      const c = window.SSConf && window.SSConf.get ? window.SSConf.get() : null;
      const v = c && c.affichage ? c.affichage[nom] : null;
      return liste.some(function (x) { return x.id === v; }) ? v : repli;
    } catch (e) { return repli; }
  }

  function effetSociete() { return defautSociete('signal_effet', EFFETS, EFFET_DEFAUT); }
  function couleurSociete() { return defautSociete('signal_couleur', COULEURS, COULEUR_DEFAUT); }

  /* ── L APERÇU D UN RÉGLAGE SOCIÉTÉ PAS ENCORE ENREGISTRÉ ─────────────────────────
     Le défaut de la société part au SERVEUR : tant qu on n a pas cliqué « Enregistrer », le
     cache de `SSConf` porte encore l ancienne valeur, donc choisir une couleur ne changeait
     RIEN à l écran. Nicolas, le 10/10/2026 : « quand je change la couleur ça marche pas ».
     Il avait raison du point de vue qui compte : un aperçu posé juste sous le menu, et qui ne
     bouge pas quand on touche le menu, ne dit pas « pas encore enregistré » — il dit « ton
     choix n a pas été pris ».
     ⚠️ CETTE VALEUR N EST JAMAIS ÉCRITE NULLE PART. Elle vit en mémoire, le temps de la page :
     c est un APERÇU, pas un réglage. Un rechargement sans enregistrement la perd, ce qui est
     exactement ce qu on veut — et le bandeau « 1 réglage modifié, pas encore enregistré » de
     la page dit déjà que rien n est acté.
     ⚠️ ET ELLE NE PASSE JAMAIS DEVANT LE CHOIX DE L APPAREIL. Un appareil qui a choisi sa
     propre couleur garde la sienne, même pendant qu on règle le défaut de la maison : sinon on
     lui ferait croire que son réglage a sauté. L ordre est donc : appareil → aperçu →
     société enregistrée → repli. */
  let APERCU = null;

  /** Montre un réglage société avant enregistrement. `null` (ou rien) revient au réel. */
  function previsualiserSociete(idEffet, idCouleur) {
    const e = EFFETS.some(function (x) { return x.id === idEffet; }) ? idEffet : null;
    const c = COULEURS.some(function (x) { return x.id === idCouleur; }) ? idCouleur : null;
    APERCU = (e || c) ? { effet: e, couleur: c } : null;
    monter();
    return !!APERCU;
  }

  function effet() {
    const local = choixAppareil(CLE_EFFET, EFFETS);
    if (local) return local;
    if (APERCU && APERCU.effet) return APERCU.effet;
    return effetSociete();
  }
  function couleur() {
    const local = choixAppareil(CLE_COULEUR, COULEURS);
    if (local) return local;
    if (APERCU && APERCU.couleur) return APERCU.couleur;
    return couleurSociete();
  }
  /** Cet appareil a-t-il une préférence à lui, ou suit-il la société ? */
  function suitLaSociete() {
    return { effet: !choixAppareil(CLE_EFFET, EFFETS), couleur: !choixAppareil(CLE_COULEUR, COULEURS) };
  }

  /**
   * Enregistre le choix de CET APPAREIL et applique dans la foulée.
   * ⚠️ `SUIVRE` n'est pas une valeur, c'est un RETRAIT : il efface la préférence locale pour
   * que l'appareil reparte sur le défaut de la société. Sans ce chemin, un appareil qui a
   * choisi une fois ne pourrait plus JAMAIS revenir au réglage commun — et le défaut serveur
   * deviendrait inutile pour tout le monde dès la première fois qu'on y touche.
   * Un argument omis (`null`) laisse ce réglage-là tel quel.
   */
  function regler(idEffet, idCouleur) {
    try {
      if (idEffet === SUIVRE) localStorage.removeItem(CLE_EFFET);
      else if (idEffet && EFFETS.some(function (x) { return x.id === idEffet; })) localStorage.setItem(CLE_EFFET, idEffet);
      if (idCouleur === SUIVRE) localStorage.removeItem(CLE_COULEUR);
      else if (idCouleur && COULEURS.some(function (x) { return x.id === idCouleur; })) localStorage.setItem(CLE_COULEUR, idCouleur);
    } catch (e) {}
    /* ⚠️ Un choix d APPAREIL annule l aperçu société en cours : les deux répondent à la même
       question, et laisser les deux actifs ferait afficher une couleur qui n est ni l une ni
       l autre dès qu on revient à « Comme la société ». */
    APERCU = null;
    monter();
  }

  /* ── QUAND UNE OUVERTURE EST « COMMENCÉE » ────────────────────────────────────────────────
     Dès qu'UN champ bloquant est rempli. C'est la définition la plus simple qu'on puisse
     expliquer en une phrase, et c'est ce qui la rend sûre : personne n'aura à deviner demain
     pourquoi tel champ compte et tel autre non.
     ⚠️ Elle se lit aussi à l'envers, et c'est là qu'elle est bonne : une ouverture DUPLIQUÉE
     arrive entièrement remplie, donc rien ne s'allume — le signal ne crie pas après une copie
     qui n'a rien à se reprocher. */
  function requis(item) {
    const P = window.SSProducts;
    if (!item || !P || !P.CHAMPS_REQUIS) return [];
    return P.CHAMPS_REQUIS[item.type] || [];
  }
  function commencee(item) {
    const tous = requis(item);
    if (!tous.length) return false;
    const manque = window.SSProducts.champsManquants(item).length;
    return manque < tous.length;      // au moins un rempli
  }

  /** @returns {string[]} les clés des champs à allumer — vide tant que l'ouverture est vierge. */
  function champsASignaler(item) {
    if (effet() === 'aucun') return [];
    if (!commencee(item)) return [];
    return window.SSProducts.champsManquants(item).map(function (c) { return c.k; });
  }

  /* ── POSER LE SIGNAL SUR UNE CARTE ────────────────────────────────────────────────────────
     ⚠️ ON RETIRE TOUJOURS AVANT DE POSER, sur TOUS les champs de la racine — y compris ceux
     qui ne sont plus bloquants. Sans ce nettoyage, un champ allumé puis rempli gardait son
     halo jusqu'au prochain rendu complet de la carte : on voyait du néon sur un champ plein,
     et le signal perdait tout son crédit en deux minutes.
     ⚠️ La classe se pose sur le `.field` (étiquette + contrôle), pas sur le seul `<input>` :
     c'est l'ensemble qui doit se repérer, et plusieurs champs enveloppent leur contrôle dans
     un `.input-unit` (le « € » du prix) qu'un sélecteur sur l'input seul aurait coupé en deux. */
  function appliquer(racine, item) {
    if (!racine) return [];
    const aAllumer = champsASignaler(item);
    racine.querySelectorAll('[data-f]').forEach(function (champ) {
      const enveloppe = champ.closest('.field') || champ.parentElement;
      if (!enveloppe) return;
      const doit = aAllumer.indexOf(champ.dataset.f) !== -1;
      enveloppe.classList.toggle(CLASSE, doit);
      // `aria-invalid` serait un mensonge : rien n'est FAUX, c'est seulement vide. On décrit
      // donc l'état au lecteur d'écran par un titre, pas par une erreur de validation.
      if (doit) enveloppe.setAttribute('data-signal-aide', 'À compléter');
      else enveloppe.removeAttribute('data-signal-aide');
    });
    return aAllumer;
  }

  /* ── VISER UN CHAMP ───────────────────────────────────────────────────────────────────────
     Appelé quand on SAUTE sur un champ depuis une liste de ce qui manque. L'animation dure une
     seconde puis se retire d'elle-même : c'est un ÉVÉNEMENT (« te voilà arrivé »), pas un état.
     ⚠️ On écoute `animationend` ET on garde un repli par minuterie : si l'utilisateur a demandé
     moins de mouvement à son système, l'animation ne démarre jamais et `animationend` ne part
     pas — la classe resterait collée pour toujours. */
  function viser(champ) {
    if (!champ) return;
    const cible = champ.closest ? (champ.closest('.field') || champ) : champ;
    cible.classList.remove(CLASSE_VISE);
    void cible.offsetWidth;                       // redémarre l'animation si on revise le même
    cible.classList.add(CLASSE_VISE);
    const oter = function () { cible.classList.remove(CLASSE_VISE); };
    cible.addEventListener('animationend', oter, { once: true });
    setTimeout(oter, 1400);
    if (champ.scrollIntoView) champ.scrollIntoView({ block: 'center' });
    if (champ.focus) { try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); } }
  }

  /* ── LA FEUILLE DE STYLE ──────────────────────────────────────────────────────────────────
     Posée une seule fois, et REFAITE à chaque réglage : c'est elle qui porte la teinte. */
  function css() {
    const c = COULEURS.filter(function (x) { return x.id === couleur(); })[0] || COULEURS[0];
    const clairs = (window.SSTheme ? window.SSTheme.idsClairs() : ['light'])
      .map(function (id) { return '[data-theme="' + id + '"]'; }).join(', ');
    return `
      :root { --ssg-c: ${c.ton.sombre}; }
      ${clairs} { --ssg-c: ${c.ton.clair}; }

      /* L'angle du liseré tournant. Déclaré en @property pour pouvoir être ANIMÉ : une variable
         CSS ordinaire ne s'interpole pas, l'animation sauterait de 0 à 360 d'un bloc. Là où
         @property manque, le liseré reste un anneau fixe — dégradé acceptable, jamais cassé. */
      @property --ssg-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

      .${CLASSE} { position: relative; border-radius: var(--r-sm, 6px); }

      /* L'ÉTIQUETTE EST TEINTÉE DANS TOUS LES EFFETS, et porte un point.
         C'est ce qui rend le signal SCANNABLE : dans une colonne de vingt champs, on lit les
         étiquettes, pas les contours. Le point reste visible même en « Trait souligné », donc
         même le réglage le plus discret dit encore OÙ ça manque. */
      .${CLASSE} > .label { color: var(--ssg-c); }
      .${CLASSE} > .label::after {
        content: ''; display: inline-block; width: 5px; height: 5px; border-radius: 50%;
        margin-left: 6px; vertical-align: 1px; background: var(--ssg-c);
        box-shadow: 0 0 6px -1px var(--ssg-c);
      }

      /* ── HALO ── le défaut : net, fixe, supportable à six exemplaires. */
      html[data-signal="halo"] .${CLASSE} .input,
      html[data-signal="halo"] .${CLASSE} .select,
      html[data-signal="pouls"] .${CLASSE} .input,
      html[data-signal="pouls"] .${CLASSE} .select {
        border-color: var(--ssg-c);
        box-shadow: 0 0 0 1px var(--ssg-c), 0 0 16px -5px var(--ssg-c);
      }
      /* ── POULS ── le même, qui respire. */
      html[data-signal="pouls"] .${CLASSE} .input,
      html[data-signal="pouls"] .${CLASSE} .select { animation: ssg-pouls 2.8s ease-in-out infinite; }
      @keyframes ssg-pouls {
        0%, 100% { box-shadow: 0 0 0 1px var(--ssg-c), 0 0 10px -6px var(--ssg-c); }
        50%      { box-shadow: 0 0 0 1px var(--ssg-c), 0 0 22px -2px var(--ssg-c); }
      }

      /* ── LISERÉ TOURNANT ── un filet de lumière qui fait le tour.
         Le masque en « exclude » ne garde que l'anneau : sans lui le dégradé remplirait tout le
         champ et on ne lirait plus rien de ce qu'on y tape. */
      html[data-signal="lisere"] .${CLASSE}::after {
        content: ''; position: absolute; inset: -3px; border-radius: calc(var(--r-sm, 6px) + 3px);
        padding: 1.5px; pointer-events: none;
        background: conic-gradient(from var(--ssg-a), transparent 0 58%, var(--ssg-c) 80%, transparent 94%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        mask-composite: exclude;
        animation: ssg-tour 2.6s linear infinite;
      }
      @keyframes ssg-tour { to { --ssg-a: 360deg; } }
      html[data-signal="lisere"] .${CLASSE} .input,
      html[data-signal="lisere"] .${CLASSE} .select { border-color: var(--ssg-c); }

      /* ── TRAIT ── pour qui trouve le néon trop présent. Aucun halo, juste la base qui s'allume. */
      html[data-signal="trait"] .${CLASSE} .input,
      html[data-signal="trait"] .${CLASSE} .select {
        border-bottom: 2px solid var(--ssg-c);
        box-shadow: 0 3px 12px -8px var(--ssg-c);
      }

      /* ── L'ARRIVÉE ── une seconde, puis plus rien. Elle marque un événement, pas un état,
         et elle reste visible même en effet « Aucun » : si on a demandé à sauter sur un champ,
         c'est qu'on veut le voir. */
      .${CLASSE_VISE} { animation: ssg-arrivee 1s cubic-bezier(.22,1,.36,1); border-radius: var(--r-sm, 6px); }
      @keyframes ssg-arrivee {
        0%   { box-shadow: 0 0 0 0 var(--ssg-c); }
        35%  { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ssg-c) 45%, transparent), 0 0 26px -2px var(--ssg-c); }
        100% { box-shadow: 0 0 0 0 transparent; }
      }

      /* ⚠️ MOINS DE MOUVEMENT : on ne RETIRE pas le signal, on retire seulement son animation.
         Quelqu'un qui demande moins de mouvement ne demande pas moins d'information. */
      @media (prefers-reduced-motion: reduce) {
        html[data-signal="pouls"] .${CLASSE} .input,
        html[data-signal="pouls"] .${CLASSE} .select,
        html[data-signal="lisere"] .${CLASSE}::after,
        .${CLASSE_VISE} { animation: none; }
        html[data-signal="pouls"] .${CLASSE} .input,
        html[data-signal="pouls"] .${CLASSE} .select {
          box-shadow: 0 0 0 1px var(--ssg-c), 0 0 16px -5px var(--ssg-c);
        }
      }

      /* L'APERÇU DES PARAMÈTRES. Le champ garde une largeur confortable, l'explication prend
         ce qui reste, et les deux passent l'un sous l'autre quand la place manque. */
      .ssg-apercu { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: flex-start; margin-top: 0.5rem; }
      .ssg-apercu .field { flex: 0 1 260px; }
      .ssg-apercu-aide { flex: 1 1 240px; margin: 0;
        font-size: var(--fs-2xs); line-height: 1.6; color: var(--text-muted); }

      /* ⚠️ RIEN À L'IMPRESSION. Une page de saisie n'a normalement pas à être imprimée, mais
         si elle l'est, un halo fluo sur un papier n'est plus un signal : c'est une tache. */
      @media print {
        .${CLASSE} > .label { color: inherit; }
        .${CLASSE} > .label::after { display: none; }
        .${CLASSE} .input, .${CLASSE} .select { border-color: inherit; box-shadow: none; animation: none; }
        .${CLASSE}::after { display: none; }
      }
    `;
  }

  /** (Re)pose la feuille de style et l'attribut qui choisit l'effet. */
  function monter() {
    const html = document.documentElement;
    html.setAttribute('data-signal', effet());
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      (document.head || html).appendChild(s);
    }
    s.textContent = css();
  }

  /* ── LE RÉGLAGE DANS PARAMÈTRES ───────────────────────────────────────────────────────────
     ⚠️ L'APERÇU EST UN VRAI CHAMP, pas une vignette dessinée pour l'occasion : il porte les
     mêmes classes que ceux du simulateur. Une vignette séparée serait une deuxième vérité, et
     elle aurait fini par montrer autre chose que ce qu'on obtient réellement. */
  function monterSelecteurs(selEffet, selCouleur, apercu) {
    const suit = suitLaSociete();
    const nomDe = function (liste, id) {
      const x = liste.filter(function (o) { return o.id === id; })[0];
      return x ? x.nom : id;
    };
    /* ⚠️ LA PREMIÈRE OPTION NOMME CE QU'ELLE DONNE : « Comme la société · Halo », pas
       « Comme la société » tout court. Sans le nom, il faut choisir l'option POUR savoir ce
       qu'elle fait, puis revenir en arrière si ça ne plaît pas — or revenir en arrière efface
       justement la préférence qu'on avait. On montre donc la valeur avant de la choisir. */
    if (selEffet) {
      selEffet.innerHTML =
        '<option value="' + SUIVRE + '">Comme la société · ' + nomDe(EFFETS, effetSociete()) + '</option>' +
        EFFETS.map(function (e) { return '<option value="' + e.id + '">' + e.nom + '</option>'; }).join('');
      selEffet.value = suit.effet ? SUIVRE : effet();
      selEffet.addEventListener('change', function () {
        regler(selEffet.value, null);
        rendreApercu(apercu, selEffet);
      });
    }
    if (selCouleur) {
      selCouleur.innerHTML =
        '<option value="' + SUIVRE + '">Comme la société · ' + nomDe(COULEURS, couleurSociete()) + '</option>' +
        COULEURS.map(function (c) { return '<option value="' + c.id + '">' + c.nom + '</option>'; }).join('');
      selCouleur.value = suit.couleur ? SUIVRE : couleur();
      selCouleur.addEventListener('change', function () {
        regler(null, selCouleur.value);
        rendreApercu(apercu, selEffet);
      });
    }
    rendreApercu(apercu, selEffet);
  }

  /**
   * À rappeler quand le DÉFAUT DE LA SOCIÉTÉ vient de changer (réglages reçus du serveur, ou
   * enregistrement dans Paramètres) : les libellés « Comme la société · … » mentent sinon,
   * et l'écran afficherait l'ancien défaut sur l'appareil qui vient de le changer.
   */
  function rafraichirSelecteurs(selEffet, selCouleur, apercu) {
    const suit = suitLaSociete();
    if (selEffet) {
      const premier = selEffet.querySelector('option[value="' + SUIVRE + '"]');
      if (premier) premier.textContent = 'Comme la société · ' +
        (EFFETS.filter(function (o) { return o.id === effetSociete(); })[0] || {}).nom;
      selEffet.value = suit.effet ? SUIVRE : effet();
    }
    if (selCouleur) {
      const premier = selCouleur.querySelector('option[value="' + SUIVRE + '"]');
      if (premier) premier.textContent = 'Comme la société · ' +
        (COULEURS.filter(function (o) { return o.id === couleurSociete(); })[0] || {}).nom;
      selCouleur.value = suit.couleur ? SUIVRE : couleur();
    }
    monter();
    rendreApercu(apercu, selEffet);
  }

  function rendreApercu(apercu, selEffet) {
    if (!apercu) return;
    const e = EFFETS.filter(function (x) { return x.id === effet(); })[0] || EFFETS[0];
    /* ⚠️ LE CHAMP ET SON EXPLICATION SE POSENT CÔTE À CÔTE, ET ÇA S'ENROULE.
       Première version : les deux étaient rendus dans la colonne de droite d'une ligne de
       réglage, qui fait 168 px. Le texte passait PAR-DESSUS le champ. Rien ne débordait de la
       page — donc aucune mesure ne le disait — et ça se voyait au premier coup d'œil. */
    apercu.innerHTML =
      '<div class="ssg-apercu">' +
      '<div class="field ' + (effet() === 'aucun' ? '' : CLASSE) + '">' +
      '<label class="label">Largeur (mm)</label>' +
      '<input class="input input-num" type="text" value="" placeholder="—" readonly></div>' +
      '<p class="ssg-apercu-aide">' + e.aide + '</p></div>';
    /* Cliquer sur l'aperçu rejoue l'effet d'ARRIVÉE. C'est la seule animation qu'on ne peut pas
       juger à l'arrêt, puisqu'elle dure une seconde et ne se déclenche qu'au moment où l'on
       saute sur un champ — un geste qu'on ne va pas faire depuis les Paramètres. */
    const champ = apercu.querySelector('.input');
    if (champ) {
      champ.style.cursor = 'pointer';
      champ.title = 'Clique pour voir l’effet d’arrivée';
      champ.addEventListener('click', function () { viser(champ); });
    }
  }

  monter();

  /* ⚠️ LES RÉGLAGES SERVEUR ARRIVENT APRÈS LE PREMIER RENDU, et il faut y revenir.
     `SSConf.get()` lit un CACHE : sur un appareil qui vient d'être configuré par l'autre, ou
     qui ouvre l'ERP pour la première fois, ce cache est vide ou périmé — on monterait donc le
     repli écrit dans ce fichier au lieu du style de la maison, et il faudrait recharger la page
     pour voir le bon. On remonte donc la feuille quand les réglages arrivent.
     ⚠️ UNIQUEMENT si l'appareil n'a rien choisi : sinon on écraserait son choix une seconde
     après l'avoir affiché, ce qui est exactement le défaut qu'on veut éviter. */
  if (window.SSConf && window.SSConf.charger) {
    window.SSConf.charger().then(function () {
      const suit = suitLaSociete();
      if (suit.effet || suit.couleur) monter();
    }).catch(function () {});
  }

  window.SSSignal = {
    EFFETS: EFFETS,
    COULEURS: COULEURS,
    CLASSE: CLASSE,
    CLASSE_VISE: CLASSE_VISE,
    SUIVRE: SUIVRE,
    effet: effet,
    couleur: couleur,
    effetSociete: effetSociete,
    couleurSociete: couleurSociete,
    previsualiserSociete: previsualiserSociete,
    suitLaSociete: suitLaSociete,
    regler: regler,
    commencee: commencee,
    champsASignaler: champsASignaler,
    appliquer: appliquer,
    viser: viser,
    monter: monter,
    monterSelecteurs: monterSelecteurs,
    rafraichirSelecteurs: rafraichirSelecteurs,
  };
})();
