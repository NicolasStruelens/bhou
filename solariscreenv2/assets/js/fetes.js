/* ═══════════════════════════════════════════════════════════════════════════════════════════
   DÉCORS DE FÊTES (window.SSFetes)

   POURQUOI UN MODULE, ET PAS DU DÉCOR POSÉ PAGE PAR PAGE
   Un décor saisonnier recopié sur vingt pages, c'est vingt endroits à retrouver le 2 novembre —
   donc des toiles d'araignée encore en place à Noël. Ici tout vit à UN endroit : le calendrier
   décide seul, les dessins sont rangés par fête, et il n'y a jamais rien à retirer à la main.

   AJOUTER UNE FÊTE = UNE ENTRÉE DANS `FETES`. Rien d'autre.
   Les quatre emplacements (`coin`, `suspendu`, `marque`, `volants`) sont les mêmes pour toutes :
   on remplace les dessins, pas le code. Chaque dessin s'écrit au choix en SVG en ligne (`svg:`)
   ou en fichier (`img:` — un chemin depuis la racine du site). Le SVG en ligne est préféré parce
   qu'il suit le thème via `currentColor` et ne coûte aucune requête ; le fichier existe pour le
   jour où l'on voudra déposer une image toute faite.

   TROIS RÈGLES QUI NE SE DEVINENT PAS, ET QUI SONT LA RAISON D'ÊTRE DE CE FICHIER

   1. JAMAIS SUR CE QUE LE CLIENT VOIT. L'ERP établit de vrais devis pour de vraies écoles. Une
      araignée sur un devis imprimé, ou sur la page que le client ouvre pour signer, ce n'est pas
      drôle : c'est une facture qu'on ne prend pas au sérieux. Le décor s'arrête donc à la coque
      de l'application — jamais dans `.paper`, jamais sur `devis-review.html`, jamais à
      l'impression.
   2. LE DÉCOR NE DIT RIEN. Sur ces écrans la couleur PORTE DU SENS (le liseré dit l'action, la
      pastille dit le client). Les décors se reconnaissent donc à leur FORME, et vivent en
      opacité basse, pour qu'aucun ne puisse se lire comme un statut. C'est aussi pourquoi
      l'orange de la citrouille, voisin de `--warn`, ne pose pas de problème : personne ne prend
      une citrouille pour une alerte.
   3. ÇA DOIT POUVOIR S'ÉTEINDRE. Un client par-dessus l'épaule, une capture d'écran à envoyer,
      et l'envie de chauves-souris tombe d'un coup. Le réglage est dans Paramètres, et le respect
      de `prefers-reduced-motion` est intégré : les animations disparaissent, les décors fixes
      restent.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CLE = 'ss_fetes';          // 'non' = éteint ; absent = allumé
  const SKY = 'ssfete-ciel';

  /* APERÇU. Regarder une fête hors de sa période, depuis les Paramètres. Ça n'est pas un confort
     de développeur : la console n'existe pas sur iPhone, et c'est sur iPhone que Nicolas teste.
     Sans ça, un décor de décembre ne pouvait être jugé qu'en décembre — donc trop tard.
     Volontairement NON persistant : il disparaît au rechargement. Un aperçu qu'on oublierait
     allumé afficherait Noël en juillet, et on finirait par ne plus croire au calendrier. */
  let FORCE = null;
  let COURANTE = null;            // la fête réellement montée, lue par l'observateur
  let SURVEILLE = false;          // un seul observateur, quoi qu'il arrive

  /* OÙ SE POSE UN DÉCOR DE COIN. Une seule liste, ici, et c'est tout l'intérêt : une classe
     ajoutée ici décore les vingt pages d'un coup, au lieu d'être recopiée vingt fois.
     `.section` et `.ticked` sont les encadrés du design system (ce sont eux qui portent déjà les
     coins « ticked »). `.ec-poster` s'y ajoute parce que les Échanges — l'un des écrans les plus
     ouverts — ne contiennent aucune `.section` et n'auraient eu aucun décor.
     `.kcol` (les colonnes du kanban des demandes) en est volontairement absent : elles sont CINQ
     et identiques, donc en décorer trois a l'air d'un bug, pas d'un décor. */
  const HOTES_COIN = '.section, .ticked, .ec-poster';

  /* CE QUI NE PEUT PAS ÊTRE UN HÔTE, même s'il porte la bonne classe.
     Les tuiles de chiffres s'écrivent `class="kpi ticked"` : sans cette liste elles passaient le
     filtre et recevaient une toile de 58 px sur un carré de 150 — illisible. Et sur le SAV, la
     toile s'est posée sur une MODALE (`class="modal ticked"`), donc invisible au chargement puis
     surgissant sur une fenêtre de saisie. */
  const PAS_HOTE = '.kpi, .mini-kpi, .modal, .modal-bg, .ral-modal, .paper';

  /* IL FAUT DE LA PLACE. Cette règle chiffrée remplace une liste noire qui n'aurait jamais fini
     de grandir : un encadré trop petit pour accueillir une toile de 58 px n'en reçoit pas, quel
     que soit son nom. Elle écarte aussi toute boîte repliée ou masquée, qui mesure 0. */
  const MIN_L = 260, MIN_H = 130;
  const MAX_COINS = 6;             // au-delà ce n'est plus un décor, c'est un envahissement

  /* ── Les dessins ────────────────────────────────────────────────────────────────────────────
     Tous en `currentColor` : la teinte est donnée par l'emplacement, donc un même dessin peut
     servir deux fois dans deux tons. Les yeux et les découpes prennent `var(--surface)` pour
     rester lisibles dans les deux thèmes. */
  const TOILE =
    '<svg viewBox="0 0 104 104" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<path d="M0,0L104,0M0,0L98.9,32.1M0,0L84.1,61.1M0,0L61.1,84.1M0,0L32.1,98.9M0,0L0,104' +
    'M26,0Q19.8,3.1 24.7,8Q17.8,9.1 21,15.3Q14.2,14.2 15.3,21Q9.1,17.8 8,24.7Q3.1,19.8 0,26' +
    'M48,0Q36.5,5.8 45.7,14.8Q32.9,16.8 38.8,28.2Q26.1,26.1 28.2,38.8Q16.8,32.9 14.8,45.7Q5.8,36.5 0,48' +
    'M70,0Q53.3,8.4 66.6,21.6Q48.1,24.5 56.6,41.1Q38.1,38.1 41.1,56.6Q24.5,48.1 21.6,66.6Q8.4,53.3 0,70' +
    'M92,0Q70,11.1 87.5,28.4Q63.2,32.2 74.4,54.1Q50.1,50.1 54.1,74.4Q32.2,63.2 28.4,87.5Q11.1,70 0,92"/></svg>';

  const ARAIGNEE =
    '<svg viewBox="0 0 44 40" fill="currentColor">' +
    '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
    '<path d="M16,14C9.5,9 5.5,7 2.5,10"/><path d="M15,18C8.5,16 3.5,16 1.5,20"/>' +
    '<path d="M15,22C8.5,23 3.5,26 2.5,31"/><path d="M16,26C10,30 7.5,34 7.5,38"/>' +
    '<path d="M28,14C34.5,9 38.5,7 41.5,10"/><path d="M29,18C35.5,16 40.5,16 42.5,20"/>' +
    '<path d="M29,22C35.5,23 40.5,26 41.5,31"/><path d="M28,26C34,30 36.5,34 36.5,38"/></g>' +
    '<ellipse cx="22" cy="26" rx="9" ry="10"/><circle cx="22" cy="15" r="6"/>' +
    '<circle cx="19.6" cy="14" r="1.7" fill="var(--surface)"/><circle cx="24.4" cy="14" r="1.7" fill="var(--surface)"/></svg>';

  // Les ailes portent la classe `ssfete-aile` : c'est le CSS qui les fait battre.
  const CHAUVE_SOURIS =
    '<svg viewBox="0 0 64 26" fill="currentColor">' +
    '<path d="M28.4,7.6 L29.4,2.6 L31.6,6.6 Z"/><path d="M35.6,7.6 L34.6,2.6 L32.4,6.6 Z"/>' +
    '<circle cx="32" cy="10" r="4"/><ellipse cx="32" cy="15.5" rx="3.3" ry="5.6"/>' +
    '<path class="ssfete-aile" d="M35,11C41,6.6 48,5.6 54,7.8C58,9.2 61,12 63,16.2C59,14 56,15 55,18.2C53,15 50,15 48,18.2C46,15 42,15 40,18.2C38,15.2 36,14.2 35,16.2Z"/>' +
    '<path class="ssfete-aile" d="M29,11C23,6.6 16,5.6 10,7.8C6,9.2 3,12 1,16.2C5,14 8,15 9,18.2C11,15 14,15 16,18.2C18,15 22,15 24,18.2C26,15.2 28,14.2 29,16.2Z"/></svg>';

  /* La sorcière vole vers la DROITE : les brins du balai sont donc derrière elle, et la cape
     traîne du même côté. Dessinée dans l'autre sens, elle semblait reculer. */
  const SORCIERE =
    '<svg viewBox="0 0 100 62" fill="currentColor">' +
    '<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M18,46 L94,18"/></g>' +
    '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none">' +
    '<path d="M21,45 L2,53M21,45 L1,45M21,45 L4,58M21,45 L12,60"/></g>' +
    '<path d="M54,24C42,27 30,34 16,48C31,44 44,40 56,33Z"/>' +
    '<path d="M52,32C49,23 54,17 62,17C70,17 75,22 73,29L76,34C67,38 59,37 52,32Z"/>' +
    '<circle cx="64" cy="15" r="5.2"/>' +
    '<path d="M57,11 L72,11 C69,4 64,-1 55,-4 C58,1 58,6 57,11Z"/>' +
    '<ellipse cx="64.5" cy="11.4" rx="11.5" ry="2.5"/></svg>';

  const CITROUILLE =
    '<svg viewBox="0 0 44 40" fill="currentColor">' +
    '<path d="M20,9C20,4.5 17.5,2 14,1C19,0.5 22.5,3 23.5,7.5Z" fill="#6b8f3a"/>' +
    '<path d="M22,8C33,8 40,15 40,24C40,33 32,38.5 22,38.5C12,38.5 4,33 4,24C4,15 11,8 22,8Z"/>' +
    '<g stroke="var(--surface)" stroke-width="1.1" fill="none" opacity=".45">' +
    '<path d="M14,10.5C11,16 11,31 14,36.5"/><path d="M30,10.5C33,16 33,31 30,36.5"/></g>' +
    '<g fill="var(--surface)" class="ssfete-lueur">' +
    '<path d="M12.5,19 L19,22 L12.5,25.5Z"/><path d="M31.5,19 L25,22 L31.5,25.5Z"/>' +
    '<path d="M12,28.5 L16,31.5 L19,28.5 L22,31.5 L25,28.5 L28,31.5 L32,28.5 L30.5,34.5 L13.5,34.5Z"/></g></svg>';


  /* ── Décembre et Nouvel An ───────────────────────────────────────────────────────────────
     Ce qui fait la différence avec une silhouette plate, et qui manquait à la première
     version : TROIS COUCHES par objet (la masse, un détail découpé dans `var(--surface)`,
     un reflet), et une ANIMATION QUI APPARTIENT À L'OBJET — les bulles montent, l'étoile
     scintille, la fumée s'échappe. C'est exactement ce qui rendait Halloween vivant.
     ───────────────────────────────────────────────────────────────────────────────────────── */

  // Trois cristaux différents : une neige d'un seul flocon répété se voit tout de suite.
  const FLOCONS = ['M0,0L10,0M4.4,0l2.09,2.68M4.4,0l2.09,-2.68M7.2,0l1.6,2.05M7.2,0l1.6,-2.05M10,0l2.65,1.41M10,0l2.65,-1.41M0,0L5,8.66M2.2,3.81l-1.27,3.15M2.2,3.81l3.37,0.47M3.6,6.24l-0.97,2.41M3.6,6.24l2.57,0.36M5,8.66l0.1,3M5,8.66l2.54,1.59M0,0L-5,8.66M-2.2,3.81l-3.37,0.47M-2.2,3.81l1.27,3.15M-3.6,6.24l-2.57,0.36M-3.6,6.24l0.97,2.41M-5,8.66l-2.54,1.59M-5,8.66l-0.1,3M0,0L-10,0M-4.4,0l-2.09,-2.68M-4.4,0l-2.09,2.68M-7.2,0l-1.6,-2.05M-7.2,0l-1.6,2.05M-10,0l-2.65,-1.41M-10,0l-2.65,1.41M0,0L-5,-8.66M-2.2,-3.81l1.27,-3.15M-2.2,-3.81l-3.37,-0.47M-3.6,-6.24l0.97,-2.41M-3.6,-6.24l-2.57,-0.36M-5,-8.66l-0.1,-3M-5,-8.66l-2.54,-1.59M0,0L5,-8.66M2.2,-3.81l3.37,-0.47M2.2,-3.81l-1.27,-3.15M3.6,-6.24l2.57,-0.36M3.6,-6.24l-0.97,-2.41M5,-8.66l2.54,-1.59M5,-8.66l0.1,-3M2.6,0L1.3,2.25L-1.3,2.25L-2.6,0L-1.3,-2.25L1.3,-2.25Z', 'M0,0L10,0M5.5,0l1.9,3.29M5.5,0l1.9,-3.29M10,0l2.65,1.41M10,0l2.65,-1.41M0,0L5,8.66M2.75,4.76l-1.9,3.29M2.75,4.76l3.8,0M5,8.66l0.1,3M5,8.66l2.54,1.59M0,0L-5,8.66M-2.75,4.76l-3.8,0M-2.75,4.76l1.9,3.29M-5,8.66l-2.54,1.59M-5,8.66l-0.1,3M0,0L-10,0M-5.5,0l-1.9,-3.29M-5.5,0l-1.9,3.29M-10,0l-2.65,-1.41M-10,0l-2.65,1.41M0,0L-5,-8.66M-2.75,-4.76l1.9,-3.29M-2.75,-4.76l-3.8,0M-5,-8.66l-0.1,-3M-5,-8.66l-2.54,-1.59M0,0L5,-8.66M2.75,-4.76l3.8,0M2.75,-4.76l-1.9,-3.29M5,-8.66l2.54,-1.59M5,-8.66l0.1,-3', 'M0,0L10,0M3.6,0l1.84,1.84M3.6,0l1.84,-1.84M6.2,0l2.26,2.26M6.2,0l2.26,-2.26M8.4,0l1.41,1.41M8.4,0l1.41,-1.41M0,0L5,8.66M1.8,3.12l-0.67,2.51M1.8,3.12l2.51,0.67M3.1,5.37l-0.83,3.09M3.1,5.37l3.09,0.83M4.2,7.27l-0.52,1.93M4.2,7.27l1.93,0.52M0,0L-5,8.66M-1.8,3.12l-2.51,0.67M-1.8,3.12l0.67,2.51M-3.1,5.37l-3.09,0.83M-3.1,5.37l0.83,3.09M-4.2,7.27l-1.93,0.52M-4.2,7.27l0.52,1.93M0,0L-10,0M-3.6,0l-1.84,-1.84M-3.6,0l-1.84,1.84M-6.2,0l-2.26,-2.26M-6.2,0l-2.26,2.26M-8.4,0l-1.41,-1.41M-8.4,0l-1.41,1.41M0,0L-5,-8.66M-1.8,-3.12l0.67,-2.51M-1.8,-3.12l-2.51,-0.67M-3.1,-5.37l0.83,-3.09M-3.1,-5.37l-3.09,-0.83M-4.2,-7.27l0.52,-1.93M-4.2,-7.27l-1.93,-0.52M0,0L5,-8.66M1.8,-3.12l2.51,-0.67M1.8,-3.12l-0.67,-2.51M3.1,-5.37l3.09,-0.83M3.1,-5.37l-0.83,-3.09M4.2,-7.27l1.93,-0.52M4.2,-7.27l-0.52,-1.93M2.6,0L1.3,2.25L-1.3,2.25L-2.6,0L-1.3,-2.25L1.3,-2.25Z'].map(function (d) {
    return '<svg viewBox="-13 -13 26 26" fill="none" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  });

  // Semis d'étoiles : chacune scintille avec son propre décalage, sinon elles clignotent en chœur.
  const ETOILES =
    '<svg viewBox="0 0 100 100" fill="currentColor"><path class="ssfete-scintille" style="animation-delay:0s" d="M16,0.5C18.7,11.3 18.7,11.3 29.5,14C18.7,16.7 18.7,16.7 16,27.5C13.3,16.7 13.3,16.7 2.5,14C13.3,11.3 13.3,11.3 16,0.5Z"/><path class="ssfete-scintille" style="animation-delay:0.45s" d="M52,10.5C53.9,18.1 53.9,18.1 61.5,20C53.9,21.9 53.9,21.9 52,29.5C50.1,21.9 50.1,21.9 42.5,20C50.1,18.1 50.1,18.1 52,10.5Z"/><path class="ssfete-scintille" style="animation-delay:0.9s" d="M22,43C23.8,50.2 23.8,50.2 31,52C23.8,53.8 23.8,53.8 22,61C20.2,53.8 20.2,53.8 13,52C20.2,50.2 20.2,50.2 22,43Z"/><path class="ssfete-scintille" style="animation-delay:1.35s" d="M74,39C75.4,44.6 75.4,44.6 81,46C75.4,47.4 75.4,47.4 74,53C72.6,47.4 72.6,47.4 67,46C72.6,44.6 72.6,44.6 74,39Z"/><path class="ssfete-scintille" style="animation-delay:1.8s" d="M44,63.5C45.3,68.7 45.3,68.7 50.5,70C45.3,71.3 45.3,71.3 44,76.5C42.7,71.3 42.7,71.3 37.5,70C42.7,68.7 42.7,68.7 44,63.5Z"/><path class="ssfete-scintille" style="animation-delay:2.25s" d="M14,78.5C15.1,82.9 15.1,82.9 19.5,84C15.1,85.1 15.1,85.1 14,89.5C12.9,85.1 12.9,85.1 8.5,84C12.9,82.9 12.9,82.9 14,78.5Z"/><path class="ssfete-scintille" style="animation-delay:2.7s" d="M86,75C87,79 87,79 91,80C87,81 87,81 86,85C85,81 85,81 81,80C85,79 85,79 86,75Z"/><path class="ssfete-scintille" style="animation-delay:3.1s" d="M62,62C62.9,65.6 62.9,65.6 66.5,66.5C62.9,67.4 62.9,67.4 62,71C61.1,67.4 61.1,67.4 57.5,66.5C61.1,65.6 61.1,65.6 62,62Z"/><path class="ssfete-scintille" style="animation-delay:3.5s" d="M36,30C36.8,33.2 36.8,33.2 40,34C36.8,34.8 36.8,34.8 36,38C35.2,34.8 35.2,34.8 32,34C35.2,33.2 35.2,33.2 36,30Z"/><circle class="ssfete-scintille" style="animation-delay:1.1s" cx="66" cy="12" r="1.8"/><circle class="ssfete-scintille" style="animation-delay:2s" cx="8" cy="54" r="1.6"/><circle class="ssfete-scintille" style="animation-delay:2.9s" cx="58" cy="88" r="1.7"/></svg>';

  const BRANCHE_SAPIN =
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
    '<path d="M0,0L87.5,28.4M19,6.2l9.2,15.9M19,6.2l16.7,-7.4M29.5,9.6l8.1,14.1M29.5,9.6l14.9,-6.6M39.9,13l7.1,12.3M39.9,13l13,-5.8M50.4,16.4l6.1,10.6M50.4,16.4l11.2,-5M60.9,19.8l5.1,8.8M60.9,19.8l9.3,-4.1M71.3,23.2l4.1,7.1M71.3,23.2l7.4,-3.3M0,0L65.1,65.1M14.1,14.1l1,18.3M14.1,14.1l18.3,1M21.9,21.9l0.9,16.2M21.9,21.9l16.2,0.9M29.7,29.7l0.7,14.2M29.7,29.7l14.2,0.7M37.5,37.5l0.6,12.2M37.5,37.5l12.2,0.6M45.3,45.3l0.5,10.2M45.3,45.3l10.2,0.5M53,53l0.4,8.1M53,53l8.1,0.4M0,0L28.4,87.5M6.2,19l-7.4,16.7M6.2,19l15.9,9.2M9.6,29.5l-6.6,14.9M9.6,29.5l14.1,8.1M13,39.9l-5.8,13M13,39.9l12.3,7.1M16.4,50.4l-5,11.2M16.4,50.4l10.6,6.1M19.8,60.9l-4.1,9.3M19.8,60.9l8.8,5.1M23.2,71.3l-3.3,7.4M23.2,71.3l7.1,4.1"/>' +
    '<g fill="var(--accent-2)" stroke="none" opacity=".85">' +
    '<circle cx="62" cy="21" r="3.4"/><circle cx="47" cy="47" r="3"/><circle cx="21" cy="63" r="3.4"/></g></svg>';

  /* La mitre : deux arcs, un bandeau serti de trois gemmes, la croix, et les FANONS qui
     pendent derrière — ce sont eux qui la rendent immédiatement reconnaissable. */
  const MITRE =
    '<svg viewBox="0 0 46 60" fill="currentColor">' +
    '<g opacity=".55"><path d="M14,44L12,58L15.5,55L19,58L18,44Z"/><path d="M28,44L27,58L30.5,55L34,58L32,44Z"/></g>' +
    '<path d="M23,3C31,13 38,23 38,32L38,46L8,46L8,32C8,23 15,13 23,3Z"/>' +
    '<rect x="8" y="31" width="30" height="7.5" fill="var(--surface)" opacity=".92"/>' +
    '<g fill="var(--accent-2)"><circle cx="15" cy="34.8" r="2"/><circle cx="23" cy="34.8" r="2.5"/><circle cx="31" cy="34.8" r="2"/></g>' +
    '<g stroke="var(--surface)" stroke-width="2.8" stroke-linecap="round"><path d="M23,12L23,26"/><path d="M16.5,18.5L29.5,18.5"/></g>' +
    '<rect x="8" y="43" width="30" height="3" fill="var(--surface)" opacity=".5"/></svg>';

  /* Le spéculoos : un biscuit ESTAMPÉ. Sans le relief en creux, ce n'était qu'un rectangle. */
  const SPECULOOS =
    '<svg viewBox="0 0 36 44" fill="currentColor">' +
    '<path d="M6,5C6,2.8 7.6,1.5 9.8,1.5L26.2,1.5C28.4,1.5 30,2.8 30,5L30,39C30,41.2 28.4,42.5 26.2,42.5L9.8,42.5C7.6,42.5 6,41.2 6,39Z"/>' +
    '<g fill="var(--surface)" opacity=".42">' +
    '<path d="M18,7.5C21,10.5 23,13.5 23,16.5L13,16.5C13,13.5 15,10.5 18,7.5Z"/>' +
    '<circle cx="18" cy="20" r="3.2"/>' +
    '<path d="M12,25.5C12,23 24,23 24,25.5L25,37L11,37Z"/></g>' +
    '<g fill="var(--surface)" opacity=".16"><circle cx="9.5" cy="9" r="1.1"/><circle cx="27" cy="12" r="0.9"/>' +
    '<circle cx="9" cy="33" r="0.9"/><circle cx="27.5" cy="35" r="1.1"/></g></svg>';

  /* Le sabot : la pointe relevée, le veinage du bois, l'ouverture en creux — et la carotte
     avec ses fanes, qui est la moitié de l'image. */
  const SABOT =
    '<svg viewBox="0 0 56 40" fill="currentColor">' +
    '<path d="M30,13L36,2.5L40.5,5.5L34.5,15Z" fill="#e07c00"/>' +
    '<path d="M35,3.5C33,0.5 29.8,1 29.3,3.5C31.4,4 33,4 35,3.5Z" fill="#6b8f3a"/>' +
    '<path d="M37.5,2.5C37.5,-0.6 40.6,-0.6 41.5,1.4C40,2.5 38.5,2.7 37.5,2.5Z" fill="#6b8f3a"/>' +
    '<path d="M9,34C3,29 3,19 11,15C15,13 20,12.5 26,12.5L41,12.5C48,12.5 53,17 53,24C53,30 48,34 42,34Z"/>' +
    '<ellipse cx="22" cy="15.5" rx="11" ry="3.2" fill="var(--surface)" opacity=".45"/>' +
    '<g fill="none" stroke="var(--surface)" stroke-width="1" opacity=".3">' +
    '<path d="M16,23C24,21 38,21 46,24"/><path d="M15,28C24,26 38,26 47,29"/></g>' +
    '<path d="M9,34C4,30 5,22 10.5,19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

  /* Le bateau de Saint-Nicolas. Il arrive d'Espagne par bateau — d'où un décor qui TRAVERSE
     l'écran pour une raison évidente. La fumée s'échappe vraiment (trois bouffées décalées),
     la coque a sa ligne de flottaison et ses hublots, et il y a des caisses sur le pont.
     ⚠️ Le saint sur son âne a été essayé DEUX fois et abandonné : à cette taille, en mouvement,
     l'âne et le cavalier fusionnaient. Il faut QUATRE formes franches, pas une illustration. */
  const BATEAU =
    '<svg viewBox="0 0 120 72" fill="currentColor">' +
    '<g opacity=".55"><circle class="ssfete-fumee" cx="84" cy="14" r="4.5" style="animation-delay:0s"/>' +
    '<circle class="ssfete-fumee" cx="84" cy="14" r="3.4" style="animation-delay:1.5s"/>' +
    '<circle class="ssfete-fumee" cx="84" cy="14" r="2.6" style="animation-delay:3s"/></g>' +
    '<rect x="78" y="16" width="12" height="26" rx="2"/>' +
    '<rect x="75.5" y="12.5" width="17" height="5" rx="2"/>' +
    '<rect x="78" y="21" width="12" height="3.5" fill="var(--surface)" opacity=".5"/>' +
    '<rect x="32" y="22" width="40" height="20" rx="2.5"/><rect x="29" y="18.5" width="46" height="4.5" rx="1.5"/>' +
    '<g fill="var(--surface)" opacity=".55"><rect x="37" y="27" width="8" height="8" rx="1.5"/>' +
    '<rect x="49" y="27" width="8" height="8" rx="1.5"/><rect x="61" y="27" width="7" height="8" rx="1.5"/></g>' +
    '<rect x="13" y="30" width="14" height="12" rx="1.5"/>' +
    '<g stroke="var(--surface)" stroke-width="1.5" opacity=".5"><path d="M20,30L20,42"/><path d="M13,36L27,36"/></g>' +
    '<path d="M6,42L112,42L102,60L18,60Z"/>' +
    '<path d="M10,50L107,50" stroke="var(--surface)" stroke-width="2.4" opacity=".4"/>' +
    '<g fill="var(--surface)" opacity=".5"><circle cx="34" cy="46" r="2.4"/><circle cx="46" cy="46" r="2.4"/>' +
    '<circle cx="58" cy="46" r="2.4"/><circle cx="70" cy="46" r="2.4"/></g>' +
    '<path d="M22,42L22,9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
    '<path d="M22,9L41,14.5L22,20Z"/>' +
    '<g fill="none" stroke="currentColor" stroke-linecap="round">' +
    '<path d="M2,64C14,59 26,69 38,64C50,59 62,69 74,64C86,59 100,69 114,64" stroke-width="2.6" opacity=".45"/>' +
    '<path d="M8,70C20,66 32,74 44,70C56,66 70,74 84,70" stroke-width="2" opacity=".26"/></g></svg>';

  /* Le sapin : quatre étages, des guirlandes, des boules, et l'étoile qui scintille.
     La première version était un triangle en escalier — d'où le retour « pas assez soigné ». */
  const SAPIN =
    '<svg viewBox="0 0 42 58" fill="currentColor">' +
    '<rect x="18" y="47" width="6" height="8" rx="1.5" opacity=".7"/>' +
    '<path d="M21,30L37,49Q21,45.5 5,49Z"/>' +
    '<path d="M21,19L33,35Q21,31.5 9,35Z"/>' +
    '<path d="M21,10L29,23Q21,20 13,23Z"/>' +
    '<g fill="none" stroke="var(--surface)" stroke-linecap="round">' +
    '<path d="M8,44Q21,38.5 34,44" stroke-width="1.4" opacity=".42"/>' +
    '<path d="M11.5,31Q21,26.5 30.5,31" stroke-width="1.2" opacity=".36"/></g>' +
    '<g fill="var(--surface)"><circle cx="13" cy="43.5" r="2" opacity=".6"/><circle cx="27.5" cy="44" r="1.8" opacity=".55"/>' +
    '<circle cx="16.5" cy="31.5" r="1.6" opacity=".5"/><circle cx="25.5" cy="32" r="1.6" opacity=".5"/>' +
    '<circle cx="21" cy="21.5" r="1.4" opacity=".45"/></g>' +
    '<path class="ssfete-scintille" fill="var(--accent-2)" d="M21,0C22.4,5.6 22.4,5.6 28,7C22.4,8.4 22.4,8.4 21,14C19.6,8.4 19.6,8.4 14,7C19.6,5.6 19.6,5.6 21,0Z"/></svg>';

  /* La boule : calotte et anneau, un zigzag peint, une étoile gravée, et un reflet qui
     respire. Avant : un disque avec un point blanc. */
  const BOULE =
    '<svg viewBox="0 0 36 48" fill="currentColor">' +
    '<path d="M15,9L15,5.6A3.2,3.2 0 0 1 21,5.6L21,9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<rect x="12.5" y="7.5" width="11" height="6.5" rx="2"/>' +
    '<rect x="12.5" y="10.2" width="11" height="1.6" fill="var(--surface)" opacity=".45"/>' +
    '<circle cx="18" cy="29" r="15"/>' +
    '<path d="M4.6,26L9,23L13.4,26L17.8,23L22.2,26L26.6,23L31,26" fill="none" stroke="var(--surface)" stroke-width="2" opacity=".5"/>' +
    '<path d="M5.4,34.5C10,37 26,37 30.6,34.5" fill="none" stroke="var(--surface)" stroke-width="1.5" opacity=".32"/>' +
    '<path fill="var(--surface)" opacity=".38" d="M18,25.5C18.9,28.6 18.9,28.6 22,29.5C18.9,30.4 18.9,30.4 18,33.5C17.1,30.4 17.1,30.4 14,29.5C17.1,28.6 17.1,28.6 18,25.5Z"/>' +
    '<ellipse class="ssfete-eclat" cx="11.5" cy="22.5" rx="3.4" ry="4.6" transform="rotate(-25 11.5 22.5)" fill="var(--surface)"/></svg>';

  /* Le cadeau : couvercle débordant, deux rubans, et un VRAI nœud — deux boucles, un centre,
     deux pans. C'est le nœud qui fait la différence avec une boîte quelconque. */
  const CADEAU =
    '<svg viewBox="0 0 44 44" fill="currentColor">' +
    '<rect x="4" y="17" width="36" height="24" rx="2"/>' +
    '<rect x="1" y="11.5" width="42" height="7" rx="2"/>' +
    '<rect x="18.5" y="11.5" width="7" height="29.5" fill="var(--surface)" opacity=".5"/>' +
    '<rect x="4" y="26" width="36" height="4" fill="var(--surface)" opacity=".3"/>' +
    '<path d="M22,11.5C16,11.5 11,8 12,4.4C13,1.4 18,3 22,11.5Z"/>' +
    '<path d="M22,11.5C28,11.5 33,8 32,4.4C31,1.4 26,3 22,11.5Z"/>' +
    '<path d="M19.6,12.6L15,19.4L19.2,18Z" opacity=".65"/><path d="M24.4,12.6L29,19.4L24.8,18Z" opacity=".65"/>' +
    '<circle cx="22" cy="10.4" r="2.7"/>' +
    '<ellipse cx="18" cy="6.5" rx="1.5" ry="2.2" fill="var(--surface)" opacity=".3" transform="rotate(-25 18 6.5)"/></svg>';

  /* Le traîneau : patins à double courbe, volute au dossier, liseré, cadeaux rubannés, et une
     traînée d'étincelles qui scintillent. */
  /* Le traineau. PREMIERE VERSION REFAITE : juge sur planche, il sortait en tache rouge — trop
     de detail pour sa taille rendue (88 px), et une caisse qui n'occupait que la moitie du
     cadre. Ici le cadre est resserre, les patins sont epais et leur double courbe est nette,
     le dossier a sa volute, et les cadeaux sont poses bien en vue. Meme lecon que le saint sur
     son ane : a cette taille, des formes franches, pas une illustration. */
  const TRAINEAU =
    '<svg viewBox="0 0 104 58" fill="currentColor">' +
    '<g opacity=".5"><circle class="ssfete-scintille" cx="4" cy="26" r="2.6" style="animation-delay:0s"/>' +
    '<circle class="ssfete-scintille" cx="11" cy="40" r="1.9" style="animation-delay:0.6s"/></g>' +
    '<rect x="36" y="6" width="22" height="17" rx="2.5"/>' +
    '<g stroke="var(--surface)" stroke-width="2.2" opacity=".5"><path d="M47,6L47,23"/><path d="M36,14.5L58,14.5"/></g>' +
    '<rect x="62" y="12" width="16" height="11" rx="2.5"/>' +
    '<path d="M70,12L70,23" stroke="var(--surface)" stroke-width="2" opacity=".45"/>' +
    '<path d="M20,40C18,28 24,23 36,23L80,23C89,23 92,29 88,39L86,43L24,43Z"/>' +
    '<path d="M80,23C90,17 95,22 92,31" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>' +
    '<path d="M25,34L86,34" stroke="var(--surface)" stroke-width="2.6" opacity=".38"/>' +
    '<g fill="none" stroke="currentColor" stroke-linecap="round">' +
    '<path d="M16,52C10,44 14,35 24,32" stroke-width="4.2"/>' +
    '<path d="M16,52L92,52" stroke-width="4.2"/>' +
    '<path d="M92,52C99,48 99,41 92,39" stroke-width="4.2"/>' +
    '<path d="M36,43.5L36,52M74,43.5L74,52" stroke-width="3"/></g></svg>';

  const ETOILE_FILANTE =
    '<svg viewBox="0 0 66 28" fill="currentColor">' +
    '<g fill="none" stroke="currentColor" stroke-linecap="round">' +
    '<path d="M1,21C12,15 23,11 34,11" stroke-width="2.4" opacity=".4"/>' +
    '<path d="M7,26C16,22 25,19 33,18" stroke-width="1.6" opacity=".22"/></g>' +
    '<path class="ssfete-scintille" d="M48,1C50.8,11.2 50.8,11.2 61,14C50.8,16.8 50.8,16.8 48,27C45.2,16.8 45.2,16.8 35,14C45.2,11.2 45.2,11.2 48,1Z"/></svg>';

  /* Le feu d'artifice : un cœur lumineux, onze rayons de longueurs inégales, deux couronnes
     d'étincelles — et l'ensemble qui s'épanouit. */
  const FEU =
    '<svg viewBox="0 0 100 100" fill="currentColor">' +
    '<g class="ssfete-eclore">' +
    '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M13,0L82,0M12.84,2.03L53.34,8.45M12.36,4.02L70.38,22.87M11.58,5.9L55.24,28.15M10.52,7.64L59.87,43.5M9.19,9.19L38.18,38.18M7.64,10.52L48.2,66.34M5.9,11.58L24.52,48.11M4.02,12.36L22.87,70.38M2.03,12.84L9.7,61.24M0,13L0,74"/></g>' +
    '<circle cx="85.5" cy="0" r="3.4"/><circle cx="56.79" cy="8.99" r="2.1"/><circle cx="31.61" cy="5.01" r="1.6" opacity=".7"/><circle cx="73.71" cy="23.95" r="3.4"/><circle cx="58.36" cy="29.74" r="2.1"/><circle cx="28.51" cy="14.53" r="1.6" opacity=".7"/><circle cx="62.7" cy="45.55" r="3.4"/><circle cx="40.66" cy="40.66" r="2.1"/><circle cx="22.63" cy="22.63" r="1.6" opacity=".7"/><circle cx="50.26" cy="69.17" r="3.4"/><circle cx="26.1" cy="51.23" r="2.1"/><circle cx="14.53" cy="28.51" r="1.6" opacity=".7"/><circle cx="23.95" cy="73.71" r="3.4"/><circle cx="10.25" cy="64.69" r="2.1"/><circle cx="5.01" cy="31.61" r="1.6" opacity=".7"/><circle cx="0" cy="77.5" r="3.4"/>' +
    '<circle cx="0" cy="0" r="9" opacity=".9"/><circle cx="0" cy="0" r="14" opacity=".3"/></g></svg>';

  /* La flûte : le niveau du vin, des bulles qui MONTENT vraiment, le reflet sur la paroi,
     le pied. Avant : un triangle sur un bâton. */
  const FLUTE =
    '<svg viewBox="0 0 32 56" fill="currentColor">' +
    '<path d="M8,3L24,3L22,22C21.6,26.6 19,29.2 16,29.2C13,29.2 10.4,26.6 10,22Z"/>' +
    '<path d="M9.3,10.5L22.7,10.5L22,22C21.6,26.6 19,29.2 16,29.2C13,29.2 10.4,26.6 10,22Z" fill="var(--surface)" opacity=".26"/>' +
    '<g fill="var(--surface)" opacity=".8">' +
    '<circle class="ssfete-bulle" cx="13" cy="26" r="1.5" style="animation-delay:0s"/>' +
    '<circle class="ssfete-bulle" cx="17.5" cy="27" r="1.1" style="animation-delay:0.7s"/>' +
    '<circle class="ssfete-bulle" cx="15" cy="28" r="0.9" style="animation-delay:1.4s"/>' +
    '<circle class="ssfete-bulle" cx="19" cy="25.5" r="1.2" style="animation-delay:2.1s"/></g>' +
    '<path d="M11.2,6.5L11.2,20" stroke="var(--surface)" stroke-width="1.6" opacity=".4" stroke-linecap="round" fill="none"/>' +
    '<rect x="15" y="29" width="2" height="18"/>' +
    '<path d="M8,51C8,48.2 10.2,47 16,47C21.8,47 24,48.2 24,51Z"/>' +
    '<g opacity=".45"><circle class="ssfete-bulle" cx="27" cy="8" r="1.8" style="animation-delay:0.4s"/>' +
    '<circle class="ssfete-bulle" cx="29.5" cy="4" r="1.2" style="animation-delay:1.8s"/></g></svg>';

  /* L'horloge : cloches, marteau, pieds, un cadran avec ses DOUZE index (les cardinaux plus
     longs), et les aiguilles à minuit pile. */
  const HORLOGE =
    '<svg viewBox="0 0 46 52" fill="currentColor">' +
    '<path d="M9.5,11C4,9 3,2.5 7.5,1.2C10.8,0.3 12.5,3.5 12.5,7.5Z"/>' +
    '<path d="M36.5,11C42,9 43,2.5 38.5,1.2C35.2,0.3 33.5,3.5 33.5,7.5Z"/>' +
    '<path d="M23,8.5L23,4.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<g stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none">' +
    '<path d="M12,42L8,50"/><path d="M34,42L38,50"/></g>' +
    '<circle cx="23" cy="26" r="17.5"/>' +
    '<circle cx="23" cy="26" r="13.8" fill="var(--surface)" opacity=".92"/>' +
    '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".65"><path d="M23,14.1L23,17.5M28.95,15.69L27.95,17.43M33.31,20.05L31.57,21.05M34.9,26L31.5,26M33.31,31.95L31.57,30.95M28.95,36.31L27.95,34.57M23,37.9L23,34.5M17.05,36.31L18.05,34.57M12.69,31.95L14.43,30.95M11.1,26L14.5,26M12.69,20.05L14.43,21.05M17.05,15.69L18.05,17.43"/></g>' +
    '<g stroke="currentColor" stroke-linecap="round"><path d="M23,26L23,16.5" stroke-width="2.6"/>' +
    '<path d="M23,26L23,19.5" stroke-width="3.2"/></g>' +
    '<circle cx="23" cy="26" r="1.9"/>' +
    '<path d="M14,18C16.5,15 19.5,13.5 23,13.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".28" stroke-linecap="round"/></svg>';

  /* Trois confettis différents : un ruban, un disque, une serpentine. Un seul dessin répété
     seize fois se voit immédiatement. */
  /* Quatre confettis. La premiere version — un rectangle plat, un disque plat, un gribouillis —
     etait la plus pauvre de tout le lot : jugee sur planche, elle ne tenait pas a cote de la
     boule ou de la flute. Chacun a maintenant son PLI ou son reflet, ce qui lui donne du volume
     quand il tourne en tombant (la chute applique deja une rotation). */
  const CONFETTIS = [
    // ruban plie
    '<svg viewBox="0 0 14 20" fill="currentColor"><path d="M1,1L13,3L12,19L2,17Z"/>' +
      '<path d="M7,2L13,3L12,19L7,18Z" fill="var(--surface)" opacity=".26"/></svg>',
    // pastille, avec son croissant de lumiere
    '<svg viewBox="0 0 14 14" fill="currentColor"><circle cx="7" cy="7" r="6.5"/>' +
      '<path d="M7,0.5A6.5,6.5 0 0 1 7,13.5A4.4,6.5 0 0 0 7,0.5Z" fill="var(--surface)" opacity=".24"/></svg>',
    // serpentin
    '<svg viewBox="0 0 20 26" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round">' +
      '<path d="M4,2C14,5 5,11 15,14C19,15.2 19,19 15,21C12,22.5 8,23 5,24"/></svg>',
    // eclat triangulaire
    '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7,0.5L13.5,12.5L0.5,12.5Z"/>' +
      '<path d="M7,0.5L13.5,12.5L7,12.5Z" fill="var(--surface)" opacity=".22"/></svg>',
  ];

  /* ── Rentrée scolaire ────────────────────────────────────────────────────────────────────
     Le rendez-vous le plus UTILE de l'année pour cet ERP : les clients sont des écoles, et
     c'est fin août que tout se décide. ───────────────────────────────────────────────────── */

  /* Trois crayons en éventail depuis l'angle — même géométrie calculée que la toile et la
     branche. Chacun a son corps, sa pointe taillée, sa mine, sa bague et sa gomme. */
  const CRAYONS =
    '<svg viewBox="0 0 100 100" fill="currentColor">' +
    '<g><path d="M12.5,7.75L86.24,26.14L88.42,17.41L14.67,-0.98Z"/>' +
    '<path d="M86.24,26.14L85,22.82L85.77,19.76L88.42,17.41Z" fill="var(--surface)" opacity=".55"/>' +
    '<path d="M85,22.82L90.24,22.5L85.77,19.76Z" opacity=".85"/>' +
    '<path d="M3.76,5.58L12.5,7.75L14.67,-0.98L5.94,-3.16Z" fill="#e08a84"/>' +
    '<path d="M38.31,14.19L40.48,5.46" stroke="var(--accent-2)" stroke-width="3.2" fill="none" opacity=".85"/></g>' +
    '<g><path d="M7.07,12.73L56.57,62.23L62.23,56.57L12.73,7.07Z"/>' +
    '<path d="M56.57,62.23L56.99,58.97L58.97,56.99L62.23,56.57Z" fill="var(--surface)" opacity=".55"/>' +
    '<path d="M56.99,58.97L61.52,61.52L58.97,56.99Z" opacity=".85"/>' +
    '<path d="M0.71,6.36L7.07,12.73L12.73,7.07L6.36,0.71Z" fill="#e08a84"/>' +
    '<path d="M24.4,30.05L30.05,24.4" stroke="var(--accent-2)" stroke-width="3.2" fill="none" opacity=".85"/></g>' +
    '<g><path d="M-0.98,14.67L17.41,88.42L26.14,86.24L7.75,12.5Z"/>' +
    '<path d="M17.41,88.42L19.76,85.77L22.82,85L26.14,86.24Z" fill="var(--surface)" opacity=".55"/>' +
    '<path d="M19.76,85.77L22.5,90.24L22.82,85Z" opacity=".85"/>' +
    '<path d="M-3.16,5.94L-0.98,14.67L7.75,12.5L5.58,3.76Z" fill="#e08a84"/>' +
    '<path d="M5.46,40.48L14.19,38.31" stroke="var(--accent-2)" stroke-width="3.2" fill="none" opacity=".85"/></g></svg>';

  // Un crayon seul, pour la marque du bandeau : gomme, bague, corps, pointe taillée, mine.
  const CRAYON =
    '<svg viewBox="0 0 16 58" fill="currentColor">' +
    '<rect x="3.5" y="2" width="9" height="8.5" rx="2.5" fill="#e08a84"/>' +
    '<rect x="3" y="9.5" width="10" height="4.5" fill="var(--accent-2)"/>' +
    '<rect x="3" y="13.5" width="10" height="31"/>' +
    '<path d="M5.5,15L5.5,44" stroke="var(--surface)" stroke-width="1.4" opacity=".28"/>' +
    '<path d="M3,44.5L8,55L13,44.5Z" fill="var(--surface)" opacity=".6"/>' +
    '<path d="M6,51L8,55L10,51Z"/></svg>';

  /* Le cartable : rabat, boucle, poignée, soufflets. C'est la boucle en accent qui le rend
     lisible d'un coup d'œil. */
  const CARTABLE =
    '<svg viewBox="0 0 40 44" fill="currentColor">' +
    '<path d="M13,10L13,5.5C13,3.2 15.5,2 20,2C24.5,2 27,3.2 27,5.5L27,10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M6,15C6,12 8,10.5 11,10.5L29,10.5C32,10.5 34,12 34,15L34,35C34,38 32,39.5 29,39.5L11,39.5C8,39.5 6,38 6,35Z"/>' +
    '<g fill="var(--surface)" opacity=".3"><rect x="9.5" y="30" width="7" height="2.2" rx="1.1"/><rect x="23.5" y="30" width="7" height="2.2" rx="1.1"/></g>' +
    '<path d="M4,14C4,11 6,9.5 9,9.5L31,9.5C34,9.5 36,11 36,14L36,23C36,25 34,26 31,26L9,26C6,26 4,25 4,23Z"/>' +
    '<rect x="16" y="23" width="8" height="7.5" rx="1.8" fill="var(--accent-2)"/>' +
    '<rect x="17.8" y="25.5" width="4.4" height="2.4" rx="1" fill="var(--surface)" opacity=".55"/></svg>';

  // Une pile de livres, tranches visibles et signet qui dépasse.
  const LIVRES =
    '<svg viewBox="0 0 46 42" fill="currentColor">' +
    '<rect x="4" y="29" width="38" height="9" rx="1.8"/>' +
    '<rect x="4" y="29" width="5" height="9" fill="var(--surface)" opacity=".38"/>' +
    '<rect x="7" y="19.5" width="33" height="8.5" rx="1.8"/>' +
    '<rect x="7" y="19.5" width="4.5" height="8.5" fill="var(--surface)" opacity=".38"/>' +
    '<rect x="5.5" y="10" width="30" height="8.5" rx="1.8"/>' +
    '<rect x="5.5" y="10" width="4.5" height="8.5" fill="var(--surface)" opacity=".38"/>' +
    '<path d="M28,18.5L28,26L30.5,23.5L33,26L33,18.5Z" fill="var(--accent-2)" opacity=".9"/>' +
    '<g fill="var(--surface)" opacity=".22"><rect x="14" y="13" width="14" height="1.8" rx="0.9"/>' +
    '<rect x="16" y="22.5" width="16" height="1.8" rx="0.9"/></g></svg>';

  /* L'avion en papier : deux ailes de tons différents (sans quoi c'est un triangle), le pli,
     et une traînée pointillée. Il traverse l'écran pour une raison évidente. */
  const AVION =
    '<svg viewBox="0 0 72 42" fill="currentColor">' +
    '<path d="M1,33C10,29.5 18,26 26,23.5" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-dasharray="4 4.5" stroke-linecap="round" opacity=".35"/>' +
    '<path d="M68,5L8,24L31,29Z"/>' +
    '<path d="M68,5L31,29L37,39Z" opacity=".55"/>' +
    '<path d="M68,5L31,29" fill="none" stroke="var(--surface)" stroke-width="1.3" opacity=".45"/></svg>';

  /* Trois feuilles différentes : fin août, l'été bascule. Même mécanisme que la neige et les
     confettis — seul le dessin change. */
  const FEUILLES = [
    '<svg viewBox="0 0 22 26" fill="currentColor"><path d="M11,1C17.5,6.5 18.5,16 11,23C3.5,16 4.5,6.5 11,1Z"/>' +
      '<path d="M11,3.5L11,24" stroke="var(--surface)" stroke-width="1.2" opacity=".45" fill="none"/>' +
      '<g stroke="var(--surface)" stroke-width="0.9" opacity=".3" fill="none">' +
      '<path d="M11,9L6.5,7M11,9L15.5,7M11,15L6,13.5M11,15L16,13.5"/></g></svg>',
    '<svg viewBox="0 0 24 26" fill="currentColor">' +
      '<path d="M12,1L15.5,8L21,6.5L17.5,12L22,16.5L15.5,16.5L14,25L12,19.5L10,25L8.5,16.5L2,16.5L6.5,12L3,6.5L8.5,8Z"/>' +
      '<path d="M12,12L12,25" stroke="var(--surface)" stroke-width="1.1" opacity=".4" fill="none"/></svg>',
    '<svg viewBox="0 0 18 28" fill="currentColor"><path d="M9,1C13,8.5 13,18 9,25C5,18 5,8.5 9,1Z"/>' +
      '<path d="M9,3L9,27" stroke="var(--surface)" stroke-width="1.1" opacity=".45" fill="none"/></svg>',
  ];

  /* ── Le calendrier ──────────────────────────────────────────────────────────────────────────
     Les bornes s'écrivent en MM-JJ : elles reviennent toutes seules chaque année, il n'y a aucun
     millésime à tenir à jour. `au` est INCLUS. Une période qui enjambe le 31 décembre (Nouvel An)
     s'écrit du:'12-26', au:'01-02' — la comparaison le gère. */
  const FETES = [
    {
      id: 'halloween',
      nom: 'Halloween',
      du: '10-01', au: '11-02',
      /* Le coin des encadrés. C'est le décor le plus présent, donc le plus discret — et `bete`
         est ce qui y pend. Une araignée ancrée au BANDEAU a été essayée et retirée : à 16 % elle
         tombait sur « Compact », à 34 % sur un filtre des demandes de RDV. Aucune valeur ne
         convient sur 21 pages, puisque c'est la page qui décide de ce qu'il y a sous le bandeau.
         Dans la toile, elle est chez elle et l'espace est déjà celui du décor. */
      coin: {
        svg: TOILE, taille: 58,
        teinte: { sombre: '#9fb0d8', clair: '#5b6a96' }, opacite: { sombre: 0.35, clair: 0.38 },
        bete: {
          svg: ARAIGNEE, taille: 20, fil: 14,
          teinte: { sombre: '#c3cde8', clair: '#44507a' }, opacite: { sombre: 0.8, clair: 0.75 },
        },
      },
      // Petite marque fixe à côté du logo.
      marque: { svg: CITROUILLE, taille: 20,
        teinte: { sombre: '#ff9f1c', clair: '#e07c00' }, opacite: { sombre: 1, clair: 1 } },
      /* Le rail de navigation est un décor à part : c'est une colonne, pas un encadré. La toile
         s'y pose au coin haut-droit DERRIÈRE les entrées (z-index 0), et la citrouille se cale
         en pied de colonne — `margin-top: auto` dans un conteneur en colonne. Replié en icônes,
         les deux tiennent encore dans 60 px. */
      rail: {
        coin: { svg: TOILE, taille: 54,
          teinte: { sombre: '#9fb0d8', clair: '#5b6a96' }, opacite: { sombre: 0.3, clair: 0.3 } },
        pied: { svg: CITROUILLE, taille: 26,
          teinte: { sombre: '#ff9f1c', clair: '#e07c00' }, opacite: { sombre: 0.85, clair: 0.9 } },
      },
      // Traversent l'écran. `rare: true` = masqué sur petit écran (voir le CSS).
      volants: [
        { svg: CHAUVE_SOURIS, taille: 46, haut: '16%', duree: 24, retard: 3, ailes: true,
          teinte: { sombre: '#b9a6e8', clair: '#7a63c4' }, opacite: { sombre: 0.42, clair: 0.3 } },
        { svg: CHAUVE_SOURIS, taille: 30, haut: '74%', duree: 31, retard: 19, ailes: true,
          teinte: { sombre: '#a692dd', clair: '#6d55bb' }, opacite: { sombre: 0.3, clair: 0.22 } },
        { svg: SORCIERE, taille: 92, haut: '38%', duree: 38, retard: 16, rare: true,
          teinte: { sombre: '#cdbaf0', clair: '#8a74cf' }, opacite: { sombre: 0.34, clair: 0.26 } },
      ],
    },

    /* RENTRÉE SCOLAIRE — du 25 août au 7 septembre. C'est le rendez-vous le plus UTILE de
       l'année pour cet ERP : les clients sont des écoles, et tout se décide fin août. */
    {
      id: 'rentree',
      nom: 'Rentrée',
      du: '08-25', au: '09-07',
      coin: {
        svg: CRAYONS, taille: 58,
        teinte: { sombre: '#f0c05a', clair: '#9a6f10' }, opacite: { sombre: 0.42, clair: 0.42 },
        bete: {
          svg: CARTABLE, taille: 21, fil: 12,
          teinte: { sombre: '#c89168', clair: '#7a4e24' }, opacite: { sombre: 0.9, clair: 0.85 },
        },
      },
      marque: { svg: CRAYON, taille: 13,
        teinte: { sombre: '#f0c05a', clair: '#9a6f10' }, opacite: { sombre: 1, clair: 1 } },
      rail: {
        coin: { svg: CRAYONS, taille: 54,
          teinte: { sombre: '#f0c05a', clair: '#9a6f10' }, opacite: { sombre: 0.28, clair: 0.28 } },
        pied: { svg: LIVRES, taille: 32,
          teinte: { sombre: '#78a9d6', clair: '#2f5f8f' }, opacite: { sombre: 0.9, clair: 0.9 } },
      },
      volants: [
        { svg: AVION, taille: 52, haut: '17%', duree: 23, retard: 4,
          teinte: { sombre: '#dfe6f5', clair: '#5c6b86' }, opacite: { sombre: 0.45, clair: 0.32 } },
      ],
      // Fin août, l'été bascule : des feuilles plutôt que de la neige.
      tombe: {
        svg: FEUILLES, taille: 17, nombre: 10, duree: 17,
        palette: ['#d98841', '#c9622f', '#e0a63c', '#a8562a', '#c98a4b'],
        teinte: { sombre: '#d98841', clair: '#a8562a' }, opacite: { sombre: 0.6, clair: 0.5 },
      },
    },

    /* SAINT-NICOLAS — six jours seulement, et c'est voulu : la fête EST courte, un décor qui
       traînerait deux semaines lui ferait perdre son caractère d'événement. */
    {
      id: 'saint-nicolas',
      nom: 'Saint-Nicolas',
      du: '12-01', au: '12-06',
      // Un semis d'étoiles dans l'angle : c'est la nuit où il passe sur les toits.
      coin: {
        svg: ETOILES, taille: 56,
        teinte: { sombre: '#f0d27a', clair: '#a87f12' }, opacite: { sombre: 0.42, clair: 0.42 },
        bete: {
          svg: SPECULOOS, taille: 19, fil: 13,
          teinte: { sombre: '#d09660', clair: '#8a5a2b' }, opacite: { sombre: 0.9, clair: 0.85 },
        },
      },
      marque: { svg: MITRE, taille: 17,
        teinte: { sombre: '#e4554f', clair: '#c0392b' }, opacite: { sombre: 1, clair: 1 } },
      rail: {
        coin: { svg: ETOILES, taille: 52,
          teinte: { sombre: '#f0d27a', clair: '#a87f12' }, opacite: { sombre: 0.3, clair: 0.3 } },
        pied: { svg: SABOT, taille: 30,
          teinte: { sombre: '#d09660', clair: '#8a5a2b' }, opacite: { sombre: 0.9, clair: 0.9 } },
      },
      volants: [
        { svg: ETOILE_FILANTE, taille: 40, haut: '15%', duree: 22, retard: 4,
          teinte: { sombre: '#ffe9a8', clair: '#9a7b1f' }, opacite: { sombre: 0.5, clair: 0.36 } },
        { svg: BATEAU, taille: 86, haut: '58%', duree: 34, retard: 15, rare: true,
          teinte: { sombre: '#e4554f', clair: '#b03a33' }, opacite: { sombre: 0.45, clair: 0.32 } },
      ],
      tombe: { svg: FLOCONS, taille: 15, nombre: 9, duree: 16,
        teinte: { sombre: '#cfe3ff', clair: '#7f9ec9' }, opacite: { sombre: 0.5, clair: 0.38 } },
    },

    /* NOËL — du 10 au 26. Il démarre après la Saint-Nicolas (pas de chevauchement : `active`
       retient la PREMIÈRE période qui correspond, et deux fêtes qui se recouvrent se
       voleraient la vedette) et s'arrête au lendemain de Noël. */
    {
      id: 'noel',
      nom: 'Noël',
      du: '12-10', au: '12-26',
      coin: {
        svg: BRANCHE_SAPIN, taille: 62,
        teinte: { sombre: '#4e8f5e', clair: '#2f6b3f' }, opacite: { sombre: 0.45, clair: 0.45 },
        // La boule remplace l'araignée : même fil, même balancement — le mécanisme était déjà là.
        bete: {
          svg: BOULE, taille: 20, fil: 11,
          teinte: { sombre: '#e4554f', clair: '#b5342e' }, opacite: { sombre: 0.95, clair: 0.9 },
        },
      },
      marque: { svg: SAPIN, taille: 17,
        teinte: { sombre: '#4e8f5e', clair: '#2f6b3f' }, opacite: { sombre: 1, clair: 1 } },
      rail: {
        coin: { svg: BRANCHE_SAPIN, taille: 56,
          teinte: { sombre: '#4e8f5e', clair: '#2f6b3f' }, opacite: { sombre: 0.32, clair: 0.32 } },
        pied: { svg: CADEAU, taille: 30,
          teinte: { sombre: '#e4554f', clair: '#b5342e' }, opacite: { sombre: 0.9, clair: 0.9 } },
      },
      volants: [
        { svg: ETOILE_FILANTE, taille: 42, haut: '13%', duree: 20, retard: 3,
          teinte: { sombre: '#ffe9a8', clair: '#9a7b1f' }, opacite: { sombre: 0.5, clair: 0.36 } },
        { svg: TRAINEAU, taille: 88, haut: '60%', duree: 34, retard: 17, rare: true,
          teinte: { sombre: '#e4554f', clair: '#b03a33' }, opacite: { sombre: 0.4, clair: 0.3 } },
      ],
      tombe: { svg: FLOCONS, taille: 16, nombre: 14, duree: 14,
        teinte: { sombre: '#dce9ff', clair: '#8ba6cc' }, opacite: { sombre: 0.55, clair: 0.4 } },
    },

    /* NOUVEL AN — du 27 décembre au 2 janvier. C'est la SEULE période qui enjambe le 1er janvier,
       donc la seule qui exerce vraiment la bascule de `dansLaPeriode` ; elle était testée depuis
       le premier jour sans qu'aucune fête ne s'en serve. */
    {
      id: 'nouvel-an',
      nom: 'Nouvel An',
      du: '12-27', au: '01-02',
      coin: {
        svg: FEU, taille: 60,
        teinte: { sombre: '#ffd45e', clair: '#b07a00' }, opacite: { sombre: 0.42, clair: 0.4 },
      },
      marque: { svg: FLUTE, taille: 15,
        teinte: { sombre: '#ffd45e', clair: '#9a6f00' }, opacite: { sombre: 1, clair: 1 } },
      rail: {
        coin: { svg: FEU, taille: 54,
          teinte: { sombre: '#ffd45e', clair: '#b07a00' }, opacite: { sombre: 0.3, clair: 0.3 } },
        pied: { svg: HORLOGE, taille: 30,
          teinte: { sombre: '#cfe3ff', clair: '#49618c' }, opacite: { sombre: 0.85, clair: 0.9 } },
      },
      /* UN SEUL volant, et c'est un choix. Une fusee a ete dessinee puis retiree : agrandie, elle
         ne se lisait pas (une tache orange allongee), et elle faisait doublon avec l'etoile
         filante — deux trainees lumineuses qui traversent, ca n'ajoute rien. Les feux d'artifice
         des coins et les seize confettis portent deja la fete. */
      volants: [
        { svg: ETOILE_FILANTE, taille: 40, haut: '14%', duree: 21, retard: 3,
          teinte: { sombre: '#ffe9a8', clair: '#9a7b1f' }, opacite: { sombre: 0.5, clair: 0.36 } },
      ],
      /* Les confettis réutilisent le mécanisme de la neige — c'est exactement pour ça que
         l'emplacement s'appelle « tombe » et non « neige ». Seule la PALETTE est nouvelle :
         des confettis d'une seule couleur ne sont plus des confettis. */
      tombe: {
        svg: CONFETTIS, taille: 13, nombre: 16, duree: 11,
        palette: ['#ffd45e', '#ff6b8a', '#5ad1ff', '#8fe36b', '#c08cff', '#ff9e5e'],
        teinte: { sombre: '#ffd45e', clair: '#b07a00' }, opacite: { sombre: 0.75, clair: 0.6 },
      },
    },
  ];

  /* ── Quelle fête aujourd'hui ? ──────────────────────────────────────────────────────────────
     La date se lit en heure LOCALE. `new Date().toISOString()` renverrait une date UTC, donc LA
     VEILLE entre minuit et 2 h du matin en heure d'été belge : le 1er novembre à 00 h 30, les
     toiles seraient encore là. */
  function moisJour(d) {
    const x = d || new Date();
    return String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function dansLaPeriode(mj, du, au) {
    return du <= au ? (mj >= du && mj <= au)      // période normale
                    : (mj >= du || mj <= au);     // période qui enjambe le 1er janvier
  }
  function active(d) {
    // Une date EXPLICITE l'emporte toujours sur l'aperçu : sinon les tests, qui passent leurs
    // propres dates, se mettraient à mentir dès qu'un aperçu serait actif.
    if (!d && FORCE) {
      const forcee = FETES.find(function (f) { return f.id === FORCE; });
      if (forcee) return forcee;
    }
    const mj = moisJour(d);
    return FETES.find(function (f) { return dansLaPeriode(mj, f.du, f.au); }) || null;
  }

  function estAllumee() {
    try { return localStorage.getItem(CLE) !== 'non'; } catch (e) { return true; }
  }
  /* ⚠️ La FEUILLE DE STYLE fait partie de ce qu'il faut retirer. Elle porte les variables de
     teinte de la fête courante et `style()` sort immédiatement si elle existe déjà : la garder
     ferait afficher les dessins de Noël avec les teintes d'Halloween, sans la moindre erreur. */
  function nettoyer() {
    ['ssfete-style', SKY].forEach(function (id) {
      const n = document.getElementById(id);
      if (n) n.remove();
    });
    document.querySelectorAll('.ssfete').forEach(function (n) { n.remove(); });
  }

  function allumer(oui) {
    try { localStorage.setItem(CLE, oui ? 'oui' : 'non'); } catch (e) {}
    nettoyer();
    if (oui) monter();
  }

  // `id` vide = on revient au calendrier.
  function apercu(id) {
    FORCE = id || null;
    nettoyer();
    monter(true);   // on passe outre le réglage : c'est une demande explicite de regarder
  }

  /* ── TEINTES PAR THÈME ──────────────────────────────────────────────────────────────────────
     Les décors étaient coloriés EN LIGNE, donc identiques dans les deux thèmes — or ils ont été
     calibrés en sombre, et en CLAIR (le thème réellement utilisé en production) une toile gris
     bleuté à 35 % sur du blanc ne se voyait presque plus. Chaque teinte s'écrit donc
     { sombre, clair }, et le module en fait des variables CSS : c'est la feuille de style qui
     colorie, donc le décor suit le bouton lune/soleil sans une seule ligne de JS.
     Une valeur simple reste acceptée, et sert alors dans les deux thèmes. */
  function ton(v, quoi) {
    if (v === null || v === undefined) return null;
    return (typeof v === 'object') ? v[quoi] : v;
  }

  /* Tous les décors d'une fête, NOMMÉS. Ce nom devient celui de la variable CSS et celui de la
     règle qui l'utilise : ajouter un emplacement, c'est l'ajouter ici et nulle part ailleurs. */
  function emplacements(f) {
    const l = [];
    if (f.coin) { l.push(['coin', f.coin]); if (f.coin.bete) l.push(['bete', f.coin.bete]); }
    if (f.marque) l.push(['marque', f.marque]);
    if (f.rail && f.rail.coin) l.push(['railcoin', f.rail.coin]);
    if (f.rail && f.rail.pied) l.push(['railpied', f.rail.pied]);
    if (f.tombe) l.push(['tombe', f.tombe]);
    (f.volants || []).forEach(function (v, i) { l.push(['vol' + i, v]); });
    return l;
  }

  const CIBLE = {
    coin: '.ssfete-coin', bete: '.ssfete-pendu', marque: '.ssfete-marque',
    railcoin: '.ssfete-railcoin', railpied: '.ssfete-railpied', tombe: '.ssfete-tombe',
  };

  function cssTeintes(f) {
    const sombre = [], clair = [], regles = [];
    emplacements(f).forEach(function (e) {
      const n = e[0], d = e[1];
      sombre.push('--ssf-' + n + '-c:' + ton(d.teinte, 'sombre') + ';--ssf-' + n + '-o:' + ton(d.opacite, 'sombre') + ';');
      clair.push('--ssf-' + n + '-c:' + ton(d.teinte, 'clair') + ';--ssf-' + n + '-o:' + ton(d.opacite, 'clair') + ';');
      const sel = CIBLE[n] || ('.ssfete-vol[data-i="' + n.slice(3) + '"]');
      regles.push(sel + ' { color: var(--ssf-' + n + '-c); opacity: var(--ssf-' + n + '-o); }');
    });
    /* Les teintes « claires » ne visent plus le seul thème `light` : elles visent TOUS les
       thèmes clairs, et la liste vient de SSTheme — la source unique. Sans ça, le premier
       thème clair ajouté (Zen, Blueprint…) héritait des teintes du SOMBRE et les décors
       devenaient invisibles sur fond blanc, sans que rien ne le signale. */
    const selClairs = (window.SSTheme ? window.SSTheme.idsClairs() : ['light'])
      .map(function (id) { return '[data-theme="' + id + '"]'; }).join(', ');
    return ':root {' + sombre.join('') + '}\n      ' + selClairs + ' {' + clair.join('') +
      '}\n      ' + regles.join('\n      ');
  }

  /* Un dessin s'écrit en SVG en ligne OU en fichier. Le `<img>` ne suit pas `currentColor` : on
     ne s'en sert donc que pour une image déjà coloriée. */
  function dessin(d) {
    if (d.img) return '<img src="' + base() + d.img + '" alt="" style="width:100%;height:auto;display:block">';
    return d.svg;
  }
  function base() {
    return location.pathname.indexOf('/app/') !== -1 ? '../' : './';
  }

  /* La bête qui pend dans la toile. Rendue à part parce qu'elle a deux morceaux — le fil et
     l'animal — et que le fil doit partir du point d'accroche, pas du dos de l'animal. */
  function beteHtml(b) {
    if (!b) return '';
    return '<div class="ssfete-pendu" style="--fil:' + b.fil + 'px;width:' + b.taille + 'px">' +
      '<div class="ssfete-fil"></div>' +
      '<div class="ssfete-bete" style="width:' + b.taille + 'px">' + dessin(b) + '</div></div>';
  }

  /* POSER LES COINS — rejouable, et c'est indispensable.
     Presque toutes les listes de l'ERP sont rendues APRÈS le chargement, depuis l'API : au
     moment du DOMContentLoaded, la page ne contient souvent aucun encadré. Un décor posé une
     seule fois n'apparaissait donc pas du tout sur ces écrans — et disparaissait au premier
     filtre sur les autres, puisque le rendu remplace l'innerHTML. */
  function poserCoins(f) {
    if (!f.coin) return;
    const deja = document.querySelectorAll('.ssfete-coin').length;
    if (deja >= MAX_COINS) return;
    Array.prototype.filter.call(document.querySelectorAll(HOTES_COIN), function (h) {
      // `closest` se teste lui-même : couvre l'élément ET tout ce qui vit dedans.
      if (h.closest(PAS_HOTE)) return false;
      // Jamais sur un encadré qui en contient un autre : les deux toiles se superposeraient.
      if (h.querySelector(HOTES_COIN)) return false;
      if (h.querySelector(':scope > .ssfete-coin')) return false;   // jamais deux fois
      if (!h.getClientRects().length) return false;                 // masqué = pas de décor
      return h.offsetWidth >= MIN_L && h.offsetHeight >= MIN_H;
    }).slice(0, MAX_COINS - deja).forEach(function (h, i) {
      /* Le rang se compte sur les toiles DÉJÀ posées, pas sur l'index de cette passe : les
         encadrés arrivent par vagues (chaque rendu de liste en apporte), et repartir de zéro à
         chaque passe aurait cassé l'alternance des coins. */
      const rang = deja + i;
      const haut = (rang % 2 === 0);
      const d = document.createElement('div');
      d.className = 'ssfete ssfete-coin ' + (haut ? 'ssfete-coin--hd' : 'ssfete-coin--bg');
      d.setAttribute('aria-hidden', 'true');
      d.style.width = f.coin.taille + 'px';
      // L'araignée n'habite que la PREMIÈRE toile : une par encadré en ferait une invasion, et
      // dans un coin bas-gauche elle pendrait hors de l'encadré.
      d.innerHTML = '<div class="ssfete-toile">' + dessin(f.coin) + '</div>' +
        (rang === 0 ? beteHtml(f.coin.bete) : '');
      /* `.section` et `.ticked` sont déjà en `position: relative` (base.css), mais pas forcément
         `.ec-poster`. Sans ça le décor, qui est en `position: absolute`, se placerait par rapport
         au premier ANCÊTRE positionné — donc n'importe où sur la page, et sans la moindre erreur
         pour le signaler. */
      if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
      h.appendChild(d);
    });
  }

  /* LE RAIL. Posé à part des encadrés pour deux raisons : c'est une COLONNE (212 px de large,
     donc sous le minimum exigé d'un encadré), et il est construit par nav.js, qui peut passer
     après nous. D'où le même traitement que les coins : rejouable, et rappelé par
     l'observateur — sans quoi le décor dépendait de l'ordre d'exécution de deux scripts. */
  function poserRail(f) {
    if (!f.rail) return;
    const rail = document.querySelector('.ssrail');
    if (!rail) return;
    if (f.rail.coin && !rail.querySelector('.ssfete-railcoin')) {
      const d = document.createElement('div');
      d.className = 'ssfete ssfete-railcoin';
      d.setAttribute('aria-hidden', 'true');
      d.style.width = f.rail.coin.taille + 'px';
      d.innerHTML = '<div class="ssfete-toile">' + dessin(f.rail.coin) + '</div>';
      rail.appendChild(d);
    }
    if (f.rail.pied && !rail.querySelector('.ssfete-railpied')) {
      const d = document.createElement('div');
      d.className = 'ssfete ssfete-railpied';
      d.setAttribute('aria-hidden', 'true');
      d.style.width = f.rail.pied.taille + 'px';
      d.title = f.nom;
      d.innerHTML = dessin(f.rail.pied);
      rail.appendChild(d);
    }
  }

  /* Tout ce qui peut apparaître après coup se repose ici, en un seul endroit. */
  function poser(f) { poserCoins(f); poserRail(f); }

  /* Surveiller les rendus. Groupé derrière un `setTimeout` : un rendu de liste produit des
     centaines de mutations, on ne veut repasser qu'UNE fois à la fin. Poser un décor déclenche
     à son tour l'observateur, mais la passe suivante ne trouve plus rien à faire (le filtre
     `:scope > .ssfete-coin`) et s'arrête — pas de boucle.
     ⚠️ `setTimeout` et non `requestAnimationFrame` : rAF ne se déclenche PAS dans un onglet
     masqué. Avec lui, une liste rendue pendant que l'onglet est en arrière-plan n'était jamais
     décorée, et rien ne le signalait. */
  /* ⚠️ UN SEUL observateur pour toute la vie de la page, et il lit la fête COURANTE au lieu de
     la capturer. Deux raisons, toutes deux constatées : chaque remontage (le réglage qu'on
     éteint et rallume, un aperçu) en empilait un de plus, et un observateur qui aurait gardé
     SA fête aurait continué à reposer les toiles d'Halloween pendant l'aperçu de Noël. */
  function surveiller() {
    if (!window.MutationObserver || SURVEILLE) return;
    SURVEILLE = true;
    let prevu = false;
    new MutationObserver(function () {
      if (prevu || !COURANTE) return;
      prevu = true;
      setTimeout(function () { prevu = false; if (COURANTE) poser(COURANTE); }, 120);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function style(f) {
    if (document.getElementById('ssfete-style')) return;
    const s = document.createElement('style');
    s.id = 'ssfete-style';
    s.textContent = `
      /* Rien de tout ceci ne doit JAMAIS intercepter un clic ni déplacer quoi que ce soit. */
      .ssfete, #${SKY} { pointer-events: none; }
      .ssfete svg, #${SKY} svg { width: 100%; height: auto; display: block; }
      .ssfete-toile { line-height: 0; }

      ${cssTeintes(f)}

      /* LE COIN DES ENCADRÉS — et l'ORIENTATION, qui était fausse.
         La toile est dessinée avec son moyeu à l'origine du viewBox, donc en HAUT À GAUCHE de
         son carré. Posée telle quelle en haut à droite d'un encadré, son moyeu se retrouvait
         58 px À L'INTÉRIEUR : ça ne se lisait plus comme une toile accrochée dans l'angle, mais
         comme une tache posée à côté. Invisible à cette taille et à 35 % d'opacité — il a fallu
         l'agrandir en rouge pour le voir. On la retourne donc selon le coin qu'elle occupe.
         ⚠️ Le miroir porte sur la TOILE SEULE, pas sur le conteneur : appliqué au conteneur, il
         retournerait aussi l'araignée, qui pendrait vers le haut dans le coin bas-gauche.
         Les coins alternent haut-droite / bas-gauche : ce sont les deux angles libres (les coins
         « ticked » occupent haut-gauche et bas-droite), et alterner évite la répétition
         mécanique quand plusieurs encadrés se suivent. */
      .ssfete-coin { position: absolute; z-index: 2; }
      .ssfete-coin--hd { top: 0; right: 0; }
      .ssfete-coin--hd .ssfete-toile { transform: scaleX(-1); }
      .ssfete-coin--bg { bottom: 0; left: 0; }
      .ssfete-coin--bg .ssfete-toile { transform: scaleY(-1); }

      /* LE RAIL. La toile se pose derrière les entrées (z-index 0, elles n'en ont pas), et la
         citrouille se cale en pied de colonne. */
      .ssfete-railcoin { position: absolute; top: 0; right: 0; z-index: 0; }
      .ssfete-railcoin .ssfete-toile { transform: scaleX(-1); }
      /* La citrouille du rail est HORS DU FLUX, et ce n'est pas un detail de style : en flux
         elle ajoutait 30 px a la colonne, le rail passait en defilement des 820 px de haut, et
         la barre lui volait 10 px de largeur -- << Outillage & references >> se faisait tronquer.
         Ancree par le bas, elle n'allonge plus le contenu, donc elle ne peut plus declencher ca. */
      .ssfete-railpied { position: absolute; bottom: 10px; left: 0; right: 0; margin: 0 auto; }

      /* Ce qui pend dans la toile : un fil, puis la bête. L'ensemble se balance depuis le
         POINT D'ACCROCHE (transform-origin en haut), sinon il pivote sur son ventre. */
      .ssfete-pendu { position: absolute; top: 26px; left: 1px; z-index: 3; transform-origin: top center;
        animation: ssfete-balance 6s ease-in-out infinite; }
      .ssfete-pendu .ssfete-fil { position: absolute; top: 0; left: 50%; width: 1px;
        height: var(--fil); background: currentColor; opacity: 0.45;
        animation: ssfete-soie 7s ease-in-out infinite; }
      .ssfete-pendu .ssfete-bete { position: absolute; left: 0; top: var(--fil);
        animation: ssfete-file 7s ease-in-out infinite; }
      @keyframes ssfete-balance { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
      /* Les deux animations partagent durée ET étapes : le fil s'allonge exactement au rythme où
         la bête descend. Désynchronisées, l'araignée se décroche de son fil — c'est ce qui
         arrivait quand seule la bête bougeait. */
      @keyframes ssfete-soie { 0%, 100% { height: var(--fil); } 55% { height: calc(var(--fil) + 9px); } }
      @keyframes ssfete-file { 0%, 100% { top: var(--fil); }    55% { top: calc(var(--fil) + 9px); } }

      /* La petite marque à côté du logo : fixe, elle ne bouge jamais. */
      .ssfete-marque { display: inline-block; vertical-align: middle; flex: none; }

      /* Le ciel : plein écran, en z-index 3 — au-dessus du contenu (.container est à 1) mais
         loin sous le bandeau (100) et sous les modales (9000). Une bête ne passera donc jamais
         par-dessus une fenêtre ouverte. */
      #${SKY} { position: fixed; inset: 0; z-index: 3; overflow: hidden; }
      .ssfete-vol { position: absolute; left: 0; will-change: transform; }
      @keyframes ssfete-traverse {
        from { transform: translate3d(-18vw, 0, 0); }
        to   { transform: translate3d(118vw, -6vh, 0); }
      }
      .ssfete-aile { transform-origin: center; animation: ssfete-aile 0.42s ease-in-out infinite alternate; }
      @keyframes ssfete-aile { from { transform: scaleY(1); } to { transform: scaleY(0.45); } }
      /* CE QUI TOMBE. L'emplacement s'appelle « tombe » et non « neige » parce que le meme
         mecanisme servira aux confettis du Carnaval et du Nouvel An : seul le dessin change.
         Chaque element porte SA colonne, SA duree, SA derive et SA rotation, derivees de son
         rang — pas de tirage au hasard, donc un rendu reproductible d'un chargement a l'autre. */
      .ssfete-tombe { position: absolute; top: 0; left: 0; --derive: 0px; --tour: 180deg;
        will-change: transform; }
      @keyframes ssfete-chute {
        from { transform: translate3d(0, -14vh, 0) rotate(0deg); }
        to   { transform: translate3d(var(--derive), 114vh, 0) rotate(var(--tour)); }
      }
      .ssfete-lueur { animation: ssfete-lueur 2.8s ease-in-out infinite; }
      @keyframes ssfete-lueur { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

      /* ANIMATIONS DE DÉTAIL. C'est ce qui séparait Halloween du reste : les ailes battaient et
         la citrouille respirait, pendant que les décors de décembre restaient figés. Chacune
         s'applique à un morceau DANS le dessin, jamais à l'objet entier.
         ⚠️ << transform-box: fill-box >> est indispensable : sans lui, << transform-origin: center >>
         désigne le centre du VIEWPORT SVG et non celui de la forme — l'élément part alors en
         diagonale au lieu de pivoter sur lui-même. */
      .ssfete-scintille, .ssfete-bulle, .ssfete-fumee, .ssfete-eclore {
        transform-box: fill-box; transform-origin: center; }
      .ssfete-scintille { animation: ssfete-scintille 3.2s ease-in-out infinite; }
      @keyframes ssfete-scintille {
        0%, 100% { opacity: 0.45; transform: scale(0.82); }
        50%      { opacity: 1;    transform: scale(1.1); }
      }
      .ssfete-bulle { animation: ssfete-bulle 2.8s ease-in infinite; }
      @keyframes ssfete-bulle {
        0%   { transform: translateY(2px); opacity: 0; }
        25%  { opacity: 0.9; }
        100% { transform: translateY(-13px); opacity: 0; }
      }
      .ssfete-fumee { animation: ssfete-fumee 4.5s ease-out infinite; }
      @keyframes ssfete-fumee {
        0%   { transform: translate(0, 0) scale(0.55); opacity: 0.6; }
        100% { transform: translate(8px, -14px) scale(1.6); opacity: 0; }
      }
      .ssfete-eclore { animation: ssfete-eclore 3.6s ease-in-out infinite; }
      @keyframes ssfete-eclore {
        0%, 100% { transform: scale(0.9); opacity: 0.75; }
        50%      { transform: scale(1.04); opacity: 1; }
      }
      .ssfete-eclat { animation: ssfete-eclat 4.5s ease-in-out infinite; }
      @keyframes ssfete-eclat { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.6; } }

      /* Sur petit écran on allège : l'écran est déjà plein, et c'est là qu'on travaille vite. */
      /* DEUX SEUILS, et ils ne disent pas la même chose.
         900 px : la sorcière fait 92 px de large, elle encombre dès qu'on quitte le grand écran.
         700 px (téléphone) : la toile se réduit, et l'araignée s'en va — à 62 % elle ne serait
         plus qu'une tache sur le compteur de la section. Elle reste donc visible sur un portable,
         ce qui n'était pas possible tant qu'elle pendait sous le bandeau. */
      @media (max-width: 900px) {
        .ssfete-vol[data-rare="1"] { display: none; }
        /* Sur petit ecran on enleve un flocon sur deux : l'ecran est plus etroit, donc la
           meme quantite y parait deux fois plus dense. */
        .ssfete-tombe[data-moitie="1"] { display: none; }
      }
      @media (max-width: 700px) {
        /* L'origine suit le coin occupé : avec un « top right » unique, la toile du bas-gauche se
           réduisait en s'éloignant de son angle. */
        .ssfete-coin--hd { transform: scale(0.62); transform-origin: top right; }
        .ssfete-coin--bg { transform: scale(0.62); transform-origin: bottom left; }
        .ssfete-railcoin { transform: scale(0.7); transform-origin: top right; }
        .ssfete-pendu { display: none; }
      }

      /* Mouvement réduit : les décors FIXES restent, ceux qui ne vivent que par leur mouvement
         s'en vont. Les figer au milieu de l'écran serait pire que de ne rien afficher. */
      @media (prefers-reduced-motion: reduce) {
        #${SKY} { display: none; }
        .ssfete-pendu, .ssfete-pendu .ssfete-fil, .ssfete-pendu .ssfete-bete { animation: none; }
        .ssfete-lueur, .ssfete-scintille, .ssfete-bulle, .ssfete-fumee,
        .ssfete-eclore, .ssfete-eclat { animation: none; }
      }

      /* À l'impression, rien. Jamais. */
      @media print { .ssfete, #${SKY} { display: none !important; } }
    `;
    document.head.appendChild(s);
  }

  /* ── Le montage ─────────────────────────────────────────────────────────────────────────── */
  function monter(forcer) {
    const f = active();
    COURANTE = null;
    if (!f || (!forcer && !estAllumee())) return;
    COURANTE = f;

    /* Les pages que le CLIENT ouvre ne sont JAMAIS décorées. Elles sont servies par un lien à
       jeton, hors Cloudflare Access : `devis-review.html` (le devis à accepter) et `track.html`
       (le suivi de commande). Le script n'y est de toute façon pas inclus — cette garde est la
       ceinture par-dessus les bretelles, pour le jour où quelqu'un l'ajoutera par copier-coller
       en dupliquant une page. */
    if (/(devis-review|track)\.html$/.test(location.pathname)) return;

    style(f);

    // 1. Les coins et le rail, puis on les repose à chaque rendu (voir surveiller()).
    poser(f);
    surveiller();

    // 2. La marque à côté du logo.
    const marque = document.querySelector('.brand-logo');
    if (f.marque && marque && marque.parentElement) {
      const d = document.createElement('span');
      d.className = 'ssfete ssfete-marque';
      d.setAttribute('aria-hidden', 'true');
      d.style.width = f.marque.taille + 'px';
      d.title = f.nom;
      d.innerHTML = dessin(f.marque);
      marque.parentElement.insertBefore(d, marque.nextSibling);
    }

    // 3. Le ciel : ce qui le traverse, et ce qui tombe.
    if ((f.volants && f.volants.length) || f.tombe) {
      const ciel = document.createElement('div');
      ciel.id = SKY;
      ciel.setAttribute('aria-hidden', 'true');
      (f.volants || []).forEach(function (v, i) {
        const d = document.createElement('div');
        d.className = 'ssfete-vol';
        if (v.rare) d.setAttribute('data-rare', '1');
        d.setAttribute('data-i', String(i));   // cible la règle de teinte de CE volant
        d.style.width = v.taille + 'px';
        d.style.top = v.haut;
        // Un retard négatif démarre l'animation EN COURS de route : sans lui, toutes les bêtes
        // partiraient en même temps au chargement, en file indienne.
        d.style.animation = 'ssfete-traverse ' + v.duree + 's linear ' + (-v.retard) + 's infinite';
        d.innerHTML = dessin(v);
        ciel.appendChild(d);
      });

      if (f.tombe && f.tombe.nombre > 0) {
        const t = f.tombe;
        for (let i = 0; i < t.nombre; i++) {
          const d = document.createElement('div');
          d.className = 'ssfete-tombe';
          if (i % 2) d.setAttribute('data-moitie', '1');
          d.style.width = Math.round(t.taille * (0.62 + (i % 4) * 0.17)) + 'px';
          d.style.left = (((i + 0.5) * 100) / t.nombre).toFixed(1) + '%';
          d.style.setProperty('--derive', (((i % 5) - 2) * 16) + 'px');
          d.style.setProperty('--tour', (((i % 3) - 1) * 200 + 60) + 'deg');
          // Retard NÉGATIF : l'animation démarre en cours de route, sinon tous les flocons
          // partiraient du haut en même temps, en rideau.
          d.style.animation = 'ssfete-chute ' + (t.duree + (i % 5) * 2.6) + 's linear ' +
            (-(i * 1.9).toFixed(1)) + 's infinite';
          // Une palette l'emporte sur la teinte de thème : voir le commentaire de `tombe`.
          if (t.palette && t.palette.length) d.style.color = t.palette[i % t.palette.length];
          /* `svg` peut être une LISTE : un seul flocon répété seize fois se voit immédiatement,
             et c'est exactement ce qui faisait « pas soigné ». On alterne par rang. */
          d.innerHTML = (!t.img && Array.isArray(t.svg)) ? t.svg[i % t.svg.length] : dessin(t);
          ciel.appendChild(d);
        }
      }

      document.body.appendChild(ciel);
    }
  }

  window.SSFetes = {
    active: active,
    estAllumee: estAllumee,
    allumer: allumer,
    apercu: apercu,
    FETES: FETES,
    // exposés pour les tests : ils décident de tout et ne doivent pas dériver en silence
    _moisJour: moisJour,
    _dansLaPeriode: dansLaPeriode,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();
