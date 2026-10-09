/* ═══════════════════════════════════════════════════════════════════════════════════════════
   VOLET ROULANT VR150 (window.SSVolet) — un seul configurateur, quatre écrans.

   POURQUOI CE FICHIER EXISTE
   Le bloc de configuration VR150 vivait en DEUX copies, une dans `app/simulateur.html` et une
   dans `app/terrain.html`. À quatre champs c'était tenable, et elles avaient pourtant déjà
   divergé (grid-4 contre grid-2, classes de case à cocher différentes). Le portail de commande
   Harol en demande une trentaine : à ce volume, deux copies, c'est la certitude qu'un champ
   existera d'un côté et pas de l'autre — et qu'on le découvrira en passant la commande, quand
   il est trop tard pour demander au client.

   Ce fichier ne décide de RIEN. La description des champs — libellés, valeurs, conditions —
   vit dans `products.js` (`VR_CHAMPS`), avec tout le reste du vocabulaire produit. Ici, on ne
   fait que la RENDRE : à l'écran pour la saisie, en résumé lisible pour le devis du client, en
   résumé complet pour la commande. Trois sorties, une seule source.

   ⚠️ LA RÈGLE QUI PROTÈGE LES ANCIENS DEVIS. Un menu déroulant dont la valeur courante ne
   figure dans aucune option affiche « — » sans prévenir, et le premier enregistrement écrase la
   valeur par du vide. Cette mise à jour crée exactement ce cas deux fois : les caissons 137 et
   150 que Harol ne propose plus, et les libellés de couleur de lame réécrits d'après le portail.
   `SSProducts.vrOptions` réinjecte donc toujours la valeur enregistrée, marquée comme telle.
   Ne jamais construire un <option> de ce bloc sans passer par elle.

   Dépend de `products.js`, qui doit être chargé AVANT.
   Protégé par `tests/volet.test.html`.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  const P = function () { return window.SSProducts || null; };

  /** Ce bloc ne concerne que les volets roulants. `volet` est l'ancien nom du type : il reste
   *  sur de vrais devis, et un configurateur qui ne s'affiche pas sur un ancien dossier donne
   *  l'impression que la donnée a disparu. */
  function estVolet(item) {
    const t = item && item.type;
    return t === 'volet_roulant' || t === 'volet';
  }

  /* ── LA COULEUR SE PROPAGE DEPUIS LE CAISSON ──────────────────────────────────────────
     Nicolas, 09/10/2026 : « quand je prends un RAL il se répercute sur la lame finale et sur
     les deux coulisses, c'est logique, c'est rarement le contraire ». Il avait raison : sur un
     volet, les quatre pièces sortent presque toujours du même bain de laquage, et recopier la
     même teinte quatre fois est le genre de saisie qu'on finit par bâcler — donc une coulisse
     qui part au mauvais RAL chez le fournisseur.
     ⚠️ MAIS ON N'ÉCRASE JAMAIS UN CHOIX. Une valeur qui DIFFÈRE de l'ancienne couleur de
     caisson a été posée exprès : la remplacer détruirait en silence une décision, et c'est
     précisément le genre d'erreur qu'on ne voit qu'à la livraison. Trois cas, et trois seulement :
       • le champ est VIDE               → on le remplit ;
       • il valait l'ANCIENNE couleur     → il suivait, il suit encore ;
       • il vaut autre chose              → on n'y touche pas.
     C'est la même discipline que le drapeau « quantité saisie à la main » du simulateur, qui
     coupe la synchro dès que quelqu'un a décidé. */
  const LIES_AU_RAL = ['lame_finale_couleur', 'couleur_coulisses', 'couleur_coulisses2'];

  /** La forme canonique d'un RAL : « 7016 » et « 7016 — Gris anthracite » sont la même teinte.
   *  Sans ça, taper le code seul poserait dans les menus une valeur qui ne correspond à aucune
   *  option — elle s'afficherait « valeur enregistrée », comme une donnée périmée. */
  function normaliserRal(v) {
    const p = P();
    const s = String(v == null ? '' : v).trim();
    if (!s || !p) return s;
    const code = p.ralCode(s);
    return code ? p.ralLabel(code) : s;
  }

  /**
   * Répercute la couleur du caisson sur les pièces liées. MODIFIE l'ouverture.
   * @param ancienne la couleur de caisson AVANT la saisie — c'est elle qui dit si un champ
   *                 suivait ou avait été décidé à part.
   * @returns les clés réellement changées (vide = rien à faire, donc rien à re-rendre).
   */
  function appliquerRal(item, ancienne) {
    if (!estVolet(item)) return [];
    const neuve = normaliserRal(item.couleur);
    const avant = normaliserRal(ancienne);
    // Caisson vidé : on ne vide pas le reste pour autant. Et une couleur inchangée n'a rien
    // à propager — sans cette garde, chaque frappe dans un AUTRE champ relancerait la copie.
    if (!neuve || neuve === avant) return [];
    const changees = [];
    LIES_AU_RAL.forEach(function (k) {
      const v = normaliserRal(item[k]);
      if (v && !(avant && v === avant)) return;   // posé exprès : on laisse
      if (item[k] === neuve) return;
      item[k] = neuve;
      changees.push(k);
    });
    return changees;
  }

  /** La valeur affichable d'un champ, ou '' s'il n'y a rien à dire. */
  function valeurAffichable(champ, item) {
    const v = item ? item[champ.k] : undefined;
    if (champ.t === 'check') return v ? 'Oui' : '';
    if (v === undefined || v === null || v === '') return '';
    // Un RAL tapé au code seul se lit en entier sur le devis (voir `ral: true` dans la spec).
    if (champ.ral) return normaliserRal(v);
    return String(v) + (champ.unite ? ' ' + champ.unite : '');
  }

  /** Le code de menu Harol devant une valeur n'apprend RIEN au client : « 1 : type 1 (dans
   *  le jour) » se lit « Type 1 (dans le jour) », « A4118 : RS100 Solar io 6/15 » se lit
   *  « RS100 Solar io 6/15 ». C'est l'index du menu du portail, pas une caractéristique.
   *  ⚠️ On ne retire QUE ce qui est un index (1 ou 2 chiffres) ou une référence d'article
   *  (A4118). Jamais 3 ou 4 chiffres : « 7016 — Gris anthracite » est un RAL et
   *  « 135 — glissière de sécurité » une référence de coulisse — elles DÉSIGNENT le produit,
   *  les retirer rendrait le devis invérifiable.
   *  La majuscule n'est remise que si on a retiré quelque chose : sinon « alu237 »
   *  deviendrait « Alu237 », et c'est une référence produit. */
  function sansCodeMenu(v) {
    const s = String(v == null ? '' : v);
    const net = s.replace(/^(?:\d{1,2}|A\d{3,5}|[A-Z]{2,4}\d{0,2})\s*[:\u2014\u2013-]\s*/, '');
    return net === s ? s : net.charAt(0).toUpperCase() + net.slice(1);
  }

  /**
   * Le résumé de la configuration.
   * @param niveau 'client'  → ce que le client doit pouvoir vérifier : lame, couleurs, montage,
   *                           motorisation. PAS les références de commande Harol (perçage A168,
   *                           rivets, embouts, bouchons) : elles noient ce qu'il doit lire et
   *                           exposent le détail fournisseur sur un document qui circule.
   *               'complet' → tout, pour la feuille de picking et le bon de commande.
   * @returns [{ g, l, v }] dans l'ordre de la spec — l'ordre de lecture est voulu.
   */
  function resume(item, niveau) {
    const p = P();
    if (!p || !estVolet(item)) return [];
    const client = niveau === 'client';
    return p.vrChamps(item)
      .filter(function (c) { return !client || c.client; })
      // Une valeur muette ne se montre à personne : ni au client, ni au poseur.
      .filter(function (c) {
        return !(c.muets && c.muets.indexOf(item[c.k]) >= 0);
      })
      .map(function (c) {
        const v = valeurAffichable(c, item);
        /* ⚠️ Sur le document du client, une case cochée se MENTIONNE, elle ne s'affirme pas :
           « Moustiquaire » dit tout, « Moustiquaire : Oui » ajoute un mot et une ponctuation
           par option — et avec trois options de suite, l'encadré se met à bégayer. Le résumé
           COMPLET garde le « Oui » : une feuille d'atelier se lit de travers, et une mention
           seule au milieu d'une ligne de valeurs s'y confondrait avec un intitulé. */
        if (client && c.t === 'check') return { k: c.k, g: c.g, l: c.lCourt || c.l, v: '', coche: !!v };
        return client
          ? { k: c.k, g: c.g, l: c.lCourt || c.l, v: sansCodeMenu(v), coche: false }
          : { k: c.k, g: c.g, l: c.l, v: v, coche: false };
      })
      .filter(function (x) { return x.v !== '' || x.coche; });
  }

  /** Le même résumé, à plat — pour une ligne de feuille de pose ou une infobulle. */
  function resumeTexte(item, niveau) {
    return resume(item, niveau)
      .map(function (x) { return x.coche ? x.l : x.l + ' : ' + x.v; })
      .join(' · ');
  }

  // ── Le rendu de saisie ────────────────────────────────────────────────────────────────────

  /* La feuille de style voyage AVEC le composant. Elle vivait sinon dans le <style> de chaque
     page qui l'affiche, c'est-à-dire exactement le problème que ce fichier résout. Posée une
     seule fois, à la première utilisation. */
  const CSS = [
    '.vr-grp{margin-top:var(--sp-3);}',
    '.vr-grp-t{font-family:var(--font-mono);font-size:var(--fs-2xs);letter-spacing:.06em;',
    'text-transform:uppercase;color:var(--text-subtle);margin-bottom:var(--sp-2);}',
    '.vr-checks{display:flex;flex-wrap:wrap;gap:var(--sp-2) var(--sp-4);margin-top:var(--sp-2);}',
    '.vr-checks label{display:flex;align-items:center;gap:.5rem;font-size:var(--fs-sm);cursor:pointer;}',
    '.vr-aide{font-size:var(--fs-2xs);color:var(--text-subtle);margin-top:.25rem;line-height:1.45;}',
    '.vr-perime{color:var(--warn);}',
    /* Sur un téléphone, une case à cocher de 14 px ne se vise pas : on respecte les 44 px de
       cible tactile du reste de l'application. La hauteur seule est élargie — élargir aussi
       horizontalement ferait déborder la carte en largeur de défilement. */
    '@media (pointer: coarse){.vr-checks{gap:var(--sp-3) var(--sp-4);}',
    '.vr-checks label{min-height:44px;}.vr-checks input{width:20px;height:20px;}}',
  ].join('');

  function poserCss() {
    if (document.getElementById('ss-volet-css')) return;
    const st = document.createElement('style');
    st.id = 'ss-volet-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function champSelect(champ, item, onchange) {
    const p = P();
    const opts = p.vrOptions(p.vrValeurs(champ, item), item[champ.k]);
    const cur = String(item[champ.k] == null ? '' : item[champ.k]);
    const perime = opts.some(function (o) { return o.perime && o.v === cur; });
    const lignes = opts.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (o.v === cur ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
    return '<div class="field' + (champ.large ? ' col-full' : '') + '">' +
      '<label class="label">' + esc(champ.l) + '</label>' +
      '<select class="select" data-f="' + esc(champ.k) + '"' + onchange + '>' +
      '<option value="">—</option>' + lignes + '</select>' +
      aideHtml(champ, item, perime) + '</div>';
  }

  function champTexte(champ, item) {
    const val = item[champ.k] == null ? '' : item[champ.k];
    const inner = '<input class="input" type="text" data-f="' + esc(champ.k) + '" value="' + esc(val) + '">';
    return '<div class="field' + (champ.large ? ' col-full' : '') + '">' +
      '<label class="label">' + esc(champ.l) + '</label>' +
      (champ.unite
        ? '<div class="input-unit">' + inner.replace('class="input"', 'class="input input-num"') +
          '<span class="unit">' + esc(champ.unite) + '</span></div>'
        : inner) +
      aideHtml(champ, item, false) + '</div>';
  }

  function champCheck(champ, item, onchange) {
    return '<label><input type="checkbox" data-f="' + esc(champ.k) + '"' +
      (item[champ.k] ? ' checked' : '') + onchange + '> ' + esc(champ.l) + '</label>';
  }

  function aideHtml(champ, item, perime) {
    const a = typeof champ.aide === 'function' ? champ.aide(item) : champ.aide;
    const bouts = [];
    if (perime) {
      /* « ne figure PAS », et non « ne figure plus » : le cas couvre aussi bien une valeur
         retirée du catalogue qu'un RAL hors de la palette Harol propagé depuis le caisson. */
      bouts.push('<span class="vr-perime">Cette valeur ne figure pas dans la liste du ' +
        'catalogue Harol — elle est conservée telle quelle, à vérifier avant de commander.</span>');
    }
    if (a) bouts.push(esc(a));
    return bouts.length ? '<div class="vr-aide">' + bouts.join('<br>') + '</div>' : '';
  }

  /**
   * Le bloc de configuration complet.
   * @param opts { cols } — le simulateur a de la place (4 colonnes), le Mode Terrain non (2).
   *             { onchange } — le nom de la fonction globale à rappeler quand un champ PILOTE
   *             change. Seuls les champs `pilote` la déclenchent : re-rendre le bloc à chaque
   *             frappe ferait perdre le focus, et à chaque menu ferait sauter la page sous les
   *             doigts pour rien.
   *             { icon } — la fonction d'icône de la page appelante, facultative.
   */
  function html(item, opts) {
    if (!estVolet(item) || !P()) return '';
    poserCss();
    const o = opts || {};
    const cols = o.cols || 2;
    // `horsFormulaire` : résumé sur le devis, mais saisi ailleurs (la couleur du caisson vit
    // dans le sélecteur RAL commun, en haut de la carte).
    const champs = P().vrChamps(item).filter(function (c) { return !c.horsFormulaire; });
    const ico = (typeof o.icon === 'function') ? o.icon('sliders', 14) : '';
    const rappel = function (champ) {
      return (champ.pilote && o.onchange)
        ? ' onchange="' + esc(o.onchange) + '(\'' + esc(item._id || item.id || '') + '\')"'
        : '';
    };

    // Les groupes dans l'ordre de la spec : cet ordre EST l'ordre de la commande chez Harol,
    // du tablier vers les accessoires. Le respecter évite de chercher un champ.
    const groupes = [];
    champs.forEach(function (c) {
      let g = groupes.filter(function (x) { return x.nom === c.g; })[0];
      if (!g) { g = { nom: c.g, champs: [] }; groupes.push(g); }
      g.champs.push(c);
    });

    const corps = groupes.map(function (g) {
      const checks = g.champs.filter(function (c) { return c.t === 'check'; });
      const autres = g.champs.filter(function (c) { return c.t !== 'check'; });
      const grille = autres.length
        ? '<div class="grid grid-' + cols + '">' + autres.map(function (c) {
            return c.t === 'texte' ? champTexte(c, item) : champSelect(c, item, rappel(c));
          }).join('') + '</div>'
        : '';
      const cases = checks.length
        ? '<div class="vr-checks">' + checks.map(function (c) { return champCheck(c, item, rappel(c)); }).join('') + '</div>'
        : '';
      return '<div class="vr-grp"><div class="vr-grp-t">' + esc(g.nom) + '</div>' + grille + cases + '</div>';
    }).join('');

    return '<div class="cs8-block mt-4" data-volet-block>' +
      '<div class="cs8-head">' + ico + ' Configuration VR150 Pure</div>' +
      corps + '</div>';
  }

  /**
   * Remplace le bloc à l'intérieur d'une carte d'ouverture, après qu'un champ pilote a changé.
   * ⚠️ On remplace le bloc SEUL et pas la carte entière : re-rendre la carte reconstruirait les
   * photos et ferait remonter la page au-dessus du champ qu'on vient de toucher.
   *
   * ⚠️⚠️ `opts.bind` N'EST PAS FACULTATIF, et l'oublier coûte des DONNÉES.
   * `outerHTML` détruit les anciens éléments : les écouteurs que la page avait posés dessus
   * partent avec eux. Sans rebranchement, TOUS les champs du bloc cessaient d'être collectés
   * dès le premier changement d'alimentation ou de combinaison — on les remplissait, ils
   * s'affichaient correctement à l'écran, et ils n'arrivaient jamais dans le devis.
   * Signalé indirectement par Nicolas le 09/10/2026 (« ça ne se répercute pas »), trouvé en
   * rejouant le geste réel plutôt qu'en relisant le code : le symptôme ne ressemblait pas
   * à la cause. Ne jamais appeler `rafraichir` sans `bind`.
   */
  function rafraichir(carte, item, opts) {
    const bloc = carte && carte.querySelector('[data-volet-block]');
    if (!bloc) return false;
    bloc.outerHTML = html(item, opts);
    const neuf = carte.querySelector('[data-volet-block]');
    if (neuf && opts && typeof opts.bind === 'function') opts.bind(neuf);
    return !!neuf;
  }

  window.SSVolet = {
    estVolet: estVolet,
    html: html,
    rafraichir: rafraichir,
    resume: resume,
    resumeTexte: resumeTexte,
    LIES_AU_RAL: LIES_AU_RAL,
    normaliserRal: normaliserRal,
    appliquerRal: appliquerRal,
    valeurAffichable: valeurAffichable,
    sansCodeMenu: sansCodeMenu,
  };
})();
