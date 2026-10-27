// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SOLARISCREEN — LES ÉCHANGES (page Échanges)
// Script classique (file:// OK). Global : window.SSEchanges
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE (revue du 27/10/2026, propositions A à G choisies par Nicolas)
// La page décidait tout dans son HTML : qui a la balle, ce qu'on peut supprimer, quand rappeler,
// où chercher. Les règles vivent ici, en fonctions PURES testées (`tests/echanges.test.html`).
// « Qui doit agir » reste dans `attente.js` (règle 15) ; ce module ne fait que lire les sujets.
// Règle 52 de CLAUDE.md.
(function () {
  'use strict';

  const U = function () { return window.SSUI; };
  const A = function () { return window.SSAttente; };
  const PERSONNES = ['nicolas', 'yannick'];
  function autre(k) { return k === 'nicolas' ? 'yannick' : (k === 'yannick' ? 'nicolas' : ''); }
  function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function jourDe(x) { if (!x) return ''; const d = new Date(x); return isNaN(d) ? '' : U().isoDate(d); }

  /** La recherche : sans accents (« ecole » trouve « École »), mot à mot, dans le titre, le détail,
   *  le client, la décision, les réponses et le nom de l'auteur. */
  function correspond(s, q, nomDe) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return true;
    const nom = nomDe || function (k) { return k || ''; };
    const foin = sansAccents([s.titre, s.corps, s.client_nom, s.decision, s.devis_id, nom(s.auteur),
      (s.reponses || []).map(function (r) { return r && r.texte; }).join(' ')].join(' '));
    return mots.every(function (m) { return foin.indexOf(m) >= 0; });
  }

  /** La dernière réponse du fil (rappels compris : ils disent que quelqu'un s'est manifesté). */
  function derniere(s) {
    const l = ((s && s.reponses) || []).filter(function (r) { return r && r.date; });
    return l.length ? l.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })[l.length - 1] : null;
  }

  /* ── A — CE QU'UNE CARTE REPLIÉE DOIT DIRE EN TROIS LIGNES ───────────────────────────────────
     Qui a la balle, depuis quand, et ce qui s'est dit en dernier. Le reste (le fil, les photos, les
     boutons) attend qu'on touche la carte : 148 px de boutons par carte poussaient le premier sujet
     à 2 149 px sur téléphone. */
  function resume(s, moi) {
    const d = derniere(s);
    let balle = 'personne';
    if (s.statut === 'fait') balle = 'fait';
    else if (s.awaiting && s.awaiting === moi) balle = 'moi';
    else if (s.awaiting) balle = 'autre';
    return {
      balle: balle, qui: s.statut === 'fait' ? '' : (s.awaiting || ''),
      depuis: A() && A().depuisBalle ? A().depuisBalle(s) : (s.date_modification || ''),
      derniere: d, nbReponses: ((s && s.reponses) || []).length,
    };
  }

  /* ── F — LUI RAPPELER ────────────────────────────────────────────────────────────────────────
     Seulement quand la balle est chez L'AUTRE depuis au moins trois jours (le seuil « une question
     qui dort » d'`attente.js`), et pas deux fois le même jour : un rappel par jour reste un rappel,
     trois deviennent du bruit qu'on apprend à ne plus lire. */
  function peutRappeler(s, moi, auj) {
    if (!s || s.statut === 'fait' || !moi || !s.awaiting || s.awaiting === moi) return false;
    const seuil = (A() && A().SEUILS && A().SEUILS.ATTENTE_LONGUE_J) || 3;
    const depuis = A() && A().depuisBalle ? A().depuisBalle(s) : s.date_modification;
    if (!depuis || A().joursDepuis(depuis) < seuil) return false;
    const jour = auj || U().aujourdhui();
    return !((s.reponses || []).some(function (r) { return r && r.rappel && r.auteur === moi && jourDe(r.date) === jour; }));
  }
  const TEXTE_RAPPEL = 'Petit rappel : j’attends ta réponse.';

  /* ── CE QU'ON PEUT SUPPRIMER ─────────────────────────────────────────────────────────────────
     La même règle que le serveur (qui la tient, 409) : ce qui n'engage que soi. Un sujet de l'autre,
     une réponse de l'autre ou sa décision : on classe, on ne supprime pas. Identité inconnue (aperçu
     local, sans Access) : le serveur laisse faire, l'écran aussi. */
  function peutSupprimer(s, moi) {
    if (!s) return false;
    if (!moi) return true;
    if (s.auteur && s.auteur !== moi) return false;
    if ((s.reponses || []).some(function (r) { return r && r.auteur && r.auteur !== moi; })) return false;
    if (s.decision && s.decision_par && s.decision_par !== moi) return false;
    return true;
  }

  /* ── G — LE REGISTRE DES DÉCISIONS ───────────────────────────────────────────────────────────
     « On avait dit quoi pour les coulisses de Depaepe ? » (règle 16) : toutes les décisions, la plus
     récente d'abord, cherchables sans accents (dans la décision, le titre du sujet et le client). */
  function decisions(sujets, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    return (sujets || []).filter(function (s) { return s && String(s.decision || '').trim(); })
      .filter(function (s) {
        const foin = sansAccents([s.decision, s.titre, s.client_nom, s.devis_id].join(' '));
        return mots.every(function (m) { return foin.indexOf(m) >= 0; });
      })
      .map(function (s) {
        return { id: s.id, decision: s.decision, par: s.decision_par || '', le: s.decision_le || s.fait_le || s.date_modification || '',
          titre: s.titre || '', client_nom: s.client_nom || '', devis_id: s.devis_id || '', statut: s.statut };
      })
      .sort(function (a, b) { return String(b.le).localeCompare(String(a.le)); });
  }

  /* ── E — LES DOSSIERS D'UN CLIENT ────────────────────────────────────────────────────────────
     Un sujet ne se rattachait à un dossier qu'en venant de sa fiche. En choisissant le client, ses
     devis sont proposés, reconnaissables sans être ouverts (règle 9 : le résumé), le plus récent
     d'abord ; les archivés en dernier. */
  function dossiersDuClient(devis, cle, nom) {
    const k = String(cle || '').toLowerCase();
    const n = sansAccents(nom).trim();
    if (!k && !n) return [];
    return (devis || []).filter(function (d) {
      const c = (d && d.client) || {};
      const kd = U().clientKeyOf(c.prenom, c.nom);
      const nd = sansAccents([c.prenom, c.nom].filter(Boolean).join(' ')).trim();
      return (k && kd === k) || (n && nd === n);
    }).sort(function (a, b) {
      return ((a.archive ? 1 : 0) - (b.archive ? 1 : 0)) || String(b.date_modification || '').localeCompare(String(a.date_modification || ''));
    }).map(function (d) {
      const statut = (U().STATUT_DEVIS_LABEL && U().STATUT_DEVIS_LABEL[d.statut]) || d.statut || '';
      const res = (U().resumeDevis && U().resumeDevis(d)) || (d.type_document === 'depannage' ? 'Dépannage' : 'Devis');
      return { id: d.id, libelle: res + ' · ' + statut + (d.archive ? ' · archivé' : ''), archive: !!d.archive };
    });
  }

  /** Les nombres des onglets : ce qui m'attend ou n'attend personne, les échanges ouverts, les décisions. */
  function compteurs(sujets, attentes, moi) {
    const L = attentes || [];
    return {
      attente: L.filter(function (i) { return !i.qui || i.qui === moi; }).length,
      echanges: (sujets || []).filter(function (s) { return s && s.statut !== 'fait'; }).length,
      decisions: decisions(sujets, '').length,
    };
  }

  window.SSEchanges = {
    PERSONNES: PERSONNES, TEXTE_RAPPEL: TEXTE_RAPPEL,
    autre: autre, sansAccents: sansAccents, correspond: correspond, derniere: derniere, resume: resume,
    peutRappeler: peutRappeler, peutSupprimer: peutSupprimer, decisions: decisions,
    dossiersDuClient: dossiersDuClient, compteurs: compteurs,
  };
})();
