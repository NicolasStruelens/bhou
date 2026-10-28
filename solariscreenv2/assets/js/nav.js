// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Menu de navigation rapide (présent sur toutes les pages)
// Script classique (file:// OK). Global : window.SSNav
// ═══════════════════════════════════════════════════════════
(function () {
  /* L'adresse de CE script, pour charger ses voisins (attente.js) depuis n'importe quelle page.
     ⚠️ Elle ne se lit que PENDANT l'exécution du script : plus tard, currentScript vaut null. */
  const NAV_SRC = (document.currentScript && document.currentScript.src) || '';
  // Styles injectés ici (pas dans base.css) car nav.js tourne sur des pages qui ne
  // définissent pas toutes ".status-menu" — le popover doit être autonome partout.
  if (!document.getElementById('ssnav-injected-styles')) {
    const style = document.createElement('style');
    style.id = 'ssnav-injected-styles';
    style.textContent = `
      .ssnav-who { margin: 0; line-height: 1; }
      .conn-log { position: fixed; z-index: 5000; display: none; min-width: 300px; max-width: 340px;
        background: var(--surface, #141d3d); border: 1px solid var(--border-strong, #324273);
        border-radius: var(--r-md, 3px); box-shadow: var(--shadow, 0 10px 34px rgba(0,0,0,0.5));
        max-height: 360px; overflow-y: auto; }
      .conn-log.open { display: block; }
      .conn-log-head { padding: 0.6rem 0.9rem; font-family: var(--font-mono, monospace); font-size: 0.68rem;
        text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-subtle, #6675a0);
        border-bottom: 1px solid var(--border, #243056); }
      .conn-log-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem;
        font-size: 0.78rem; border-bottom: 1px solid var(--border, #243056); }
      .conn-log-row:last-child { border-bottom: none; }
      .conn-log-who { font-weight: 700; flex: none; min-width: 58px; color: var(--text, #e9eefb); }
      .conn-log-when { flex: 1; color: var(--text-muted, #97a4cc); font-family: var(--font-mono, monospace); font-size: 0.72rem; }
      .conn-log-dur { flex: none; font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--accent-2, #ffd23f); }
      .conn-log-tout { display: block; padding: 0.55rem 0.9rem; font-size: 0.72rem; text-align: center;
        color: var(--accent, #6ea8ff); border-top: 1px solid var(--border, #233049); text-decoration: none; }
      .conn-log-tout:hover { background: var(--surface-2, #141c2f); }
      /* ── Palette de recherche globale (Ctrl+K) ── */
      .cmdk-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 6000; display: none; align-items: flex-start; justify-content: center; padding: 12vh 1rem 1rem; }
      .cmdk-ov.open { display: flex; }
      .cmdk { width: 560px; max-width: 100%; background: var(--surface,#141d3d); border: 1px solid var(--border-strong,#324273); border-radius: var(--r-md,4px); box-shadow: var(--shadow,0 10px 34px rgba(0,0,0,.5)); overflow: hidden; display: flex; flex-direction: column; max-height: 70vh; }
      .cmdk-input { display: flex; align-items: center; gap: 0.6rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--border,#243056); }
      .cmdk-input svg { color: var(--text-subtle,#6675a0); flex: none; }
      .cmdk-input input { flex: 1; background: none; border: none; outline: none; color: var(--text,#e9eefb); font-size: 1rem; font-family: inherit; }
      .cmdk-kbd { font-family: var(--font-mono, monospace); font-size: 0.6rem; color: var(--text-subtle,#6675a0); border: 1px solid var(--border,#243056); border-radius: 3px; padding: 0.1rem 0.35rem; flex: none; }
      .cmdk-results { overflow-y: auto; padding: 0.35rem; }
      .cmdk-group { font-family: var(--font-mono, monospace); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-subtle,#6675a0); padding: 0.5rem 0.6rem 0.25rem; }
      .cmdk-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border-radius: 3px; cursor: pointer; text-decoration: none; color: var(--text,#e9eefb); }
      .cmdk-item:hover, .cmdk-item.sel { background: color-mix(in srgb, var(--accent,#4d7cff) 16%, transparent); }
      .cmdk-item .ci-ic { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-mono, monospace); font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, var(--accent,#4d7cff) 16%, transparent); color: var(--accent,#4d7cff); }
      .cmdk-item .ci-ic.F { background: color-mix(in srgb, var(--accent-2,#ffd23f) 16%, transparent); color: var(--accent-2,#ffd23f); }
      .cmdk-item .ci-ic.R { background: color-mix(in srgb, var(--accent-3,#a78bfa) 16%, transparent); color: var(--accent-3,#a78bfa); }
      .cmdk-item .ci-ic.E { background: color-mix(in srgb, var(--ok,#34d399) 16%, transparent); color: var(--ok,#34d399); }
      .cmdk-item .ci-t { flex: 1; min-width: 0; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cmdk-item .ci-s { font-size: 0.62rem; color: var(--text-subtle,#6675a0); font-family: var(--font-mono, monospace); flex: none; }
      .cmdk-empty { padding: 1.4rem; text-align: center; color: var(--text-subtle,#6675a0); font-size: 0.85rem; }
      /* ── Menu groupé par métier + badges d'alerte ── */
      .ssnav-group { font-family: var(--font-mono, monospace); font-size: 0.58rem; text-transform: uppercase;
        letter-spacing: 0.09em; color: var(--text-subtle,#6675a0); padding: 0.55rem 0.7rem 0.25rem; }
      .ssnav-group:first-child { padding-top: 0.25rem; }
      .ssnav-sep { height: 1px; background: var(--border,#243056); margin: 0.3rem 0.4rem; }
      .ssnav-count { margin-left: auto; font-family: var(--font-mono, monospace); font-size: 0.6rem; font-weight: 700;
        min-width: 17px; height: 17px; padding: 0 0.28rem; border-radius: 999px; display: inline-flex;
        align-items: center; justify-content: center; background: var(--danger,#ff5e7a); color: #fff; flex: none; }
      .ssnav-count.warn { background: var(--warn,#ffb020); color: #2a1a00; }
      /* Pastille sur le bouton du menu : on voit qu'il se passe quelque chose SANS ouvrir. */
      .ssnav-toggle { position: relative; }
      .ssnav-dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%;
        background: var(--danger,#ff5e7a); box-shadow: 0 0 0 2px var(--surface,#0e1530); }
      @media (prefers-reduced-motion: no-preference) {
        .ssnav-dot { animation: ssnavPulse 2.4s ease-in-out infinite; }
        @keyframes ssnavPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
      }

      /* ── RAIL DE NAVIGATION ──────────────────────────────────────────────────
         Il n'apparaît qu'au-delà de 1400 px : en dessous, le volet déroulant reste le seul menu, et
         sur téléphone rien ne change. AUCUNE branche JS sur la largeur — tout passe par cette media
         query, donc rien ne peut se désynchroniser en redimensionnant la fenêtre.
         Quand le rail est là, le volet déroulant DISPARAÎT : deux navigations côte à côte, ce serait
         exactement le défaut des « deux portes » corrigé ailleurs. */
      .ssrail { display: none; }
      @media (min-width: 1400px) {
        .ssrail { display: flex; flex-direction: column; gap: 2px;
          position: fixed; left: 0; top: 0; bottom: 0; width: 212px; z-index: 90;
          padding: var(--sp-3, 0.75rem) var(--sp-2, 0.5rem);
          background: var(--surface, #0e1530); border-right: 1px solid var(--border, #243056);
          overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
        body { padding-left: 212px; }
        /* Le bandeau est en position: fixed : il ignore le padding-left du body, il faut
           donc le recaler a la main, sinon il recouvre le rail. */
        .app-header { left: 212px; }
        html.ss-rail-reduit .app-header { left: 60px; }
        /* Même chose pour une barre collée en BAS d'écran (la barre du Mode Terrain) : partant de 0, elle
           recouvrait le pied du rail — « Paramètres » et la ligne « qui » ne se cliquaient plus au-delà de
           1400 px (trouvé par l'audit du 28/10/2026). */
        .wiz-bar, [data-barre-bas] { left: 212px; }
        html.ss-rail-reduit .wiz-bar, html.ss-rail-reduit [data-barre-bas] { left: 60px; }
        .ssnav { display: none; }
        html.ss-rail-reduit .ssrail { width: 60px; align-items: stretch; }
        html.ss-rail-reduit body { padding-left: 60px; }
        html.ss-rail-reduit .ssrail-lbl, html.ss-rail-reduit .ssrail-group { display: none; }
        html.ss-rail-reduit .ssrail-item { justify-content: center; padding-left: 0; padding-right: 0; }
        /* Réduit, le compteur se pose en pastille sur l'icône : c'est tout l'intérêt du rail, il
           reste lisible même sans les libellés. */
        html.ss-rail-reduit .ssrail-item .ssnav-count { position: absolute; top: 3px; right: 5px;
          min-width: 15px; padding: 0 3px; font-size: 0.58rem; line-height: 15px; }
        /* Replie, il ne reste que le logo : c'est le seul repere de marque encore visible. */
        html.ss-rail-reduit .ssrail-brand { justify-content: center; padding-left: 0; padding-right: 0; }
        html.ss-rail-reduit .ssrail-kbd, html.ss-rail-reduit .ssrail-chev { display: none; }
        html.ss-rail-reduit .ssrail-top { flex-direction: column; gap: 0.4rem; }
        /* Un conteneur flex en colonne de hauteur fixe ÉCRASE ses enfants au lieu de défiler
           (piège déjà payé sur la fiche devis) : chaque entrée garde sa hauteur, le rail défile. */
        .ssrail > * { flex: none; }
        /* UNE SEULE IDENTITÉ À L'ÉCRAN, comme une seule marque : dès que le rail est là, c'est son
           pied qui dit « Nicolas », et la pastille du bandeau ferait doublon à 1 000 px de là.
           Elle reste au-dessous de 1400 px, où il n'y a pas de rail. */
        .ssnav-who { display: none; }

        /* UNE SEULE MARQUE À L'ÉCRAN. Dès que le rail est là, il porte le logo et le nom — les
           répéter dans le bandeau juste à côté faisait deux fois la même chose à 200 px
           d'intervalle. Le bandeau annonce donc la PAGE, ce qui est son rôle, et récupère au
           passage la place qui manquait à droite (le badge « HORS-LIGNE » passait sur deux
           lignes). Sous 1400 px le rail n'existe pas : la marque reste dans le bandeau,
           inchangée. Aucune branche JS — c'est la même media query qui décide des deux. */
        .brand-logo, .brand h1 { display: none; }
        .brand .module {
          font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 700;
          color: var(--text); letter-spacing: 0.04em; text-transform: uppercase;
        }
      }
      .ssrail-brand { display: flex; align-items: center; gap: 0.5rem;
        padding: 0 0.55rem var(--sp-3, 0.75rem); }
      .ssrail-brand svg { width: 28px; height: 28px; flex: none; box-sizing: border-box;
        padding: 3px; border: 1px solid var(--accent, #4d8bff); border-radius: var(--r-sm, 3px); }
      .ssrail-brand .ssrail-lbl { font-family: var(--font-display, inherit); font-weight: 700;
        color: var(--accent, #4d8bff); letter-spacing: 0.02em; font-size: var(--fs-base, 0.95rem); }
      /* Les deux marques sont des LIENS depuis qu'on peut cliquer dessus pour rentrer. Elles ne
         doivent pas se mettre a ressembler a du texte souligne pour autant. */
      .ssrail-brand, a.brand-logo { text-decoration: none; }
      .ssrail-brand:hover .ssrail-lbl, a.brand-logo:hover { opacity: 0.85; }
      .ssrail-brand:focus-visible, a.brand-logo:focus-visible {
        outline: 2px solid var(--accent, #4d8bff); outline-offset: 2px; }
      .ssrail-item { position: relative; display: flex; align-items: center; gap: 0.6rem;
        padding: 0.38rem 0.55rem; border-radius: var(--r-sm, 3px); text-decoration: none;
        color: var(--text-muted, #97a4cc); font-size: var(--fs-sm, 0.86rem); white-space: nowrap; }
      .ssrail-item:hover { background: color-mix(in srgb, var(--accent, #4d8bff) 10%, transparent);
        color: var(--text, #e9eefb); }
      .ssrail-item.active { background: color-mix(in srgb, var(--accent, #4d8bff) 16%, transparent);
        color: var(--accent, #4d8bff); font-weight: 600; }
      .ssrail-item:focus-visible { outline: 2px solid var(--accent, #4d8bff); outline-offset: -2px; }
      /* Les boutons du rail ont l'allure des liens : ce sont des entrées de menu. */
      button.ssrail-item { border: none; background: none; cursor: pointer; width: 100%;
        text-align: left; font: inherit; font-size: var(--fs-sm, 0.86rem); }
      .ssrail-item svg { flex: none; }
      .ssrail-lbl { overflow: hidden; text-overflow: ellipsis; }
      /* ⚠️ « hidden » NE SUFFIT PAS ICI : la feuille donne « display: flex » à ces éléments, et une
         règle d'auteur l'emporte sur celle du navigateur. Sans cette ligne, la liste « Nouveau »
         serait toujours ouverte et la ligne d'identité visible, vide, même hors connexion. */
      .ssrail [hidden] { display: none !important; }

      /* ── LE BAC À SABLE SE VOIT (DEPLOIEMENT.md, étape 12) ──────────────────────────────────
         Rien ici ne change une taille : la bande pend SOUS le bandeau, en position absolue (une
         bordure changerait sa hauteur, que nav.js mesure et dont toute la page dépend), et la
         pastille vit DANS le libellé de la page, déjà tronqué proprement sur téléphone. La bande
         était d'abord peinte AU FOND du bandeau : elle passait derrière la date du tableau de bord,
         qui descend jusqu'au bord. Sous le bandeau, elle ne touche aucun texte et suit son décalage
         quand le rail est là. Des hachures, pas une teinte : ici chaque couleur dit une ACTION
         (règle 21 bis), un chantier balisé ne se confond avec aucune. */
      html.ss-essai .app-header::after {
        content: ''; position: absolute; left: 0; right: 0; top: 100%; height: 4px; pointer-events: none;
        background: repeating-linear-gradient(-45deg, #e8a400 0 7px, #1b1b1b 7px 14px); }
      html.ss-essai .app-header .brand .module::before {
        content: 'Essai'; display: inline-block; margin-right: 0.5em; padding: 0 0.45em; border-radius: 3px;
        background: #e8a400; color: #1b1b1b; font-family: var(--font-mono, monospace); font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase; }
      .ssrail-group { font-family: var(--font-mono, monospace); font-size: var(--fs-3xs, 0.62rem);
        text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-subtle, #8593bf);
        padding: 0.5rem 0.55rem 0.2rem; }
      /* Chaque pixel de hauteur compte : 2 px de trop suffisent à faire apparaître la barre de
         défilement, qui vole 9 px de LARGEUR et coupe « Outillage & références ». Mesuré à 860 px. */
      .ssrail-top { display: flex; align-items: center; gap: 0.25rem; padding-bottom: 0.5rem; }
      .ssrail-top .ssrail-brand { flex: 1 1 auto; min-width: 0; padding-bottom: 0; }
      /* Icône seule, mais le rail n'existe qu'au-delà de 1400 px, donc devant une souris : l'infobulle
         et le libellé accessible disent ce qu'il fait. L'icône est la convention des panneaux
         latéraux, et non plus une grille qui annonçait l'ouverture d'un menu. */
      .ssrail-toggle { flex: none; display: grid; place-items: center; width: 28px; height: 28px;
        border: none; border-radius: var(--r-sm, 3px); background: none; cursor: pointer;
        color: var(--text-subtle, #8593bf); }
      .ssrail-toggle:hover { color: var(--text, #e9eefb);
        background: color-mix(in srgb, var(--accent, #4d8bff) 10%, transparent); }
      .ssrail-toggle:focus-visible { outline: 2px solid var(--accent, #4d8bff); outline-offset: 1px; }
      .ssrail-kbd { margin-left: auto; font-family: var(--font-mono, monospace); font-size: 0.58rem;
        color: var(--text-subtle, #8593bf); border: 1px solid var(--border, #243056); border-radius: 3px;
        padding: 0.05rem 0.3rem; }
      /* « + Nouveau » est la seule ACTION du rail : c'est donc la seule entrée encadrée. */
      button.ssrail-newbtn { justify-content: center; border: 1px solid var(--border-strong, #324273);
        color: var(--text, #e9eefb); font-weight: 600; margin-bottom: 0.2rem; }
      .ssrail-chev { display: inline-flex; transition: transform 0.15s ease; }
      .ssrail-newbtn[aria-expanded="true"] .ssrail-chev { transform: rotate(180deg); }
      .ssrail-newlist { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--sp-2, 0.5rem); }
      .ssrail-sub { padding-left: 1.7rem; }
      /* Le pied colle en bas quand il y a de la place, et suit le contenu quand le rail défile. */
      .ssrail-foot { margin-top: auto; padding-top: var(--sp-2, 0.5rem);
        border-top: 1px solid var(--border, #243056); display: flex; flex-direction: column; gap: 2px; }
      button.ssrail-who { color: var(--text, #e9eefb); font-weight: 600; }
      .ssrail-ava { width: 20px; height: 20px; flex: none; border-radius: 50%; display: grid; place-items: center;
        font-size: 0.62rem; font-weight: 700; color: var(--text, #e9eefb);
        border: 1px solid var(--ssrail-ava, var(--accent, #4d8bff));
        background: color-mix(in srgb, var(--ssrail-ava, var(--accent, #4d8bff)) 16%, transparent); }
      @media (prefers-reduced-motion: reduce) { .ssrail-chev { transition: none; } }

      /* -- Soli, la mascotte de l'assistant : en bas a droite, sur toutes les pages --
         Au-dessus du bandeau (sinon il la recouvre en haut de page sur telephone), SOUS les
         fenetres modales : une modale ouverte la cache, comme le reste de la page. */
      .ssfab { position: fixed; z-index: calc(var(--z-header, 100) + 5);
        right: max(16px, env(safe-area-inset-right, 0px));
        bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--ssfab-leve, 0px));
        width: 60px; height: 60px; padding: 0; border-radius: 50%; cursor: pointer;
        display: grid; place-items: center;
        border: 1px solid var(--border-strong, #324273); background: var(--surface, #111a33);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28), 0 0 0 4px color-mix(in srgb, #FFC501 20%, transparent);
        transition: transform 0.18s ease, bottom 0.18s ease; }
      .ssfab:hover { transform: translateY(-2px) scale(1.05); }
      .ssfab:focus-visible { outline: 2px solid var(--accent, #4d8bff); outline-offset: 4px; }
      .ssfab .ssm { width: 52px; height: 52px; display: block; }
      .ssm-rayons { transform-origin: 32px 34px; transition: transform 0.6s ease; }
      .ssfab:hover .ssm-rayons { transform: rotate(45deg); }
      .ssm-reflet { animation: ssm-reflet 7s ease-in-out infinite; }
      @keyframes ssm-reflet { 0%, 86%, 100% { opacity: 0.9; } 92% { opacity: 0; } }
      /* -- Soli prend le style du THEME : une palette par theme, en variables. Le dessin ne change
         pas, ses couleurs oui. Pro = la marque (le jaune et le bleu du logo). -- */
      .ssm { --ssm-soleil: #FFC501; --ssm-bord: #E9A400; --ssm-rayons: #FFC501; --ssm-verres: #1F319D;
        --ssm-reflet: #ffffff; --ssm-bouche: #7A3E00; --ssm-joues: #FF7A59; overflow: visible; }
      html[data-theme="dark"] .ssm { --ssm-soleil: #FFD23F; --ssm-bord: #E0A800; --ssm-rayons: #FFD23F; --ssm-verres: #2E5FD8; }
      html[data-theme="cyberpunk"] .ssm { --ssm-soleil: #FFD400; --ssm-bord: #FF4ECD; --ssm-rayons: #FF4ECD; --ssm-verres: #00E5FF;
        --ssm-reflet: #ffffff; --ssm-bouche: #2A0F3D; --ssm-joues: #FF4ECD; filter: drop-shadow(0 0 3px rgba(0, 229, 255, 0.55)); }
      html[data-theme="zen"] .ssm { --ssm-soleil: #EBC86E; --ssm-bord: #C9A227; --ssm-rayons: #E2B95A; --ssm-verres: #0F5F6B;
        --ssm-bouche: #6B4F2A; --ssm-joues: #E8A598; }
      html[data-theme="ardoise"] .ssm { --ssm-soleil: #E8C66A; --ssm-bord: #C9A94F; --ssm-rayons: #E8C66A; --ssm-verres: #2F3A48;
        --ssm-bouche: #5C4320; --ssm-joues: #D98C7C; }
      .ssm-rayons { stroke: var(--ssm-rayons); }
      .ssm-face { fill: var(--ssm-soleil); stroke: var(--ssm-bord); }
      .ssm-verre { fill: var(--ssm-verres); }
      .ssm-pont { stroke: var(--ssm-verres); }
      .ssm-reflet { stroke: var(--ssm-reflet); }
      .ssm-bouche { stroke: var(--ssm-bouche); }
      .ssm-joue { fill: var(--ssm-joues); }
      /* Un accessoire de fete couvre le rayon du haut : il s'efface. */
      .ssm.accessoire .ssm-r0 { display: none; }
      /* Soli reflechit (l'assistant travaille) : les rayons tournent doucement ; il saute quand la
         reponse arrive. */
      .ssm-pense .ssm-rayons { animation: ssm-tourne 2.4s linear infinite; }
      @keyframes ssm-tourne { to { transform: rotate(360deg); } }
      .ssm-saut { animation: ssm-saut 0.55s cubic-bezier(.3, 1.6, .5, 1); transform-origin: 50% 90%; }
      @keyframes ssm-saut { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-4px) scale(1.06, 0.96); } 100% { transform: none; } }
      .ssfab[aria-expanded="false"]:hover { box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3), 0 0 0 6px color-mix(in srgb, var(--ssm-anneau, #FFC501) 26%, transparent); }
      html[data-theme="cyberpunk"] .ssfab { --ssm-anneau: #00E5FF; }
      html[data-theme="zen"] .ssfab { --ssm-anneau: #0F5F6B; }
      .ssfab-x { position: absolute; top: -4px; right: -4px; width: 22px; height: 22px; border-radius: 50%;
        display: grid; place-items: center; background: var(--text, #e9eefb); color: var(--bg, #0b1021);
        opacity: 0; transform: scale(0.6); pointer-events: none; transition: opacity 0.15s ease, transform 0.15s ease; }
      .ssfab[aria-expanded="true"] .ssfab-x { opacity: 1; transform: none; }
      @media (max-width: 640px) {
        .ssfab { width: 56px; height: 56px; }
        .ssfab .ssm { width: 48px; height: 48px; }
        html.ssa-ouvert .ssfab { visibility: hidden; }
      }
      @media print { .ssfab { display: none !important; } }
      @media (prefers-reduced-motion: reduce) {
        .ssfab, .ssm-rayons { transition: none; } .ssm-reflet, .ssm-pense .ssm-rayons, .ssm-saut { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════ LE MENU : « LE FIL DE L'AFFAIRE » (choisi par Nicolas le 25/10/2026) ══════
     Les groupes suivent la vie d'un dossier : on le décroche (Affaires), on le pose (Chantiers),
     on le suit (Après-vente), on l'encaisse (Argent) — et l'Équipe à part, parce qu'un échange
     ne concerne pas forcément un dossier. Chaque compteur se retrouve donc là où se fait le
     travail qu'il réclame.
     ⚠️ TROIS SORTES D'ENTRÉES, ET C'EST VOULU :
     • la MAISON (le tableau de bord) : hors des groupes, en tête. C'était la 13e ligne du menu,
       sous « Gestion », alors que c'est la page d'où l'on part et où l'on revient ;
     • les ACTIONS (« + Nouveau ») : créer un devis, un dépannage, une demande. Ce ne sont pas
       des endroits où aller, elles ne s'allument donc jamais comme page en cours ;
     • les RÉGLAGES, au pied du rail avec l'identité : on y va une fois par mois, ils n'ont pas
       leur place au milieu des outils du jour.
     ⚠️ UNE SEULE DESCRIPTION pour le rail ET le volet déroulant : deux listes finiraient par
     diverger, et le menu dirait deux choses selon la largeur de l'écran.
     `badge` = clé de compteur d'alerte (voir computeBadges). */
  const NAV_ACCUEIL = { href: 'dashboard.html', label: 'Tableau de bord', icon: 'grid' };
  const NAV_CREER = [
    { href: 'simulateur.html', label: 'Devis', titre: 'Nouveau devis', icon: 'calculator' },
    // Le dépannage est le même écran que le devis, ouvert directement sur le bon type de document.
    { href: 'simulateur.html?type=depannage', label: 'Dépannage', titre: 'Nouveau dépannage', icon: 'wrench' },
    { href: 'rdv.html?nouvelle=1', label: 'Demande de RDV', titre: 'Nouvelle demande de RDV', icon: 'bellphone' },
  ];
  const NAV_GROUPS = [
    { title: 'Affaires', pages: [
      { href: 'rdv.html', label: 'Demandes de RDV', icon: 'bellphone', badge: 'rdv' },
      { href: 'clients.html', label: 'Clients', icon: 'users' },
      // Le Mode Terrain sert à établir le devis CHEZ le client : c'est de la vente, pas du chantier.
      { href: 'terrain.html', label: 'Mode Terrain', icon: 'phone' },
    ] },
    { title: 'Chantiers', pages: [
      { href: 'planning.html', label: 'Planning', icon: 'calendar' },
      { href: 'carte.html', label: 'Carte des chantiers', icon: 'pin' },
      { href: 'portfolio.html', label: 'Portfolio', icon: 'image' },
    ] },
    { title: 'Après-vente', pages: [
      { href: 'sav.html', label: 'SAV', icon: 'warning', badge: 'sav' },
      { href: 'outillage.html', label: 'Outillage & références', icon: 'hammer' },
    ] },
    { title: 'Argent', pages: [
      { href: 'factures.html', label: 'Facturation', icon: 'filetext', badge: 'factures' },
      // Les tickets de frais avancés. Le compteur EST la raison d'être de l'outil : « c'est une
      // sécurité pour moi de pouvoir être remboursé et ne pas tomber dans l'oubli » (Nicolas).
      // ⚠️ Il reste un outil à part (ni statistiques, ni rémunération) : le menu compte, il
      // n'intègre pas.
      { href: 'depenses.html', label: 'Notes de frais', icon: 'receipt', badge: 'depenses' },
      { href: 'stats.html', label: 'Statistiques', icon: 'sliders' },
    ] },
    { title: 'Équipe', pages: [
      // Le fil interne entre Nicolas et Yannick, y compris pour ce qui ne touche aucun dossier.
      { href: 'echanges.html', label: 'Échanges', icon: 'message', badge: 'echanges' },
    ] },
  ];
  const NAV_REGLAGES = { href: 'parametres.html', label: 'Paramètres', icon: 'settings' };
  // Les clés que computeBadges DOIT produire : un test vérifie que chaque compteur du menu en a une.
  const BADGE_KEYS = ['rdv', 'sav', 'factures', 'echanges', 'depenses'];

  /* ══════ QUELLE PAGE EST « EN COURS » ? ══════
     ⚠️ L'ANCIEN TEST NE MARCHAIT QU'EN LOCAL. Il comparait la fin de l'adresse à « echanges.html »,
     or Cloudflare sert les pages SANS l'extension (« …/app/echanges »). En production, aucune
     entrée ne s'allumait JAMAIS — et en local, où le serveur de test garde le « .html », tout
     avait l'air de marcher. D'où une clé de page NORMALISÉE des deux côtés : sans extension,
     sans paramètres, sans barre finale.
     ⚠️ Une page qui n'est pas dans le menu s'oriente sur sa page MÈRE : la fiche d'un devis (et
     son document, et son éditeur) appartient au tableau de bord, la fiche d'une facture à la
     Facturation. Sans ça, sur la page qu'on consulte le plus, le menu ne dit pas où l'on est. */
  const PAGE_MERE = { vue: 'dashboard', devis: 'dashboard', simulateur: 'dashboard', facture: 'factures' };
  function pageKey(adresse) {
    let p = String(adresse || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
    p = p.slice(p.lastIndexOf('/') + 1).replace(/\.html?$/i, '').toLowerCase();
    return p || 'index';
  }
  function pageCourante(chemin) {
    const k = pageKey(chemin == null ? location.pathname : chemin);
    return PAGE_MERE[k] || k;
  }
  function estActive(href, courante) { return pageKey(href) === courante; }

  /* ══════ LE CALCUL COMMUN DE « CE QUI T'ATTEND », CHARGÉ À LA DEMANDE ══════
     ⚠️ Le compteur « Échanges » n'avait pas la même valeur selon la page. Sur les 5 pages qui
     chargent attente.js, il comptait tout ce qui t'attend (demandes, SAV, sujets) ; sur les 16
     autres, seulement les sujets. Nicolas a vu 3 sur une page et 2 sur une autre, le même jour.
     Plutôt que d'ajouter une balise à 16 pages (et d'oublier la 17e), le menu va chercher le
     calcul lui-même, une fois. S'il n'y arrive pas, il n'affiche RIEN plutôt qu'un chiffre qui
     voudrait dire autre chose. */
  let attentePromise = null;
  function chargerAttente() {
    if (window.SSAttente) return Promise.resolve(window.SSAttente);
    if (attentePromise) return attentePromise;
    attentePromise = new Promise(function (resolve) {
      const m = NAV_SRC.match(/^(.*\/)nav\.js(?:[?#].*)?$/);
      // Sans adresse reconnaissable, on ne devine pas : recharger nav.js lui-même par erreur
      // monterait un deuxième menu.
      if (!m) { resolve(null); return; }
      const sc = document.createElement('script');
      sc.src = m[1] + 'attente.js';
      sc.onload = function () { resolve(window.SSAttente || null); };
      sc.onerror = function () { resolve(null); };
      document.head.appendChild(sc);
    });
    return attentePromise;
  }

  /* ══════ L'ASSISTANT (assets/js/assistant.js), CHARGÉ AU PREMIER CLIC ══════
     Même principe qu'attente.js : une balise de moins sur 21 pages, et rien à télécharger tant
     qu'on ne s'en sert pas. Une conversation ouverte SUIT l'onglet : la page suivante rouvre le
     panneau tout de suite (sessionStorage), sinon chaque lien suivi depuis l'assistant le fermerait. */
  let assistantPromise = null;
  function chargerAssistant() {
    if (window.SSAssistant) return Promise.resolve(window.SSAssistant);
    if (assistantPromise) return assistantPromise;
    assistantPromise = new Promise(function (resolve) {
      const m = NAV_SRC.match(/^(.*\/)nav\.js(?:[?#].*)?$/);
      if (!m) { resolve(null); return; }
      const sc = document.createElement('script');
      sc.src = m[1] + 'assistant.js';
      sc.onload = function () { resolve(window.SSAssistant || null); };
      sc.onerror = function () { assistantPromise = null; resolve(null); };
      document.head.appendChild(sc);
    });
    return assistantPromise;
  }
  function ouvrirAssistant(depuis, direct) {
    return chargerAssistant().then(function (A) {
      if (!A) return;
      if (direct) A.ouvrir(null, { direct: true }); else A.basculer(depuis);
    });
  }

  /* ══════ SOLI, LA MASCOTTE (demandée par Nicolas le 25/10/2026) ══════
     Un soleil — le rond jaune du logo — qui porte en lunettes le parallélogramme bleu du logo :
     une protection solaire, ce que vend SolariScreen. Couleurs FIXES, celles de la marque : la
     pastille garde la même tête dans tous les thèmes. Une seule description, réutilisée par
     l'assistant (en-tête, accueil) : deux dessins finiraient par ne plus se ressembler. */
  const RAYONS = [[32, 13, 32, 7], [46.85, 19.15, 51.09, 14.91], [53, 34, 59, 34], [46.85, 48.85, 51.09, 53.09],
    [32, 55, 32, 61], [17.15, 48.85, 12.91, 53.09], [11, 34, 5, 34], [17.15, 19.15, 12.91, 14.91]];
  /* Les couleurs vivent dans la feuille de style (variables --ssm-*), une palette par THÈME :
     Soli prend le style du thème choisi sans être redessiné. Et pendant une fête (si les décors
     sont allumés), il porte l'accessoire de la saison — posé sur le rayon du haut, qui s'efface. */
  const ACCESSOIRES = {
    halloween: '<g class="ssm-acc"><ellipse cx="32" cy="17.6" rx="14" ry="2.8" fill="#2B1B3D"/>' +
      '<path d="M22.5 17.5Q27 9 33.5 2.5Q35 8 41.5 17.5Z" fill="#3B2357"/>' +
      '<path d="M23.6 15.2h17.2l0.9 2.3H22.7z" fill="#FF8C1A"/><circle cx="33.5" cy="2.7" r="1.4" fill="#FF8C1A"/></g>',
    'saint-nicolas': '<g class="ssm-acc"><path d="M24 18.5L25.5 8L32 1.5L38.5 8L40 18.5Z" fill="#C1121F"/>' +
      '<path d="M32 4v12M28 9.5h8" stroke="#F4C430" stroke-width="1.6" stroke-linecap="round"/><path d="M23.6 16.6h16.8v2.6H23.6z" fill="#F4C430"/></g>',
    noel: '<g class="ssm-acc"><path d="M20.5 18Q27 3.5 41 4.5Q46 6 46.5 11Q44.5 13 44 18Z" fill="#D62828"/>' +
      '<rect x="18.6" y="15.4" width="27.4" height="5" rx="2.5" fill="#ffffff"/><circle cx="46.6" cy="11" r="3.1" fill="#ffffff"/></g>',
    'nouvel-an': '<g class="ssm-acc"><path d="M25.5 18.5L32 2.5L38.5 18.5Z" fill="#7B2CBF"/>' +
      '<path d="M27.6 13.5L35.5 10.2M26.4 16.6L37.3 12.9M29.6 8.4L33.9 6.6" stroke="#FFD23F" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="32" cy="2.4" r="2" fill="#FFD23F"/><circle cx="20" cy="9" r="1" fill="#FF4ECD"/><circle cx="45" cy="7" r="1" fill="#00E5FF"/></g>',
    rentree: '<g class="ssm-acc"><path d="M32 5L47 11L32 17L17 11Z" fill="#1B1F3B"/><path d="M24 13.6v4.4q8 3.4 16 0v-4.4L32 17Z" fill="#2A3058"/>' +
      '<path d="M47 11v6.5" stroke="#F4C430" stroke-width="1.2"/><circle cx="47" cy="18.4" r="1.4" fill="#F4C430"/></g>',
  };
  function accessoireDuJour() {
    try {
      const F = window.SSFetes;
      const f = F && F.estAllumee() ? F.active() : null;
      return (f && ACCESSOIRES[f.id]) || '';
    } catch (e) { return ''; }
  }
  function mascotte(taille) {
    const t = taille || 52;
    const acc = accessoireDuJour();
    return '<svg class="ssm' + (acc ? ' accessoire' : '') + '" viewBox="0 0 64 64" width="' + t + '" height="' + t + '" aria-hidden="true" focusable="false">' +
      '<g class="ssm-rayons" stroke-width="3.6" stroke-linecap="round">' +
        RAYONS.map(function (r, i) { return '<line' + (i === 0 ? ' class="ssm-r0"' : '') + ' x1="' + r[0] + '" y1="' + r[1] + '" x2="' + r[2] + '" y2="' + r[3] + '"/>'; }).join('') + '</g>' +
      '<circle class="ssm-face" cx="32" cy="34" r="18" stroke-width="1.5"/>' +
      '<ellipse class="ssm-joue" cx="21" cy="40.6" rx="3.2" ry="2.1" opacity="0.5"/>' +
      '<ellipse class="ssm-joue" cx="43" cy="40.6" rx="3.2" ry="2.1" opacity="0.5"/>' +
      '<path class="ssm-verre" d="M16.5 26.5h11.5l1.8 8.3H18.3z"/>' +
      '<path class="ssm-verre" d="M34.2 26.5h11.5l1.8 8.3H36z"/>' +
      '<path class="ssm-pont" d="M27.6 27.6h7" fill="none" stroke-width="2" stroke-linecap="round"/>' +
      '<g class="ssm-reflet" stroke-width="1.4" stroke-linecap="round"><path d="M19.6 28.4l1 3.8"/><path d="M37.3 28.4l1 3.8"/></g>' +
      '<path class="ssm-bouche" d="M25.5 41.5q6.5 6 13 0" fill="none" stroke-width="2.4" stroke-linecap="round"/>' +
      acc + '</svg>';
  }

  /* La pastille en bas à droite, sur toutes les pages qui ont un menu.
     ⚠️ ELLE NE SE POSE JAMAIS SUR UNE BARRE COLLÉE EN BAS D'ÉCRAN — l'assistant du Mode Terrain,
     la barre d'enregistrement des Paramètres : elle monte au-dessus, et redescend quand la barre
     s'en va. Une nouvelle barre de ce genre prend l'attribut data-barre-bas (ou rejoint la liste). */
  const BARRES_BAS = '.wiz-bar, .barre, [data-barre-bas]';
  let fab = null, leveePrevue = false;
  function leverMascotte() {
    const h = window.innerHeight, l = window.innerWidth;
    let leve = 0;
    document.querySelectorAll(BARRES_BAS).forEach(function (b) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || r.top >= h || r.bottom < h - 40 || r.right < l - 100) return;
      leve = Math.max(leve, h - r.top - 6);   // 10 px d'air au-dessus de la barre
    });
    document.documentElement.style.setProperty('--ssfab-leve', Math.max(0, Math.round(leve)) + 'px');
  }
  function planifierLevee() {
    if (leveePrevue) return;
    leveePrevue = true;
    requestAnimationFrame(function () { leveePrevue = false; leverMascotte(); });
  }
  function monterMascotte() {
    if (fab || document.querySelector('.ssfab')) return;
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'ssfab';
    fab.title = 'Soli, ton assistant : une question sur tes devis, factures, planning, échanges…';
    fab.setAttribute('aria-label', 'Ouvrir Soli, l\u2019assistant');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = mascotte(52) + '<span class="ssfab-x" aria-hidden="true">' + window.SSUI.icon('x', 12) + '</span>';
    fab.addEventListener('click', function () { ouvrirAssistant(fab); });
    document.body.appendChild(fab);
    leverMascotte();
    window.addEventListener('resize', planifierLevee, { passive: true });
    window.addEventListener('scroll', planifierLevee, { passive: true, capture: true });
    // Une barre qui apparaît sans défilement (étape suivante du Mode Terrain) : on revérifie.
    setInterval(function () { if (document.visibilityState === 'visible') leverMascotte(); }, 1500);
    // … et dès qu'une barre change de taille : vide (donc masquée) au montage, la barre du Mode Terrain se
    // remplit juste après, et Soli restait posé sur « Continuer » jusqu'au prochain passage, 1,5 s plus tard.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(planifierLevee);
      document.querySelectorAll(BARRES_BAS).forEach(function (b) { ro.observe(b); });
    }
  }

  // ── Compteurs d'alerte du menu ────────────────────────────────────────────────────────
  // Jusqu'ici il fallait ALLER sur le tableau de bord pour savoir qu'il se passait quelque
  // chose. Ces compteurs suivent l'utilisateur sur toutes les pages. Calculés une seule fois
  // par minute, en tâche de fond, et TOUJOURS silencieux en cas d'échec (hors-ligne, session
  // expirée) : la navigation ne doit jamais dépendre de leur disponibilité.
  let badgesCache = null, badgesAt = 0;
  async function computeBadges() {
    if (badgesCache && Date.now() - badgesAt < 60000) return badgesCache;
    const SS = window.SS;
    if (!SS) return { rdv: 0, sav: 0, factures: 0, echanges: 0, depenses: 0 };
    const today = window.SSUI.aujourdhui();
    const [devis, factures, rdv, sujets, depenses, moi, A] = await Promise.all([
      SS.listDevis().catch(function () { return []; }),
      SS.listFactures().catch(function () { return []; }),
      (SS.listRdv ? SS.listRdv().catch(function () { return []; }) : Promise.resolve([])),
      (SS.listSujets ? SS.listSujets().catch(function () { return []; }) : Promise.resolve([])),
      (SS.listDepenses ? SS.listDepenses().catch(function () { return []; }) : Promise.resolve([])),
      getIdentity().catch(function () { return { key: '' }; }),
      chargerAttente(),
    ]);
    // Demandes entrantes que personne n'a prises en charge (hors annulées/converties).
    const nbRdv = (rdv || []).filter(function (r) {
      return !r.assigned_to && ['annule', 'converti'].indexOf(r.statut) === -1;
    }).length;
    // Tickets SAV encore ouverts, tous devis confondus.
    let nbSav = 0;
    (devis || []).forEach(function (d) {
      (d.sav_tickets || []).forEach(function (t) { if (t.statut !== 'resolu') nbSav++; });
    });
    // Factures échues et non soldées.
    const nbFac = (factures || []).filter(function (f) {
      const paye = (f.paiements || []).reduce(function (s, p) { return s + (Number(p.montant) || 0); }, 0);
      return f.echeance && f.echeance < today && paye < (Number(f.total_ttc) || 0) - 0.005;
    }).length;
    // Ce qui attend une action DE MOI, plus ce que PERSONNE n'a pris — c'est ce second cas qui
    // pourrit, chacun croyant que l'autre s'en occupe. Sans identité (session Access expirée,
    // page hors ligne), on n'affiche rien plutôt qu'un compteur faux.
    // Le calcul passe par SSAttente quand il est chargé, pour que le badge dise exactement la même
    // chose que l'écran Échanges. Les alertes du PLANNING (conflits) en sont volontairement
    // exclues : elles exigeraient de charger le moteur du temps sur chacune des seize pages.
    // null = « on ne sait pas » : le menu n'affiche alors rien, plutôt qu'un chiffre faux.
    let nbEch = null;
    if (moi && moi.key && A) {
      const items = [].concat(A.depuisRdv(rdv, devis), A.depuisSav(devis), A.depuisSujets(sujets));
      nbEch = A.concerne(items, moi.key).length;
    }
    /* MES tickets pas encore remboursés. Ceux de l'autre ne me concernent pas : le compteur
       doit dire ce que JE dois aller chercher, sinon on apprend à ne plus le regarder.
       Sans identité (session Access expirée), on n'affiche rien plutôt qu'un chiffre faux. */
    let nbDep = 0;
    if (moi && moi.key) {
      nbDep = (depenses || []).filter(function (d) {
        return d && String(d.qui || '') === moi.key && !String(d.rembourse_le || '').slice(0, 10);
      }).length;
    }
    badgesCache = { rdv: nbRdv, sav: nbSav, factures: nbFac, echanges: nbEch, depenses: nbDep };
    badgesAt = Date.now();
    return badgesCache;
  }

  // Identité Cloudflare Access → affichage cosmétique ("connecté en tant que…") ET
  // pré-remplissage de l'auteur des notes internes. Jamais utilisée pour une décision
  // de sécurité (l'application réelle se fait par la politique Access sur le domaine).
  const IDENTITIES = {
    'info@solariscreen.be': { key: 'yannick', name: 'Yannick', colorVar: '--accent-2' },
    'nicolas.struelens@me.com': { key: 'nicolas', name: 'Nicolas', colorVar: '--accent' },
  };

  let identityPromise = null;
  // Résout une fois par page : { email, key: 'nicolas'|'yannick'|null, name, colorVar }
  function getIdentity() {
    if (identityPromise) return identityPromise;
    identityPromise = (window.SS && typeof window.SS.whoAmI === 'function' ? window.SS.whoAmI() : Promise.resolve({ email: null }))
      .then(function (res) {
        const email = res && res.email;
        const id = email ? IDENTITIES[email.toLowerCase()] : null;
        return { email: email || null, key: id ? id.key : null, name: id ? id.name : null, colorVar: id ? id.colorVar : '--text-subtle' };
      })
      .catch(function () { return { email: null, key: null, name: null, colorVar: '--text-subtle' }; });
    return identityPromise;
  }

  function mountWhoAmI(anchor) {
    if (!anchor) return;
    getIdentity().then(function (identity) {
      if (!identity.email) return; // pas derrière Cloudflare Access (dev local) → rien à afficher
      // Marque ce navigateur comme « staff » (même origine que la page client devis-review.html) :
      // sert à NE PAS compter les consultations de Nicolas/Yannick dans le compteur de vues du client.
      try { localStorage.setItem('ss_staff', '1'); } catch (e) {}
      const label = identity.name || identity.email;
      const colorVar = 'var(' + identity.colorVar + ')';
      const span = document.createElement('button');
      span.type = 'button';
      span.className = 'badge ssnav-who';
      span.style.cursor = 'pointer';
      span.title = 'Connecté : ' + identity.email + ' — cliquer pour voir l\'historique de connexion';
      span.style.color = colorVar;
      span.style.borderColor = 'color-mix(in srgb, ' + colorVar + ' 45%, transparent)';
      span.style.background = 'color-mix(in srgb, ' + colorVar + ' 9%, transparent)';
      span.innerHTML = window.SSUI.icon('user', 11) + ' ' + escHtml(label);
      span.addEventListener('click', function (e) { toggleConnLog(e); });
      anchor.parentNode.insertBefore(span, anchor);
    });
  }

  // ── Historique de connexion (popover ouvert en cliquant sur le badge d'identité) ──
  // Source unique : assets/js/ui.js (ces deux-là vivaient en double, ici et dans stats.html).
  const IDENTITY_LABEL = window.SSUI.IDENTITE_LABEL;
  // Échappement HTML partagé (le badge d'identité et le popover injectent des valeurs serveur).
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const fmtDuration = window.SSUI.fmtDuree;
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' +
      d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  }
  let connLogEl = null;
  window.toggleConnLog = async function (e) {
    e.stopPropagation();
    if (!connLogEl) {
      connLogEl = document.createElement('div');
      connLogEl.className = 'conn-log';
      document.body.appendChild(connLogEl);
      document.addEventListener('click', function (ev) {
        // Le clic sur le déclencheur est géré par le déclencheur lui-même : le compter ici comme
        // « ailleurs » fermait puis rouvrait aussitôt l'historique.
        if (connLogEl.classList.contains('open') && !connLogEl.contains(ev.target) && !ev.target.closest('.ssnav-who, .ssrail-who')) connLogEl.classList.remove('open');
      }, true);
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') connLogEl.classList.remove('open'); });
    }
    if (connLogEl.classList.contains('open')) { connLogEl.classList.remove('open'); return; }
    connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Chargement…</div>';
    const r = e.currentTarget.getBoundingClientRect();
    if (e.currentTarget.closest && e.currentTarget.closest('.ssrail')) {
      // Depuis le pied du rail : À DROITE du rail et calé sur le bas, sinon l'historique
      // s'ouvrirait par-dessus le menu lui-même.
      connLogEl.style.left = Math.round(r.right + 8) + 'px';
      connLogEl.style.top = Math.max(8, Math.round(r.bottom - 360)) + 'px';
    } else {
      connLogEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 340)) + 'px';
      connLogEl.style.top = Math.min(r.bottom + 6, window.innerHeight - 380) + 'px';
    }
    connLogEl.classList.add('open');
    try {
      const res = await fetch('/api/connections', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
      const rows = (res && res.data) || [];
      if (!rows.length) { connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Aucune connexion enregistrée.</div>'; return; }
      connLogEl.innerHTML = '<div class="conn-log-head">Dernières plages d’activité</div>' + rows.slice(0, 8).map(function (c) {
        // Durée d'une plage d'utilisation ACTIVE : une pause (navigateur réduit / onglet en
        // arrière-plan / PC laissé ouvert > SESSION_GAP) coupe la session et en démarre une
        // nouvelle, donc cet écart début→fin ne reflète que du temps réellement actif.
        const dur = fmtDuration(new Date(c.last_seen) - new Date(c.start_time));
        const label = IDENTITY_LABEL[c.identity] || c.email || 'Inconnu';
        return '<div class="conn-log-row"><span class="conn-log-who">' + escHtml(label) + '</span><span class="conn-log-when">' + fmtDateTime(c.start_time) + '</span><span class="conn-log-dur" title="Temps actif (onglet visible + interactions)">' + dur + '</span></div>';
      }).join('') +
        '<a class="conn-log-tout" href="stats.html#connexions">Historique complet et rythmes de travail →</a>';
    } catch (e2) {
      connLogEl.innerHTML = '<div style="padding:0.8rem 1rem;font-size:var(--fs-xs);color:var(--text-subtle);">Historique indisponible hors-ligne.</div>';
    }
  };

  // ── Heartbeat : approxime le temps réellement passé sur l'appli (voir schéma D1 "connections") ──
  (function trackSession() {
    const HEARTBEAT_MS = 30000;
    const IDLE_LIMIT_MS = 2 * 60000;   // au-delà de 2 min sans interaction, on ne compte plus (lecture tolérée)
    const SESSION_GAP_MS = 150000;     // > IDLE_LIMIT : un trou d'inactivité RÉELLE > 2 min 30 démarre une NOUVELLE session
    let lastActivity = Date.now();
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
    });
    // Identifiant de session qui se RENOUVELLE après une longue pause : si le dernier battement
    // remonte à plus de SESSION_GAP (navigateur réduit, autre onglet/appli au premier plan, PC
    // laissé ouvert…), on ouvre une nouvelle session. Chaque ligne d'historique = une vraie plage
    // d'utilisation active, au lieu d'un seul long créneau qui engloberait les temps morts.
    function sessionId() {
      const now = Date.now();
      // On segmente sur l'INACTIVITÉ RÉELLE (dernière interaction persistée), pas sur la cadence des
      // battements : ceux-ci continuent jusqu'à IDLE_LIMIT après la dernière action, donc se baser sur
      // ss_last_beat ne détectait le trou qu'au-delà de ~IDLE_LIMIT+GAP (temps actif surévalué).
      const lastAct = parseInt(sessionStorage.getItem('ss_last_activity') || '0', 10);
      let id = sessionStorage.getItem('ss_session_id');
      if (!id || (lastAct && now - lastAct > SESSION_GAP_MS)) {
        id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : now + '-' + Math.random().toString(36).slice(2));
        sessionStorage.setItem('ss_session_id', id);
      }
      return id;
    }
    function sendHeartbeat() {
      if (Date.now() - lastActivity > IDLE_LIMIT_MS) return;   // inactif depuis trop longtemps → ne compte pas
      const sid = sessionId();   // évalue le trou AVANT de rafraîchir la dernière activité persistée
      sessionStorage.setItem('ss_last_activity', String(lastActivity));
      sessionStorage.setItem('ss_last_beat', String(Date.now()));
      const body = JSON.stringify({ session_id: sid });
      fetch('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin', keepalive: true }).catch(function () {});
    }
    sendHeartbeat();
    // Ne bat QUE lorsque l'onglet est réellement visible (réduit / arrière-plan → pas de battement,
    // donc le temps mort n'est jamais compté et coupera la session au retour).
    setInterval(function () { if (document.visibilityState === 'visible') sendHeartbeat(); }, HEARTBEAT_MS);
  })();

  // ── Remontée des erreurs JavaScript vers le journal d'activité ────────────────────────
  // POURQUOI : une erreur qui survient chez Nicolas ou Yannick, en production, derrière
  // Cloudflare Access, est TOTALEMENT invisible depuis un poste de développement. On perdait
  // le message exact et il fallait deviner. Désormais chaque erreur non rattrapée est
  // journalisée (action `error.js`) avec le fichier, la ligne et la page.
  // Garde-fous : maximum 5 par session, jamais deux fois la même, et l'envoi ne peut jamais
  // casser la page (fire-and-forget, échec avalé).
  (function reportJsErrors() {
    const MAX_PAR_SESSION = 5;
    let envoyees = 0;
    const dejaVues = new Set();
    function report(kind, msg, where) {
      if (envoyees >= MAX_PAR_SESSION) return;
      const sig = kind + '|' + msg + '|' + where;
      if (dejaVues.has(sig)) return;          // une boucle de rendu ne doit pas inonder le journal
      dejaVues.add(sig); envoyees++;
      const page = location.pathname.split('/').pop() || 'index';
      const label = ('⚠ ' + kind + ' — ' + msg + (where ? ' (' + where + ')' : '') + ' · page ' + page).slice(0, 400);
      try {
        fetch('/api/activity', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', keepalive: true,
          body: JSON.stringify({ action: 'error.js', entity_type: 'system', entity_id: page, label: label }),
        }).catch(function () {});
      } catch (e) { /* jamais bloquant */ }
    }
    window.addEventListener('error', function (e) {
      if (!e) return;
      // Échec de CHARGEMENT d'une ressource : l'événement n'a pas de message, l'info est sur la cible.
      // On ne remonte que les scripts et feuilles de style : une image manquante (logo) est déjà
      // gérée proprement ailleurs et polluerait le journal à chaque page.
      const t = e.target;
      if (t && t !== window && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
        // ⚠️ Uniquement NOS fichiers. Cloudflare injecte son beacon d'analytics
        // (static.cloudflareinsights.com/beacon.min.js) sur chaque page servie ; une
        // protection anti-pistage ou un bloqueur le refuse, et le journal d'activité se
        // remplissait d'une alerte À CHAQUE chargement de page — noyant les vraies erreurs.
        // Un script tiers bloqué côté navigateur n'est pas un problème de l'ERP ; un de nos
        // fichiers qui ne charge pas, si — et celui-là continue d'être remonté.
        const url = String(t.src || t.href || '');
        let interne = true;
        try { if (url) interne = new URL(url, location.href).origin === location.origin; } catch (err) { interne = false; }
        if (!interne) return;
        report('Ressource non chargée', t.tagName.toLowerCase(), url.split('/').pop());
        return;
      }
      if (t && t !== window && !e.message) return;   // autre ressource (image…) → ignoré
      report('Erreur JS', e.message || 'inconnue',
        (e.filename ? String(e.filename).split('/').pop() : '') + (e.lineno ? ':' + e.lineno : ''));
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      const r = e && e.reason;
      report('Promesse rejetée', String((r && (r.message || r)) || 'inconnue').slice(0, 200), '');
    });
  })();

  // Croissant de lune autonome : SSUI n'a pas d'icône « moon » (theme.js garde la sienne
  // en propre parce qu'il se charge avant ui.js).
  const ICO_MOON_MENU = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  // État replié appliqué LE PLUS TÔT POSSIBLE : posé après coup, le rail s'afficherait large puis
  // se rétracterait sous les yeux à chaque chargement de page.
  try { if (localStorage.getItem('ss_rail') === 'reduit') document.documentElement.classList.add('ss-rail-reduit'); } catch (e) {}

  /* LE LOGO RAMENE AU TABLEAU DE BORD. Le <span class="brand-logo"> devient un <a> de meme
     classe : tout le style tient a la classe, donc rien ne bouge visuellement. On remplace au
     lieu d'envelopper -- un <a> en display:contents autour aurait garde la mise en page, mais
     ce mode est mal rendu dans l'arbre d'accessibilite de plusieurs navigateurs, et un lien
     qu'un lecteur d'ecran ne voit pas n'est pas un lien.
     Toutes les pages qui chargent nav.js vivent dans /app/, d'ou le href relatif -- le meme que
     celui que porte deja le <h1>. */
  /* HAUTEUR REELLE DU BANDEAU. Il est en `position: fixed`, donc il ne pousse plus le contenu :
     c'est `body { padding-top }` qui s'en charge, et il lui faut la hauteur EXACTE. Elle n'est
     pas constante — sur telephone le bandeau passe sur deux lignes des que les boutons ne
     tiennent plus, et elle change encore quand les polices finissent de charger. D'ou la mesure
     plutot qu'une constante, et l'observateur qui la tient a jour.
     Pose des l'execution du script (nav.js est charge APRES le markup du bandeau) pour que le
     decalage soit correct des le premier rendu, sans sursaut. */
  function hauteurBandeau() {
    const h = document.querySelector('.app-header');
    const px = h ? Math.round(h.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--ss-header-h', px + 'px');
    return h;
  }
  (function suivreHauteurBandeau() {
    const h = hauteurBandeau();
    if (!h || !window.ResizeObserver) return;
    new ResizeObserver(hauteurBandeau).observe(h);
  })();

  function logoCliquable() {
    const sp = document.querySelector('span.brand-logo');
    if (!sp) return;
    const a = document.createElement('a');
    a.className = sp.className;
    a.href = 'dashboard.html';
    a.title = 'Retour au tableau de bord';
    a.setAttribute('aria-label', 'Retour au tableau de bord');
    a.innerHTML = sp.innerHTML;
    sp.replaceWith(a);
  }

  let peindreCompteurs = null;
  /** Recalcule les compteurs TOUT DE SUITE, sans attendre le cache d'une minute. Pour une page
   *  qui vient de changer ce qu'ils comptent (un ticket SAV clos, un sujet classé). */
  function rafraichirCompteurs() {
    badgesCache = null;
    return computeBadges().then(function (b) { if (peindreCompteurs) peindreCompteurs(b); return b; });
  }

  function mountRail(cur) {
    if (document.querySelector('.ssrail')) return;
    const icon = window.SSUI.icon;
    const rail = document.createElement('aside');
    rail.className = 'ssrail';
    rail.setAttribute('aria-label', 'Navigation');
    const entree = function (pg) {
      const actif = estActive(pg.href, cur);
      return '<a class="ssrail-item' + (actif ? ' active' : '') + '" href="' + pg.href + '"' +
        (actif ? ' aria-current="page"' : '') +
        (pg.badge ? ' data-badge="' + pg.badge + '"' : '') + ' title="' + pg.label + '">' +
        icon(pg.icon, 15) + '<span class="ssrail-lbl">' + pg.label + '</span></a>';
    };
    rail.innerHTML =
      /* ⚠️ LE BOUTON DE RÉDUCTION VIT À CÔTÉ DU LOGO, et pas dans le pied. Essayé dans le pied :
         le rail montait à 1 068 px pour une fenêtre de 950, le pied passait sous le bord et la
         citrouille d'Halloween se posait sur le nom de l'utilisateur. L'ancien bouton « Menu »
         était déjà en haut : la main sait où le chercher. */
      '<div class="ssrail-top">' +
        '<a class="ssrail-brand" href="dashboard.html" title="Retour au tableau de bord"><svg viewBox="60.7 69.8 359.3 359.3" aria-hidden="true"><circle cx="205" cy="261.4" r="134.1" fill="#FFC501"/><path d="M158.4,83L315.5,83A8,8 0 0 1 323.2,89L407.2,406A8,8 0 0 1 399.5,416L242.4,416A8,8 0 0 1 234.7,410L150.7,93A8,8 0 0 1 158.4,83Z" fill="#1F319D"/></svg><span class="ssrail-lbl">SolariScreen</span></a>' +
        '<button class="ssrail-toggle" type="button">' + icon('panelleft', 16) + '</button>' +
      '</div>' +
      // La liste se DÉPLIE dans le rail au lieu de flotter à côté : le rail a un « overflow »
      // masqué, une liste flottante y serait coupée — et replié à 60 px, elle n'aurait nulle part
      // où s'afficher.
      '<button class="ssrail-item ssrail-newbtn" type="button" aria-expanded="false" aria-controls="ssrail-newlist" title="Créer un devis, un dépannage ou une demande de RDV">' +
        icon('plus', 15) + '<span class="ssrail-lbl">Nouveau</span><span class="ssrail-chev" aria-hidden="true">' + icon('chevrondown', 13) + '</span></button>' +
      '<div class="ssrail-newlist" id="ssrail-newlist" hidden>' +
        NAV_CREER.map(function (pg) {
          return '<a class="ssrail-item ssrail-sub" href="' + pg.href + '" title="' + pg.titre + '">' +
            icon(pg.icon, 15) + '<span class="ssrail-lbl">' + pg.label + '</span></a>';
        }).join('') + '</div>' +
      entree(NAV_ACCUEIL) +
      '<button class="ssrail-item ssrail-search" type="button" title="Rechercher (Ctrl+K)">' +
        icon('search', 15) + '<span class="ssrail-lbl">Recherche</span><span class="ssrail-kbd">Ctrl K</span></button>' +
      NAV_GROUPS.map(function (g) {
        return '<div class="ssrail-group">' + g.title + '</div>' + g.pages.map(entree).join('');
      }).join('') +
      '<div class="ssrail-foot">' +
        '<button class="ssrail-item ssrail-who" type="button" hidden><span class="ssrail-ava" aria-hidden="true"></span><span class="ssrail-lbl"></span></button>' +
        entree(NAV_REGLAGES) +
      '</div>';
    document.body.appendChild(rail);

    /* ── « + Nouveau » ── Échap et un clic ailleurs referment ; Échap rend le focus au bouton,
       sinon le clavier se retrouve perdu au milieu d'une liste qui vient de disparaître. */
    const nb = rail.querySelector('.ssrail-newbtn');
    const liste = rail.querySelector('.ssrail-newlist');
    function ouvrirNouveau(oui) { liste.hidden = !oui; nb.setAttribute('aria-expanded', String(oui)); }
    nb.addEventListener('click', function (e) { e.stopPropagation(); ouvrirNouveau(liste.hidden); });
    document.addEventListener('click', function (e) {
      if (!liste.hidden && !liste.contains(e.target) && !nb.contains(e.target)) ouvrirNouveau(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !liste.hidden) { ouvrirNouveau(false); nb.focus(); }
    });

    rail.querySelector('.ssrail-search').addEventListener('click', function () {
      if (window.ssCommandPalette) window.ssCommandPalette();
    });

    /* ── Réduire / déployer ── Le bouton s'appelait « Menu » avec une icône de grille : il
       annonçait l'ouverture d'un menu et faisait l'inverse. Il dit maintenant ce qu'il fait, et
       son état est lisible par un lecteur d'écran (replié, son libellé n'est plus affiché). */
    const tg = rail.querySelector('.ssrail-toggle');
    function peindreToggle() {
      const reduit = document.documentElement.classList.contains('ss-rail-reduit');
      const t = reduit ? 'Déployer le menu' : 'Réduire le menu';
      tg.title = t; tg.setAttribute('aria-label', t);
      tg.setAttribute('aria-expanded', String(!reduit));
    }
    peindreToggle();
    tg.addEventListener('click', function () {
      const reduit = document.documentElement.classList.toggle('ss-rail-reduit');
      try { localStorage.setItem('ss_rail', reduit ? 'reduit' : 'large'); } catch (e) {}
      peindreToggle();
    });

    /* ── Qui est connecté ── Rien hors connexion (aperçu, serveur de test) : une ligne vide ou
       « inconnu » ne servirait à rien. Un clic ouvre l'historique de connexion, comme la
       pastille du bandeau qu'elle remplace sur grand écran. */
    getIdentity().then(function (id) {
      if (!id || !id.email) return;
      const who = rail.querySelector('.ssrail-who');
      const nom = id.name || id.email;
      who.querySelector('.ssrail-ava').textContent = nom.charAt(0).toUpperCase();
      who.querySelector('.ssrail-lbl').textContent = nom;
      who.style.setProperty('--ssrail-ava', 'var(' + id.colorVar + ')');
      who.title = 'Connecté : ' + id.email + ' — voir l\'historique de connexion';
      who.setAttribute('aria-label', who.title);
      who.hidden = false;
      who.addEventListener('click', function (e) { window.toggleConnLog(e); });
    });
    return rail;
  }

  /* ── LE BAC À SABLE SE VOIT ───────────────────────────────────────────────────────────────
     Un aperçu de branche travaille sur une base d'ESSAI (DEPLOIEMENT.md, étape 12) : ce qu'on y
     saisit n'existe pas en production. Sans marque, un aperçu ouvert par erreur recevrait un vrai
     devis, qui ne serait jamais arrivé chez l'autre. La classe porte la bande et la pastille (feuille
     ci-dessus) ; le titre de l'onglet le dit aussi, parce qu'un onglet se lit sans être affiché.
     `hote` ne sert qu'aux tests. */
  function marquerBacASable(hote) {
    if (!window.SSUI.hoteBacASable(hote == null ? location.hostname : hote)) return false;
    document.documentElement.classList.add('ss-essai');
    if (document.title.indexOf('ESSAI · ') !== 0) document.title = 'ESSAI · ' + document.title;
    return true;
  }

  function mount(container) {
    logoCliquable();
    marquerBacASable();
    if (!container) return;
    const icon = window.SSUI.icon;
    const cur = pageCourante();
    const lien = function (p) {
      const actif = estActive(p.href, cur);
      return `<a class="ssnav-item ${actif ? 'active' : ''}" href="${p.href}" role="menuitem"${actif ? ' aria-current="page"' : ''}${p.badge ? ` data-badge="${p.badge}"` : ''}>${icon(p.icon, 14)} ${p.label}</a>`;
    };
    container.innerHTML = `
      <div class="ssnav">
        <button class="btn btn-ghost btn-sm ssnav-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Naviguer vers une autre page">${icon('grid9', 14)}</button>
        <div class="ssnav-menu" role="menu">
          <button class="ssnav-item ssnav-search" type="button" role="menuitem" style="width:100%;text-align:left;background:none;cursor:pointer;">${icon('search', 14)} Recherche<span style="margin-left:auto;font-family:var(--font-mono);font-size:0.58rem;opacity:0.7;border:1px solid var(--border);border-radius:3px;padding:0.05rem 0.3rem;">Ctrl&nbsp;K</span></button>
          ${lien(NAV_ACCUEIL)}
          <div class="ssnav-sep"></div>
          <div class="ssnav-group">Nouveau</div>
          ${NAV_CREER.map(p => `<a class="ssnav-item" href="${p.href}" role="menuitem">${icon(p.icon, 14)} ${p.titre}</a>`).join('')}
          ${NAV_GROUPS.map(g => `
            <div class="ssnav-sep"></div>
            <div class="ssnav-group">${g.title}</div>
            ${g.pages.map(lien).join('')}
          `).join('')}
          <div class="ssnav-sep"></div>
          ${lien(NAV_REGLAGES)}
        </div>
      </div>`;
    mountRail(cur);
    const root = container.querySelector('.ssnav');
    const btn = root.querySelector('.ssnav-toggle');
    const menu = root.querySelector('.ssnav-menu');

    // ── Entrées réservées au téléphone ────────────────────────────────────────────────────
    // Le bandeau d'un téléphone ne peut pas porter six boutons de 44 px : le sélecteur de
    // thème et le badge d'identité descendent donc ici, où ils gagnent un vrai libellé.
    // Elles sont TOUJOURS écrites dans le DOM et masquées par CSS au-dessus de 640 px
    // (.ssnav-mobile) : aucune branche JS sur la largeur, donc rien qui puisse se
    // désynchroniser en tournant le téléphone, et zéro changement à l'écran du bureau.
    const themeItem = document.createElement('button');
    themeItem.type = 'button';
    themeItem.className = 'ssnav-item ssnav-mobile';
    themeItem.setAttribute('role', 'menuitem');
    themeItem.style.cssText = 'width:100%;text-align:left;background:none;cursor:pointer;';
    function paintThemeItem() {
      const sombre = window.SSTheme && window.SSTheme.getTheme() === 'dark';
      themeItem.innerHTML = (sombre ? icon('sun', 14) : ICO_MOON_MENU) +
        ' Thème ' + (sombre ? 'clair' : 'sombre');
    }
    paintThemeItem();
    themeItem.addEventListener('click', function () {
      if (window.SSTheme) window.SSTheme.toggleTheme();
      paintThemeItem();
    });
    const sep = document.createElement('div');
    sep.className = 'ssnav-sep ssnav-mobile';
    menu.appendChild(sep);
    menu.appendChild(themeItem);
    // Identité : affichée en clair (« Connecté : Nicolas ») plutôt qu'en pictogramme.
    getIdentity().then(function (identity) {
      if (!identity.email) return;
      const who = document.createElement('div');
      who.className = 'ssnav-group ssnav-mobile';
      who.style.color = 'var(' + identity.colorVar + ')';
      who.textContent = 'Connecté : ' + (identity.name || identity.email);
      menu.appendChild(who);
    });

    // Compteurs d'alerte : peints dans le menu ET résumés par une pastille sur le bouton,
    // pour repérer une urgence sans même ouvrir le menu.
    function paintBadges(b) {
      if (!b) return;
      const CLS = { rdv: '', sav: '', factures: 'warn' };   // RDV/SAV = rouge, factures = orange
      let total = 0;
      // Le rail autant que le volet : c'est tout l'objet du rail, des compteurs qu'on n'a pas
      // besoin d'ouvrir un menu pour voir. On interroge donc le DOCUMENT, pas le seul volet.
      document.querySelectorAll('.ssnav-item[data-badge], .ssrail-item[data-badge]').forEach(function (a) {
        const k = a.getAttribute('data-badge'), n = b[k] || 0;
        const old = a.querySelector('.ssnav-count');
        if (old) old.remove();
        if (!n) return;
        if (a.classList.contains('ssnav-item')) total += n;   // sinon le rail doublerait le total
        const s = document.createElement('span');
        s.className = 'ssnav-count' + (CLS[k] ? ' ' + CLS[k] : '');
        s.textContent = n > 99 ? '99+' : String(n);
        a.appendChild(s);
      });
      const oldDot = btn.querySelector('.ssnav-dot');
      if (oldDot) oldDot.remove();
      if (total > 0) {
        const dot = document.createElement('span');
        dot.className = 'ssnav-dot';
        btn.appendChild(dot);
        btn.title = total + ' point(s) d\'attention — ouvrir le menu';
      }
    }
    peindreCompteurs = paintBadges;
    computeBadges().then(paintBadges).catch(function () {});
    /* ⚠️ SUR GRAND ÉCRAN, LES COMPTEURS NE BOUGEAIENT JAMAIS. Ils n'étaient recalculés qu'à
       l'ouverture du volet déroulant — or le volet DISPARAÎT dès que le rail est là. Une page
       laissée ouverte gardait les chiffres du matin. Ils se rafraîchissent donc toutes les deux
       minutes tant que la page est regardée, et dès qu'on revient sur l'onglet. Le cache d'une
       minute de computeBadges évite de tout relire à chaque retour d'onglet.
       setInterval et non requestAnimationFrame : rAF ne tire pas dans un onglet en arrière-plan. */
    setInterval(function () {
      if (document.visibilityState === 'visible') computeBadges().then(paintBadges).catch(function () {});
    }, 120000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') computeBadges().then(paintBadges).catch(function () {});
    });
    function close() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    function toggle(e) {
      e.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      menu.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
      // À l'ouverture, on rafraîchit les compteurs (cache d'1 min) : ils restent à jour même
      // si la page est ouverte depuis longtemps.
      if (willOpen) computeBadges().then(paintBadges).catch(function () {});
    }
    btn.addEventListener('click', toggle);
    const searchItem = root.querySelector('.ssnav-search');
    if (searchItem) searchItem.addEventListener('click', function (e) { e.preventDefault(); close(); if (window.ssCommandPalette) window.ssCommandPalette(); });
    /* TOUCHER À CÔTÉ FERME LE MENU — ET RIEN D'AUTRE. Écouté en phase de CAPTURE, pour passer avant
       la page : sur téléphone, le doigt posé à côté du volet pour le fermer ouvrait AUSSI ce qui était
       dessous (une ligne du tableau de bord mène à sa fiche) — on fermait un menu et on se retrouvait
       sur un autre dossier. Trouvé le 26/10/2026 : le cas T6 de nav.test.html cliquait sur une ligne, le
       cadre partait sur vue.html, et T7 à T9 vérifiaient un document détaché sans s'en apercevoir.
       Menu fermé, ce gestionnaire ne fait rien : les clics passent normalement. */
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open') || root.contains(e.target)) return;
      close(); e.preventDefault(); e.stopPropagation();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    mountWhoAmI(container);
    monterMascotte();
    /* Une conversation ouverte SUIT l'onglet au bureau : la page suivante rouvre la fenêtre.
       ⚠️ JAMAIS SUR TÉLÉPHONE. Le panneau y couvre tout l'écran : rouvert tout seul, il revenait
       à chaque « retour » du navigateur, et Nicolas restait enfermé dedans (25/10/2026). */
    try {
      if (sessionStorage.getItem('ss_assistant_ouvert') === '1' && !window.matchMedia('(max-width: 640px)').matches) ouvrirAssistant(null, true);
    } catch (e) {}
  }

  // ── Palette de recherche globale (Ctrl+K / ⌘K) — devis, clients, factures, RDV, échanges ──
  (function commandPalette() {
    let ov = null, input = null, resultsEl = null, DATA = null, dataAt = 0, sel = 0, flat = [];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function ensure() {
      if (ov) return;
      ov = document.createElement('div'); ov.className = 'cmdk-ov';
      ov.innerHTML = '<div class="cmdk" role="dialog" aria-label="Recherche globale">' +
        '<div class="cmdk-input">' + window.SSUI.icon('search', 16) +
        '<input type="text" placeholder="Rechercher un devis, client, facture, RDV, une décision…" aria-label="Recherche" autocomplete="off">' +
        '<span class="cmdk-kbd">Échap</span></div><div class="cmdk-results"></div></div>';
      document.body.appendChild(ov);
      input = ov.querySelector('input'); resultsEl = ov.querySelector('.cmdk-results');
      ov.addEventListener('click', e => { if (e.target === ov) closeP(); });
      input.addEventListener('input', renderP);
      input.addEventListener('keydown', onKey);
    }
    async function loadData() {
      if (DATA && Date.now() - dataAt < 60000) return DATA;
      const SS = window.SS;
      const [devis, clients, factures, rdv, sujets] = await Promise.all([
        SS.listDevis().catch(() => []), SS.listClients().catch(() => []), SS.listFactures().catch(() => []),
        (SS.listRdv ? SS.listRdv().catch(() => []) : Promise.resolve([])),
        (SS.listSujets ? SS.listSujets().catch(() => []) : Promise.resolve([])),
      ]);
      DATA = { devis: devis || [], clients: clients || [], factures: factures || [], rdv: rdv || [], sujets: sujets || [] };
      dataAt = Date.now(); return DATA;
    }
    function openP() {
      ensure(); ov.classList.add('open'); input.value = '';
      resultsEl.innerHTML = '<div class="cmdk-empty">Chargement…</div>';
      setTimeout(() => input.focus(), 30);
      loadData().then(renderP).catch(() => { resultsEl.innerHTML = '<div class="cmdk-empty">Recherche indisponible hors-ligne.</div>'; });
    }
    function closeP() { if (ov) ov.classList.remove('open'); }
    function renderP() {
      if (!DATA) return;
      const q = input.value.trim().toLowerCase();
      flat = [];
      if (!q) { resultsEl.innerHTML = '<div class="cmdk-empty">Tape pour chercher un devis, un client, une facture, une demande de RDV — ou une décision prise.</div>'; return; }
      const groups = [];
      const dv = DATA.devis.map(d => {
        const prenom = d.client_prenom || (d.client && d.client.prenom) || '', nom = d.client_nom || (d.client && d.client.nom) || '';
        const ville = (d.client && d.client.adresse && d.client.adresse.ville) || '';
        const resume = (window.SSUI && window.SSUI.resumeDevis) ? window.SSUI.resumeDevis(d) : '';
        return { label: (prenom + ' ' + nom).trim() || 'Sans nom',
          sub: resume ? resume + ' · #' + d.id : '#' + d.id,
          // Le résumé devient cherchable : taper « façade sud » ou « tente » trouve le bon
          // devis sans connaître son numéro — c'est comme ça qu'on se souvient d'un chantier.
          hay: (prenom + ' ' + nom + ' ' + d.id + ' ' + ville + ' ' + resume).toLowerCase(),
          href: 'vue.html?id=' + encodeURIComponent(d.id), ic: 'D' };
      }).filter(x => x.hay.includes(q)).slice(0, 6);
      if (dv.length) groups.push({ title: 'Devis', items: dv });
      const cl = DATA.clients.map(c => {
        const full = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
        return { label: full || 'Client', sub: c.telephone || c.email || '', hay: (full + ' ' + (c.telephone || '') + ' ' + (c.email || '') + ' ' + ((c.adresse && c.adresse.ville) || '')).toLowerCase(), href: 'clients.html?q=' + encodeURIComponent(full), ic: 'C' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (cl.length) groups.push({ title: 'Clients', items: cl });
      const fa = DATA.factures.map(f => {
        const full = (((f.client && f.client.prenom) || '') + ' ' + ((f.client && f.client.nom) || '')).trim();
        return { label: f.id + (full ? ' — ' + full : ''), sub: '', hay: (f.id + ' ' + full).toLowerCase(), href: 'facture.html?id=' + encodeURIComponent(f.id), ic: 'F' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (fa.length) groups.push({ title: 'Factures', items: fa });
      const rv = DATA.rdv.map(r => {
        const full = (((r.client && r.client.prenom) || '') + ' ' + ((r.client && r.client.nom) || '')).trim();
        return { label: full || 'Demande', sub: r.source || '', hay: (full + ' ' + (r.source || '') + ' ' + ((r.client && r.client.adresse && r.client.adresse.ville) || '')).toLowerCase(), href: 'rdv.html?open=' + encodeURIComponent(r.id), ic: 'R' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (rv.length) groups.push({ title: 'Demandes de RDV', items: rv });
      // Échanges et DÉCISIONS. C'est la réponse à « on avait dit quoi pour les coulisses de
      // Depaepe ? » : la décision était déjà cherchable, mais seulement en pensant à ouvrir
      // l'écran des Échanges — donc on ne la retrouvait pas. Le texte des réponses entre aussi
      // dans la meule : la décision est parfois dans le fil plutôt que dans le champ.
      const su = DATA.sujets.map(s => {
        const dec = String(s.decision || '').trim();
        const reps = (s.reponses || []).map(r => r.texte || '').join(' ');
        return { label: s.titre || 'Sujet',
          // Ce qu'on vient relire, c'est la DÉCISION : elle passe donc devant le nom du client.
          sub: dec ? '✓ ' + dec.slice(0, 90) : (s.client_nom || ''),
          hay: [s.titre, s.corps, dec, s.client_nom, reps].filter(Boolean).join(' ').toLowerCase(),
          href: 'echanges.html?sujet=' + encodeURIComponent(s.id), ic: 'E' };
      }).filter(x => x.hay.includes(q)).slice(0, 5);
      if (su.length) groups.push({ title: 'Échanges et décisions', items: su });
      if (!groups.length) { resultsEl.innerHTML = '<div class="cmdk-empty">Aucun résultat pour « ' + esc(input.value) + ' ».</div>'; return; }
      let html = '', idx = 0;
      groups.forEach(g => {
        html += '<div class="cmdk-group">' + esc(g.title) + '</div>';
        g.items.forEach(it => { flat.push(it); html += '<a class="cmdk-item" data-i="' + idx + '" href="' + it.href + '"><span class="ci-ic ' + it.ic + '">' + it.ic + '</span><span class="ci-t">' + esc(it.label) + '</span><span class="ci-s">' + esc(it.sub) + '</span></a>'; idx++; });
      });
      resultsEl.innerHTML = html; sel = 0; highlight();
    }
    function highlight() {
      resultsEl.querySelectorAll('.cmdk-item').forEach((e, i) => e.classList.toggle('sel', i === sel));
      const s = resultsEl.querySelector('.cmdk-item.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
    }
    function onKey(e) {
      if (e.key === 'Escape') { closeP(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) { sel = (sel + 1) % flat.length; highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) { sel = (sel - 1 + flat.length) % flat.length; highlight(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (flat[sel]) location.href = flat[sel].href; }
    }
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (ov && ov.classList.contains('open')) closeP(); else openP();
      }
    });
    window.ssCommandPalette = openP;
  })();

  // ── Métadonnées web (manifest + icônes iOS) ──
  // NOTE : on N'ENREGISTRE PLUS de service worker. Un ancien SW (PWA hors-ligne) cassait toutes les
  // navigations en ERR_FAILED derrière Cloudflare Access. sw.js est devenu un kill-switch qui se
  // désinscrit tout seul. On garde uniquement le manifeste/les icônes (inoffensifs, aucune interception).
  (function webMeta() {
    const base = location.pathname.indexOf('/app/') !== -1 ? '../' : './';
    function addOnce(sel, make) { if (!document.querySelector(sel)) document.head.appendChild(make()); }
    addOnce('link[rel="manifest"]', function () { const l = document.createElement('link'); l.rel = 'manifest'; l.href = base + 'manifest.webmanifest'; return l; });
    // iOS n'accepte pas de SVG ici, et un PNG TRANSPARENT y est aplati sur du noir : c'est
    // apple-touch-icon.png (180x180, fond opaque, marque cadrée) qu'il faut, pas le logo brut.
    addOnce('link[rel="apple-touch-icon"]', function () { const l = document.createElement('link'); l.rel = 'apple-touch-icon'; l.href = base + 'assets/img/apple-touch-icon.png'; return l; });
    addOnce('meta[name="theme-color"]', function () { const m = document.createElement('meta'); m.name = 'theme-color'; m.content = '#0b1224'; return m; });
    addOnce('meta[name="apple-mobile-web-app-capable"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-capable'; m.content = 'yes'; return m; });
    addOnce('meta[name="apple-mobile-web-app-title"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; m.content = 'SolariScreen'; return m; });
    addOnce('meta[name="apple-mobile-web-app-status-bar-style"]', function () { const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-status-bar-style'; m.content = 'black-translucent'; return m; });
    // Ceinture + bretelles : si un ancien SW traîne encore, on le désinscrit côté page aussi.
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) { regs.forEach(function (r) { r.unregister(); }); }).catch(function () {});
      // Purge les caches laissés par l'ancienne PWA : un SW fantôme "cache-first" devient
      // inoffensif sans ses caches (chaque requête retombe alors sur le réseau). C'est ce qui
      // faisait "disparaître" des notes : GET API servis depuis un cache toujours un coup en
      // retard → lecture périmée → réécriture du devis sur une base périmée.
      if (window.caches && caches.keys) {
        caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
      }
      // Si un SW contrôle ENCORE cette page (zombie pas encore délogé), un rechargement unique
      // suffit à s'en débrancher (la désinscription ne prend effet qu'à la navigation suivante).
      // Garde sessionStorage : jamais plus d'un rechargement automatique par onglet.
      try {
        if (navigator.serviceWorker.controller && !sessionStorage.getItem('ss_sw_purge')) {
          sessionStorage.setItem('ss_sw_purge', '1');
          setTimeout(function () { location.reload(); }, 500);
        }
      } catch (e) {}
    }
  })();

  window.SSNav = {
    mount: mount, getIdentity: getIdentity, rafraichirCompteurs: rafraichirCompteurs, ouvrirAssistant: ouvrirAssistant, mascotte: mascotte,
    // exposés pour tests/nav.test.html : ils décident de tout et ne doivent pas dériver en silence
    _pageKey: pageKey, _pageCourante: pageCourante, _estActive: estActive, _chargerAttente: chargerAttente,
    _marquerBacASable: marquerBacASable,
    _NAV: { accueil: NAV_ACCUEIL, creer: NAV_CREER, groupes: NAV_GROUPS, reglages: NAV_REGLAGES, badges: BADGE_KEYS },
  };
})();
