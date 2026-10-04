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
    (f.volants || []).forEach(function (v, i) { l.push(['vol' + i, v]); });
    return l;
  }

  const CIBLE = {
    coin: '.ssfete-coin', bete: '.ssfete-pendu', marque: '.ssfete-marque',
    railcoin: '.ssfete-railcoin', railpied: '.ssfete-railpied',
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
      .ssfete-lueur { animation: ssfete-lueur 2.8s ease-in-out infinite; }
      @keyframes ssfete-lueur { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

      /* Sur petit écran on allège : l'écran est déjà plein, et c'est là qu'on travaille vite. */
      /* DEUX SEUILS, et ils ne disent pas la même chose.
         900 px : la sorcière fait 92 px de large, elle encombre dès qu'on quitte le grand écran.
         700 px (téléphone) : la toile se réduit, et l'araignée s'en va — à 62 % elle ne serait
         plus qu'une tache sur le compteur de la section. Elle reste donc visible sur un portable,
         ce qui n'était pas possible tant qu'elle pendait sous le bandeau. */
      @media (max-width: 900px) { .ssfete-vol[data-rare="1"] { display: none; } }
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

    // 3. Le ciel et ce qui le traverse.
    if (f.volants && f.volants.length) {
      const ciel = document.createElement('div');
      ciel.id = SKY;
      ciel.setAttribute('aria-hidden', 'true');
      f.volants.forEach(function (v, i) {
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
