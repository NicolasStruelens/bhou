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


  /* ── Décembre : Saint-Nicolas puis Noël ─────────────────────────────────────────────────── */

  // Semis d'étoiles pour l'angle (calculé, comme la toile) : c'est la nuit où il passe.
  const ETOILES =
    '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M16.0,1.0C18.9,11.1 18.9,11.1 29.0,14.0C18.9,16.9 18.9,16.9 16.0,27.0C13.1,16.9 13.1,16.9 3.0,14.0C13.1,11.1 13.1,11.1 16.0,1.0ZM52.0,11.0C54.0,18.0 54.0,18.0 61.0,20.0C54.0,22.0 54.0,22.0 52.0,29.0C50.0,22.0 50.0,22.0 43.0,20.0C50.0,18.0 50.0,18.0 52.0,11.0ZM22.0,43.5C23.9,50.1 23.9,50.1 30.5,52.0C23.9,53.9 23.9,53.9 22.0,60.5C20.1,53.9 20.1,53.9 13.5,52.0C20.1,50.1 20.1,50.1 22.0,43.5ZM74.0,39.5C75.4,44.6 75.4,44.6 80.5,46.0C75.4,47.4 75.4,47.4 74.0,52.5C72.6,47.4 72.6,47.4 67.5,46.0C72.6,44.6 72.6,44.6 74.0,39.5ZM44.0,64.0C45.3,68.7 45.3,68.7 50.0,70.0C45.3,71.3 45.3,71.3 44.0,76.0C42.7,71.3 42.7,71.3 38.0,70.0C42.7,68.7 42.7,68.7 44.0,64.0ZM14.0,79.0C15.1,82.9 15.1,82.9 19.0,84.0C15.1,85.1 15.1,85.1 14.0,89.0C12.9,85.1 12.9,85.1 9.0,84.0C12.9,82.9 12.9,82.9 14.0,79.0ZM86.0,75.5C87.0,79.0 87.0,79.0 90.5,80.0C87.0,81.0 87.0,81.0 86.0,84.5C85.0,81.0 85.0,81.0 81.5,80.0C85.0,79.0 85.0,79.0 86.0,75.5Z"/></svg>';

  // Trois rameaux depuis l'angle, aiguilles de part et d'autre.
  const BRANCHE_SAPIN =
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
    '<path d="M0,0L87.5,28.4M19.0,6.2l9.2,15.9M19.0,6.2l16.7,-7.4M29.5,9.6l8.1,14.1M29.5,9.6l14.9,-6.6M39.9,13.0l7.1,12.3M39.9,13.0l13.0,-5.8M50.4,16.4l6.1,10.6M50.4,16.4l11.2,-5.0M60.9,19.8l5.1,8.8M60.9,19.8l9.3,-4.1M71.3,23.2l4.1,7.1M71.3,23.2l7.4,-3.3M0,0L65.1,65.1M14.1,14.1l1.0,18.3M14.1,14.1l18.3,1.0M21.9,21.9l0.9,16.2M21.9,21.9l16.2,0.9M29.7,29.7l0.7,14.2M29.7,29.7l14.2,0.7M37.5,37.5l0.6,12.2M37.5,37.5l12.2,0.6M45.3,45.3l0.5,10.2M45.3,45.3l10.2,0.5M53.0,53.0l0.4,8.1M53.0,53.0l8.1,0.4M0,0L28.4,87.5M6.2,19.0l-7.4,16.7M6.2,19.0l15.9,9.2M9.6,29.5l-6.6,14.9M9.6,29.5l14.1,8.1M13.0,39.9l-5.8,13.0M13.0,39.9l12.3,7.1M16.4,50.4l-5.0,11.2M16.4,50.4l10.6,6.1M19.8,60.9l-4.1,9.3M19.8,60.9l8.8,5.1M23.2,71.3l-3.3,7.4M23.2,71.3l7.1,4.1"/></svg>';

  const FLOCON =
    '<svg viewBox="-11 -11 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
    '<path d="M0,0L10.00,0.00M4.40,0.00l2.19,2.60M4.40,0.00l2.19,-2.60M7.20,0.00l1.67,1.99M7.20,0.00l1.67,-1.99M0,0L5.00,8.66M2.20,3.81l-1.16,3.19M2.20,3.81l3.35,0.59M3.60,6.24l-0.89,2.44M3.60,6.24l2.56,0.45M0,0L-5.00,8.66M-2.20,3.81l-3.35,0.59M-2.20,3.81l1.16,3.19M-3.60,6.24l-2.56,0.45M-3.60,6.24l0.89,2.44M0,0L-10.00,0.00M-4.40,0.00l-2.19,-2.60M-4.40,0.00l-2.19,2.60M-7.20,0.00l-1.67,-1.99M-7.20,0.00l-1.67,1.99M0,0L-5.00,-8.66M-2.20,-3.81l1.16,-3.19M-2.20,-3.81l-3.35,-0.59M-3.60,-6.24l0.89,-2.44M-3.60,-6.24l-2.56,-0.45M0,0L5.00,-8.66M2.20,-3.81l3.35,-0.59M2.20,-3.81l-1.16,-3.19M3.60,-6.24l2.56,-0.45M3.60,-6.24l-0.89,-2.44"/></svg>';

  const MITRE =
    '<svg viewBox="0 0 40 48" fill="currentColor">' +
    '<path d="M20,2C27,10 33,18 33,28L33,44L7,44L7,28C7,18 13,10 20,2Z"/>' +
    '<rect x="7" y="30" width="26" height="5" fill="var(--surface)"/>' +
    '<g stroke="var(--surface)" stroke-width="2.6" stroke-linecap="round"><path d="M20,11L20,26"/><path d="M14,18.5L26,18.5"/></g></svg>';

  // Le spéculoos : en Belgique c'est L'objet de la Saint-Nicolas.
  const SPECULOOS =
    '<svg viewBox="0 0 30 34" fill="currentColor">' +
    '<rect x="2" y="2" width="26" height="30" rx="4"/>' +
    '<g fill="var(--surface)" opacity=".5"><circle cx="15" cy="10" r="3.4"/>' +
    '<path d="M9,16C9,15 21,15 21,16L19.5,25L10.5,25Z"/><path d="M8,18L5,22M22,18L25,22"/></g></svg>';

  const SABOT =
    '<svg viewBox="0 0 46 30" fill="currentColor">' +
    '<path d="M18,2L22,10L25,8.6L21,1Z" fill="#e07c00"/>' +
    '<path d="M17,1.5C15,0 13,0.5 13,2C13,3.4 15,4 17,3Z" fill="#6b8f3a"/>' +
    '<path d="M7,26C2.5,22 3,14.5 9.5,11.5C12.5,10 16.5,9.5 21,9.5L33,9.5C38.5,9.5 43,13.5 43,18C43,22.4 39.5,26 35,26Z"/></svg>';

  // Saint-Nicolas sur son âne. Le plus complexe des dessins : mitre, barbe, crosse et cape
  // suffisent à le rendre reconnaissable même à 80 px.
  /* LE BATEAU DE SAINT-NICOLAS. Dans la tradition belge, il arrive d'Espagne par bateau — d'ou
     un decor qui TRAVERSE l'ecran pour une raison evidente, au lieu de flotter sans raison.
     ⚠️ Le saint sur son ane a ete essaye DEUX fois et abandonne : a 84 px, en mouvement et en
     opacite basse, l'ane et le cavalier fusionnaient en une seule masse. Mettre l'ane en retrait
     a aide sans suffire. La lecon vaut pour les prochaines fetes : a cette taille il faut QUATRE
     formes franches, pas une illustration. */
  const BATEAU =
    '<svg viewBox="0 0 100 58" fill="currentColor">' +
    '<path d="M8,37L92,37L84,51L16,51Z"/>' +
    '<rect x="28" y="22" width="34" height="15" rx="2"/>' +
    '<rect x="33" y="26" width="7" height="7" rx="1" fill="var(--surface)"/>' +
    '<rect x="46" y="26" width="7" height="7" rx="1" fill="var(--surface)"/>' +
    '<rect x="66" y="15" width="10" height="22" rx="2"/>' +
    '<rect x="63.5" y="12" width="15" height="4.5" rx="1.5"/>' +
    '<circle cx="73" cy="5.5" r="4.2" opacity=".5"/><circle cx="84" cy="2.5" r="2.8" opacity=".35"/>' +
    '<g stroke="currentColor" fill="none" stroke-linecap="round">' +
    '<path d="M20,37L20,13" stroke-width="2.4"/>' +
    '<path d="M3,52C13,47.5 23,56 33,51.5C43,47 53,55.5 63,51C73,46.5 85,55 97,50.5" stroke-width="2.4" opacity=".45"/></g>' +
    '<path d="M20,13L35,17.5L20,22Z"/></svg>';

  const BOULE =
    '<svg viewBox="0 0 30 38" fill="currentColor">' +
    '<path d="M12,7L12,4.5C12,2.6 13.3,1.5 15,1.5C16.7,1.5 18,2.6 18,4.5L18,7" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="11.2" y="6" width="7.6" height="5" rx="1.5"/>' +
    '<circle cx="15" cy="24" r="12"/>' +
    '<path d="M5,20C9,17.5 21,17.5 25,20" fill="none" stroke="var(--surface)" stroke-width="1.6" opacity=".45"/>' +
    '<circle cx="10.5" cy="19" r="2.3" fill="var(--surface)" opacity=".35"/></svg>';

  const SAPIN =
    '<svg viewBox="0 0 32 42" fill="currentColor">' +
    '<rect x="13.5" y="34" width="5" height="6"/>' +
    '<path d="M16,2L24,14L20,14L27,25L22,25L30,35L2,35L10,25L5,25L12,14L8,14Z"/></svg>';

  const CADEAU =
    '<svg viewBox="0 0 34 32" fill="currentColor">' +
    '<rect x="3" y="12" width="28" height="19" rx="1.5"/>' +
    '<rect x="1" y="7.5" width="32" height="6" rx="1.5"/>' +
    '<rect x="14.5" y="7.5" width="5" height="23.5" fill="var(--surface)" opacity=".45"/>' +
    '<path d="M17,8C13,8 10,5 11,2.5C12,0.5 15,1.5 17,8ZM17,8C21,8 24,5 23,2.5C22,0.5 19,1.5 17,8Z"/></svg>';

  const ETOILE_FILANTE =
    '<svg viewBox="0 0 62 26" fill="currentColor">' +
    '<path d="M1,19C12,13 24,10 35,11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".45"/>' +
    '<path d="M47,2C49.6,11.2 49.6,11.2 58.8,13.8C49.6,16.4 49.6,16.4 47,25.6C44.4,16.4 44.4,16.4 35.2,13.8C44.4,11.2 44.4,11.2 47,2Z"/></svg>';

  const TRAINEAU =
    '<svg viewBox="0 0 94 50" fill="currentColor">' +
    '<rect x="30" y="8" width="15" height="11" rx="2"/><rect x="47" y="11.5" width="11" height="7.5" rx="2"/>' +
    '<path d="M16,33C14,26 18,19 27,19L63,19C69,19 71,24 69,31L67,35L20,35Z"/>' +
    '<g stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round">' +
    '<path d="M13,40C10,34 12,28 19,26"/><path d="M13,40L76,40"/><path d="M76,40C81,37 81,32 76,31"/></g></svg>';

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
      tombe: { svg: FLOCON, taille: 15, nombre: 9, duree: 16,
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
      tombe: { svg: FLOCON, taille: 16, nombre: 14, duree: 14,
        teinte: { sombre: '#dce9ff', clair: '#8ba6cc' }, opacite: { sombre: 0.55, clair: 0.4 } },
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
    const mj = moisJour(d);
    return FETES.find(function (f) { return dansLaPeriode(mj, f.du, f.au); }) || null;
  }

  function estAllumee() {
    try { return localStorage.getItem(CLE) !== 'non'; } catch (e) { return true; }
  }
  function allumer(oui) {
    try { localStorage.setItem(CLE, oui ? 'oui' : 'non'); } catch (e) {}
    const ciel = document.getElementById(SKY);
    if (ciel) ciel.remove();
    document.querySelectorAll('.ssfete').forEach(function (n) { n.remove(); });
    if (oui) monter();
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
  function surveiller(f) {
    if ((!f.coin && !f.rail) || !window.MutationObserver) return;
    let prevu = false;
    new MutationObserver(function () {
      if (prevu) return;
      prevu = true;
      setTimeout(function () { prevu = false; poser(f); }, 120);
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
        .ssfete-lueur { animation: none; }
      }

      /* À l'impression, rien. Jamais. */
      @media print { .ssfete, #${SKY} { display: none !important; } }
    `;
    document.head.appendChild(s);
  }

  /* ── Le montage ─────────────────────────────────────────────────────────────────────────── */
  function monter() {
    const f = active();
    if (!f || !estAllumee()) return;

    /* Les pages que le CLIENT ouvre ne sont JAMAIS décorées. Elles sont servies par un lien à
       jeton, hors Cloudflare Access : `devis-review.html` (le devis à accepter) et `track.html`
       (le suivi de commande). Le script n'y est de toute façon pas inclus — cette garde est la
       ceinture par-dessus les bretelles, pour le jour où quelqu'un l'ajoutera par copier-coller
       en dupliquant une page. */
    if (/(devis-review|track)\.html$/.test(location.pathname)) return;

    style(f);

    // 1. Les coins et le rail, puis on les repose à chaque rendu (voir surveiller()).
    poser(f);
    surveiller(f);

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
          d.innerHTML = dessin(t);
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
    FETES: FETES,
    // exposés pour les tests : ils décident de tout et ne doivent pas dériver en silence
    _moisJour: moisJour,
    _dansLaPeriode: dansLaPeriode,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();
