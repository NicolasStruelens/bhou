/* ═══════════════════════════════════════════════════════════════════════════════════════════
   L'ASSISTANT — un panneau sur toutes les pages, qui parle à Claude (window.SSAssistant)
   « On va mettre en place le chatbot » (Nicolas, 25/10/2026). Trois choix faits avec lui :
   un panneau sur toutes les pages, qui LIT tout et n'écrit qu'après CONFIRMATION, sur Opus 5.5.

   ⚠️ LES OUTILS TOURNENT ICI, DANS LE NAVIGATEUR, avec les fonctions de l'ERP — jamais une
      seconde lecture de la base côté serveur. « À faire » vient de SSActions (la règle du
      tableau de bord), l'argent dû de SSUI.duFacture, les écritures des routes CIBLÉES de
      SS.* (règle 3) avec l'identité Access. Le serveur (/api/assistant) ne fait que parler à
      Claude : il ne voit des données que ce que ces outils lui renvoient.
   ⚠️ UNE ÉCRITURE N'EST QU'UNE CARTE. Claude « propose » (proposer_mot, proposer_note,
      proposer_attente) ; rien ne part tant qu'on n'a pas cliqué Confirmer. Aucune suppression,
      aucun changement de statut, aucun envoi au client n'existe dans la liste des outils.
   ⚠️ LA CONVERSATION NE SE RÉÉCRIT JAMAIS. Elle est renvoyée entière à chaque tour, et l'API
      refuse un historique retouché (les blocs de réflexion sont liés à ce qui les précède). On
      AJOUTE toujours : une proposition laissée sans réponse reçoit un résultat « annulée » au
      message suivant, une étape interrompue un résultat « interrompue ».
   La conversation vit dans sessionStorage : elle suit l'onglet d'une page à l'autre, et
   disparaît quand on le ferme. Protégé par tests/assistant.test.html.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.SSAssistant) return;

  const API = '/api/assistant';
  const CLE_CONV = 'ss_assistant_conv';
  const CLE_OUVERT = 'ss_assistant_ouvert';
  const CLE_BROUILLON = 'ss_assistant_brouillon';
  const MAX_ETAPES = 8;               // appels au modèle pour UNE question (boucle d'outils)
  const MAX_RESULTAT = 14000;         // caractères renvoyés par outil
  const MAX_CONV = 700000;            // au-delà, on propose d'en commencer une nouvelle
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE_JS = SRC.replace(/assistant\.js(?:[?#].*)?$/, '');

  const SSUI = window.SSUI;
  const icon = (n, s) => (SSUI && SSUI.icon ? SSUI.icon(n, s) : '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ══════ STYLES ══════ */
  const CSS = `
    /* Au bureau et sur tablette : une FENÊTRE posée au-dessus de Soli, en bas à droite. Elle laisse
       voir la page — l'ancien panneau pleine hauteur recouvrait la colonne du relais et la liste.
       Plan d'empilement pris dans tokens.css, jamais un nombre en dur (au-dessus des modales :
       on l'ouvre volontairement, par-dessus ce qu'on regarde). Sur téléphone : plein écran, plus bas. */
    .ssa { position: fixed; z-index: calc(var(--z-overlay, 1000) + 20);
      right: max(16px, env(safe-area-inset-right, 0px));
      bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--ssfab-leve, 0px) + 72px);
      width: min(420px, calc(100vw - 32px)); height: min(640px, calc(100vh - 110px - var(--ssfab-leve, 0px)));
      display: flex; flex-direction: column; overflow: hidden; border-radius: 16px;
      background: var(--surface, #111a33); color: var(--text, #e9eefb);
      border: 1px solid var(--border-strong, #324273); box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      transform-origin: bottom right; transform: translateY(10px) scale(0.97); opacity: 0; visibility: hidden;
      transition: transform 0.2s ease, opacity 0.2s ease, visibility 0s linear 0.2s; }
    .ssa.open { transform: none; opacity: 1; visibility: visible; transition: transform 0.2s ease, opacity 0.2s ease; }
    .ssa-tete { flex: none; display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.6rem 0.55rem 0.75rem;
      border-bottom: 1px solid var(--border, #263459); min-height: 56px; box-sizing: border-box;
      background: color-mix(in srgb, #FFC501 7%, var(--surface, #111a33)); }
    .ssa-titre { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 0.5rem; }
    .ssa-titre .ssm { width: 34px; height: 34px; flex: none; }
    .ssa-nom { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
    .ssa-nom b { font-family: var(--font-display, inherit); font-weight: 700; font-size: 1rem; }
    .ssa-sous { font-family: var(--font-mono, monospace); font-size: 0.6rem; font-weight: 500; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--text-subtle, #7d8bb0); white-space: nowrap; }
    .ssa-fermer-lib { display: none; }
    /* ── LA FENÊTRE SE DÉPLACE ET SE REDIMENSIONNE (bureau et tablette) ──
       L'en-tête est la poignée : une petite barre en haut le dit, le curseur aussi. Pendant le
       geste, la fenêtre « se soulève » (ombre plus profonde) ; aucune transition ne traîne derrière
       la main. Les bords et les coins se tirent ; le coin bas-droit porte des stries visibles. */
    .ssa-tete { position: relative; cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
    .ssa-tete::before { content: ''; position: absolute; top: 4px; left: 50%; width: 34px; height: 4px; margin-left: -17px;
      border-radius: 4px; background: var(--border-strong, #324273); opacity: 0.55; transition: opacity 0.15s ease, width 0.15s ease; }
    .ssa-tete:hover::before { opacity: 0.9; }
    .ssa.deplace .ssa-tete { cursor: grabbing; }
    .ssa.deplace, .ssa.redim { transition: none; user-select: none; -webkit-user-select: none; }
    .ssa.deplace { box-shadow: 0 34px 90px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--accent, #4d8bff) 35%, transparent); }
    .ssa-p { position: absolute; z-index: 4; touch-action: none; }
    .ssa-p[data-dir="n"] { top: 0; left: 16px; right: 16px; height: 6px; cursor: ns-resize; }
    .ssa-p[data-dir="s"] { bottom: 0; left: 16px; right: 16px; height: 6px; cursor: ns-resize; }
    .ssa-p[data-dir="e"] { right: 0; top: 16px; bottom: 16px; width: 6px; cursor: ew-resize; }
    .ssa-p[data-dir="w"] { left: 0; top: 16px; bottom: 16px; width: 6px; cursor: ew-resize; }
    .ssa-p[data-dir="nw"] { top: 0; left: 0; width: 16px; height: 16px; cursor: nwse-resize; }
    .ssa-p[data-dir="ne"] { top: 0; right: 0; width: 16px; height: 16px; cursor: nesw-resize; }
    .ssa-p[data-dir="sw"] { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; }
    .ssa-p[data-dir="se"] { bottom: 0; right: 0; width: 18px; height: 18px; cursor: nwse-resize; }
    .ssa-p[data-dir="se"]::after { content: ''; position: absolute; right: 4px; bottom: 4px; width: 9px; height: 9px; opacity: 0.55;
      background: linear-gradient(135deg, transparent 0 45%, var(--text-subtle, #7d8bb0) 45% 55%, transparent 55% 70%, var(--text-subtle, #7d8bb0) 70% 80%, transparent 80%); }
    .ssa-p[data-dir="se"]:hover::after { opacity: 1; }
    .ssa-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; min-height: 36px;
      padding: 0 0.6rem; border-radius: 8px; border: 1px solid var(--border, #263459); background: transparent;
      color: var(--text-muted, #b5c0de); font: inherit; font-size: 0.78rem; cursor: pointer; }
    .ssa-btn:hover { color: var(--text, #e9eefb); border-color: var(--border-strong, #324273); }
    .ssa-btn:focus-visible, .ssa-envoi:focus-visible, .ssa-sugg:focus-visible, .ssa-fil a:focus-visible,
    .ssa-carte button:focus-visible { outline: 2px solid var(--accent, #4d8bff); outline-offset: 2px; }
    .ssa-fermer { width: 40px; padding: 0; }
    .ssa-fil { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 0.9rem 0.9rem 0.4rem;
      display: flex; flex-direction: column; gap: 0.7rem; }
    .ssa-moi { align-self: flex-end; max-width: 86%; padding: 0.5rem 0.75rem; border-radius: 12px 12px 3px 12px;
      background: color-mix(in srgb, var(--accent, #4d8bff) 16%, transparent); white-space: pre-wrap;
      overflow-wrap: anywhere; font-size: 0.88rem; line-height: 1.45; }
    .ssa-lui { align-self: stretch; font-size: 0.88rem; line-height: 1.55; overflow-wrap: anywhere; }
    .ssa-lui p { margin: 0 0 0.5rem; } .ssa-lui p:last-child { margin-bottom: 0; }
    .ssa-lui ul, .ssa-lui ol { margin: 0 0 0.5rem; padding-left: 1.2rem; } .ssa-lui li { margin: 0.12rem 0; }
    .ssa-lui .ssa-h { font-weight: 700; margin-top: 0.3rem; }
    .ssa-lui a { color: var(--accent, #4d8bff); text-decoration: underline; text-underline-offset: 2px; }
    .ssa-lui code { font-family: var(--font-mono, monospace); font-size: 0.8em; padding: 0.05rem 0.3rem; border-radius: 4px;
      background: var(--surface-2, #18223f); }
    .ssa-lui hr { border: 0; border-top: 1px solid var(--border, #263459); margin: 0.6rem 0; }
    .ssa-outil { display: flex; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--text-subtle, #7d8bb0); }
    .ssa-outil .ok { color: var(--ok, #2fd27e); display: inline-flex; }
    .ssa-roue { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent;
      animation: ssa-tourne 0.8s linear infinite; flex: none; }
    @keyframes ssa-tourne { to { transform: rotate(360deg); } }
    .ssa-attente { display: inline-flex; gap: 4px; padding: 0.3rem 0; }
    .ssa-attente i { width: 6px; height: 6px; border-radius: 50%; background: var(--text-subtle, #7d8bb0); animation: ssa-point 1.1s infinite ease-in-out; }
    .ssa-attente i:nth-child(2) { animation-delay: 0.15s; } .ssa-attente i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ssa-point { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
    .ssa-carte { border: 1px solid var(--border-strong, #324273); border-left: 3px solid var(--accent, #4d8bff); border-radius: 10px;
      padding: 0.65rem 0.75rem; background: var(--surface-2, #18223f); display: flex; flex-direction: column; gap: 0.45rem; }
    .ssa-carte-t { font-weight: 700; font-size: 0.84rem; display: flex; align-items: center; gap: 0.4rem; }
    .ssa-carte-q { font-size: 0.74rem; color: var(--text-muted, #b5c0de); }
    .ssa-carte-texte { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.84rem; line-height: 1.45;
      padding: 0.45rem 0.55rem; border-radius: 6px; background: var(--surface, #111a33); max-height: 220px; overflow-y: auto; }
    .ssa-carte-pied { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .ssa-carte button { min-height: 36px; padding: 0 0.85rem; border-radius: 8px; font: inherit; font-size: 0.8rem; cursor: pointer;
      border: 1px solid var(--border-strong, #324273); background: transparent; color: var(--text, #e9eefb); }
    .ssa-carte button.oui { background: var(--accent, #4d8bff); border-color: var(--accent, #4d8bff); color: var(--on-accent, #fff); font-weight: 600; }
    .ssa-carte button:disabled { opacity: 0.55; cursor: default; }
    .ssa-carte.fait { border-left-color: var(--ok, #2fd27e); } .ssa-carte.non { border-left-color: var(--text-subtle, #7d8bb0); }
    .ssa-carte.rate { border-left-color: var(--danger, #ff5470); }
    .ssa-etat { font-size: 0.78rem; font-weight: 600; } .ssa-carte.fait .ssa-etat { color: var(--ok, #2fd27e); }
    .ssa-carte.rate .ssa-etat { color: var(--danger, #ff5470); } .ssa-carte.non .ssa-etat { color: var(--text-subtle, #7d8bb0); }
    .ssa-err { border: 1px solid color-mix(in srgb, var(--danger, #ff5470) 50%, transparent); border-radius: 10px; padding: 0.55rem 0.7rem;
      font-size: 0.82rem; color: var(--text, #e9eefb); background: color-mix(in srgb, var(--danger, #ff5470) 10%, transparent);
      display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .ssa-note { font-size: 0.76rem; color: var(--text-subtle, #7d8bb0); }
    .ssa-vide { display: flex; flex-direction: column; gap: 0.55rem; padding: 0.4rem 0; }
    .ssa-salut { display: flex; align-items: center; gap: 0.7rem; }
    .ssa-salut .ssm { width: 56px; height: 56px; flex: none; }
    .ssa-vide-t { font-size: 0.9rem; font-weight: 600; } .ssa-vide-s { font-size: 0.8rem; color: var(--text-muted, #b5c0de); line-height: 1.45; }
    .ssa-suggs { display: flex; flex-direction: column; gap: 0.35rem; }
    .ssa-sugg { text-align: left; min-height: 38px; padding: 0.45rem 0.7rem; border-radius: 9px; cursor: pointer; font: inherit; font-size: 0.82rem;
      border: 1px solid var(--border, #263459); background: transparent; color: var(--text, #e9eefb); }
    .ssa-sugg:hover { border-color: var(--accent, #4d8bff); background: color-mix(in srgb, var(--accent, #4d8bff) 8%, transparent); }
    .ssa-saisie { flex: none; border-top: 1px solid var(--border, #263459); padding: 0.6rem 0.7rem;
      padding-bottom: max(0.6rem, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 0.35rem; }
    .ssa-ligne { display: flex; gap: 0.45rem; align-items: flex-end; }
    .ssa-texte { flex: 1 1 auto; min-width: 0; resize: none; min-height: 40px; max-height: 140px; box-sizing: border-box;
      padding: 0.55rem 0.7rem; border-radius: 10px; border: 1px solid var(--input-border, var(--border, #263459));
      background: var(--input-bg, var(--surface-2, #18223f)); color: var(--text, #e9eefb); font: inherit; font-size: 0.9rem; line-height: 1.35; }
    .ssa-texte:focus { outline: 2px solid var(--accent, #4d8bff); outline-offset: -1px; }
    .ssa-envoi { flex: none; width: 40px; height: 40px; border-radius: 10px; border: 0; cursor: pointer; display: grid; place-items: center;
      background: var(--accent, #4d8bff); color: var(--on-accent, #fff); }
    .ssa-envoi.stop { background: var(--surface-3, #22305a); color: var(--text, #e9eefb); }
    .ssa-envoi:disabled { opacity: 0.5; cursor: default; }
    .ssa-avert { font-size: 0.66rem; color: var(--text-subtle, #7d8bb0); line-height: 1.35; }
    @media (max-width: 640px) {
      .ssa { inset: 0; width: auto; height: auto; border-radius: 0; border: 0; box-shadow: none;
        transform: translateY(14px); transform-origin: center; }
      .ssa-btn { min-height: 40px; }
      /* « Fermer » EN TOUTES LETTRES sur téléphone : une croix seule ne s'est pas vue (25/10/2026). */
      .ssa-btn.ssa-fermer { width: auto; min-height: 44px; padding: 0 0.75rem; color: var(--text, #e9eefb);
        border-color: var(--border-strong, #324273); font-weight: 600; }   /* après .ssa-btn, sinon il retombe à 40 px */
      .ssa-fermer-lib { display: inline; }
      .ssa-p { display: none; }
      .ssa-tete { cursor: default; touch-action: auto; }
      .ssa-tete::before { display: none; }
      html.ssa-ouvert, html.ssa-ouvert body { overflow: hidden; }
      .ssa-texte { font-size: 16px; }   /* sous 16 px, iOS zoome sur le champ et la page déborde */
    }
    @media (prefers-reduced-motion: reduce) {
      .ssa, .ssa.open { transition: none; } .ssa-roue, .ssa-attente i { animation: none; }
      .ssa-tete::before { transition: none; }
    }
  `;

  /* ══════ L'ÉTAT ══════ */
  // messages : la conversation au format de l'API (seule source de vérité de l'affichage).
  // decisions : résultats déjà connus d'appels d'outil du DERNIER tour, pas encore envoyés
  //             (lectures faites pendant qu'une carte attend, cartes confirmées ou annulées).
  let conv = lireConv();
  let enCours = false;          // un tour est en route (appel au modèle ou outils)
  let controleur = null;        // AbortController de l'appel en cours
  let vivant = null;            // { texte } de la réponse en train d'arriver
  let outilsEnCours = {};       // id d'appel d'outil → true pendant son exécution
  let erreur = null;            // { message, reessayer: bool }
  let avis = '';                // remarque discrète sous la conversation (refus, coupure…)
  let panneau = null, fil = null, zone = null, boutonEnvoi = null, ouvreur = null;

  function convVide() { return { v: 1, messages: [], decisions: {} }; }
  function lireConv() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CLE_CONV) || 'null');
      if (c && c.v === 1 && Array.isArray(c.messages)) { c.decisions = c.decisions || {}; return c; }
    } catch (e) {}
    return convVide();
  }
  function sauver() { try { sessionStorage.setItem(CLE_CONV, JSON.stringify(conv)); } catch (e) {} }

  /* ══════ LES DONNÉES — les mêmes lectures que le tableau de bord ══════ */
  const D = { at: 0, devis: [], factures: [], rdv: [], sujets: [], clients: [], moi: null };
  let chargement = null;
  function chargerScript(nom, present) {
    if (present()) return Promise.resolve(true);
    return new Promise((resolve) => {
      if (!BASE_JS) { resolve(false); return; }
      const sc = document.createElement('script');
      sc.src = BASE_JS + nom;
      sc.onload = () => resolve(present());
      sc.onerror = () => resolve(false);
      document.head.appendChild(sc);
    });
  }
  async function modules() {
    await chargerScript('config.js', () => !!window.SSConf);
    await chargerScript('attente.js', () => !!window.SSAttente);
    return chargerScript('actions.js', () => !!window.SSActions);
  }
  async function donnees() {
    if (Date.now() - D.at < 60000) return D;
    if (chargement) return chargement;
    chargement = (async () => {
      await modules();
      const SS = window.SS;
      if (!SS) throw new Error('Cette page ne charge pas l’accès aux données de l’ERP.');
      const [raw, facs, clients, rdvs, sujets] = await Promise.all([
        SS.listDevis(), SS.listFactures(), SS.listClients(),
        SS.listRdv ? SS.listRdv().catch(() => []) : Promise.resolve([]),
        SS.listSujets ? SS.listSujets().catch(() => []) : Promise.resolve([]),
      ]);
      D.devis = (raw || []).map(SSUI.normDevis);
      D.factures = facs || []; D.clients = clients || []; D.rdv = rdvs || []; D.sujets = sujets || [];
      D.moi = await identite();
      D.at = Date.now();
      return D;
    })();
    try { return await chargement; } finally { chargement = null; }
  }
  function oublierDonnees() { D.at = 0; }
  async function identite() {
    let id = null;
    try { id = window.SSNav && window.SSNav.getIdentity ? await window.SSNav.getIdentity() : null; } catch (e) { id = null; }
    const key = (id && id.key) || '';
    return { key, nom: (id && id.name) || '', autre: key === 'nicolas' ? 'yannick' : (key === 'yannick' ? 'nicolas' : '') };
  }
  let ACT = null;
  function act() {
    if (!ACT) ACT = window.SSActions.creer({ factures: () => D.factures, devis: () => D.devis, rdv: () => D.rdv, sujets: () => D.sujets });
    return ACT;
  }

  /* ══════ PETITS OUTILS DE MISE EN FORME (pour Claude) ══════ */
  const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function correspond(texte, champs) {
    const mots = sansAccent(texte).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const h = sansAccent(champs.filter(Boolean).join(' '));
    return mots.every((m) => h.indexOf(m) >= 0);
  }
  const eur = (n) => SSUI.fmtEur(Number(n) || 0);
  const jj = (iso) => (iso && !isNaN(new Date(iso).getTime()) ? SSUI.fmtDate(iso) : '');
  const nomDevis = (d) => ((d.prenom || '') + ' ' + (d.nom || '')).trim() || 'Sans nom';
  const nomPersonne = (c) => (c && typeof c === 'object' ? ((c.prenom || '') + ' ' + (c.nom || '')).trim() : String(c || ''));
  const nomAssocie = (k) => (SSUI.IDENTITE_LABEL && SSUI.IDENTITE_LABEL[k]) || k || '';
  const lienApp = (href) => '/app/' + String(href || '').replace(/^\/+/, '').replace(/^app\//, '');
  const lienDevis = (id) => lienApp('vue.html?id=' + encodeURIComponent(id));
  const statutLib = (s) => (SSUI.STATUT_DEVIS_LABEL && SSUI.STATUT_DEVIS_LABEL[s]) || s || '';
  const adresseTexte = (a) => (a && typeof a === 'object' ? Object.values(a).filter((v) => typeof v === 'string' && v.trim()).join(', ') : String(a || ''));
  // L'état de la pose d'un devis, en clair — mêmes règles que le tableau de bord.
  function etatPose(n, A) {
    const dp = n.chantier && n.chantier.date_pose, faite = SSUI.isPoseDone(n);
    if (faite && A.poseAVenir(n)) return 'première pose faite (PV), la suite est prévue le ' + jj(dp) + ' : chantier posé en plusieurs fois';
    if (faite) return 'pose faite' + (dp ? ' (le ' + jj(dp) + ')' : '');
    if (dp) return 'prévue le ' + jj(dp);
    return 'pas encore de date';
  }
  function trouverDevis(id) {
    const k = String(id || '').trim().replace(/^#/, '').toLowerCase();
    if (!k) return null;
    return D.devis.find((d) => String(d.id).toLowerCase() === k) || null;
  }
  function texteCourt(s, n) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* ══════ LES OUTILS ══════
     Les DESCRIPTIONS (ce que Claude lit) vivent côté serveur, avec le prompt, pour rester en
     cache ; ici, l'exécution. `ecrit` = carte à confirmer : `verifier` refuse tôt une demande
     mal formée (sans carte), `carte` dit ce qui sera fait, `appliquer` le fait. */
  const OUTILS = {
    a_faire: { lib: 'Je regarde ce qu’il y a à faire', async run(p) {
      await donnees();
      const tout = act().actionsDuJour();
      const moi = D.moi.key, autre = D.moi.autre;
      const pour = ['moi', 'autre', 'tous'].includes(p.pour) ? p.pour : 'moi';
      const liste = (!moi || pour === 'tous') ? tout
        : (pour === 'autre' ? tout.filter((x) => x.qui === autre) : tout.filter((x) => !x.qui || x.qui === moi));
      return {
        pour: pour === 'autre' ? nomAssocie(autre) : (pour === 'tous' || !moi ? 'tout le monde' : nomAssocie(moi) + ' (et ce que personne n’a pris)'),
        nombre: liste.length,
        entrees: liste.slice(0, 40).map((x) => ({
          pour_qui: x.qui ? nomAssocie(x.qui) : 'personne', genre: x.fam, client: x.nom, detail: x.detail,
          montant: x.extra || undefined, geste: x.bouton, lien: lienApp(x.href),
        })),
      };
    } },

    chercher_devis: { lib: 'Je cherche dans les devis', async run(p) {
      await donnees();
      const A = act();
      const statut = p.statut || 'actifs';
      const limite = Math.min(50, Math.max(1, parseInt(p.limite, 10) || 20));
      const liste = D.devis.filter((d) => {
        if (statut === 'actifs') { if (d.archive || !A.estActif(d)) return false; }
        else if (statut !== 'tous' && d.statut !== statut) return false;
        return correspond(p.texte, [d.id, d.prenom, d.nom, d.ville, d.email, d.telephone, SSUI.resumeDevis(d)]);
      }).sort((a, b) => String(b.date_modification).localeCompare(String(a.date_modification)));
      return {
        trouves: liste.length, affiches: Math.min(limite, liste.length),
        devis: liste.slice(0, limite).map((d) => {
          const a = A.prochaineAction(d);
          return {
            id: d.id, type: A.estDepannage(d) ? 'Dépannage' : 'Devis', client: nomDevis(d), ville: d.ville || undefined,
            statut: statutLib(d.statut) + (d.archive ? ' (archivé)' : ''), montant_ttc: eur(d.ttc),
            vendeur: nomAssocie(d.seller_principal), resume: SSUI.resumeDevis(d) || undefined,
            cree_le: jj(d.date_creation), modifie_le: jj(d.date_modification),
            prochaine_action: a ? (a.titre || a.txt) : 'rien à faire', lien: lienDevis(d.id),
          };
        }),
      };
    } },

    detail_devis: { lib: 'J’ouvre le devis', async run(p) {
      await donnees();
      const A = act();
      const n = trouverDevis(p.id);
      if (!n) return { erreur: 'Aucun devis portant le numéro « ' + p.id + ' ». Cherche-le d’abord avec chercher_devis.' };
      let f = null;
      try { f = await window.SS.getDevis(n.id); } catch (e) { f = null; }
      f = f || {};
      const cl = f.client || {};
      const a = A.prochaineAction(n);
      const att = SSUI.attenteClient(n);
      const facs = D.factures.filter((x) => x.devis_id === n.id);
      return {
        id: n.id, lien: lienDevis(n.id), type: A.estDepannage(n) ? 'Dépannage' : 'Devis',
        statut: statutLib(n.statut) + (n.archive ? ' (archivé)' : ''),
        client: { nom: nomDevis(n), telephone: cl.telephone || n.telephone || undefined, email: cl.email || n.email || undefined,
          adresse: adresseTexte(cl.adresse || n.adresse) || undefined },
        montant_ttc: eur(n.ttc), acompte_pct: n.acompte_pct != null ? n.acompte_pct : undefined,
        vendeur: nomAssocie(n.seller_principal),
        benefices_internes: { nicolas: eur(n.nicolas_net), yannick: eur(n.yannick_net) },
        resume: SSUI.resumeDevis(f.items ? f : n) || undefined,
        ouvertures: (f.items || []).slice(0, 40).map((it) => ({
          type: (SSUI.TYPE_LABEL && SSUI.TYPE_LABEL[it.type]) || it.type, modele: it.modele || undefined,
          dimensions: (SSUI.dimsOf && SSUI.dimsOf(it)) || undefined, quantite: it.quantite || undefined,
          emplacement: it.emplacement || undefined,
        })),
        prochaine_action: a ? (a.titre || a.txt) : 'rien à faire',
        historique: (n.statut_history || []).slice(-10).map((h) => ({ statut: statutLib(h.statut), le: jj(h.date), par: h.by || undefined })),
        relances: (n.relances || []).map((r) => ({ n: r.n, le: jj(r.date), par: r.by || undefined })),
        mise_en_attente: (att.active || att.echue) ? { etat: att.texte, motif: att.motif } : undefined,
        espace_client: { lien_cree: !!n.has_review_link, vues: n.review_views || 0, accepte_en_ligne: !!n.client_accepted,
          question_sans_reponse: !!n.client_question_open },
        commande: A.estDepannage(n) ? undefined : (SSUI.COMMANDE_LABEL[SSUI.etatCommande(n)] || undefined),
        /* ⚠️ LA POSE SE DIT EN UNE PHRASE, avec la règle du tableau de bord (poseAVenir) : un PV avec
           une date de pose À VENIR, c'est un chantier posé en plusieurs fois, dont la suite est
           prévue. Donné en deux champs bruts (« pose faite : oui », « pose : 29/10 »), Claude y a vu
           une incohérence sur l'École du Bonheur et a proposé de « corriger » des données justes
           (25/10/2026). */
        pose: A.estDepannage(n) ? undefined : etatPose(n, A),
        factures: facs.map((x) => ({
          numero: x.id, type: x.type || undefined, total: eur(x.total_ttc), paye: eur(A.paidSum(x)),
          reste_du: eur(SSUI.duFacture(x, D.factures)), echeance: jj(x.echeance) || undefined,
          lien: lienApp('facture.html?id=' + encodeURIComponent(x.id)),
        })),
        sav: (n.sav_tickets || []).map((t) => ({
          statut: t.statut, type: (SSUI.SAV_TYPE_LABEL && SSUI.SAV_TYPE_LABEL[t.type]) || t.type || undefined,
          description: texteCourt(t.description, 300), ouvert_le: jj(t.date_creation), pour: t.pour ? nomAssocie(t.pour) : 'personne',
        })),
        notes_internes: (f.comments || []).slice(-8).map((c) => ({
          par: c.author, le: jj(c.date), type: c.type || 'note', visible_par_le_client: c.visible_client ? true : undefined,
          texte: texteCourt(c.text, 500),
        })),
      };
    } },

    chercher_clients: { lib: 'Je cherche dans les clients', async run(p) {
      await donnees();
      const liste = D.clients.filter((c) => correspond(p.texte, [c.prenom, c.nom, c.societe, c.email, c.telephone, adresseTexte(c.adresse)]));
      return {
        trouves: liste.length,
        clients: liste.slice(0, 15).map((c) => {
          const k = c.key || SSUI.clientKeyOf(c.prenom, c.nom);
          const ses = D.devis.filter((d) => SSUI.clientKeyOf(d.prenom, d.nom) === k);
          return {
            nom: nomPersonne(c) || c.societe || 'Sans nom', societe: c.societe || undefined,
            telephone: c.telephone || undefined, email: c.email || undefined, adresse: adresseTexte(c.adresse) || undefined,
            devis: ses.map((d) => ({ id: d.id, statut: statutLib(d.statut), montant_ttc: eur(d.ttc), lien: lienDevis(d.id) })),
            lien: lienApp('clients.html?q=' + encodeURIComponent(nomPersonne(c) || c.societe || '')),
          };
        }),
      };
    } },

    factures: { lib: 'Je regarde les factures', async run(p) {
      await donnees();
      const A = act();
      const etat = ['a_encaisser', 'en_retard', 'toutes'].includes(p.etat) ? p.etat : 'a_encaisser';
      const auj = SSUI.aujourdhui();
      const liste = D.factures.map((f) => ({ f, du: SSUI.duFacture(f, D.factures) })).filter(({ f, du }) => {
        if (etat === 'a_encaisser' && du <= 0.005) return false;
        if (etat === 'en_retard' && !(du > 0.005 && f.echeance && f.echeance < auj)) return false;
        return correspond(p.texte, [f.id, nomPersonne(f.client), f.devis_id, f.ref_externe]);
      }).sort((a, b) => String(a.f.echeance || '9').localeCompare(String(b.f.echeance || '9')));
      return {
        nombre: liste.length, total_reste_du: eur(liste.reduce((s, x) => s + x.du, 0)),
        factures: liste.slice(0, 40).map(({ f, du }) => ({
          numero: f.id, type: f.type || undefined, client: nomPersonne(f.client) || undefined, total: eur(f.total_ttc),
          paye: eur(A.paidSum(f)), reste_du: eur(du), echeance: jj(f.echeance) || undefined,
          en_retard: (du > 0.005 && f.echeance && f.echeance < auj) ? true : undefined,
          devis_id: f.devis_id || undefined, lien: lienApp('facture.html?id=' + encodeURIComponent(f.id)),
        })),
      };
    } },

    planning: { lib: 'Je regarde le planning', async run(p) {
      await donnees();
      const A = act();
      const auj = SSUI.aujourdhui();
      const du = /^\d{4}-\d{2}-\d{2}$/.test(p.du || '') ? p.du : auj;
      const au = /^\d{4}-\d{2}-\d{2}$/.test(p.au || '') ? p.au : SSUI.isoDate(new Date(Date.now() + 14 * 86400000));
      const dans = (x) => { const j = String(x || '').slice(0, 10); return j >= du && j <= au; };
      const out = [];
      D.devis.forEach((d) => {
        const dp = d.chantier && d.chantier.date_pose;
        if (!dp || !dans(dp) || window.SSActions.DEAD_STATUSES.includes(d.statut)) return;
        out.push({ date: String(dp).slice(0, 10), quoi: A.estDepannage(d) ? 'Intervention' : (SSUI.isPoseDone(d) ? 'Suite de pose (chantier en plusieurs fois)' : 'Pose'), client: nomDevis(d),
          ville: d.ville || undefined, resume: SSUI.resumeDevis(d) || undefined, vendeur: nomAssocie(d.seller_principal), lien: lienDevis(d.id) });
      });
      D.rdv.forEach((r) => {
        if (r.statut !== 'rdv_fixe' || !dans(r.date_rdv)) return;
        const h = String(r.date_rdv || '').slice(11, 16);
        out.push({ date: String(r.date_rdv).slice(0, 10), heure: (h && h !== '00:00') ? h : undefined, quoi: 'Visite client',
          client: nomPersonne(r.client) || 'Sans nom', projet: r.projet || undefined,
          pour: r.assigned_to ? nomAssocie(r.assigned_to) : 'personne', lien: lienApp('rdv.html?open=' + encodeURIComponent(r.id)) });
      });
      out.sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || '')));
      return { du: jj(du), au: jj(au), nombre: out.length, prevu: out.map((x) => Object.assign({}, x, { date: jj(x.date) })) };
    } },

    demandes_rdv: { lib: 'Je regarde les demandes de RDV', async run(p) {
      await donnees();
      const ouvertes = p.ouvertes !== false;
      const liste = D.rdv.filter((r) => !ouvertes || !['converti', 'annule'].includes(r.statut))
        .sort((a, b) => String(b.date_creation || '').localeCompare(String(a.date_creation || '')));
      return {
        nombre: liste.length,
        demandes: liste.slice(0, 40).map((r) => {
          const c = r.client || {};
          const h = String(r.date_rdv || '').slice(11, 16);
          return {
            client: nomPersonne(c) || 'Sans nom', telephone: c.telephone || undefined,
            ville: (c.adresse && c.adresse.ville) || undefined, projet: r.projet || undefined, source: r.source || undefined,
            statut: r.statut, visite: r.date_rdv ? jj(r.date_rdv) + (h && h !== '00:00' ? ' à ' + h : '') : undefined,
            pour: r.assigned_to ? nomAssocie(r.assigned_to) : 'personne', recue_le: jj(r.date_creation),
            lien: lienApp('rdv.html?open=' + encodeURIComponent(r.id)),
          };
        }),
      };
    } },

    echanges: { lib: 'Je lis les échanges', async run(p) {
      await donnees();
      const ouverts = p.ouverts !== false;
      const liste = D.sujets.filter((s) => (!ouverts || s.statut !== 'fait') && correspond(p.texte, [s.titre, s.corps, s.client_nom, s.decision]))
        .sort((a, b) => String(b.date_modification || '').localeCompare(String(a.date_modification || '')));
      return {
        nombre: liste.length,
        sujets: liste.slice(0, 40).map((s) => ({
          titre: s.titre, texte: texteCourt(s.corps, 400) || undefined, genre: s.kind,
          de: s.auteur ? nomAssocie(s.auteur) : undefined, pour: s.pour ? nomAssocie(s.pour) : 'personne',
          attend: s.awaiting ? nomAssocie(s.awaiting) : 'personne', statut: s.statut === 'fait' ? 'classé' : 'ouvert',
          echeance: jj(s.echeance) || undefined, client: s.client_nom || undefined, devis_id: s.devis_id || undefined,
          decision: s.decision ? texteCourt(s.decision, 300) : undefined, reponses: s.reponses_count || 0,
          modifie_le: jj(s.date_modification), lien: lienApp('echanges.html#suj-' + encodeURIComponent(s.id)),
        })),
      };
    } },

    chiffres: { lib: 'Je calcule les chiffres', async run(p) {
      await donnees();
      const K = act().chiffres(p.mois);
      return {
        mois: K.mois, signe_dans_le_mois: eur(K.caMois), devis_signes_dans_le_mois: K.duMois.length,
        objectif_du_mois: K.objectif > 0 ? eur(K.objectif) : 'aucun objectif réglé',
        en_jeu_chez_les_clients: eur(K.caEnJeu), devis_chez_les_clients: K.envoyes.length,
        acceptes_en_ligne_a_faire_signer: K.acceptes.length ? (K.acceptes.length + ' pour ' + eur(K.caAcceptes)) : 'aucun',
        facture_total: eur(K.totalFacture), encaisse_total: eur(K.caEncaisse), pourcentage_encaisse: K.encPct + ' %',
        reste_a_encaisser: eur(K.resteEncaisser), dont_en_retard: eur(K.enRetard),
        signe_depuis_toujours: eur(K.caSigne) + ' sur ' + K.signes.length + ' devis',
        benefices_vendeurs_internes: { nicolas: eur(K.nicolasNet), yannick: eur(K.yannickNet) },
      };
    } },

    sav: { lib: 'Je regarde le SAV', async run() {
      await donnees();
      const ATT = window.SSAttente;
      if (!ATT) return { erreur: 'Le module SAV n’a pas pu être chargé.' };
      const avecClient = D.devis.map((d) => Object.assign({}, d, { client: { prenom: d.prenom, nom: d.nom } }));
      const liste = ATT.depuisSav(avecClient);
      return {
        ouverts: liste.length,
        tickets: liste.slice(0, 40).map((i) => ({
          client: i.titre, etat: i.quoi, description: i.detail || undefined, pour: i.qui ? nomAssocie(i.qui) : 'personne',
          depuis: i.depuis ? ATT.delai(i.depuis) : undefined, lien: lienApp(i.href),
        })),
      };
    } },

    proposer_mot: { ecrit: true, lib: 'Mot à confirmer',
      async verifier(p) {
        await donnees();
        const texte = String(p.texte || '').trim();
        if (!texte) return 'Le mot est vide.';
        if (texte.length > 4000) return 'Le mot dépasse 4 000 caractères — raccourcis-le.';
        if (!D.moi.autre) return 'Je ne sais pas qui est connecté : impossible d’adresser un mot à l’autre.';
        if (p.devis_id && !trouverDevis(p.devis_id)) return 'Aucun devis numéro « ' + p.devis_id + ' ».';
        return '';
      },
      carte(p) {
        const d = p.devis_id ? trouverDevis(p.devis_id) : null;
        const GENRE = { afaire: 'À faire', question: 'Question', idee: 'Idée' };
        return { ic: 'message', titre: 'Mot pour ' + nomAssocie(D.moi.autre),
          quoi: (GENRE[p.genre] || 'À faire') + (d ? ' · devis ' + d.id + ' (' + nomDevis(d) + ')' : ''),
          texte: String(p.texte || '').trim(), oui: 'Envoyer à ' + nomAssocie(D.moi.autre) };
      },
      async appliquer(p) {
        const d = p.devis_id ? trouverDevis(p.devis_id) : null;
        const s = SSUI.nouveauSujet(String(p.texte).trim(), {
          kind: ['afaire', 'question', 'idee'].includes(p.genre) ? p.genre : 'afaire', pour: D.moi.autre,
          devis_id: d ? d.id : '', client_nom: d ? nomDevis(d) : '', client_key: d ? SSUI.clientKeyOf(d.prenom, d.nom) : '',
        });
        const r = await window.SS.saveSujet(s);
        if (!r || !r.ok) return { ok: false, erreur: (r && r.error) || 'Le mot n’est pas parti.' };
        return { ok: true, envoye_a: nomAssocie(D.moi.autre), lien: lienApp('echanges.html#suj-' + encodeURIComponent(s.id)) };
      } },

    proposer_note: { ecrit: true, lib: 'Note à confirmer',
      async verifier(p) {
        await donnees();
        if (!trouverDevis(p.devis_id)) return 'Aucun devis numéro « ' + p.devis_id + ' ».';
        const t = String(p.texte || '').trim();
        if (!t) return 'La note est vide.';
        if (t.length > 5000) return 'La note dépasse 5 000 caractères.';
        return '';
      },
      carte(p) {
        const d = trouverDevis(p.devis_id);
        const TYPE = { note: 'Note', question: 'Question', important: 'Important' };
        return { ic: 'edit', titre: 'Note interne sur le devis ' + d.id,
          quoi: nomDevis(d) + ' · ' + (TYPE[p.type] || 'Note') + ' · jamais visible par le client',
          texte: String(p.texte || '').trim(), oui: 'Ajouter la note' };
      },
      async appliquer(p) {
        const d = trouverDevis(p.devis_id);
        const r = await window.SS.addComment(d.id, { text: String(p.texte).trim(), type: ['note', 'question', 'important'].includes(p.type) ? p.type : 'note' });
        if (!r || !r.ok) return { ok: false, erreur: (r && r.error) || 'La note n’a pas été enregistrée.' };
        return { ok: true, hors_ligne: r.offline ? 'gardée sur cet appareil, elle partira à la reconnexion' : undefined, lien: lienDevis(d.id) };
      } },

    proposer_attente: { ecrit: true, lib: 'Mise en attente à confirmer',
      async verifier(p) {
        await donnees();
        const d = trouverDevis(p.devis_id);
        if (!d) return 'Aucun devis numéro « ' + p.devis_id + ' ».';
        if (SSUI.attenteApplicable && !SSUI.attenteApplicable(d)) return 'Ce devis (' + statutLib(d.statut) + ') ne se met pas en attente : seul un devis chez le client, en attente de sa réponse, peut l’être.';
        if (!String(p.motif || '').trim()) return 'Il faut un motif : sans lui, dans trois semaines, personne ne saura pourquoi le devis est gelé.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.revoir_le || ''))) return 'La date de reprise doit être au format AAAA-MM-JJ.';
        if (p.revoir_le <= SSUI.aujourdhui()) return 'La date de reprise doit être dans le futur.';
        return '';
      },
      carte(p) {
        const d = trouverDevis(p.devis_id);
        return { ic: 'clock', titre: 'Mettre en attente le devis ' + d.id,
          quoi: nomDevis(d) + ' · reprise le ' + jj(p.revoir_le) + ' · les relances sont gelées jusque-là',
          texte: String(p.motif || '').trim(), oui: 'Mettre en attente' };
      },
      async appliquer(p) {
        const d = trouverDevis(p.devis_id);
        const r = await window.SS.setDevisAttente(d.id, { motif: String(p.motif).trim(), revoir_le: p.revoir_le });
        if (!r || !r.ok) return { ok: false, erreur: (r && r.error) || 'La mise en attente n’a pas été enregistrée.' };
        return { ok: true, revoir_le: jj(p.revoir_le), lien: lienDevis(d.id) + '#relance' };
      } },
  };

  function resultatBloc(id, r) {
    let s = JSON.stringify(r === undefined ? null : r);
    if (s.length > MAX_RESULTAT) s = s.slice(0, MAX_RESULTAT) + ' …(tronqué : demande moins de résultats ou un filtre plus précis)';
    const b = { type: 'tool_result', tool_use_id: id, content: s };
    if (r && (r.erreur || r.ok === false)) b.is_error = true;
    return b;
  }
  async function executerLecture(tu) {
    const o = OUTILS[tu.name];
    if (!o || o.ecrit) return { erreur: 'Outil inconnu : ' + tu.name };
    const p = (tu.input && typeof tu.input === 'object') ? tu.input : {};
    try { return await o.run(p); }
    catch (e) { return { erreur: 'Lecture impossible : ' + ((e && e.message) || 'erreur inconnue') }; }
  }

  /* ══════ LE CONTEXTE de chaque question ══════ */
  function contexte() {
    const k = window.SSNav && window.SSNav._pageKey ? window.SSNav._pageKey(location.pathname) : '';
    const id = new URLSearchParams(location.search).get('id') || '';
    const jour = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    // Les titres s'écrivent « SolariScreen — Échanges » ou « Devis X — SolariScreen » : le nom de
    // l'application ne dit rien à Claude, seule la page compte.
    const titre = texteCourt(String(document.title || '').replace(/^\s*SolariScreen\s*[—–-]\s*/i, '')
      .replace(/\s*[—–-]\s*SolariScreen.*$/i, ''), 80);
    let c = '[Contexte] Aujourd’hui : ' + jour + '. Page ouverte : ' + (titre || k || 'inconnue') + (k ? ' (' + k + ')' : '') + '.';
    if (id && ['vue', 'devis', 'simulateur'].includes(k)) c += ' Devis ouvert : ' + id + '.';
    if (id && k === 'facture') c += ' Facture ouverte : ' + id + '.';
    return c;
  }
  function sansContexte(t) {
    const s = String(t || '');
    if (s.indexOf('[Contexte]') !== 0) return s;
    const i = s.indexOf('\n\n');
    return i >= 0 ? s.slice(i + 2) : '';
  }

  /* ══════ MARKDOWN SÛR ══════
     Tout est échappé AVANT la mise en forme ; un lien ne s'affiche que vers une page de l'ERP,
     un numéro de téléphone ou une adresse e-mail — jamais une adresse inventée. */
  function lienSur(u) {
    const v = String(u || '').replace(/&amp;/g, '&').trim();
    if (/^\/app\/[a-z0-9-]+(\.html)?([?#][^\s"'<>]*)?$/i.test(v)) return v;
    if (/^[a-z0-9-]+\.html([?#][^\s"'<>]*)?$/i.test(v)) return lienApp(v);
    if (/^tel:\+?[0-9 .()/-]{6,24}$/i.test(v)) return v.replace(/\s+/g, '');
    if (/^mailto:[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v)) return v;
    return '';
  }
  function enLigne(t) {
    let s = esc(t);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // L'adresse peut contenir des espaces (un numéro « tel:0470 12 34 56 ») : lienSur trie ensuite.
    s = s.replace(/\[([^\]]+)\]\(([^()\s][^()]*?)\)/g, (m, txt, url) => {
      const u = lienSur(url);
      return u ? '<a href="' + esc(u) + '">' + txt + '</a>' : txt;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    return s;
  }
  function md(src) {
    const lignes = String(src || '').replace(/\r/g, '').split('\n');
    let html = '', liste = null, para = [];
    const finPara = () => { if (para.length) { html += '<p>' + para.map(enLigne).join('<br>') + '</p>'; para = []; } };
    const finListe = () => { if (liste) { html += '</' + liste + '>'; liste = null; } };
    lignes.forEach((l) => {
      const ul = l.match(/^\s*[-*•]\s+(.*)$/), ol = l.match(/^\s*\d+[.)]\s+(.*)$/), h = l.match(/^\s*#{1,6}\s+(.*)$/);
      if (ul || ol) {
        finPara();
        const t = ul ? 'ul' : 'ol';
        if (liste !== t) { finListe(); html += '<' + t + '>'; liste = t; }
        html += '<li>' + enLigne((ul || ol)[1]) + '</li>';
        return;
      }
      finListe();
      if (!l.trim()) { finPara(); return; }
      if (h) { finPara(); html += '<p class="ssa-h">' + enLigne(h[1]) + '</p>'; return; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { finPara(); html += '<hr>'; return; }
      para.push(l);
    });
    finPara(); finListe();
    return html;
  }

  /* ══════ LA CONVERSATION ══════ */
  function dernierAssistant() {
    const m = conv.messages[conv.messages.length - 1];
    return m && m.role === 'assistant' ? m : null;
  }
  // Appels d'outil du dernier message de Claude encore sans résultat envoyé.
  function appelsOuverts() {
    const m = dernierAssistant();
    return m && Array.isArray(m.content) ? m.content.filter((b) => b.type === 'tool_use') : [];
  }
  function cartesEnAttente() {
    return appelsOuverts().filter((b) => OUTILS[b.name] && OUTILS[b.name].ecrit && !conv.decisions[b.id]);
  }
  // Les résultats à joindre au prochain message : ceux déjà connus, et pour les autres une
  // réponse honnête (annulée, interrompue) — jamais un trou, l'API refuserait la suite.
  function resultatsEnSuspens(raison) {
    return appelsOuverts().map((b) => resultatBloc(b.id, conv.decisions[b.id] ||
      (OUTILS[b.name] && OUTILS[b.name].ecrit ? { ok: false, annule: true, raison: raison || 'La personne n’a pas confirmé.' } : { erreur: 'Étape interrompue avant d’avoir pu lire les données.' })));
  }

  async function lireReponse(res, surTexte) {
    const lecteur = res.body.getReader();
    const dec = new TextDecoder();
    let tampon = '', fin = null;
    const traiter = (ligne) => {
      if (!ligne.trim()) return;
      let o; try { o = JSON.parse(ligne); } catch (e) { return; }
      if (o.t === 'texte') surTexte(String(o.d || ''));
      else if (o.t === 'fin') fin = o;
      else if (o.t === 'erreur') throw new Error(o.message || 'L’assistant n’a pas pu répondre.');
    };
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += dec.decode(value, { stream: true });
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) { const l = tampon.slice(0, i); tampon = tampon.slice(i + 1); traiter(l); }
    }
    traiter(tampon + dec.decode());
    if (!fin) throw new Error('La réponse a été coupée en route — réessaie.');
    return fin;
  }
  async function horsLigne() {
    try { await fetch('/assets/img/logo-solariscreen.svg?ping=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }); return false; }
    catch (e) { return true; }
  }
  async function appeler(surTexte) {
    controleur = new AbortController();
    let res;
    try {
      res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ messages: conv.messages }), signal: controleur.signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      // Session Access expirée = même TypeError qu'une coupure réseau : la sonde statique tranche.
      throw new Error((await horsLigne()) ? 'Pas de connexion — l’assistant a besoin d’internet.'
        : 'Session expirée — recharge la page (F5) puis réessaie. La conversation est gardée.');
    }
    const type = res.headers.get('Content-Type') || '';
    if (!res.ok || type.indexOf('ndjson') < 0) {
      let j = null; try { j = await res.json(); } catch (e) { j = null; }
      const err = new Error((j && j.error) || (res.ok ? 'Session expirée — recharge la page (F5) puis réessaie.' : 'L’assistant ne répond pas (erreur ' + res.status + ').'));
      err.definitif = !!(j && ['identite', 'cle', 'plafond', 'longue'].includes(j.code));
      throw err;
    }
    return lireReponse(res, surTexte);
  }

  // Un TOUR : Claude répond, demande des lectures (faites ici, aussitôt), recommence — jusqu'à
  // une réponse finale ou une carte à confirmer.
  async function tour() {
    if (enCours) return;
    enCours = true; erreur = null; avis = '';
    soliPense(true);
    peindre();
    let reponse = false;
    try {
      for (let etape = 0; etape < MAX_ETAPES; etape++) {
        vivant = { texte: '' };
        peindre();
        let planifie = false;
        const fin = await appeler((d) => {
          vivant.texte += d;
          if (!planifie) { planifie = true; requestAnimationFrame(() => { planifie = false; peindreVivant(); }); }
        });
        vivant = null;
        reponse = true;
        let contenu = Array.isArray(fin.content) ? fin.content : [];
        // Un refus peut arriver sans un mot (avant toute réponse) ou au milieu d'une phrase. On ne
        // garde que son texte : un appel d'outil coupé n'est pas à exécuter. Et jamais de message
        // vide — l'API refuserait toute la suite de la conversation.
        if (fin.stop_reason === 'refusal') contenu = contenu.filter((b) => b.type === 'text' && String(b.text || '').trim());
        if (!contenu.length) contenu = [{ type: 'text', text: fin.stop_reason === 'refusal' ? '(Je ne peux pas répondre à cette demande.)' : '(Pas de réponse.)' }];
        conv.messages.push({ role: 'assistant', content: contenu });
        conv.decisions = {};
        sauver();
        if (fin.stop_reason === 'refusal') { avis = 'Claude a refusé de répondre à cette demande — reformule-la autrement.'; break; }
        const appels = contenu.filter((b) => b.type === 'tool_use');
        if (!appels.length) { if (fin.stop_reason === 'max_tokens') avis = 'La réponse a été coupée (trop longue).'; break; }
        // Une entrée d'outil coupée par la limite de longueur peut avoir l'air complète : on ne l'exécute pas.
        if (fin.stop_reason === 'max_tokens') {
          appels.forEach((b) => { conv.decisions[b.id] = { erreur: 'Demande coupée avant la fin — refais-la plus simplement.' }; });
        } else {
          for (const b of appels) {
            const o = OUTILS[b.name];
            if (!o) { conv.decisions[b.id] = { erreur: 'Outil inconnu : ' + b.name }; continue; }
            if (o.ecrit) {
              const motif = await o.verifier(b.input || {}).catch((e) => 'Vérification impossible : ' + e.message);
              if (motif) conv.decisions[b.id] = { ok: false, erreur: motif };
              continue;   // valide → la carte attend le clic
            }
            outilsEnCours[b.id] = true; peindre();
            conv.decisions[b.id] = await executerLecture(b);
            delete outilsEnCours[b.id];
          }
        }
        sauver();
        if (cartesEnAttente().length) { peindre(); return; }
        conv.messages.push({ role: 'user', content: resultatsEnSuspens() });
        conv.decisions = {};
        sauver();
        if (etape === MAX_ETAPES - 1) avis = 'J’ai arrêté après ' + MAX_ETAPES + ' étapes — dis-moi si je continue.';
      }
    } catch (e) {
      vivant = null;
      if (e && e.name === 'AbortError') avis = 'Arrêté.';
      else erreur = { message: (e && e.message) || 'Erreur inconnue', reessayer: !(e && e.definitif) };
    } finally {
      enCours = false; controleur = null; outilsEnCours = {};
      soliPense(false);
      if (reponse && !erreur) soliSaute();
      peindre();
    }
  }

  /* Soli réfléchit pendant que l'assistant travaille (ses rayons tournent, dans l'en-tête comme
     sur la pastille), et saute de joie quand la réponse arrive. */
  function soliPense(oui) {
    document.querySelectorAll('.ssa-tete .ssm, .ssfab .ssm').forEach((m) => m.classList.toggle('ssm-pense', oui));
  }
  function soliSaute() {
    const m = panneau && panneau.querySelector('.ssa-tete .ssm');
    if (!m) return;
    m.classList.remove('ssm-saut'); void m.getBoundingClientRect(); m.classList.add('ssm-saut');
    m.addEventListener('animationend', () => m.classList.remove('ssm-saut'), { once: true });
  }

  function envoyer(texte) {
    const t = String(texte || '').trim();
    if (!t || enCours) return;
    if (JSON.stringify(conv.messages).length > MAX_CONV) {
      erreur = { message: 'La conversation est devenue très longue — commence-en une nouvelle (bouton « Nouvelle »).', reessayer: false };
      peindre(); return;
    }
    const bloc = { type: 'text', text: contexte() + '\n\n' + t };
    const prec = conv.messages[conv.messages.length - 1];
    if (prec && prec.role === 'assistant') {
      // Des appels restés sans suite (carte non confirmée, étape interrompue) reçoivent leur
      // résultat EN TÊTE du message : c'est la forme que l'API exige.
      const r = resultatsEnSuspens('La personne a écrit un nouveau message sans confirmer.');
      conv.messages.push({ role: 'user', content: r.concat([bloc]) });
    } else if (prec && prec.role === 'user') {
      // Le tour précédent a échoué avant toute réponse : on complète le message en attente au lieu
      // d'en empiler un second (deux messages de suite du même côté sont refusés).
      const c = Array.isArray(prec.content) ? prec.content : [{ type: 'text', text: String(prec.content) }];
      prec.content = c.concat([bloc]);
    } else {
      conv.messages.push({ role: 'user', content: [bloc] });
    }
    conv.decisions = {};
    sauver();
    if (zone) { zone.value = ''; ajusterZone(); }
    try { sessionStorage.removeItem(CLE_BROUILLON); } catch (e) {}
    tour();
  }

  async function decider(id, oui) {
    const b = appelsOuverts().find((x) => x.id === id);
    if (!b || conv.decisions[id] || enCours) return;
    const o = OUTILS[b.name];
    if (oui) {
      outilsEnCours[id] = true; peindre();
      let r;
      try { r = await o.appliquer(b.input || {}); } catch (e) { r = { ok: false, erreur: (e && e.message) || 'Échec' }; }
      delete outilsEnCours[id];
      conv.decisions[id] = r;
      if (r && r.ok) {
        oublierDonnees();
        try { if (window.SSNav && window.SSNav.rafraichirCompteurs) window.SSNav.rafraichirCompteurs(); } catch (e) {}
      }
    } else {
      conv.decisions[id] = { ok: false, annule: true, raison: 'La personne a annulé.' };
    }
    sauver();
    if (cartesEnAttente().length) { peindre(); return; }
    conv.messages.push({ role: 'user', content: resultatsEnSuspens() });
    conv.decisions = {};
    sauver();
    tour();
  }

  function nouvelle() {
    if (enCours && controleur) controleur.abort();
    conv = convVide(); erreur = null; avis = ''; vivant = null;
    sauver(); peindre();
    if (zone) zone.focus();
  }

  /* ══════ L'AFFICHAGE ══════ */
  function resultatsConnus() {
    const r = {};
    conv.messages.forEach((m) => {
      if (m.role === 'user' && Array.isArray(m.content)) m.content.forEach((b) => {
        if (b.type === 'tool_result') { let v = null; try { v = JSON.parse(b.content); } catch (e) { v = { brut: true }; } r[b.tool_use_id] = v; }
      });
    });
    Object.keys(conv.decisions).forEach((k) => { r[k] = conv.decisions[k]; });
    return r;
  }
  function htmlCarte(b, r, ouvert) {
    const o = OUTILS[b.name];
    let c;
    try { c = o.carte(b.input || {}); } catch (e) { c = null; }
    if (!c) return '';
    let classe = '', pied = '';
    if (r) {
      if (r.ok) { classe = 'fait'; pied = '<span class="ssa-etat">' + icon('check', 13) + ' Fait</span>' + (r.lien ? ' <a class="ssa-note" href="' + esc(lienSur(r.lien)) + '">voir</a>' : ''); }
      else if (r.annule) { classe = 'non'; pied = '<span class="ssa-etat">Annulé</span>'; }
      else { classe = 'rate'; pied = '<span class="ssa-etat">' + icon('warning', 13) + ' ' + esc(r.erreur || 'Échec') + '</span>'; }
    } else if (ouvert) {
      const occupe = !!outilsEnCours[b.id] || enCours;
      pied = '<button type="button" class="oui" data-ssa-oui="' + esc(b.id) + '"' + (occupe ? ' disabled' : '') + '>' + (outilsEnCours[b.id] ? 'En cours…' : esc(c.oui)) + '</button>' +
        '<button type="button" data-ssa-non="' + esc(b.id) + '"' + (occupe ? ' disabled' : '') + '>Annuler</button>';
    } else {
      classe = 'non'; pied = '<span class="ssa-etat">Sans suite</span>';
    }
    return '<div class="ssa-carte ' + classe + '"><div class="ssa-carte-t">' + icon(c.ic, 14) + ' ' + esc(c.titre) + '</div>' +
      '<div class="ssa-carte-q">' + esc(c.quoi) + '</div><div class="ssa-carte-texte">' + esc(c.texte) + '</div>' +
      '<div class="ssa-carte-pied">' + pied + '</div></div>';
  }
  // Soli, dessiné par nav.js (une seule description de la mascotte) ; repli discret sinon.
  function tete(taille) {
    return window.SSNav && window.SSNav.mascotte ? window.SSNav.mascotte(taille) : '<span style="color:var(--accent)">' + icon('sparkle', Math.round(taille / 2)) + '</span>';
  }
  function htmlVide() {
    const id = new URLSearchParams(location.search).get('id');
    const k = window.SSNav && window.SSNav._pageKey ? window.SSNav._pageKey(location.pathname) : '';
    const s = [];
    if (id && ['vue', 'devis', 'simulateur'].includes(k)) s.push('Résume ce devis et dis-moi la prochaine étape');
    s.push('Qu’est-ce que je dois faire maintenant ?', 'Quels devis faut-il relancer ?', 'Combien j’ai signé ce mois-ci ?',
      'Qu’est-ce qui reste à encaisser ?');
    // « l'autre » n'a de sens que si l'on sait qui est connecté.
    if (D.moi && D.moi.autre) s.push('Qu’est-ce qui attend ' + nomAssocie(D.moi.autre) + ' ?');
    return '<div class="ssa-vide"><div class="ssa-salut">' + tete(56) + '<div><div class="ssa-vide-t">Salut ! Moi, c’est Soli.</div>' +
      '<div class="ssa-vide-s">Je lis les devis, les factures, le planning et les échanges. Je ne modifie rien sans ton clic.</div></div></div>' +
      '<div class="ssa-suggs">' + s.slice(0, 5).map((q) => '<button type="button" class="ssa-sugg" data-ssa-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div></div>';
  }
  function peindre() {
    if (!fil) return;
    const res = resultatsConnus();
    const dernier = dernierAssistant();
    let html = '';
    conv.messages.forEach((m) => {
      const blocs = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content || []);
      if (m.role === 'user') {
        blocs.forEach((b) => { if (b.type === 'text') { const t = sansContexte(b.text); if (t.trim()) html += '<div class="ssa-moi">' + esc(t) + '</div>'; } });
        return;
      }
      blocs.forEach((b) => {
        if (b.type === 'text' && b.text && b.text.trim()) html += '<div class="ssa-lui">' + md(b.text) + '</div>';
        else if (b.type === 'tool_use') {
          const o = OUTILS[b.name];
          if (o && o.ecrit) { html += htmlCarte(b, res[b.id], m === dernier); return; }
          const fini = !!res[b.id] && !outilsEnCours[b.id];
          const lib = (o ? o.lib : b.name) + (b.name === 'detail_devis' && b.input && b.input.id ? ' ' + b.input.id : '');
          html += '<div class="ssa-outil">' + (fini ? '<span class="ok">' + icon('check', 12) + '</span>' : '<span class="ssa-roue" aria-hidden="true"></span>') + esc(lib) + '</div>';
        }
      });
    });
    if (vivant) html += '<div class="ssa-lui ssa-vivant">' + (vivant.texte ? md(vivant.texte) : '<span class="ssa-attente" aria-label="Claude réfléchit"><i></i><i></i><i></i></span>') + '</div>';
    if (avis) html += '<div class="ssa-note">' + esc(avis) + '</div>';
    if (erreur) html += '<div class="ssa-err" role="alert">' + icon('warning', 14) + ' <span>' + esc(erreur.message) + '</span>' +
      (erreur.reessayer ? '<button type="button" class="ssa-btn" data-ssa-reessayer="1">Réessayer</button>' : '') + '</div>';
    if (!conv.messages.length && !vivant && !erreur) html = htmlVide();
    const enBas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 80;
    fil.innerHTML = html;
    if (enBas || vivant) fil.scrollTop = fil.scrollHeight;
    if (boutonEnvoi) {
      boutonEnvoi.classList.toggle('stop', enCours);
      boutonEnvoi.innerHTML = enCours ? icon('x', 16) : icon('chevronright', 18);
      const t = enCours ? 'Arrêter' : 'Envoyer';
      boutonEnvoi.title = t; boutonEnvoi.setAttribute('aria-label', t);
    }
  }
  function peindreVivant() {
    if (!fil || !vivant) return;
    const n = fil.querySelector('.ssa-vivant');
    if (!n) { peindre(); return; }
    const enBas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 120;
    n.innerHTML = vivant.texte ? md(vivant.texte) : n.innerHTML;
    if (enBas) fil.scrollTop = fil.scrollHeight;
  }
  function ajusterZone() {
    if (!zone) return;
    zone.style.height = 'auto';
    zone.style.height = Math.min(140, zone.scrollHeight) + 'px';
  }

  function monter() {
    if (panneau) return;
    const st = document.createElement('style');
    st.id = 'ssa-css';
    st.textContent = CSS;
    document.head.appendChild(st);
    panneau = document.createElement('aside');
    panneau.className = 'ssa';
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', 'Soli, l’assistant');
    panneau.innerHTML =
      '<div class="ssa-tete"><div class="ssa-titre">' + tete(34) + '<span class="ssa-nom"><b>Soli</b><span class="ssa-sous">assistant · Claude</span></span></div>' +
        '<button type="button" class="ssa-btn" data-ssa-nouvelle="1" title="Commencer une nouvelle conversation">' + icon('plus', 13) + ' Nouvelle</button>' +
        '<button type="button" class="ssa-btn ssa-fermer" data-ssa-fermer="1" title="Fermer (Échap)" aria-label="Fermer l’assistant">' + icon('x', 16) + '<span class="ssa-fermer-lib">Fermer</span></button></div>' +
      '<div class="ssa-fil" aria-live="polite"></div>' +
      '<form class="ssa-saisie" novalidate><div class="ssa-ligne">' +
        '<textarea class="ssa-texte" rows="1" placeholder="Pose ta question…" aria-label="Ta question à l’assistant"></textarea>' +
        '<button type="submit" class="ssa-envoi" title="Envoyer" aria-label="Envoyer">' + icon('chevronright', 18) + '</button></div>' +
        '<div class="ssa-avert">Claude peut se tromper : vérifie un montant avant d’agir. Rien n’est modifié sans ton clic.</div></form>';
    panneau.insertAdjacentHTML('beforeend', ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
      .map((d) => '<i class="ssa-p" data-dir="' + d + '" aria-hidden="true"></i>').join(''));
    document.body.appendChild(panneau);
    // ⚠️ « enTete », pas « tete » : tete() dessine Soli, et un nom repris ici la masquerait.
    const enTete = panneau.querySelector('.ssa-tete');
    enTete.title = 'Glisse pour déplacer · double-clic pour remettre à sa place';
    enTete.addEventListener('pointerdown', (e) => { if (!e.target.closest('button, a')) geste(e, 'deplacer'); });
    enTete.addEventListener('dblclick', (e) => { if (!e.target.closest('button, a')) remettreEnPlace(); });
    panneau.querySelectorAll('.ssa-p').forEach((p) => p.addEventListener('pointerdown', (e) => geste(e, p.dataset.dir)));
    window.addEventListener('resize', () => { if (panneau.classList.contains('open')) appliquerGeo(); });
    fil = panneau.querySelector('.ssa-fil');
    zone = panneau.querySelector('.ssa-texte');
    boutonEnvoi = panneau.querySelector('.ssa-envoi');

    panneau.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (enCours) { if (controleur) controleur.abort(); return; }
      envoyer(zone.value);
    });
    zone.addEventListener('input', () => {
      ajusterZone();
      try { sessionStorage.setItem(CLE_BROUILLON, zone.value); } catch (e) {}
    });
    // Une question commencée ne se perd pas en changeant de page.
    try { const b = sessionStorage.getItem(CLE_BROUILLON); if (b) { zone.value = b; setTimeout(ajusterZone, 0); } } catch (e) {}
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!enCours) envoyer(zone.value); }
    });
    panneau.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t || !panneau.contains(t)) return;
      if (t.dataset.ssaFermer) fermer({});
      else if (t.dataset.ssaNouvelle) nouvelle();
      else if (t.dataset.ssaQ) envoyer(t.dataset.ssaQ);
      else if (t.dataset.ssaOui) decider(t.dataset.ssaOui, true);
      else if (t.dataset.ssaNon) decider(t.dataset.ssaNon, false);
      else if (t.dataset.ssaReessayer) tour();
      else if (t.tagName === 'A' && TEL()) {
        // Sur téléphone le panneau couvre tout l'écran : on le referme pour voir la page ouverte.
        try { sessionStorage.setItem(CLE_OUVERT, '0'); } catch (e2) {}
        // L'entrée d'historique du panneau est d'abord retirée, PUIS on suit le lien : sinon le
        // « retour » depuis la page ouverte retomberait sur une étape morte (rien ne bouge).
        if (entreeHistorique && /^https?:/.test(t.href)) {
          e.preventDefault();
          lienApres = t.href;
          entreeHistorique = false;
          history.back();
        }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !panneau.classList.contains('open')) return;
      if (document.querySelector('.cmdk-ov[style*="flex"], .modal-bg.open')) return;   // une fenêtre au-dessus se ferme d'abord
      fermer();
    });
    // Une proposition restée en suspens (page changée avant le clic) a besoin de ses données pour
    // afficher sa carte : on les charge en silence.
    if (cartesEnAttente().length) donnees().then(peindre).catch(() => {});
    donnees().then(() => { if (!conv.messages.length) peindre(); }).catch(() => {});
    peindre();
  }

  /* ── LE « RETOUR » DU TÉLÉPHONE FERME L'ASSISTANT ──
     « Quand je suis en mode tel, je ne sais pas sortir de l'assistant, pas moyen de revenir en
     arrière » (Nicolas, 25/10/2026). Sur téléphone le panneau couvre tout l'écran : la main fait
     le geste « retour », qui quittait la PAGE — et la page précédente rouvrait le panneau (il
     suivait l'onglet). Désormais l'ouverture ajoute une étape d'historique : « retour » ferme le
     panneau et laisse la page en place. La réouverture automatique est réservée au bureau (nav.js). */
  const TEL = () => window.matchMedia('(max-width: 640px)').matches;
  let entreeHistorique = false, lienApres = '';
  window.addEventListener('popstate', () => {
    if (lienApres) { const u = lienApres; lienApres = ''; location.href = u; return; }
    if (entreeHistorique) {
      entreeHistorique = false;
      if (panneau && panneau.classList.contains('open')) fermer({ historique: true });
    }
  });
  function peindrePastille(ouvert) {
    const f = document.querySelector('.ssfab');
    if (!f) return;
    f.setAttribute('aria-expanded', String(ouvert));
    f.setAttribute('aria-label', ouvert ? 'Fermer Soli' : 'Ouvrir Soli, l’assistant');
  }

  // o.direct : réouverture au chargement d'une page (la conversation suit l'onglet) — sans
  // glissement, qui ferait croire à une nouvelle ouverture, et sans voler le focus de la page.
  function ouvrir(depuis, o) {
    const direct = !!(o && o.direct);
    monter();
    ouvreur = depuis || (direct ? null : document.activeElement);
    appliquerGeo();
    origineDepuisSoli();
    if (direct) { panneau.style.transition = 'none'; void panneau.offsetWidth; }
    panneau.classList.add('open');
    if (direct) { void panneau.offsetWidth; panneau.style.transition = ''; }
    document.documentElement.classList.add('ssa-ouvert');
    peindrePastille(true);
    try { sessionStorage.setItem(CLE_OUVERT, '1'); } catch (e) {}
    if (!direct && TEL() && !entreeHistorique) {
      try { history.pushState({ ssa: 1 }, ''); entreeHistorique = true; } catch (e) {}
    }
    peindre();
    if (fil) fil.scrollTop = fil.scrollHeight;
    // Pas de clavier qui surgit sur téléphone : on ne donne le focus que là où il y a une souris.
    if (!direct && window.matchMedia('(pointer: fine)').matches) setTimeout(() => zone && zone.focus(), 60);
  }
  // o.historique : la fermeture VIENT du « retour » — l'étape est déjà retirée, on n'y touche pas.
  function fermer(o) {
    if (!panneau) return;
    panneau.classList.remove('open');
    document.documentElement.classList.remove('ssa-ouvert');
    peindrePastille(false);
    try { sessionStorage.setItem(CLE_OUVERT, '0'); } catch (e) {}
    if (!(o && o.historique) && entreeHistorique) {
      entreeHistorique = false;
      try { history.back(); } catch (e) {}
    }
    if (ouvreur && ouvreur.focus && document.contains(ouvreur)) { try { ouvreur.focus(); } catch (e) {} }
  }
  /* ── LA GÉOMÉTRIE DE LA FENÊTRE ──
     « La fenêtre, je dois savoir la bouger, la redimensionner, qu'elle ne parte pas quand je
     change de page » (Nicolas, 25/10/2026). Bureau et tablette seulement : sur téléphone, plein
     écran. Elle vit dans localStorage (propre à l'appareil) et suit l'onglet d'une page à l'autre.
     ⚠️ ELLE EST TOUJOURS RAMENÉE DANS L'ÉCRAN : posée sur un grand écran puis rouverte sur un
     portable, une fenêtre ne doit jamais se retrouver hors de portée, poignée comprise. */
  const CLE_GEO = 'ss_assistant_fenetre';
  const MARGE = 12, MIN_L = 340, MIN_H = 380, AIMANT = 18;
  let geo = lireGeo();   // { x, y, w, h } — null : sa place par défaut, au-dessus de Soli
  function lireGeo() {
    try {
      const g = JSON.parse(localStorage.getItem(CLE_GEO) || 'null');
      return g && ['x', 'y', 'w', 'h'].every((k) => typeof g[k] === 'number' && isFinite(g[k])) ? g : null;
    } catch (e) { return null; }
  }
  function borner(g) {
    const W = window.innerWidth, H = window.innerHeight;
    const w = Math.max(Math.min(Math.max(g.w, MIN_L), W - 2 * MARGE), 200);
    const h = Math.max(Math.min(Math.max(g.h, MIN_H), H - 2 * MARGE), 200);
    const x = Math.min(Math.max(g.x, MARGE), W - MARGE - w), y = Math.min(Math.max(g.y, MARGE), H - MARGE - h);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  // Les bords de l'écran attirent la fenêtre : posée à 2 cm du coin, elle s'y cale.
  function aimanter(g) {
    const W = window.innerWidth, H = window.innerHeight;
    if (Math.abs(g.x - MARGE) < AIMANT) g.x = MARGE;
    if (Math.abs(W - MARGE - (g.x + g.w)) < AIMANT) g.x = W - MARGE - g.w;
    if (Math.abs(g.y - MARGE) < AIMANT) g.y = MARGE;
    if (Math.abs(H - MARGE - (g.y + g.h)) < AIMANT) g.y = H - MARGE - g.h;
    return g;
  }
  function appliquerGeo() {
    if (!panneau) return;
    if (!geo || TEL()) {
      ['left', 'top', 'width', 'height', 'right', 'bottom'].forEach((k) => panneau.style.removeProperty(k));
      panneau.classList.remove('libre');
      return;
    }
    const g = borner(geo);
    Object.assign(panneau.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px', right: 'auto', bottom: 'auto' });
    panneau.classList.add('libre');
  }
  function sauverGeo() {
    try { if (geo) localStorage.setItem(CLE_GEO, JSON.stringify(borner(geo))); else localStorage.removeItem(CLE_GEO); } catch (e) {}
  }
  function remettreEnPlace() {
    geo = null; sauverGeo(); appliquerGeo();
    if (panneau.animate) panneau.animate([{ transform: 'scale(0.98)', opacity: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
  // L'ouverture naît de Soli : le point de départ de l'animation est la pastille elle-même.
  function origineDepuisSoli() {
    const f = document.querySelector('.ssfab');
    if (!f || TEL()) { panneau.style.removeProperty('transform-origin'); return; }
    const fr = f.getBoundingClientRect(), pr = panneau.getBoundingClientRect();
    panneau.style.transformOrigin = Math.round(fr.left + fr.width / 2 - pr.left) + 'px ' + Math.round(fr.top + fr.height / 2 - pr.top) + 'px';
  }
  /** Glisser (l'en-tête) ou tirer un bord / un coin ('n', 'se'…). Souris, stylet et doigt. */
  function geste(e, mode) {
    if (TEL() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const r = panneau.getBoundingClientRect();
    const depart = { x: r.left, y: r.top, w: r.width, h: r.height }, x0 = e.clientX, y0 = e.clientY;
    const cible = e.currentTarget;
    try { cible.setPointerCapture(e.pointerId); } catch (_) {}
    panneau.classList.add(mode === 'deplacer' ? 'deplace' : 'redim');
    const bouger = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0, W = window.innerWidth, H = window.innerHeight;
      let g = Object.assign({}, depart);
      if (mode === 'deplacer') {
        g.x += dx; g.y += dy;
        g = aimanter(borner(g));
      } else {
        if (mode.indexOf('e') >= 0) g.w = Math.min(depart.w + dx, W - MARGE - depart.x);
        if (mode.indexOf('s') >= 0) g.h = Math.min(depart.h + dy, H - MARGE - depart.y);
        if (mode.indexOf('w') >= 0) { g.x = Math.max(depart.x + dx, MARGE); g.w = depart.x + depart.w - g.x; }
        if (mode.indexOf('n') >= 0) { g.y = Math.max(depart.y + dy, MARGE); g.h = depart.y + depart.h - g.y; }
        // Taille minimale atteinte : c'est le bord tiré qui s'arrête, l'autre ne bouge pas.
        if (g.w < MIN_L) { if (mode.indexOf('w') >= 0) g.x = depart.x + depart.w - MIN_L; g.w = MIN_L; }
        if (g.h < MIN_H) { if (mode.indexOf('n') >= 0) g.y = depart.y + depart.h - MIN_H; g.h = MIN_H; }
        g = borner(g);
      }
      geo = g;
      appliquerGeo();
    };
    const finir = () => {
      cible.removeEventListener('pointermove', bouger);
      cible.removeEventListener('pointerup', finir);
      cible.removeEventListener('pointercancel', finir);
      panneau.classList.remove('deplace', 'redim');
      sauverGeo();
    };
    cible.addEventListener('pointermove', bouger);
    cible.addEventListener('pointerup', finir);
    cible.addEventListener('pointercancel', finir);
  }

  function basculer(depuis) { if (panneau && panneau.classList.contains('open')) fermer(); else ouvrir(depuis); }

  window.SSAssistant = {
    ouvrir, fermer, basculer,
    estOuvert: () => !!(panneau && panneau.classList.contains('open')),
    // Pour les tests (tests/assistant.test.html) — jamais appelés par l'application.
    _md: md, _lienSur: lienSur, _contexte: contexte, _sansContexte: sansContexte, _outils: OUTILS,
    _donnees: donnees, _oublier: oublierDonnees, _etat: () => ({ conv, enCours, erreur, avis }),
    _envoyer: envoyer, _decider: decider, _nouvelle: nouvelle, _API: API, _CLE_CONV: CLE_CONV, _CLE_OUVERT: CLE_OUVERT,
    _CLE_GEO: CLE_GEO, _geo: () => geo, _remettreEnPlace: () => remettreEnPlace(),
  };
})();
