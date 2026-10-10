// ═══════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — THÈMES (window.SSTheme)
// Script classique (compatible double-clic file://), chargé dans le <head> de chaque page.
//
// LA TABLE `THEMES` EST LA SOURCE UNIQUE. Le sélecteur des Paramètres, le bouton lune/soleil
// du bandeau, les décors de fête et la suite de tests la lisent tous. Ajouter un thème, c'est
// ajouter UNE entrée ici et son bloc de variables dans une feuille `theme-<id>.css`.
//
// ⚠️ UN THÈME N'EST PAS QU'UNE AFFAIRE DE GOÛT. Dans cet ERP la couleur PORTE DU SENS : le
// liseré d'une ligne dit l'ACTION à faire, la pastille dit le CLIENT, le badge dit le STATUT.
// Un thème dont les teintes se ressemblent trop ferait lire un devis perdu comme un devis
// gagné. D'où `tests/themes.test.html`, qui mesure pour CHAQUE thème de cette table le
// contraste des textes et l'écart entre les familles d'action. Un thème qui n'y passe pas ne
// se publie pas — même s'il est beau.
//
// `clair: true` ne décrit pas une préférence, c'est une INFORMATION TECHNIQUE : elle dit sur
// quel fond le thème pose son contenu. Les décors de fête s'en servent pour choisir leurs
// teintes, et le bouton lune/soleil pour savoir dans quelle famille basculer.
//
// ── TROIS NIVEAUX, ET L'ORDRE EST TOUT : APPAREIL → SOCIÉTÉ → SYSTÈME ─────────────────────
// 1. le thème que CET APPAREIL a choisi, s'il en a choisi un ;
// 2. sinon le DÉFAUT DE LA SOCIÉTÉ (`affichage.theme_defaut`), décidé au serveur ;
// 3. sinon `prefers-color-scheme`, pour qu'un appareil jamais configuré soit quand même juste.
// Même motif que `signal.js` (règle 36) : un DÉFAUT n'est pas une CONSIGNE. Yannick décide le
// style de la maison, et l'écran de Nicolas ne change pas au milieu d'un devis pour autant.
//
// ⚠️ CE FICHIER LIT `localStorage['ss_reglages']` À LA MAIN, SANS PASSER PAR `SSConf`, et ce
// n'est pas une négligence — c'est la seule façon de faire. Il est chargé dans le `<head>`
// pour éviter le clignotement de thème au chargement, donc AVANT `config.js` : `window.SSConf`
// n'existe pas encore quand `getTheme()` s'exécute. Appliquer le défaut après coup ferait
// clignoter le thème sur CHAQUE page, ce qui est pire que pas de défaut du tout.
// Et douze pages chargent `theme.js` SANS charger `config.js` (devis, facture, picking,
// portfolio, index…) : sans cette lecture directe, le style de la maison ne s'appliquerait
// qu'à la moitié de l'ERP.
// ⚠️ LE PRIX DE CE RACCOURCI EST UN COUPLAGE PAR LE NOM DE LA CLÉ. `CLE_REGLAGES` ci-dessous
// et `CLE_CACHE` dans `config.js` DOIVENT rester identiques. Renommer l'une sans l'autre ne
// casse rien de visible : le thème retomberait simplement sur le système, en silence — exactement
// le défaut qu'on vient de corriger. Les deux fichiers portent donc l'avertissement.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function () {
  const CLE = 'ss_theme';
  const CLE_CLAIR = 'ss_theme_clair';     // dernier thème CLAIR choisi
  const CLE_SOMBRE = 'ss_theme_sombre';   // dernier thème SOMBRE choisi
  const CLE_REGLAGES = 'ss_reglages';     // ⚠️ MÊME CLÉ que `CLE_CACHE` dans config.js

  const THEMES = [
    { id: 'dark',  nom: 'Néon', clair: false,
      aide: 'Sombre, bleu et or — l’identité SolariScreen.' },
    { id: 'light', nom: 'Pro', clair: true,
      aide: 'Clair et sobre, lisible en plein jour.' },
    { id: 'cyberpunk', nom: 'Cyberpunk', clair: false,
      aide: 'Cyan et magenta sur noir violacé. Le plus contrasté des cinq.' },
    { id: 'ardoise', nom: 'Ardoise', clair: false,
      aide: 'Sombre et désaturé, sans halo ni scanline — pour le soir.' },
    { id: 'zen', nom: 'Zen', clair: true,
      aide: 'Blanc cassé chaud et teal profond. Rien ne hausse la voix.' },
  ];

  /* LES FAMILLES — ce que `affichage.theme_defaut` peut valoir, et rien d'autre.
     ⚠️ UNE FAMILLE N'EST PAS UN IDENTIFIANT DE THÈME, et c'est tout l'intérêt : la société
     décide « clair » ou « sombre », pas « zen ». Un défaut qui nommerait un thème précis
     deviendrait faux le jour où ce thème quitte la table, et il imposerait un GOÛT là où il ne
     s'agit que de lisibilité. La famille se résout en thème par la table ci-dessus, jamais par
     une liste recopiée (règle 29). */
  const FAMILLES = [
    { id: 'systeme', nom: 'Comme le système' },
    { id: 'clair', nom: 'Clair' },
    { id: 'sombre', nom: 'Sombre' },
  ];
  const FAMILLE_DEFAUT = 'systeme';

  /* ⚠️ VOLONTAIREMENT HORS DE `THEMES` ET DE `FAMILLES` : `SUIVRE` ne désigne aucun thème, il
     désigne l'ABSENCE de choix sur cet appareil. L'inscrire dans `THEMES` en ferait une valeur
     enregistrable, donc un appareil pourrait porter le thème « societe », qui n'a aucune
     feuille `theme-societe.css` — et la page garderait les variables du thème précédent, sans
     la moindre erreur. Même raison que le `SUIVRE` de `signal.js`. */
  const SUIVRE = 'societe';

  const IDS = THEMES.map(function (t) { return t.id; });
  const parId = function (id) { return THEMES.find(function (t) { return t.id === id; }) || null; };
  const clairs = function () { return THEMES.filter(function (t) { return t.clair; }); };
  const sombres = function () { return THEMES.filter(function (t) { return !t.clair; }); };
  const nomDe = function (id) { const t = parId(id); return t ? t.nom : id; };

  function lire(cle, defaut) {
    try { const v = localStorage.getItem(cle); return IDS.indexOf(v) !== -1 ? v : defaut; }
    catch (e) { return defaut; }
  }

  /** Le premier thème de la famille demandée. Le repli sur `THEMES[0]` couvre le jour où une
   *  famille se retrouverait vide : mieux vaut un thème de l'autre famille que pas de thème. */
  function premierDe(versClair) {
    const famille = versClair ? clairs() : sombres();
    return (famille[0] || THEMES[0]).id;
  }

  /** Ce que cet appareil préfère, d'après son système. */
  function prefereClair() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }

  /** La FAMILLE décidée par la société, lue dans le cache des réglages — synchrone, donc
   *  disponible dans le `<head>`. Une valeur inconnue ou abîmée retombe sur « système » : un
   *  réglage mal écrit ne doit pas laisser l'ERP sans thème. */
  function familleSociete() {
    try {
      const c = JSON.parse(localStorage.getItem(CLE_REGLAGES) || 'null');
      const v = c && c.affichage ? c.affichage.theme_defaut : null;
      return FAMILLES.some(function (f) { return f.id === v; }) ? v : FAMILLE_DEFAUT;
    } catch (e) { return FAMILLE_DEFAUT; }
  }

  /** Le THÈME que le défaut de la société désigne sur CET appareil. */
  function themeSociete() {
    const f = familleSociete();
    if (f === 'clair') return premierDe(true);
    if (f === 'sombre') return premierDe(false);
    return premierDe(prefereClair());        // « système »
  }

  /** Cet appareil a-t-il un thème à lui, ou suit-il la société ? */
  function suitLaSociete() { return !lire(CLE, null); }

  function getTheme() { return lire(CLE, null) || themeSociete(); }

  /**
   * Pose le thème sur le document.
   * @param retenir  `false` pour une application AUTOMATIQUE (premier rendu, arrivée des
   *                 réglages) : elle n'enregistre RIEN.
   *
   * ⚠️ NE RIEN ENREGISTRER QUAND PERSONNE N'A CHOISI EST LA MOITIÉ DU CORRECTIF, et c'était le
   * défaut le plus coûteux de ce fichier. L'application automatique de fin de fichier passait
   * par ce même chemin et écrivait `ss_theme` : au PREMIER affichage de n'importe quelle page,
   * un appareil se retrouvait donc avec un thème « choisi » qu'il n'avait jamais choisi. Deux
   * conséquences, mesurées le 10/10/2026 :
   *   • aucun défaut de société ne pouvait plus s'appliquer — il était masqué dès la 2ᵉ page ;
   *   • `prefers-color-scheme` n'était consulté qu'UNE fois dans la vie d'un navigateur :
   *     passer son système en sombre après la première visite ne changeait plus rien.
   * C'est pour ça que `theme_defaut` était « impossible à brancher » : ce n'était pas seulement
   * l'ordre de chargement, c'était qu'AFFICHER UNE PAGE VALAIT CHOIX.
   */
  function applyTheme(theme, retenir) {
    const t = parId(theme) || parId(THEMES[0].id);
    document.documentElement.setAttribute('data-theme', t.id);
    if (retenir !== false) {
      try {
        localStorage.setItem(CLE, t.id);
        // On retient le dernier choix DE CHAQUE FAMILLE : c'est ce qui permet au bouton
        // lune/soleil de rester un aller-retour d'un clic même avec dix thèmes.
        localStorage.setItem(t.clair ? CLE_CLAIR : CLE_SOMBRE, t.id);
      } catch (e) {}
    }
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      const vise = b.dataset.themeBtn === 'light';
      b.setAttribute('aria-pressed', vise === t.clair ? 'true' : 'false');
    });
    /* Un sélecteur qui porte l'option « Comme la société » doit rester DESSUS tant que
       l'appareil n'a rien choisi : le remettre sur le thème résolu ferait croire que ce
       thème-là a été choisi, et le geste du retour paraîtrait déjà fait. */
    const suit = suitLaSociete();
    document.querySelectorAll('[data-theme-select]').forEach(function (s) {
      const aLOption = !!s.querySelector('option[value="' + SUIVRE + '"]');
      s.value = (suit && aLOption) ? SUIVRE : t.id;
    });
    return t.id;
  }

  /**
   * Le réglage de CET APPAREIL, depuis le sélecteur des Paramètres.
   * ⚠️ `SUIVRE` n'est pas une valeur, c'est un RETRAIT : il efface la préférence locale pour que
   * l'appareil reparte sur le défaut de la société. Sans ce chemin, un appareil qui a choisi une
   * fois ne pourrait plus JAMAIS revenir au réglage commun — et comme le simple fait d'afficher
   * une page valait choix (voir `applyTheme`), ça voulait dire : plus jamais, pour tout le monde.
   */
  function regler(id) {
    if (id === SUIVRE) {
      try { localStorage.removeItem(CLE); } catch (e) {}
      return applyTheme(themeSociete(), false);
    }
    return applyTheme(id);
  }

  /**
   * Réaligne cet appareil sur le défaut de la société. Appelé quand les réglages viennent
   * d'arriver ou d'être enregistrés — `config.js` le fait après chaque écriture de son cache.
   * ⚠️ DEUX GARDES, ET LES DEUX COMPTENT :
   *   • on ne touche pas à un appareil QUI A CHOISI : sinon on écraserait son choix une seconde
   *     après l'avoir affiché, ce qui est exactement le clignotement qu'on fuit ;
   *   • on ne repose rien si la valeur effective ne CHANGE PAS — un appareil déjà juste, le cas
   *     de tous les jours puisque le cache est déjà là, ne doit pas clignoter pour rien.
   * @returns {?string} le thème reposé, ou `null` si on n'a touché à rien.
   */
  function suivreLaSociete() {
    if (!suitLaSociete()) return null;
    const vise = themeSociete();
    if (vise === document.documentElement.getAttribute('data-theme')) return null;
    return applyTheme(vise, false);
  }

  /* Bascule CLAIR ↔ SOMBRE, en revenant sur le dernier thème choisi dans la famille d'arrivée.
     Avec deux thèmes, c'est exactement l'ancien comportement ; avec dix, le bouton garde son
     sens — il n'essaie pas de faire défiler toute la liste, ce qui serait inutilisable. */
  function familleDefaut(versClair) {
    const memoire = lire(versClair ? CLE_CLAIR : CLE_SOMBRE, null);
    const t = memoire && parId(memoire);
    if (t && t.clair === versClair) return t.id;
    return premierDe(versClair);
  }

  function appliquerFamille(versClair) { return applyTheme(familleDefaut(versClair)); }

  function toggleTheme() {
    const t = parId(getTheme()) || THEMES[0];
    return appliquerFamille(!t.clair);
  }

  // Icônes autonomes (pas de dépendance à ui.js, chargé plus tard)
  var ICO_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICO_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  /* Le bandeau garde DEUX boutons, pas une liste : jour/nuit est le geste qu'on fait vingt fois
     par jour, le choix du thème se fait une fois dans les Paramètres. Les deux boutons visent
     donc une FAMILLE, pas un thème précis.
     ⚠️ Cliquer sur l'un des deux EST un choix d'appareil : il s'enregistre, et l'appareil quitte
     le défaut de la société. C'est voulu — c'est le geste le plus direct qu'on ait pour dire
     « sur CET écran, je veux ça ». Pour revenir au commun, il y a le sélecteur des Paramètres. */
  function mountThemeToggle(container) {
    if (!container) return;
    container.classList.add('theme-toggle');
    container.innerHTML =
      '<button data-theme-btn="dark"  title="Thème sombre" aria-label="Passer au thème sombre" aria-pressed="false">' + ICO_MOON + '</button>' +
      '<button data-theme-btn="light" title="Thème clair"  aria-label="Passer au thème clair"  aria-pressed="false">' + ICO_SUN + '</button>';
    container.querySelectorAll('[data-theme-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () { appliquerFamille(btn.dataset.themeBtn === 'light'); });
    });
    applyTheme(getTheme(), false);     // monter le bandeau n'est pas un choix : on n'enregistre rien
  }

  /* Remplit un <select> avec tous les thèmes et le branche. Posé ici et pas dans la page des
     Paramètres : la liste doit venir de la table, sinon elle se met à diverger au premier
     thème ajouté — c'est exactement ce qui est arrivé aux types de produit (13 copies).
     ⚠️ LA PREMIÈRE OPTION NOMME CE QU'ELLE DONNE : « Comme la société · Pro », pas « Comme la
     société » tout court. Sans le nom, il faut choisir l'option POUR savoir ce qu'elle fait,
     puis revenir en arrière si ça ne plaît pas — or revenir en arrière efface justement la
     préférence qu'on avait. On montre donc la valeur avant de la choisir. */
  function monterSelecteur(select) {
    if (!select) return;
    select.setAttribute('data-theme-select', '');
    select.innerHTML =
      '<option value="' + SUIVRE + '">Comme la société · ' + nomDe(themeSociete()) + '</option>' +
      THEMES.map(function (t) {
        return '<option value="' + t.id + '">' + t.nom + (t.clair ? ' — clair' : ' — sombre') + '</option>';
      }).join('');
    select.value = suitLaSociete() ? SUIVRE : getTheme();
    select.addEventListener('change', function () { regler(select.value); });
  }

  /* Remplit le sélecteur du DÉFAUT DE LA SOCIÉTÉ (réglage serveur, dans Paramètres). Les trois
     familles viennent d'ici, pas de la page : celle-ci les avait recopiées à la main, et rien
     ne vérifiait qu'elles correspondaient encore à ce que ce fichier sait lire.
     Chaque famille dit AUSSI le thème qu'elle donne (« Clair — Pro ») : c'est la seule façon de
     choisir en connaissance de cause sans aller lire la table des thèmes. */
  function monterSelecteurSociete(select) {
    if (!select) return;
    select.innerHTML = FAMILLES.map(function (f) {
      var suffixe = '';
      if (f.id === 'clair') suffixe = ' — ' + nomDe(premierDe(true));
      if (f.id === 'sombre') suffixe = ' — ' + nomDe(premierDe(false));
      return '<option value="' + f.id + '">' + f.nom + suffixe + '</option>';
    }).join('');
  }

  /**
   * À rappeler quand le défaut de la société vient de CHANGER (enregistrement dans Paramètres) :
   * le libellé « Comme la société · … » mentirait sinon, et celui qui vient de décider le style
   * de la maison verrait l'ANCIENNE valeur sur son propre écran — donc croirait que son
   * enregistrement n'a rien fait.
   */
  function rafraichirSelecteur(select) {
    if (select) {
      const premier = select.querySelector('option[value="' + SUIVRE + '"]');
      if (premier) premier.textContent = 'Comme la société · ' + nomDe(themeSociete());
    }
    suivreLaSociete();
    if (select) select.value = suitLaSociete() ? SUIVRE : getTheme();
  }

  window.SSTheme = {
    THEMES: THEMES,
    FAMILLES: FAMILLES,
    SUIVRE: SUIVRE,
    CLE_REGLAGES: CLE_REGLAGES,
    getTheme: getTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    regler: regler,
    familleSociete: familleSociete,
    themeSociete: themeSociete,
    suitLaSociete: suitLaSociete,
    suivreLaSociete: suivreLaSociete,
    mountThemeToggle: mountThemeToggle,
    monterSelecteur: monterSelecteur,
    monterSelecteurSociete: monterSelecteurSociete,
    rafraichirSelecteur: rafraichirSelecteur,
    estClair: function (id) { const t = parId(id || getTheme()); return !!(t && t.clair); },
    idsClairs: function () { return clairs().map(function (t) { return t.id; }); },
  };

  // Appliqué immédiatement pour éviter le flash — et SANS rien enregistrer (voir `applyTheme`).
  applyTheme(getTheme(), false);

  /* ⚠️ LE DÉFAUT DE LA SOCIÉTÉ VIT AU SERVEUR, DONC IL N'EST PAS LÀ AU PREMIER RENDU D'UN
     APPAREIL NEUF. Le cache (`ss_reglages`) le rend disponible instantanément dès la deuxième
     visite ; la toute première fois, il faut bien le demander une fois.
     On ne le demande QUE si le cache n'a jamais reçu de réponse : sur un appareil déjà venu, une
     requête de plus n'apprendrait rien avant le prochain rendu, et sept pages de l'ERP chargent
     `config.js` sans appeler `charger()` elles-mêmes — ce serait sept requêtes gratuites par
     visite. C'est `config.js` qui rappelle `suivreLaSociete()` quand la réponse arrive.
     Le DOMContentLoaded est nécessaire : `config.js` est chargé en fin de page, donc `SSConf`
     n'existe pas encore ici. */
  function premiereDemande() {
    try { if (JSON.parse(localStorage.getItem(CLE_REGLAGES) || 'null')) return; } catch (e) {}
    if (window.SSConf && window.SSConf.charger) window.SSConf.charger().catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', premiereDemande);
  else premiereDemande();
})();
