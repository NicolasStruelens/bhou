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
      // `data-section` : le simulateur en fait une SECTION de sa fiche (état, sommaire, « copier vers les
      // autres », règle 60). Sans effet ailleurs : le Mode Terrain l'ignore.
      return '<div class="vr-grp" data-section="' + esc(g.nom) + '"><div class="vr-grp-t" data-section-t>' + esc(g.nom) + '</div>' + grille + cases + '</div>';
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

  /* ── UN ENCADRÉ COMMUN, ET CE QUI DIFFÈRE ───────────────────────────────────────────────
     Histoire en deux temps.
     10/10/2026 — « quand c'est la même config exacte, que l'encadré soit un seul en dessous des
     deux » (Nicolas). Deux VR150 d'une même façade (Kerremans) produisaient deux encadrés
     identiques MOT POUR MOT : on regroupait alors les ouvertures VOISINES et IDENTIQUES.
     08/11/2026 — ça ne suffisait pas. Sur un devis de quatre volets identiques sauf les coulisses
     du troisième (117 au lieu de 118) et l'ajourage oublié du quatrième, le PDF portait TROIS
     encadrés de quatorze valeurs, presque pareils : 1+2, puis 3 seul, puis 4 seul. Le client (et
     Nicolas) devaient trouver la différence à l'œil — et l'ajourage absent du quatrième, lui, ne
     se voyait PAS DU TOUT : une ligne qui manque dans un encadré ne se remarque jamais.
     Demande de Nicolas : « les encadrés quand il y a plusieurs produits sont très brouillons ».
     D'où, désormais :
       • UN encadré « Configuration commune aux 4 volets » — la valeur la plus fréquente de chaque
         option (à égalité, celle de la première ligne) ;
       • puis « Différences : Volet 3 (Jardin) — Coulisses : 117 », une ligne par ouverture qui
         s'en écarte ; une option ABSENTE là où les autres l'ont se DIT (« Ajourage : non
         précisé ») au lieu de disparaître.
     ⚠️ PLUS SEULEMENT DES VOISINES. L'encadré se pose sous la DERNIÈRE ligne qu'il couvre et le
     DIT dans son intitulé ; une ouverture saisie plus bas n'a plus à se ranger à côté de sa
     jumelle pour partager son encadré.
     ⚠️ AU-DELÀ DE TROIS ÉCARTS, CE N'EST PLUS UNE VARIANTE (`SEUIL_ECARTS`) : un volet qui
     diffère de la première ouverture du groupe sur plus de trois options a son PROPRE encadré.
     Sinon deux produits différents (alu et PVC, solaire et filaire) se liraient comme une
     « configuration commune » suivie d'une liste plus longue que l'encadré lui-même.
     ⚠️ Un TYPE par encadré : un screen et un volet ne se comparent pas.
     ⚠️ LA COMPARAISON PORTE TOUJOURS SUR LE RÉSUMÉ AFFICHÉ (niveau client), pas sur l'objet :
     deux ouvertures qui ne diffèrent que par le perçage ou les rivets (`client: false`)
     présentent le même encadré et n'ont aucune « différence » à montrer. Ni les dimensions ni
     le prix : ils vivent sur la ligne de produit. Et jamais une référence Harol (règle 31). */
  const SEUIL_ECARTS = 3;

  function signature(x) { return x ? (x.coche ? 'c|' + x.l : 'v|' + x.l + '|' + x.v) : ''; }
  function parCle(lignes) {
    const m = {};
    (lignes || []).forEach(function (x) { m[x.k] = x; });
    return m;
  }
  function distanceResumes(a, b) {
    const cles = Object.keys(a).concat(Object.keys(b).filter(function (k) { return !(k in a); }));
    return cles.filter(function (k) { return signature(a[k]) !== signature(b[k]); }).length;
  }
  function typeDe(it) { return it && it.type === 'volet' ? 'volet_roulant' : (it && it.type); }

  /* Le mot de l'écart quand l'option MANQUE ici et que les autres l'ont. Une case : « Sans
     moustiquaire » (`lSans` dans la spec quand le libellé ne s'y prête pas — « Sans commande
     murale Somfy individuelle incluse » ne veut rien dire). Une valeur tue d'office (`muets`,
     « Combinaison : Simple ») : on la redonne, c'est une vraie différence. Sinon : « non précisé ». */
  function ecartAbsent(champ, item, xRef) {
    if (xRef.coche) {
      const sans = champ.lSans || ('Sans ' + String(champ.lCourt || champ.l).charAt(0).toLowerCase() + String(champ.lCourt || champ.l).slice(1));
      return { k: champ.k, g: champ.g, l: sans, v: '', coche: true };
    }
    const brut = item[champ.k];
    if (brut !== undefined && brut !== null && brut !== '') {
      return { k: champ.k, g: champ.g, l: xRef.l, v: sansCodeMenu(valeurAffichable(champ, item)), coche: false };
    }
    return { k: champ.k, g: champ.g, l: xRef.l, v: 'non précisé', coche: false, vide: true };
  }

  function construireGroupe(membres) {
    const p = P();
    const ordre = p ? p.VR_CHAMPS.map(function (c) { return c.k; }) : [];
    const cles = [];
    membres.forEach(function (m) { m.res.forEach(function (x) { if (cles.indexOf(x.k) < 0) cles.push(x.k); }); });
    cles.sort(function (a, b) { return ordre.indexOf(a) - ordre.indexOf(b); });
    const commun = [];
    const ecarts = membres.map(function (m) { return { i: m.i, bouts: [] }; });
    cles.forEach(function (k) {
      const sigs = membres.map(function (m) { return signature(m.map[k]); });
      const compte = {};
      sigs.forEach(function (s) { compte[s] = (compte[s] || 0) + 1; });
      const ref = sigs.reduce(function (a, s) { return compte[s] > compte[a] ? s : a; }, sigs[0]);
      const porteur = membres.filter(function (m, j) { return sigs[j] === ref && m.map[k]; })[0];
      const xRef = porteur ? porteur.map[k] : null;
      if (xRef) commun.push(xRef);
      membres.forEach(function (m, j) {
        if (sigs[j] === ref) return;
        const x = m.map[k];
        if (x) { ecarts[j].bouts.push(x); return; }
        // Absente ici : seulement si l'option a un SENS sur cette ouverture (un espace
        // intermédiaire n'existe pas sur une combinaison simple — la combinaison diffère déjà).
        const champ = p && p.vrChamps(m.it).filter(function (c) { return c.k === k; })[0];
        if (champ && xRef) ecarts[j].bouts.push(ecartAbsent(champ, m.it, xRef));
      });
    });
    return {
      indices: membres.map(function (m) { return m.i; }),
      resume: commun,
      ecarts: ecarts.filter(function (e) { return e.bouts.length; }),
    };
  }

  /**
   * @returns {Array} un groupe par encadré à rendre, dans l'ordre de leur première ligne :
   *   `{ indices: [0, 1, 2, 3], resume: [ce qui est commun], ecarts: [{ i: 2, bouts: [{ l, v }] }] }`
   *   — `indices` est 0-basé sur `items` ; l'encadré se pose sous la DERNIÈRE de ses lignes.
   * Une ouverture sans rien à décrire (screen, tablier) n'est dans AUCUN groupe.
   */
  function groupesConfig(items, niveau) {
    const decrits = [];
    (items || []).forEach(function (it, i) {
      const l = resume(it, niveau || 'client');
      if (l.length) decrits.push({ i: i, it: it, type: typeDe(it), res: l, map: parCle(l) });
    });
    const groupes = [];
    let reste = decrits;
    while (reste.length) {
      const graine = reste[0];
      const membres = reste.filter(function (d) {
        return d === graine || (d.type === graine.type && distanceResumes(d.map, graine.map) <= SEUIL_ECARTS);
      });
      reste = reste.filter(function (d) { return membres.indexOf(d) < 0; });
      groupes.push(construireGroupe(membres));
    }
    return groupes;
  }

  /**
   * Comment l'encadré d'un groupe se nomme. Vide pour une seule ouverture : écrire
   * « ouverture 1 » sous la ligne 1 n'apprend rien et alourdit la seule chose qu'on lit.
   */
  /* ⚠️ L'INTITULÉ NOMME CE QU'ON ACHÈTE, PAS LES NUMÉROS DE LIGNE. Demande de Nicolas,
     11/10/2026, sur un PDF réel : « “ Configuration retenue — ouvertures 1 et 2 ” devrait
     devenir “ Configuration retenue — 4 volets ” ». Il a raison, et c'est une question de
     POINT DE VUE : « ouvertures 1 et 2 » désigne des lignes d'un tableau — une notion
     d'ERP — alors que le client, lui, compte des volets. Et le compte n'est pas le même : deux
     lignes de quantités 1 et 3, ça fait QUATRE volets, ce que l'ancien intitulé ne disait nulle
     part.
     ⚠️ LA QUANTITÉ SE LIT COMME LA LIGNE LA LIT (`quantite || 1`), et surtout PAS avec
     `SSRemu.quantiteDe` : celle-là est la règle de l'ARGENT (un zéro écrit vaut zéro, un
     négatif vaut zéro). Ici on écrit un intitulé qui doit s'accorder au chiffre affiché dans la
     colonne « Qté » juste au-dessus ; deux règles différentes, et l'encadré contredirait le
     tableau.
     ⚠️ TROIS REPLIS VERS L'ANCIEN INTITULÉ, et aucun n'est de la prudence gratuite : sans les
     ouvertures (appel historique à un seul argument), avec des TYPES MÉLANGÉS dans un même
     groupe, ou sans `SSUI` chargé — dans ces trois cas on ne peut pas nommer le produit
     honnêtement, et un intitulé faux est pire qu'un intitulé technique.
     ⚠️ LE VOCABULAIRE VIENT DE `SSUI.TYPE_FORMES` (règle 10), jamais d'une table locale : les
     noms de types ont déjà vécu en treize copies, et elles avaient divergé. */
  function titreLignes(indices) {
    const n = (indices || []).length;
    if (n < 2) return '';
    const a = indices[0] + 1, b = indices[n - 1] + 1;
    return n === 2 ? 'ouvertures ' + a + ' et ' + b : 'ouvertures ' + a + ' à ' + b;
  }
  function titreGroupe(indices, items) {
    const idx = indices || [];
    if (idx.length < 2) return '';            // un encadré seul ne se nomme pas : voir plus bas
    const lot = idx.map(function (i) { return (items || [])[i]; }).filter(Boolean);
    if (lot.length !== idx.length) return titreLignes(idx);
    const types = lot.map(function (it) { return it.type; }).filter(Boolean);
    const unSeulType = types.length === lot.length && types.every(function (t) { return t === types[0]; });
    const formes = window.SSUI && window.SSUI.TYPE_FORMES && window.SSUI.TYPE_FORMES[types[0]];
    if (!unSeulType || !formes) return titreLignes(idx);
    const total = lot.reduce(function (s, it) { return s + (Number(it.quantite) || 1); }, 0);
    return total + ' ' + (total > 1 ? formes[1] : formes[0]).toLowerCase();
  }

  /** Comment une ligne se désigne dans « Différences » : « Volet 3 (Jardin) ». Le numéro est
   *  celui de la colonne # du devis ; le produit, celui que le client compte (règle 31 septies) ;
   *  l'emplacement, ce qui fait reconnaître SA fenêtre. Quantité > 1 : « Volets 3 (Jardin, ×2) ». */
  function nomLigne(i, items) {
    const it = (items || [])[i] || {};
    const formes = window.SSUI && window.SSUI.TYPE_FORMES && window.SSUI.TYPE_FORMES[it.type];
    const q = Number(it.quantite) || 1;
    const mot = formes ? formes[q > 1 ? 1 : 0] : (q > 1 ? 'Ouvertures' : 'Ouverture');
    const precis = [String(it.emplacement == null ? '' : it.emplacement).trim(), q > 1 ? '×' + q : ''].filter(Boolean).join(', ');
    return mot + ' ' + (i + 1) + (precis ? ' (' + precis + ')' : '');
  }

  /** L'intitulé d'un encadré. Seul : « Configuration retenue » (il est sous SA ligne). Seul
   *  groupe du devis : « … commune aux 4 volets ». Plusieurs groupes : il nomme ses lignes,
   *  sinon on ne saurait pas lesquels des volets il couvre (« … aux volets 1, 2 et 4 »). */
  function titreEncadre(g, groupes, items) {
    const idx = (g && g.indices) || [];
    if (idx.length < 2) return 'Configuration retenue';
    if ((groupes || []).length <= 1) return 'Configuration commune aux ' + titreGroupe(idx, items);
    const it = (items || [])[idx[0]] || {};
    const formes = window.SSUI && window.SSUI.TYPE_FORMES && window.SSUI.TYPE_FORMES[it.type];
    const n = idx.map(function (i) { return i + 1; });
    const liste = n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1];
    return 'Configuration commune aux ' + (formes ? formes[1].toLowerCase() : 'ouvertures') + ' ' + liste;
  }

  function pairesHtml(lignes) {
    return (lignes || []).map(function (x) {
      return x.coche
        ? '<span class="spec-box-i spec-box-f">' + esc(x.l) + '</span>'
        : '<span class="spec-box-i' + (x.vide ? ' spec-box-vide' : '') + '"><b>' + esc(x.l) + '</b>' + esc(x.v) + '</span>';
    }).join('');
  }

  /**
   * L'ENCADRÉ, en HTML — écrit ICI et nulle part ailleurs : `app/devis.html` et
   * `devis-review.html` le posaient chacun avec sa copie du gabarit, et c'est le MÊME client
   * qui lit les deux (règle 7). La page n'écrit plus que la ligne de tableau qui l'accueille.
   */
  function encadreHtml(g, groupes, items) {
    if (!g || (!(g.resume || []).length && !(g.ecarts || []).length)) return '';
    const diffs = (g.ecarts || []).length
      ? '<div class="spec-box-d"><div class="spec-box-t">Différences</div>' + g.ecarts.map(function (e) {
          return '<div class="spec-box-dl"><span class="spec-box-qui">' + esc(nomLigne(e.i, items)) + '</span>' + pairesHtml(e.bouts) + '</div>';
        }).join('') + '</div>'
      : '';
    return '<div class="spec-box"><div class="spec-box-t">' + esc(titreEncadre(g, groupes, items)) + '</div>' +
      '<div class="spec-box-l">' + pairesHtml(g.resume) + '</div>' + diffs + '</div>';
  }

  window.SSVolet = {
    estVolet: estVolet,
    html: html,
    rafraichir: rafraichir,
    resume: resume,
    resumeTexte: resumeTexte,
    groupesConfig: groupesConfig,
    SEUIL_ECARTS: SEUIL_ECARTS,
    titreGroupe: titreGroupe,
    titreEncadre: titreEncadre,
    nomLigne: nomLigne,
    encadreHtml: encadreHtml,
    LIES_AU_RAL: LIES_AU_RAL,
    normaliserRal: normaliserRal,
    appliquerRal: appliquerRal,
    valeurAffichable: valeurAffichable,
    sansCodeMenu: sansCodeMenu,
  };
})();
