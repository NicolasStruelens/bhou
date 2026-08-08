// ═══════════════════════════════════════════════════════════
// SOLARISCREEN API — Cloudflare Pages Function (backend UNIQUE)
// Routes : /api/devis, /api/clients, /api/factures, /api/stats, /api/health
// Same-origin (servi sous le même domaine que l'app) → pas de CORS *.
// Protégé par Cloudflare Access (au niveau du domaine, voir DEPLOIEMENT.md).
// Liaison D1 "DB" : Pages → Settings → Functions → D1 database bindings.
// ═══════════════════════════════════════════════════════════

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Défense en profondeur : si REQUIRE_ACCESS=true, on exige le jeton injecté
// par Cloudflare Access (impossible à fournir sans être authentifié au préalable).
// La protection principale reste la politique Access sur le domaine /api/*.
function accessOk(request, env) {
  if (!env || env.REQUIRE_ACCESS !== 'true') return true;
  return !!request.headers.get('Cf-Access-Jwt-Assertion');
}

// Extrait l'email authentifié depuis le JWT injecté par Cloudflare Access.
// Lecture seule pour affichage (ex: "connecté en tant que Nicolas") — jamais utilisée
// pour une décision de sécurité, donc pas besoin de vérifier la signature du JWT ici
// (la vérification/l'application réelle se fait par la politique Access sur le domaine).
function parseAccessEmail(request) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;
  try {
    const payload = jwt.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return claims.email || null;
  } catch (e) { return null; }
}

// Même mapping que nav.js (IDENTITIES) — dupliqué ici volontairement car les deux
// fichiers ne partagent pas de module commun (scripts classiques, pas de bundler).
const IDENTITIES = {
  'info@solariscreen.be': 'yannick',
  'nicolas.struelens@me.com': 'nicolas',
};

// Clé de fiche client (doit rester identique à clientKeyOf côté front, ui.js) : "nom|prenom".
function clientKey(prenom, nom) {
  return (String(nom || '').trim() + '|' + String(prenom || '').trim()).toLowerCase().replace(/\s+/g, ' ');
}
// Infos de salutation pour la page client : prénom, nom, civilité, ton (« amical » / « pro »).
// La civilité et le ton vivent sur la FICHE client (clients.html), source unique — on la relit ici
// pour ne pas dépendre de la copie figée dans le devis (qui pourrait être réécrite par le simulateur).
async function resolveGreeting(env, d) {
  const cl = (d && d.client) || {};
  // Valeurs de repli = copie figée dans le devis (peut être obsolète ou vide).
  let civilite = cl.civilite || '', ton = cl.ton || '';
  // La FICHE client (clients.html) est la SOURCE DE VÉRITÉ : on la relit toujours et on la laisse
  // GAGNER. Sans ça, une copie « amical » restée sur le devis empêchait le « pro » réglé sur la fiche
  // de s'appliquer (c'était le bug « je mets pro mais ça reste Bonjour Prénom »).
  if (cl.prenom || cl.nom) {
    try {
      const row = await env.DB.prepare('SELECT data FROM clients WHERE key = ?').bind(clientKey(cl.prenom, cl.nom)).first();
      if (row) { const f = safeParse(row.data) || {}; if (f.civilite) civilite = f.civilite; if (f.ton) ton = f.ton; }
    } catch (e) { /* jamais bloquant : on retombe sur la copie du devis / le prénom seul */ }
  }
  // PRO par défaut — c'est CETTE valeur que voit le client sur son espace en ligne quand aucune
  // fiche n'existe encore. Elle était à « amical », d'où les « Bonjour Prénom » non voulus.
  return { prenom: cl.prenom || '', nom: cl.nom || '', civilite: civilite || '', ton: ton || 'pro' };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  // ══════ SUIVI DE COMMANDE CLIENT (volontairement PUBLIC — pas de gate Access) ══════
  // Route dédiée, accessible via un lien avec jeton non-devinable (devis.track_token),
  // pensée pour être exemptée de la politique Cloudflare Access sur ce domaine (voir
  // DEPLOIEMENT.md). Ne renvoie jamais de prix ni de coordonnées — seulement l'avancement.
  if (path === '/api/track' && method === 'GET') {
    const token = (url.searchParams.get('t') || '').trim();
    if (!token) return json({ ok: false, error: 'Lien invalide' }, 400);
    try {
      const row = await env.DB.prepare("SELECT data FROM devis WHERE json_extract(data, '$.track_token') = ?").bind(token).first();
      if (!row) return json({ ok: false, error: 'Lien invalide ou expiré' }, 404);
      const d = safeParse(row.data) || {};
      const items = (d.items || []).map(it => ({ type: it.type, modele: it.modele || '' }));
      return json({ ok: true, data: {
        prenom: (d.client && d.client.prenom) || '',
        greeting: await resolveGreeting(env, d),   // civilité + ton pour la salutation
        items,
        commande: d.commande || null,
        statut: d.statut || 'brouillon',
      } });
    } catch (e) {
      return json({ ok: false, error: 'Erreur serveur' }, 500);
    }
  }

  // ══════ ESPACE CLIENT — revoir le devis, accepter/refuser, poser une question ══════
  // Route dédiée, publique par jeton non-devinable (devis.review_token), destinée à la
  // même exemption Cloudflare Access que /api/track (voir DEPLOIEMENT.md). Contrairement
  // à /api/track (post-signature, jamais de prix), celle-ci s'adresse à un devis PAS ENCORE
  // signé et affiche donc le prix total (nécessaire pour que le client puisse se décider) —
  // mais jamais la marge/commission interne.
  if (path === '/api/devis-review' && method === 'GET') {
    const token = (url.searchParams.get('t') || '').trim();
    if (!token) return json({ ok: false, error: 'Lien invalide' }, 400);
    try {
      const row = await env.DB.prepare("SELECT data FROM devis WHERE json_extract(data, '$.review_token') = ?").bind(token).first();
      if (!row) return json({ ok: false, error: 'Lien invalide ou expiré' }, 404);
      const d = safeParse(row.data) || {};

      // ── Service PHOTO côté client (?photo=ownerId/photoId) ──
      // Les photos sont servies par /api/photos/* qui est DERRIÈRE Cloudflare Access → un client
      // non connecté ne pouvait pas les charger (vignettes cassées sur le devis). On les sert donc
      // par CE endpoint, déjà exempté d'Access (pas de config Cloudflare à ajouter), et validé par
      // le jeton : le client ne peut récupérer QUE les photos réellement présentes sur les ouvertures
      // de SON devis (jamais une photo SAV interne, jamais celles d'un autre devis).
      const photoParam = url.searchParams.get('photo');
      if (photoParam) {
        const wanted = '/api/photos/' + photoParam;
        const allowed = (d.items || []).some(it => (it.photos || []).some(p => typeof p === 'string' && p.split('?')[0] === wanted));
        if (!allowed) return json({ ok: false, error: 'Photo non autorisée' }, 403);
        if (!env.PHOTOS) return json({ ok: false, error: 'Stockage non configuré' }, 500);
        const slash = photoParam.indexOf('/');
        const ownerId = photoParam.slice(0, slash), photoId = photoParam.slice(slash + 1);
        const obj = await env.PHOTOS.get(`photos/${ownerId}/${photoId}.jpg`);
        if (!obj) return json({ ok: false, error: 'Photo introuvable' }, 404);
        return new Response(obj.body, {
          headers: {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg',
            'Cache-Control': 'private, max-age=86400',
          },
        });
      }
      // Réécrit une URL de photo interne (/api/photos/owner/id, protégée par Access) en URL publique
      // servie par ce endpoint. Les data:URL (anciennes photos base64) et le reste passent tels quels.
      const publicPhoto = (p) => {
        if (typeof p !== 'string') return p;
        const base = p.split('?')[0];
        return base.startsWith('/api/photos/')
          ? '/api/devis-review?t=' + encodeURIComponent(token) + '&photo=' + encodeURIComponent(base.slice('/api/photos/'.length))
          : p;
      };
      // Suivi d'ouverture : horodatage à chaque consultation (conservé sur les 50 dernières).
      // Débounce de 10s pour éviter qu'un simple rechargement de page (ou un aspirateur de
      // liens) ne multiplie les écritures D1 sans information supplémentaire.
      const now = new Date();
      const views = d.review_views || [];
      const last = views.length ? new Date(views[views.length - 1]) : null;
      // On NE compte PAS les consultations de Nicolas/Yannick eux-mêmes (ils ouvrent le lien pour
      // vérifier la page). Leur navigateur signale `staff=1` (posé une fois qu'ils se sont
      // authentifiés dans l'ERP — voir nav.js). Un client, lui, n'a jamais ce marqueur → compté.
      const isStaff = url.searchParams.get('staff') === '1';
      if (!isStaff && (!last || (now - last) > 10000)) {
        d.review_views = views.concat([now.toISOString()]).slice(-50);
        // Écriture CIBLÉE de la seule clé review_views — surtout PAS upsertDevis(d), qui
        // réécrirait le devis ENTIER depuis notre lecture : toute note/statut enregistré par
        // Nicolas/Yannick entre notre SELECT et ce write serait silencieusement effacé. Une
        // simple CONSULTATION du lien client ne doit jamais pouvoir détruire une donnée.
        await env.DB.prepare("UPDATE devis SET data = json_set(data, '$.review_views', json(?1)) WHERE json_extract(data, '$.review_token') = ?2")
          .bind(JSON.stringify(d.review_views), token).run();
      }
      const items = (d.items || []).map(it => ({
        type: it.type, modele: it.modele || '', largeur: it.largeur || null, hauteur: it.hauteur || null,
        // projection : dimension PRINCIPALE d'une tente solaire (avec la largeur) — sans elle,
        // la page client ne pouvait afficher aucune dimension utile pour ce type de produit.
        projection: it.projection || null,
        quantite: it.quantite || 1, prix_catalogue_ht: it.prix_catalogue_ht || 0,
        // Photos d'ouverture (mesures, visualiseur couleur) uniquement — jamais les photos SAV
        // (tickets internes), qui vivent dans un tableau séparé (d.sav_tickets) jamais lu ici.
        // URLs réécrites en accès public par jeton (voir publicPhoto) pour être visibles sans login.
        photos: (it.photos || []).map(publicPhoto),
      }));
      // Fil de discussion visible côté client : ses propres questions, + les réponses de
      // Nicolas/Yannick explicitement marquées `visible_client` (opt-in, jamais par défaut —
      // une note interne ordinaire ne doit jamais fuiter ici).
      const comments = (d.comments || [])
        .filter(c => c.author === 'client' || c.visible_client === true)
        .map(c => ({ author: c.author, text: c.text, date: c.date }));
      // Document devis complet — pour afficher/imprimer chez le client LE MÊME devis que le PDF
      // officiel (app/devis.html). Whitelist stricte : uniquement des champs qui figurent déjà
      // sur le devis envoyé au client. JAMAIS pricing_v2.material (achats/vendeurs/marges),
      // JAMAIS les bénéfices nicolas_net/yannick_net, JAMAIS les notes internes.
      const calc = d.calculs || null;
      const cl = d.client || {};
      const documentData = (calc && calc.total_ttc != null) ? {
        id: d.id, statut: d.statut || 'brouillon', informatif: !!d.informatif,
        date_creation: d.date_creation || '',
        client: {
          prenom: cl.prenom || '', nom: cl.nom || '',
          adresse: cl.adresse || {}, telephone: cl.telephone || '', email: cl.email || '',
        },
        items: (d.items || []).map(it => ({
          type: it.type, modele: it.modele || '', largeur: it.largeur || null, hauteur: it.hauteur || null,
          projection: it.projection || null, quantite: it.quantite || 1, prix_catalogue_ht: it.prix_catalogue_ht || 0,
          variante: it.variante || '', combinaison: it.combinaison || '', manoeuvre: it.manoeuvre || '',
          moteur: it.moteur || it.moteur_ref || '', couleur: it.couleur || '',
          couleur_coulisses: it.couleur_coulisses || '', couleur_lame: it.couleur_lame || '',
          // La COLLECTION (liste fabricant) prime sur l'ancien texte libre `toile`.
          toile: it.collection || it.toile || '', emplacement: it.emplacement || '', etage: it.etage || '',
        })),
        calc: {
          total_ht: calc.total_ht || 0, total_tva: calc.total_tva || 0,
          tva_pct: calc.tva_pct != null ? calc.tva_pct : 6,
          total_ttc: calc.total_ttc || 0,
          acompte_pct: calc.acompte_pct || 0, acompte_montant: calc.acompte_montant || 0,
          install_total_brut: calc.install_total_brut || 0,
          remise_catalogue: (calc.remise_catalogue && calc.remise_catalogue.amount) || 0,
          remise_installation: ((calc.remise_installation && calc.remise_installation.amount) || 0)
                             + ((calc.remise_outillage && calc.remise_outillage.amount) || 0),
          extra_lines: (calc.extra_lines || []).map(e => ({ label: e.label || '', qty: e.qty || 1, unit_price_ht: e.unit_price_ht || 0, total_ht: e.total_ht || 0 })),
          surplus_difficulte: (d.pricing_v2 && d.pricing_v2.surplus_difficulte) || 0,
        },
        signature: (d.signature && d.signature.image) ? { image: d.signature.image, date: d.signature.date || '' } : null,
      } : null;
      return json({ ok: true, data: {
        prenom: (d.client && d.client.prenom) || '',
        greeting: await resolveGreeting(env, d),   // civilité + ton pour la salutation
        id: d.id, statut: d.statut || 'brouillon', items,
        total_ttc: (d.calculs && d.calculs.total_ttc) || 0,
        tva_pct: (d.pricing_v2 && d.pricing_v2.tva_pct) || 6,
        client_accepted: !!d.client_accepted,
        comments,
        document: documentData,
      } });
    } catch (e) {
      return json({ ok: false, error: 'Erreur serveur' }, 500);
    }
  }
  if (path === '/api/devis-review' && method === 'POST') {
    try {
      const body = await request.json();
      const token = (body.token || '').trim();
      if (!token) return json({ ok: false, error: 'Lien invalide' }, 400);
      const row = await env.DB.prepare("SELECT data FROM devis WHERE json_extract(data, '$.review_token') = ?").bind(token).first();
      if (!row) return json({ ok: false, error: 'Lien invalide ou expiré' }, 404);
      const d = safeParse(row.data) || {};
      // Une fois accepté OU déjà sorti du statut "en attente client", plus aucune décision
      // ne peut être reprise par ce lien public (empêche un decline après un accept déjà posé).
      const decidable = ['envoye_client', 'relance_1', 'relance_2'].includes(d.statut) && !d.client_accepted;
      const MAX_TEXT = 2000; // borne la taille d'un texte soumis publiquement (raison / question)
      // Toutes les écritures ci-dessous sont CIBLÉES (json_set/json_insert sur les seules clés
      // concernées, évaluées par SQLite sur la valeur ACTUELLE de la ligne) — jamais upsertDevis(d),
      // qui réécrirait le devis entier depuis notre lecture et écraserait toute modification
      // concurrente faite depuis le dashboard/vue au même moment.
      const nowIso = new Date().toISOString();
      const WHERE = "WHERE json_extract(data, '$.review_token') = ?";
      // Trace l'action du client dans le journal d'activité, pour qu'elle remonte dans
      // « Quoi de neuf » à la connexion (dashboard). Écriture DIRECTE en SQL : la route
      // POST /api/activity est derrière Cloudflare Access, donc inutilisable depuis ici.
      // Toujours en try/catch silencieux : le journal ne doit JAMAIS faire échouer la décision
      // du client (une acceptation perdue coûte infiniment plus cher qu'une ligne de journal).
      const cli = ((d.client && d.client.prenom) || '') + ' ' + ((d.client && d.client.nom) || '');
      const journal = async (action, label) => {
        try {
          await env.DB.prepare('INSERT INTO activity (ts, actor, action, entity_type, entity_id, label, meta) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(nowIso, 'client', action, 'devis', String(d.id || '').slice(0, 60), label.slice(0, 300), null).run();
        } catch (e) { /* jamais bloquant */ }
      };
      if (body.action === 'accept') {
        if (!decidable) return json({ ok: false, error: 'Ce devis a déjà été traité.' }, 409);
        await env.DB.prepare(`UPDATE devis SET
            data = json_set(data, '$.client_accepted', json('true'), '$.client_accepted_at', ?1, '$.date_modification', ?1),
            date_modification = ?1 ${WHERE.replace('?', '?2')}`)
          .bind(nowIso, token).run();
        // NOTE : on ne change VOLONTAIREMENT pas le statut. « signé » est contractuel (il exige
        // une signature réelle, cf. devis.html) et compte dans le CA/les bénéfices : un simple
        // clic web ne doit pas faire entrer un devis non signé dans la comptabilité.
        await journal('devis.client_accept', `✅ ${cli.trim() || 'Le client'} a ACCEPTÉ le devis #${d.id} — à faire signer`);
      } else if (body.action === 'decline') {
        if (!decidable) return json({ ok: false, error: 'Ce devis a déjà été traité.' }, 409);
        const raison = (body.text || '').trim().slice(0, MAX_TEXT) || 'Pas de réponse';
        const histEntry = JSON.stringify({ statut: 'refuse', date: nowIso, by: 'client' });
        // json(COALESCE(json_extract(...), '[]')) : garantit que le tableau existe avant l'append
        // [#] (json_insert échoue si la clé est absente, cas des vieux devis sans historique).
        await env.DB.prepare(`UPDATE devis SET
            data = json_insert(
                     json_set(data,
                       '$.statut', 'refuse',
                       '$.raison_refus', ?1,
                       '$.client_declined', json('true'),
                       '$.date_modification', ?2,
                       '$.statut_history', json(COALESCE(json_extract(data, '$.statut_history'), '[]'))),
                     '$.statut_history[#]', json(?3)),
            statut = 'refuse', date_modification = ?2 ${WHERE.replace('?', '?4')}`)
          .bind(raison, nowIso, histEntry, token).run();
        await journal('devis.client_decline', `❌ ${cli.trim() || 'Le client'} a REFUSÉ le devis #${d.id}${raison ? ' — ' + raison : ''}`);
      } else if (body.action === 'question') {
        const text = (body.text || '').trim().slice(0, MAX_TEXT);
        if (!text) return json({ ok: false, error: 'Message vide' }, 400);
        const comment = JSON.stringify({ id: crypto.randomUUID(), author: 'client', text, type: 'question', date: nowIso });
        // comments_count (dénormalisé, lu par la liste du dashboard) = ancien nombre + 1, calculé
        // par SQLite sur la même ligne dans la même instruction → cohérent même en concurrence.
        await env.DB.prepare(`UPDATE devis SET
            data = json_set(
                     json_insert(
                       json_set(data, '$.comments', json(COALESCE(json_extract(data, '$.comments'), '[]'))),
                       '$.comments[#]', json(?1)),
                     '$.comments_count', COALESCE(json_array_length(data, '$.comments'), 0) + 1,
                     '$.client_question_open', json('true'),
                     '$.date_modification', ?2),
            date_modification = ?2 ${WHERE.replace('?', '?3')}`)
          .bind(comment, nowIso, token).run();
        await journal('devis.client_question', `💬 ${cli.trim() || 'Le client'} a posé une QUESTION sur le devis #${d.id} : ${text.slice(0, 120)}`);
      } else {
        return json({ ok: false, error: 'Action inconnue' }, 400);
      }
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: 'Erreur serveur' }, 500);
    }
  }

  if (!accessOk(request, env)) return json({ ok: false, error: 'Non authentifié' }, 401);

  try {
    // ══════════ DEVIS ══════════
    if (path === '/api/devis' && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT id, client_nom, client_prenom, statut, total_ttc, date_creation, date_modification,
               -- Fallback pour les devis écrits AVANT la dénormalisation (clés absentes) : on recompte
               -- depuis les items/commentaires bruts. COALESCE/IFNULL court-circuitent → coût nul sur les devis récents.
               IFNULL(CAST(json_extract(data, '$.photos_count') AS INTEGER),
                      (SELECT IFNULL(SUM(IFNULL(json_array_length(je.value, '$.photos'), 0)), 0) FROM json_each(data, '$.items') je)) AS photos_count,
               IFNULL(CAST(json_extract(data, '$.comments_count') AS INTEGER),
                      IFNULL(json_array_length(data, '$.comments'), 0)) AS comments_count,
               IFNULL(CAST(json_extract(data, '$.archive')        AS INTEGER), 0) AS archive,
               IFNULL(CAST(json_extract(data, '$.informatif')      AS INTEGER), 0) AS informatif,
               IFNULL(CAST(json_extract(data, '$.portfolio')       AS INTEGER), 0) AS portfolio,
               IFNULL(CAST(json_extract(data, '$.calculs.nicolas_net') AS REAL), 0) AS nicolas_net,
               IFNULL(CAST(json_extract(data, '$.calculs.yannick_net') AS REAL), 0) AS yannick_net,
               json_extract(data, '$.pricing_v2.material.sellers.principal') AS seller_principal,
               json_extract(data, '$.pricing_v2.note') AS pricing_note,
               json_extract(data, '$.pricing_v2.acompte_pct') AS acompte_pct,
               json_extract(data, '$.statut_history') AS statut_history_json,
               json_extract(data, '$.chantier') AS chantier_json,
               json_extract(data, '$.commande.statut') AS commande_statut,
               json_extract(data, '$.reception.date') AS reception_date,
               json_extract(data, '$.checklist') AS checklist_json,
               json_extract(data, '$.raison_refus') AS raison_refus,
               json_extract(data, '$.probabilite') AS probabilite,
               IFNULL(CAST(json_extract(data, '$.client_accepted') AS INTEGER), 0) AS client_accepted,
               json_extract(data, '$.client_accepted_at') AS client_accepted_at,
               IFNULL(CAST(json_extract(data, '$.client_declined')      AS INTEGER), 0) AS client_declined,
               IFNULL(CAST(json_extract(data, '$.client_question_open') AS INTEGER), 0) AS client_question_open,
               json_extract(data, '$.review_views') AS review_views_json,
               (json_extract(data, '$.review_token') IS NOT NULL) AS has_review_link,
               json_extract(data, '$.sav_tickets') AS sav_tickets_json,
               IFNULL(json_array_length(data, '$.chantier_photos'), 0) AS chantier_photos_count,
               json_extract(data, '$.date_envoi') AS date_envoi,
               -- Poids du devis en base. Sert UNIQUEMENT à repérer les dossiers alourdis par des
               -- photos encore stockées en clair (base64) au lieu d'être déportées vers R2 : un
               -- devis normal pèse quelques kilo-octets, un devis chargé de photos plusieurs Mo.
               -- Mesuré ici parce que c'est gratuit ; l'extraire des items coûterait de lire tout
               -- le blob, photos comprises, pour chaque ligne de la liste.
               LENGTH(data) AS poids,
               json_extract(data, '$.relances') AS relances_json,
               json_extract(data, '$.client') AS client_json,
               COALESCE(json_extract(data, '$.item_types'),
                        (SELECT json_group_array(t) FROM (SELECT DISTINCT json_extract(je.value, '$.type') AS t
                           FROM json_each(data, '$.items') je WHERE json_extract(je.value, '$.type') IS NOT NULL))) AS item_types_json,
               -- Projection MINIMALE des ouvertures : uniquement les champs dont l'absence
               -- bloque une commande (voir SSProducts.CHAMPS_REQUIS). Le tableau de bord peut
               -- ainsi signaler « 3 à compléter » sans jamais charger les items complets, qui
               -- contiennent les photos. ~30 octets par champ : négligeable à côté d'une photo.
               (SELECT json_group_array(json_object(
                  'type', json_extract(je.value, '$.type'),
                  'modele', json_extract(je.value, '$.modele'),
                  'largeur', json_extract(je.value, '$.largeur'),
                  'hauteur', json_extract(je.value, '$.hauteur'),
                  'projection', json_extract(je.value, '$.projection'),
                  'variante', json_extract(je.value, '$.variante'),
                  'collection', json_extract(je.value, '$.collection'),
                  'couleur', json_extract(je.value, '$.couleur'),
                  'couleur_lame', json_extract(je.value, '$.couleur_lame'),
                  'toile_couleur', json_extract(je.value, '$.toile_couleur'),
                  'caisson_mesure', json_extract(je.value, '$.caisson_mesure'),
                  'moteur', json_extract(je.value, '$.moteur'),
                  'moteur_ref', json_extract(je.value, '$.moteur_ref'),
                  'lame_type', json_extract(je.value, '$.lame_type'),
                  'manoeuvre', json_extract(je.value, '$.manoeuvre'),
                  'emplacement', json_extract(je.value, '$.emplacement')
                )) FROM json_each(data, '$.items') je) AS items_min_json
        FROM devis ORDER BY date_modification DESC
      `).all();
      // client_json → objet client (coordonnées complètes pour le CRM)
      const data = results.map(r => {
        const client = safeParse(r.client_json);
        const statut_history = safeParse(r.statut_history_json) || [];
        const chantier = safeParse(r.chantier_json);
        const checklist = safeParse(r.checklist_json);
        const review_views = (safeParse(r.review_views_json) || []).length;
        const sav_tickets = safeParse(r.sav_tickets_json) || [];
        // item_types (types de produits présents) est DÉNORMALISÉ dans le blob à l'écriture
        // (voir upsertDevis) — on n'extrait donc que ce petit tableau, jamais les items complets
        // qui contiennent les PHOTOS base64 (celles-ci alourdiraient énormément la liste).
        const item_types = safeParse(r.item_types_json) || [];
        const items_min = safeParse(r.items_min_json) || [];
        // Relances envoyées : nécessaires au tableau de bord pour savoir quelle relance est due.
        const relances = safeParse(r.relances_json) || [];
        delete r.client_json; delete r.statut_history_json; delete r.chantier_json; delete r.checklist_json; delete r.review_views_json; delete r.sav_tickets_json; delete r.item_types_json; delete r.relances_json; delete r.items_min_json;
        return { ...r, client, statut_history, chantier, checklist, review_views, sav_tickets, item_types, items_min, relances };
      });
      return json({ ok: true, data });
    }
    if (path === '/api/devis' && method === 'POST') {
      const body = await request.json();
      const { _expected_date_modification, ...devis } = body;
      if (!devis.id) return json({ ok: false, error: 'ID manquant' }, 400);
      // ⚠️ Les routes CIBLÉES (commentaire, ticket SAV, photo de chantier) font AVANCER
      // date_modification. Un écran resté ouvert qui vient d'en utiliser une garderait sinon
      // une référence périmée, et SON PROPRE enregistrement suivant (typiquement un changement
      // de statut) serait refusé comme un conflit — alors que personne d'autre n'a touché au
      // devis. Ces routes renvoient donc la nouvelle date_modification, que l'écran adopte.
      // Détection de conflit (2 utilisateurs sur le même devis) : uniquement si l'appelant a fourni la
      // version qu'il croyait la plus récente. Réponse en ok:true (pas ok:false) volontairement — sinon
      // req() (api.js) lèverait une exception et le conflit serait pris à tort pour une panne réseau.
      if (_expected_date_modification) {
        const existing = await env.DB.prepare('SELECT date_modification FROM devis WHERE id = ?').bind(devis.id).first();
        if (existing && existing.date_modification && existing.date_modification !== _expected_date_modification) {
          return json({ ok: true, conflict: true, current_date_modification: existing.date_modification });
        }
      }
      stampSignatureIp(devis, request);
      const res = await upsertDevis(env.DB, devis);
      // Journalisation AUTOMATIQUE de ce qui a bougé, avec l'auteur réel de la session. Rien à
      // instrumenter côté écrans : ils enregistrent, le journal se remplit tout seul et juste.
      // Silencieux si rien de significatif n'a changé (une simple réouverture de fiche ne doit
      // pas polluer l'historique) et jamais bloquant : un journal en panne n'empêche pas de
      // travailler.
      try {
        if (res && res.changements && res.changements.length) {
          const emailAct = parseAccessEmail(request);
          const acteur = (emailAct && IDENTITIES[emailAct.toLowerCase()]) || emailAct || null;
          await env.DB.prepare(
            'INSERT INTO activity (ts, actor, action, entity_type, entity_id, label, meta) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(new Date().toISOString(), acteur,
            res.changements[0] === 'création du devis' ? 'devis.create' : 'devis.modif',
            'devis', devis.id,
            ('Devis #' + devis.id + (res.client ? ' (' + res.client + ')' : '') + ' — ' + res.changements.join(' · ')).slice(0, 300),
            JSON.stringify({ changements: res.changements }).slice(0, 1000)).run();
        }
      } catch (e) { /* le journal ne doit jamais faire échouer un enregistrement */ }
      return json({ ok: true, id: devis.id });
    }
    // ── COMMENTAIRE INTERNE : ajout CIBLÉ (json_insert sur la seule ligne) ──
    // Ne relit ni ne réécrit jamais le devis complet → un commentaire ne peut pas être perdu par
    // une écriture concurrente ou une lecture périmée. Même mécanique que /api/devis-review
    // (question client), prouvée stable en production.
    let mCommentAdd = path.match(/^\/api\/devis\/([^/]+)\/comment$/);
    if (mCommentAdd && method === 'POST') {
      const id = decodeURIComponent(mCommentAdd[1]);
      const body = await request.json().catch(() => ({}));
      const text = (body.text || '').trim();
      if (!text) return json({ ok: false, error: 'Message vide' }, 400);
      // L'AUTEUR VIENT DE CLOUDFLARE ACCESS, pas du formulaire. Avant, une liste déroulante
      // demandait « qui écrit ? » à chaque note : un oubli suffisait à attribuer un message à
      // l'autre, et rien n'empêchait de signer à sa place. L'identité de la session est déjà
      // connue et vérifiée — on l'utilise. `body.author` ne sert plus que de repli hors Access
      // (développement local), et jamais pour se faire passer pour le client.
      const emailNote = parseAccessEmail(request);
      const auteurConnu = (emailNote && IDENTITIES[emailNote.toLowerCase()]) || null;
      const auteurDemande = String(body.author || '').slice(0, 40);
      const comment = {
        id: crypto.randomUUID(),
        author: auteurConnu || (auteurDemande && auteurDemande !== 'client' ? auteurDemande : 'nicolas'),
        text: text.slice(0, 5000),
        type: String(body.type || 'note').slice(0, 20),
        date: new Date().toISOString(),
      };
      if (body.visible_client === true) comment.visible_client = true;
      // Réponse à une note précise : on ne garde que l'identifiant du message d'origine. Le texte
      // cité n'est JAMAIS recopié — il est relu à l'affichage, donc une note corrigée ou supprimée
      // ne laisse pas derrière elle une citation devenue fausse.
      if (body.reply_to) comment.reply_to = String(body.reply_to).slice(0, 60);
      const now = comment.date;
      // Une réponse VISIBLE PAR LE CLIENT referme la question en attente (le voyant « question
      // client sans réponse » du dashboard s'éteint). Une note interne ne touche pas ce flag.
      const closeQ = comment.visible_client ? "'$.client_question_open', json('false')," : '';
      const r = await env.DB.prepare(
        `UPDATE devis SET
           data = json_set(
                    json_insert(
                      json_set(data, '$.comments', json(COALESCE(json_extract(data, '$.comments'), '[]'))),
                      '$.comments[#]', json(?1)),
                    ${closeQ}
                    '$.comments_count', COALESCE(json_array_length(data, '$.comments'), 0) + 1,
                    '$.date_modification', ?2),
           date_modification = ?2
         WHERE id = ?3`
      ).bind(JSON.stringify(comment), now, id).run();
      if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const row = await env.DB.prepare("SELECT COALESCE(json_array_length(data, '$.comments'), 0) AS n FROM devis WHERE id = ?").bind(id).first();
      return json({ ok: true, comment, comments_count: row ? row.n : null, date_modification: now });
    }
    // ── COMMENTAIRE INTERNE : suppression CIBLÉE (json_set des seules clés comments/count) ──
    let mCommentDel = path.match(/^\/api\/devis\/([^/]+)\/comment\/([^/]+)$/);
    if (mCommentDel && method === 'DELETE') {
      const id = decodeURIComponent(mCommentDel[1]);
      const cid = decodeURIComponent(mCommentDel[2]);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const comments = (d.comments || []).filter(c => String(c.id) !== String(cid));
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE devis SET
           data = json_set(data, '$.comments', json(?1), '$.comments_count', ?2, '$.date_modification', ?3),
           date_modification = ?3
         WHERE id = ?4`
      ).bind(JSON.stringify(comments), comments.length, now, id).run();
      return json({ ok: true, comments_count: comments.length, date_modification: now });
    }
    // ── COMMENTAIRE INTERNE : modification CIBLÉE (corriger une note sans la retaper) ──
    // Même garantie que l'ajout et la suppression : on ne réécrit QUE $.comments, jamais le devis
    // complet. La note garde son id, son auteur et sa date d'origine ; « edited » date la retouche,
    // pour que le fil reste honnête — une note corrigée le dit.
    let mCommentEdit = path.match(/^\/api\/devis\/([^/]+)\/comment\/([^/]+)$/);
    if (mCommentEdit && method === 'PATCH') {
      const id = decodeURIComponent(mCommentEdit[1]);
      const cid = decodeURIComponent(mCommentEdit[2]);
      const body = await request.json().catch(() => ({}));
      const text = (body.text || '').trim();
      if (!text) return json({ ok: false, error: 'Message vide' }, 400);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const comments = Array.isArray(d.comments) ? d.comments.slice() : [];
      const i = comments.findIndex(c => String(c.id) === String(cid));
      if (i < 0) return json({ ok: false, error: 'Note introuvable' }, 404);
      // Un message écrit par le CLIENT n'est pas modifiable : réécrire ce qu'il a dit
      // falsifierait l'échange. On peut le supprimer, jamais le corriger à sa place.
      if (String(comments[i].author || '').toLowerCase() === 'client') {
        return json({ ok: false, error: 'Un message du client ne se modifie pas' }, 403);
      }
      const now = new Date().toISOString();
      const modifiee = Object.assign({}, comments[i], {
        text: text.slice(0, 5000),
        type: String(body.type || comments[i].type || 'note').slice(0, 20),
        edited: now,
      });
      comments[i] = modifiee;
      const r = await env.DB.prepare(
        `UPDATE devis SET
           data = json_set(data, '$.comments', json(?1), '$.comments_count', ?2, '$.date_modification', ?3),
           date_modification = ?3
         WHERE id = ?4`
      ).bind(JSON.stringify(comments), comments.length, now, id).run();
      if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'Devis introuvable' }, 404);
      return json({ ok: true, comment: modifiee, comments_count: comments.length, date_modification: now });
    }
    // ── TICKET SAV : création / modification CIBLÉE (n'écrit que la clé $.sav_tickets) ──
    // Même principe que les commentaires : on ne renvoie JAMAIS le devis complet depuis le
    // navigateur. La lecture-modification-écriture se fait ici, côté serveur, en quelques
    // millisecondes — un ticket créé par Yannick ne peut plus être écrasé par une action de
    // Nicolas qui avait la fiche ouverte depuis 10 minutes.
    let mSav = path.match(/^\/api\/devis\/([^/]+)\/sav$/);
    if (mSav && method === 'POST') {
      const id = decodeURIComponent(mSav[1]);
      const body = await request.json().catch(() => ({}));
      const description = (body.description || '').trim();
      if (!description) return json({ ok: false, error: 'Description vide' }, 400);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const tickets = Array.isArray(d.sav_tickets) ? d.sav_tickets.slice() : [];
      const now = new Date().toISOString();
      const statut = ['ouvert', 'en_cours', 'resolu'].includes(body.statut) ? body.statut : 'ouvert';
      const idx = body.id ? tickets.findIndex(t => String(t.id) === String(body.id)) : -1;
      const ticket = {
        id: (idx !== -1) ? tickets[idx].id : crypto.randomUUID(),
        probleme: String(body.probleme || 'autre').slice(0, 40),
        description: description.slice(0, 5000),
        statut,
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 20) : ((idx !== -1 && tickets[idx].photos) || []),
        date_creation: (idx !== -1) ? tickets[idx].date_creation : now,
        // Horodate la résolution au moment où le ticket passe (ou reste) « résolu ».
        date_resolution: statut === 'resolu' ? (((idx !== -1) && tickets[idx].date_resolution) || now) : null,
      };
      if (idx !== -1) tickets[idx] = ticket; else tickets.push(ticket);
      await env.DB.prepare(
        `UPDATE devis SET data = json_set(data, '$.sav_tickets', json(?1), '$.date_modification', ?2),
           date_modification = ?2 WHERE id = ?3`
      ).bind(JSON.stringify(tickets), now, id).run();
      return json({ ok: true, ticket, sav_tickets: tickets, date_modification: now });
    }
    // ── TICKET SAV : suppression CIBLÉE ──
    let mSavDel = path.match(/^\/api\/devis\/([^/]+)\/sav\/([^/]+)$/);
    if (mSavDel && method === 'DELETE') {
      const id = decodeURIComponent(mSavDel[1]);
      const tid = decodeURIComponent(mSavDel[2]);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const tickets = (d.sav_tickets || []).filter(t => String(t.id) !== String(tid));
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE devis SET data = json_set(data, '$.sav_tickets', json(?1), '$.date_modification', ?2),
           date_modification = ?2 WHERE id = ?3`
      ).bind(JSON.stringify(tickets), now, id).run();
      return json({ ok: true, sav_tickets: tickets, date_modification: now });
    }
    // ── JOURNAL DE CHANTIER : photo annotée (ajout/édition CIBLÉE, n'écrit que $.chantier_photos) ──
    // Même architecture que les tickets SAV : les OCTETS de la photo vivent dans R2 (voir /api/photos,
    // upload côté client avant cet appel), seule la métadonnée légère (url R2 + note + phase + date)
    // vit dans la ligne D1. L'écriture est ciblée → un ajout ne peut jamais écraser le reste du devis
    // ni une photo ajoutée par l'autre vendeur pendant que la fiche était ouverte. Photos INTERNES :
    // jamais exposées sur les pages publiques (track / devis-review).
    const JOURNAL_PHASES = ['avant', 'pendant', 'apres', 'probleme', 'reserve', 'autre'];
    let mCp = path.match(/^\/api\/devis\/([^/]+)\/chantier-photo$/);
    if (mCp && method === 'POST') {
      const id = decodeURIComponent(mCp[1]);
      const body = await request.json().catch(() => ({}));
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const entries = Array.isArray(d.chantier_photos) ? d.chantier_photos.slice() : [];
      const idx = body.id ? entries.findIndex(e => String(e.id) === String(body.id)) : -1;
      // Création : l'url (photo) est obligatoire. Édition : on garde l'url existante (on ne change
      // que l'annotation / la phase / la date), donc body.url peut être absent.
      const url = (body.url || (idx !== -1 ? entries[idx].url : '') || '').trim();
      if (!url) return json({ ok: false, error: 'Photo manquante' }, 400);
      const now = new Date().toISOString();
      const phase = JOURNAL_PHASES.includes(body.phase) ? body.phase : 'pendant';
      const entry = {
        id: (idx !== -1) ? entries[idx].id : crypto.randomUUID(),
        url: url.slice(0, 2000000),   // borne de sûreté (cas du repli dataURL si R2 indisponible)
        note: String(body.note || '').slice(0, 2000),
        phase,
        date: (body.date && String(body.date).slice(0, 10)) || (idx !== -1 ? entries[idx].date : now.slice(0, 10)),
        author: String(body.author || (idx !== -1 ? entries[idx].author : 'nicolas')).slice(0, 40),
        date_creation: (idx !== -1) ? entries[idx].date_creation : now,
      };
      if (idx !== -1) entries[idx] = entry; else entries.push(entry);
      await env.DB.prepare(
        `UPDATE devis SET data = json_set(data, '$.chantier_photos', json(?1), '$.date_modification', ?2),
           date_modification = ?2 WHERE id = ?3`
      ).bind(JSON.stringify(entries), now, id).run();
      return json({ ok: true, entry, chantier_photos: entries, date_modification: now });
    }
    let mCpDel = path.match(/^\/api\/devis\/([^/]+)\/chantier-photo\/([^/]+)$/);
    if (mCpDel && method === 'DELETE') {
      const id = decodeURIComponent(mCpDel[1]);
      const pid = decodeURIComponent(mCpDel[2]);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const target = (d.chantier_photos || []).find(e => String(e.id) === String(pid));
      const entries = (d.chantier_photos || []).filter(e => String(e.id) !== String(pid));
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE devis SET data = json_set(data, '$.chantier_photos', json(?1), '$.date_modification', ?2),
           date_modification = ?2 WHERE id = ?3`
      ).bind(JSON.stringify(entries), now, id).run();
      // Nettoyage R2 best-effort : si l'url pointe vers une photo R2 (et non un dataURL de repli),
      // on supprime aussi l'objet pour ne pas laisser d'orphelin. Jamais bloquant.
      try {
        const mm = target && String(target.url).match(/^\/api\/photos\/([^/]+)\/([^/]+)$/);
        if (mm && env.PHOTOS) await env.PHOTOS.delete(`photos/${decodeURIComponent(mm[1])}/${decodeURIComponent(mm[2])}.jpg`);
      } catch (e) { /* orphelin R2 sans gravité */ }
      return json({ ok: true, chantier_photos: entries, date_modification: now });
    }
    let m = path.match(/^\/api\/devis\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
        if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
        const d = safeParse(row.data);
        return d ? json({ ok: true, data: d }) : json({ ok: false, error: 'Devis illisible (données corrompues)' }, 500);
      }
      if (method === 'PUT') { const d = await request.json(); stampSignatureIp(d, request); await upsertDevis(env.DB, { ...d, id }); return json({ ok: true }); }
      if (method === 'DELETE') {
        const ex = await env.DB.prepare('SELECT id FROM devis WHERE id = ?').bind(id).first();
        if (!ex) return json({ ok: false, error: 'Devis introuvable' }, 404);
        // Blocage : un devis qui a des factures liées ne peut pas être supprimé (pièces comptables).
        const fc = await env.DB.prepare("SELECT COUNT(*) AS n FROM factures WHERE json_extract(data, '$.devis_id') = ?").bind(id).first();
        if (fc && fc.n > 0) return json({ ok: false, error: `Ce devis a ${fc.n} facture(s) liée(s). Supprime-les d'abord si tu veux vraiment le supprimer.` }, 409);
        await env.DB.prepare('DELETE FROM devis WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ══════════ DOCUMENTS FOURNISSEUR (R2) ══════════
    // Bon de commande / facture Harol attachés à un devis. Seuls les métadonnées (nom,
    // type, clé R2) vivent dans la ligne D1 (comme chantier/checklist/sav_tickets) —
    // les octets du PDF vivent dans R2, jamais dans D1 (voir incident photos non compressées).
    // Nécessite la liaison R2 "DOCS" (Pages → Settings → Functions → R2 bucket bindings).
    m = path.match(/^\/api\/devis\/([^/]+)\/documents$/);
    if (m && method === 'POST') {
      if (!env.DOCS) return json({ ok: false, error: "Stockage de documents non configuré (liaison R2 « DOCS » manquante)." }, 500);
      const id = decodeURIComponent(m[1]);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data);
      if (!d) return json({ ok: false, error: 'Devis illisible (données corrompues)' }, 500);
      const form = await request.formData();
      const file = form.get('file');
      const type = String(form.get('type') || 'autre').slice(0, 30);
      if (!file || typeof file === 'string') return json({ ok: false, error: 'Fichier manquant' }, 400);
      const MAX_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_SIZE) return json({ ok: false, error: 'Fichier trop volumineux (15 Mo max)' }, 400);
      const docId = crypto.randomUUID();
      const safeName = (file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      const r2Key = `devis/${id}/${docId}-${safeName}`;
      await env.DOCS.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
      const doc = { id: docId, type, filename: file.name || safeName, taille: file.size, r2_key: r2Key, date_upload: new Date().toISOString() };
      d.documents = d.documents || [];
      d.documents.push(doc);
      d.date_modification = new Date().toISOString();
      await upsertDevis(env.DB, d);
      return json({ ok: true, data: d.documents });
    }
    m = path.match(/^\/api\/devis\/([^/]+)\/documents\/([^/]+)$/);
    if (m) {
      if (!env.DOCS) return json({ ok: false, error: "Stockage de documents non configuré (liaison R2 « DOCS » manquante)." }, 500);
      const id = decodeURIComponent(m[1]);
      const docId = decodeURIComponent(m[2]);
      const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
      const d = safeParse(row.data);
      if (!d) return json({ ok: false, error: 'Devis illisible (données corrompues)' }, 500);
      const doc = (d.documents || []).find(x => x.id === docId);
      if (!doc) return json({ ok: false, error: 'Document introuvable' }, 404);
      if (method === 'GET') {
        const obj = await env.DOCS.get(doc.r2_key);
        if (!obj) return json({ ok: false, error: 'Fichier introuvable dans le stockage' }, 404);
        return new Response(obj.body, {
          headers: {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${doc.filename.replace(/"/g, '')}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      if (method === 'DELETE') {
        await env.DOCS.delete(doc.r2_key);
        d.documents = (d.documents || []).filter(x => x.id !== docId);
        d.date_modification = new Date().toISOString();
        await upsertDevis(env.DB, d);
        return json({ ok: true });
      }
    }

    // ══════════ PHOTOS (R2) ══════════
    // Photos d'ouvertures/chantier/SAV/RDV : compressées côté client (compressImage, ui.js) puis
    // uploadées ici plutôt qu'embarquées en dataURL base64 dans le JSON D1 (c'est ce qui a déjà causé
    // un souci de taille de ligne — voir DEPLOIEMENT.md). Nécessite la liaison R2 "PHOTOS" (Pages →
    // Settings → Functions → R2 bucket bindings), bucket séparé de "DOCS" (documents fournisseur).
    //
    // "ownerId" est générique (pas forcément un id de devis) : sert aussi bien un item de devis qu'un
    // ticket SAV ou une demande de RDV — le front est seul à savoir à quel objet la photo appartient
    // (il stocke l'URL renvoyée dans le tableau `photos` de cet objet, exactement comme il stockait un
    // dataURL avant). Volontairement AUCUNE vérification que l'objet "ownerId" existe déjà en base :
    // en Mode Terrain/Simulateur, des photos sont ajoutées à un devis AVANT le tout premier
    // enregistrement (l'id est généré côté client dès l'ouverture de la page) — exiger la ligne D1
    // empêcherait cet usage. La clé R2 est entièrement déterministe (ownerId + photoId, tous deux dans
    // l'URL), donc aucune métadonnée à maintenir en base pour retrouver un fichier.
    m = path.match(/^\/api\/photos\/([^/]+)$/);
    if (m && method === 'POST') {
      if (!env.PHOTOS) return json({ ok: false, error: "Stockage de photos non configuré (liaison R2 « PHOTOS » manquante)." }, 500);
      const ownerId = decodeURIComponent(m[1]);
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return json({ ok: false, error: 'Fichier manquant' }, 400);
      const MAX_SIZE = 5 * 1024 * 1024;   // déjà compressée côté client → largement suffisant
      if (file.size > MAX_SIZE) return json({ ok: false, error: 'Photo trop volumineuse (5 Mo max)' }, 400);
      const photoId = crypto.randomUUID();
      const r2Key = `photos/${ownerId}/${photoId}.jpg`;
      await env.PHOTOS.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || 'image/jpeg' } });
      return json({ ok: true, photoId, url: `/api/photos/${encodeURIComponent(ownerId)}/${photoId}` });
    }
    m = path.match(/^\/api\/photos\/([^/]+)\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!env.PHOTOS) return json({ ok: false, error: "Stockage de photos non configuré (liaison R2 « PHOTOS » manquante)." }, 500);
      const ownerId = decodeURIComponent(m[1]), photoId = decodeURIComponent(m[2]);
      const r2Key = `photos/${ownerId}/${photoId}.jpg`;
      const obj = await env.PHOTOS.get(r2Key);
      if (!obj) return json({ ok: false, error: 'Photo introuvable' }, 404);
      return new Response(obj.body, {
        headers: {
          'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg',
          'Cache-Control': 'private, max-age=86400',   // un photoId est unique par upload → jamais réécrit, cache long possible
        },
      });
    }

    // ══════════ CLIENTS ══════════
    if (path === '/api/clients' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT data FROM clients ORDER BY date_modification DESC').all();
      return json({ ok: true, data: results.map(r => safeParse(r.data)).filter(Boolean) });
    }
    if (path === '/api/clients' && method === 'POST') {
      const c = await request.json();
      if (!c.key) return json({ ok: false, error: 'Clé manquante' }, 400);
      await upsertClient(env.DB, c);
      return json({ ok: true, key: c.key });
    }
    // ── ÉCHANGES E-MAIL DU CLIENT : ajout CIBLÉ ────────────────────────────────────────────────
    // Même mécanique que les notes internes d'un devis (json_insert sur la seule ligne concernée) :
    // on ne relit ni ne réécrit jamais la fiche entière, donc un mail ne peut pas être perdu par
    // une sauvegarde de fiche concurrente — ni écraser les coordonnées corrigées ailleurs.
    // ⚠️ Ces deux routes doivent rester AVANT le motif générique /api/clients/(.+) ci-dessous,
    //    sinon c'est lui qui capterait l'URL et la clé vaudrait « xxx/mail ».
    let mMailAdd = path.match(/^\/api\/clients\/([^/]+)\/mail$/);
    if (mMailAdd && method === 'POST') {
      const key = decodeURIComponent(mMailAdd[1]);
      const body = await request.json().catch(() => ({}));
      const texte = (body.texte || '').trim();
      if (!texte) return json({ ok: false, error: 'Message vide' }, 400);
      const mail = {
        id: crypto.randomUUID(),
        sens: body.sens === 'envoye' ? 'envoye' : 'recu',      // reçu DU client / envoyé AU client
        objet: String(body.objet || '').slice(0, 300),
        de: String(body.de || '').slice(0, 200),
        date_mail: String(body.date_mail || '').slice(0, 40),  // date écrite dans le mail (texte libre)
        texte: texte.slice(0, 40000),
        devis_id: String(body.devis_id || '').slice(0, 40),    // rattachement facultatif à un devis
        par: String(body.par || 'nicolas').slice(0, 40),
        date: new Date().toISOString(),                        // date d'archivage
      };
      const now = mail.date;
      const r = await env.DB.prepare(
        `UPDATE clients SET
           data = json_set(
                    json_insert(
                      json_set(data, '$.mails', json(COALESCE(json_extract(data, '$.mails'), '[]'))),
                      '$.mails[#]', json(?1)),
                    '$.date_modification', ?2),
           date_modification = ?2
         WHERE key = ?3`
      ).bind(JSON.stringify(mail), now, key).run();
      if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'Fiche client introuvable' }, 404);
      const row = await env.DB.prepare("SELECT COALESCE(json_array_length(data, '$.mails'), 0) AS n FROM clients WHERE key = ?").bind(key).first();
      return json({ ok: true, mail, mails_count: row ? row.n : null });
    }
    // ── ÉCHANGES E-MAIL : suppression CIBLÉE ───────────────────────────────────────────────────
    let mMailDel = path.match(/^\/api\/clients\/([^/]+)\/mail\/([^/]+)$/);
    if (mMailDel && method === 'DELETE') {
      const key = decodeURIComponent(mMailDel[1]);
      const mid = decodeURIComponent(mMailDel[2]);
      const row = await env.DB.prepare('SELECT data FROM clients WHERE key = ?').bind(key).first();
      if (!row) return json({ ok: false, error: 'Fiche client introuvable' }, 404);
      const c = safeParse(row.data) || {};
      const reste = (c.mails || []).filter(x => String(x.id) !== mid);
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE clients SET data = json_set(data, '$.mails', json(?1), '$.date_modification', ?2), date_modification = ?2 WHERE key = ?3`
      ).bind(JSON.stringify(reste), now, key).run();
      return json({ ok: true, mails_count: reste.length });
    }

    m = path.match(/^\/api\/clients\/(.+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM clients WHERE key = ?').bind(key).first();
        if (!row) return json({ ok: false, error: 'Client introuvable' }, 404);
        const d = safeParse(row.data);
        return d ? json({ ok: true, data: d }) : json({ ok: false, error: 'Client illisible (données corrompues)' }, 500);
      }
      if (method === 'DELETE') { await env.DB.prepare('DELETE FROM clients WHERE key = ?').bind(key).run(); return json({ ok: true }); }
    }

    // ══════════ FACTURES ══════════
    if (path === '/api/factures' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT data FROM factures ORDER BY date DESC').all();
      return json({ ok: true, data: results.map(r => safeParse(r.data)).filter(Boolean) });
    }
    if (path === '/api/factures' && method === 'POST') {
      const f = await request.json();
      if (!f.id) return json({ ok: false, error: 'ID manquant' }, 400);
      await upsertFacture(env.DB, f);
      return json({ ok: true, id: f.id });
    }
    m = path.match(/^\/api\/factures\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM factures WHERE id = ?').bind(id).first();
        if (!row) return json({ ok: false, error: 'Facture introuvable' }, 404);
        const d = safeParse(row.data);
        return d ? json({ ok: true, data: d }) : json({ ok: false, error: 'Facture illisible (données corrompues)' }, 500);
      }
      if (method === 'DELETE') { await env.DB.prepare('DELETE FROM factures WHERE id = ?').bind(id).run(); return json({ ok: true }); }
    }

    // ══════════ RDV (demandes de visite / leads avant devis) ══════════
    if (path === '/api/rdv' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT data FROM rdv ORDER BY date_modification DESC').all();
      return json({ ok: true, data: results.map(r => safeParse(r.data)).filter(Boolean) });
    }
    if (path === '/api/rdv' && method === 'POST') {
      const r = await request.json();
      if (!r.id) return json({ ok: false, error: 'ID manquant' }, 400);
      await upsertRdv(env.DB, r);
      return json({ ok: true, id: r.id });
    }
    // ── ÉCHANGE INTERNE SUR UNE DEMANDE DE RDV (Nicolas ↔ Yannick) ──────────────────────────────
    // Écriture CIBLÉE (json_insert sur la seule ligne) : deux personnes peuvent commenter en même
    // temps sans qu'un message soit perdu — jamais d'upsertRdv() qui réécrirait la demande entière.
    // `awaiting` = à QUI on demande une réponse (moteur de la prise de décision rapide) :
    //   • un message posté avec `ask` (ex. « yannick ») met la balle dans son camp ;
    //   • si l'auteur du message EST la personne attendue, il répond → la balle se libère.
    let mRdvComment = path.match(/^\/api\/rdv\/([^/]+)\/comment$/);
    if (mRdvComment && method === 'POST') {
      const id = decodeURIComponent(mRdvComment[1]);
      const body = await request.json().catch(() => ({}));
      const text = (body.text || '').trim();
      if (!text) return json({ ok: false, error: 'Message vide' }, 400);
      const author = String(body.author || 'nicolas').slice(0, 40);
      const ask = ['nicolas', 'yannick'].includes(body.ask) ? body.ask : '';
      const comment = {
        id: crypto.randomUUID(), author, text: text.slice(0, 5000),
        kind: String(body.kind || 'note').slice(0, 20),   // note | question | decision
        date: new Date().toISOString(),
      };
      if (ask) comment.ask = ask;
      const now = comment.date;
      const r = await env.DB.prepare(
        `UPDATE rdv SET
           data = json_set(
                    json_insert(
                      json_set(data, '$.comments', json(COALESCE(json_extract(data, '$.comments'), '[]'))),
                      '$.comments[#]', json(?1)),
                    '$.comments_count', COALESCE(json_array_length(data, '$.comments'), 0) + 1,
                    '$.awaiting', CASE
                      WHEN ?4 <> '' THEN ?4                       -- on passe explicitement la balle
                      WHEN ?6 = 'decision' THEN ''                -- une décision clôt le débat
                      WHEN COALESCE(json_extract(data, '$.awaiting'), '') = ?5 THEN ''  -- l'attendu a répondu
                      ELSE COALESCE(json_extract(data, '$.awaiting'), '') END,
                    '$.date_modification', ?2),
           date_modification = ?2
         WHERE id = ?3`
      ).bind(JSON.stringify(comment), now, id, ask, author, comment.kind).run();
      if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'Demande introuvable' }, 404);
      return json({ ok: true, comment });
    }
    let mRdvCommentDel = path.match(/^\/api\/rdv\/([^/]+)\/comment\/([^/]+)$/);
    if (mRdvCommentDel && method === 'DELETE') {
      const id = decodeURIComponent(mRdvCommentDel[1]);
      const cid = decodeURIComponent(mRdvCommentDel[2]);
      const row = await env.DB.prepare('SELECT data FROM rdv WHERE id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'Demande introuvable' }, 404);
      const d = safeParse(row.data) || {};
      const kept = (d.comments || []).filter(c => String(c.id) !== String(cid));
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE rdv SET data = json_set(data, '$.comments', json(?1), '$.comments_count', ?2, '$.date_modification', ?3),
           date_modification = ?3 WHERE id = ?4`
      ).bind(JSON.stringify(kept), kept.length, now, id).run();
      return json({ ok: true });
    }

    m = path.match(/^\/api\/rdv\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM rdv WHERE id = ?').bind(id).first();
        if (!row) return json({ ok: false, error: 'RDV introuvable' }, 404);
        const d = safeParse(row.data);
        return d ? json({ ok: true, data: d }) : json({ ok: false, error: 'RDV illisible (données corrompues)' }, 500);
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM rdv WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ══════════ OUTILLAGE (catalogue perso de références : visserie, fixations, outils…) ══════════
    // Table créée à la volée (IF NOT EXISTS) → aucune migration manuelle à lancer avant de déployer.
    // C'est le carnet de références personnel de Nicolas (photo + réf. + fournisseur + lien d'achat),
    // pas une donnée client : rien de sensible, jamais exposé sur les pages publiques.
    if (path === '/api/outillage' || path.indexOf('/api/outillage/') === 0) {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS outillage (id TEXT PRIMARY KEY, nom TEXT NOT NULL DEFAULT '', categorie TEXT, date_modification TEXT, data TEXT NOT NULL)").run();
    }
    if (path === '/api/outillage' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT data FROM outillage ORDER BY date_modification DESC').all();
      return json({ ok: true, data: results.map(r => safeParse(r.data)).filter(Boolean) });
    }
    if (path === '/api/outillage' && method === 'POST') {
      const o = await request.json();
      if (!o.id) return json({ ok: false, error: 'ID manquant' }, 400);
      await upsertOutillage(env.DB, o);
      return json({ ok: true, id: o.id });
    }
    m = path.match(/^\/api\/outillage\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM outillage WHERE id = ?').bind(id).first();
        if (!row) return json({ ok: false, error: 'Référence introuvable' }, 404);
        const d = safeParse(row.data);
        return d ? json({ ok: true, data: d }) : json({ ok: false, error: 'Donnée illisible' }, 500);
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM outillage WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ══════════ JOURNAL D'ACTIVITÉ ══════════
    // L'acteur (nicolas/yannick) est déterminé côté SERVEUR via Cloudflare Access — non
    // falsifiable depuis le navigateur. Le client n'envoie que l'action et son libellé.
    if (path === '/api/activity' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.action) return json({ ok: false, error: 'action manquante' }, 400);
      const email = parseAccessEmail(request);
      const actor = (email && IDENTITIES[email.toLowerCase()]) || email || null;
      await env.DB.prepare(
        'INSERT INTO activity (ts, actor, action, entity_type, entity_id, label, meta) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        new Date().toISOString(), actor, String(body.action).slice(0, 60),
        String(body.entity_type || '').slice(0, 20), String(body.entity_id || '').slice(0, 60),
        String(body.label || '').slice(0, 300), body.meta ? JSON.stringify(body.meta).slice(0, 1000) : null
      ).run();
      return json({ ok: true });
    }
    if (path === '/api/activity' && method === 'GET') {
      const since = url.searchParams.get('since');
      const q = since
        // 200 lignes couvraient à peine quelques jours d'usage à deux : l'historique semblait
        // « perdre les anciens » alors que rien n'est jamais supprimé de la base — seule la
        // fenêtre de lecture était trop courte. `meta` est renvoyé aussi : il contient le détail
        // des changements d'un devis.
        ? env.DB.prepare('SELECT id, ts, actor, action, entity_type, entity_id, label, meta FROM activity WHERE ts > ? ORDER BY ts DESC LIMIT 500').bind(since)
        : env.DB.prepare('SELECT id, ts, actor, action, entity_type, entity_id, label, meta FROM activity ORDER BY ts DESC LIMIT 2000');
      const { results } = await q.all();
      return json({ ok: true, data: results });
    }

    // ══════════ STATS ══════════
    if (path === '/api/stats' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT data, statut, total_ttc, date_creation FROM devis ORDER BY date_creation ASC').all();
      const stats = {
        total: results.length, by_status: {}, by_month: {},
        nicolas: { gross: 0, net: 0, count: 0, ca_ttc: 0 }, yannick: { gross: 0, net: 0, count: 0, ca_ttc: 0 },
        ca_total_ttc: 0, ca_signe_ttc: 0, total_material_ht: 0, total_install_ht: 0, total_extras_ht: 0,
        total_supplier: 0, total_tech: 0, benefice_materiel_brut: 0,
        signes: 0, envoyes: 0, refuses: 0, annules: 0,
      };
      for (const row of results) {
        const d = safeParse(row.data); if (!d) continue;
        const calc = d.calculs || {}, p2 = d.pricing_v2 || {};
        const sellers = (p2.material && p2.material.sellers) || {};
        const statut = row.statut || 'brouillon';
        const ttc = calc.total_ttc || 0;
        stats.by_status[statut] = (stats.by_status[statut] || 0) + 1;
        const month = (d.date_creation || '').substring(0, 7);
        if (month) { (stats.by_month[month] = stats.by_month[month] || { ca_ttc: 0, count: 0, signes: 0 }); stats.by_month[month].ca_ttc += ttc; stats.by_month[month].count++; if (['signe', 'termine'].includes(statut)) stats.by_month[month].signes++; }
        stats.ca_total_ttc += ttc;
        if (['signe', 'termine'].includes(statut)) { stats.ca_signe_ttc += ttc; stats.signes++; }
        if (['envoye_client', 'relance_1', 'relance_2'].includes(statut)) stats.envoyes++;
        if (statut === 'refuse') stats.refuses++;
        if (statut === 'annule') stats.annules++;
        stats.total_material_ht += calc.total_catalog_ht || 0;
        stats.total_install_ht += calc.total_installation_ht || 0;
        stats.total_extras_ht += calc.total_extras_ht || 0;
        stats.total_supplier += calc.supplier_estimate || 0;
        stats.total_tech += (calc.tech1_total || 0) + (calc.tech2_total || 0) + (calc.tools_total || 0);
        stats.nicolas.gross += calc.nicolas_gross || 0; stats.nicolas.net += calc.nicolas_net || 0;
        stats.yannick.gross += calc.yannick_gross || 0; stats.yannick.net += calc.yannick_net || 0;
        const principal = sellers.principal || 'nicolas';
        if (principal === 'nicolas') { stats.nicolas.count++; stats.nicolas.ca_ttc += ttc; }
        else if (principal === 'yannick') { stats.yannick.count++; stats.yannick.ca_ttc += ttc; }
      }
      stats.benefice_materiel_brut = stats.total_material_ht * 0.23;
      stats.benefice_net_estime = stats.nicolas.net + stats.yannick.net;
      stats.marge_pct = stats.total_material_ht > 0 ? Math.round((stats.benefice_materiel_brut / stats.total_material_ht) * 100) : 0;
      stats.taux_conversion = stats.envoyes > 0 ? Math.round((stats.signes / stats.envoyes) * 100) : 0;
      stats.ca_moyen = stats.total > 0 ? Math.round(stats.ca_total_ttc / stats.total) : 0;
      return json({ ok: true, data: stats });
    }

    // ══════════ IDENTITÉ (qui est connecté via Cloudflare Access) ══════════
    if (path === '/api/whoami') {
      return json({ ok: true, data: { email: parseAccessEmail(request) } });
    }

    // ══════════ HISTORIQUE DE CONNEXION (Nicolas / Yannick) ══════════
    // Un "heartbeat" est envoyé par nav.js toutes les 30s tant que l'onglet est visible
    // ET qu'il y a eu une interaction récente (voir nav.js) — approxime le temps
    // réellement passé sur l'appli, pas juste "onglet resté ouvert".
    if (path === '/api/heartbeat' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const sessionId = String(body.session_id || '').slice(0, 100);
      if (!sessionId) return json({ ok: false, error: 'session_id manquant' }, 400);
      const email = parseAccessEmail(request);
      const identity = (email && IDENTITIES[email.toLowerCase()]) || null;
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO connections (session_id, identity, email, start_time, last_seen, page_count)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen, page_count = page_count + 1
      `).bind(sessionId, identity, email || '', now, now).run();
      return json({ ok: true });
    }
    if (path === '/api/connections' && method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT session_id, identity, email, start_time, last_seen, page_count FROM connections ORDER BY start_time DESC LIMIT 300'
      ).all();
      return json({ ok: true, data: results });
    }

    // ══════════ HEALTH ══════════
    if (path === '/api/health') {
      try {
        const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM devis').first();
        return json({ ok: true, devis_count: (c && c.n) || 0, version: '3.0' });
      } catch (dbErr) {
        const needsSchema = (dbErr.message || '').includes('no such table');
        return json({ ok: false, error: dbErr.message, needsSchema, hint: needsSchema ? 'Exécutez la migration schema.sql (voir DEPLOIEMENT.md)' : 'Erreur D1' }, 500);
      }
    }

    return json({ ok: false, error: 'Route introuvable' }, 404);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// Horodatage IP côté serveur (preuve d'acceptation) : impossible à falsifier depuis le
// navigateur puisque Cloudflare fournit l'IP réelle à l'edge, indépendamment de ce que
// le client envoie. Ne tamponne qu'une fois — une signature existante garde son IP d'origine.
function stampSignatureIp(devis, request) {
  if (devis.signature && devis.signature.image && !devis.signature.ip) {
    devis.signature.ip = request.headers.get('CF-Connecting-IP') || '';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   QUI A CHANGÉ QUOI SUR UN DEVIS — comparaison automatique avant/après
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Le journal savait dire « devis enregistré », jamais CE QUI avait bougé. Instrumenter les 38
   endroits qui enregistrent un devis aurait été à la fois lourd et incomplet — on aurait oublié
   des écrans, et les nouveaux seraient nés muets. La comparaison se fait donc ICI, au seul point
   de passage obligé : tout écran, présent ou futur, est couvert sans une ligne de plus.
   On ne compare que ce qui a un sens pour Nicolas et Yannick — pas les horodatages internes. */
const EUR = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',') + ' €';
const STATUT_LISIBLE = {
  brouillon: 'Brouillon', envoye_client: 'Envoyé', relance_1: 'Relance 1', relance_2: 'Relance 2',
  signe: 'Signé', termine: 'Terminé', refuse: 'Refusé', annule: 'Annulé',
};
function decrireChangements(avant, apres) {
  if (!avant) return ['création du devis'];
  const out = [];
  const nb = (o) => (o.items || []).reduce((s, i) => s + (Number(i.quantite) || 1), 0);
  const ttc = (o) => Number((o.calculs || {}).total_ttc) || 0;
  const remise = (o) => ['remise_catalogue', 'remise_installation', 'remise_outillage']
    .reduce((s, k) => s + Number(((o.calculs || {})[k] || {}).amount || 0), 0);
  const nomClient = (o) => [((o.client || {}).prenom || ''), ((o.client || {}).nom || '')].join(' ').trim();

  if (avant.statut !== apres.statut) {
    out.push('statut ' + (STATUT_LISIBLE[avant.statut] || avant.statut || '—') +
             ' → ' + (STATUT_LISIBLE[apres.statut] || apres.statut || '—'));
  }
  if (Math.abs(ttc(avant) - ttc(apres)) > 0.005) out.push('montant ' + EUR(ttc(avant)) + ' → ' + EUR(ttc(apres)));
  if (nb(avant) !== nb(apres)) out.push('ouvertures ' + nb(avant) + ' → ' + nb(apres));
  if (Math.abs(remise(avant) - remise(apres)) > 0.005) out.push('remise ' + EUR(remise(avant)) + ' → ' + EUR(remise(apres)));
  if (nomClient(avant) !== nomClient(apres)) out.push('client « ' + nomClient(avant) + ' » → « ' + nomClient(apres) + ' »');
  if (!!avant.informatif !== !!apres.informatif) out.push(apres.informatif ? 'passé en devis informatif' : 'passé en devis formel');
  if (!!avant.archive !== !!apres.archive) out.push(apres.archive ? 'archivé' : 'sorti des archives');
  if ((avant.relances || []).length !== (apres.relances || []).length) {
    out.push('relances ' + (avant.relances || []).length + ' → ' + (apres.relances || []).length);
  }
  const poseAv = (avant.chantier || {}).date_pose || null, poseAp = (apres.chantier || {}).date_pose || null;
  if (poseAv !== poseAp) out.push('date de pose ' + (poseAv || '—') + ' → ' + (poseAp || '—'));
  if ((avant.probabilite || null) !== (apres.probabilite || null)) out.push('probabilité → ' + (apres.probabilite || '—'));
  // Photos déportées vers R2 : visible comme un allègement, pas comme un ajout d'images.
  const inline = (o) => (o.items || []).reduce((s, i) => s + (i.photos || []).filter(p => typeof p === 'string' && p.startsWith('data:')).length, 0);
  if (inline(avant) > inline(apres)) out.push((inline(avant) - inline(apres)) + ' photo(s) déportée(s) vers le stockage');
  const nbPhotos = (o) => (o.items || []).reduce((s, i) => s + (i.photos || []).length, 0);
  if (nbPhotos(apres) > nbPhotos(avant)) out.push((nbPhotos(apres) - nbPhotos(avant)) + ' photo(s) ajoutée(s)');
  return out;
}

async function upsertDevis(db, devis) {
  const id = devis.id;
  const now = new Date().toISOString();

  // ⚠️ FUSION AVEC L'EXISTANT — corrige une perte de données majeure.
  // Certains écrans (simulateur.html, terrain.html) ne renvoient PAS le devis complet : ils le
  // reconstruisent à partir d'un sous-ensemble de champs (client, items, calculs, pricing_v2…).
  // Avec un remplacement brut du blob (`data=excluded.data`), tout ce que les AUTRES écrans avaient
  // écrit disparaissait : signature du client, PV de réception, date de pose, suivi de commande,
  // historique de statuts, checklist, liste de pose, tickets SAV, portfolio/archive, et surtout les
  // jetons review_token / track_token (⇒ le lien déjà envoyé au client devenait « Lien invalide »).
  // On ne remplace donc que les clés RÉELLEMENT PRÉSENTES dans le payload ; les autres sont
  // conservées telles qu'en base. Un écran qui veut vider un champ doit l'envoyer explicitement
  // (null / '' / []), ce que font tous les écrans actuels — omettre une clé n'efface plus rien.
  let existing = null;
  try {
    const row = await db.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
    if (row && row.data) existing = safeParse(row.data);
  } catch (e) { /* lecture impossible : on retombe sur le payload seul — jamais bloquant */ }
  const merged = existing ? Object.assign({}, existing, devis) : devis;
  const changements = decrireChangements(existing, merged);

  // ⚠️ NETTOYAGE D'UN CHAMP DE CONTRÔLE STOCKÉ PAR ERREUR.
  // `_expected_date_modification` sert UNIQUEMENT à la détection de conflit sur la requête ; il
  // est retiré du corps depuis (voir la route POST), mais une version antérieure du backend le
  // laissait entrer dans le blob — et la fusion clé par clé ci-dessus le recopiait fidèlement à
  // chaque écriture. Les devis touchés le renvoyaient donc au serveur au cycle suivant, qui les
  // refusait tous en « conflit » : plus aucun enregistrement complet ne passait, en silence.
  // On le supprime ici pour que la donnée se répare d'elle-même au premier enregistrement réussi.
  delete merged._expected_date_modification;

  // INVARIANT COMMENTAIRES : ils ne sont modifiés QUE par les routes ciblées
  // /api/devis/:id/comment. Tout enregistrement complet du devis PRÉSERVE ceux déjà en base, même
  // si le payload en contient une version périmée — une note ne peut donc jamais être écrasée.
  let comments = Array.isArray(merged.comments) ? merged.comments : [];
  if (existing && Array.isArray(existing.comments)) comments = existing.comments;

  const photosCount = (merged.items || []).reduce((s, i) => s + ((i.photos || []).length), 0);
  const commentsCount = comments.length;
  // Dénormalise les types de produits présents (petit tableau de chaînes) pour que la liste
  // /api/devis n'ait pas à extraire les items complets (avec leurs photos base64) juste pour ça.
  const itemTypes = [...new Set((merged.items || []).map(i => i.type).filter(Boolean))];
  const dataToStore = Object.assign({}, merged, {
    comments, photos_count: photosCount, comments_count: commentsCount, item_types: itemTypes,
  });
  // Les colonnes indexées sont dérivées de la version FUSIONNÉE (pas du payload brut) : un écran
  // qui omet `statut` ne doit pas faire retomber le devis en « brouillon ».
  const mClient = merged.client;
  await db.prepare(`
    INSERT INTO devis (id, client_nom, client_prenom, statut, total_ttc, date_creation, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET client_nom=excluded.client_nom, client_prenom=excluded.client_prenom,
      statut=excluded.statut, total_ttc=excluded.total_ttc, date_modification=excluded.date_modification, data=excluded.data
  `).bind(id, (mClient && mClient.nom) || '', (mClient && mClient.prenom) || '', merged.statut || 'brouillon',
    (merged.calculs && merged.calculs.total_ttc) || 0, merged.date_creation || now,
    merged.date_modification || now, JSON.stringify(dataToStore)).run();
  // Rendu à l'appelant : c'est la route POST qui journalise, elle seule connaît l'auteur.
  return { changements, client: [(mClient && mClient.prenom) || '', (mClient && mClient.nom) || ''].join(' ').trim() };
}

async function upsertClient(db, c) {
  const now = new Date().toISOString();
  // ⚠️ INVARIANT ÉCHANGES E-MAIL : ils ne sont modifiés QUE par les routes ciblées
  // /api/clients/:key/mail. Toute sauvegarde COMPLÈTE de la fiche préserve ceux déjà en base,
  // même si le payload n'en contient pas — sinon un enregistrement lancé depuis le simulateur ou
  // le Mode Terrain (qui ne connaissent pas ce champ) effacerait tout l'historique des échanges.
  // Même protection que les commentaires d'un devis, pour la même raison.
  let mails = Array.isArray(c.mails) ? c.mails : [];
  try {
    const row = await db.prepare('SELECT data FROM clients WHERE key = ?').bind(c.key).first();
    if (row && row.data) {
      const ex = safeParse(row.data);
      if (ex && Array.isArray(ex.mails)) mails = ex.mails;
    }
  } catch (e) { /* lecture impossible : on garde ce qu'on a, jamais bloquant */ }
  const data = Object.assign({}, c, { mails });
  await db.prepare(`
    INSERT INTO clients (key, nom, prenom, date_modification, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET nom=excluded.nom, prenom=excluded.prenom,
      date_modification=excluded.date_modification, data=excluded.data
  `).bind(c.key, c.nom || '', c.prenom || '', c.date_modification || now, JSON.stringify(data)).run();
}

async function upsertRdv(db, r) {
  const now = new Date().toISOString();
  const cl = r.client || {};
  // ⚠️ INVARIANT COMMENTAIRES — il manquait ici, alors qu'il existe pour les devis et les fiches
  // clients. Sans lui, un simple changement de statut ou d'assignation depuis rdv.html réécrivait
  // la demande ENTIÈRE depuis la copie du navigateur : tout commentaire ajouté entre le chargement
  // de la page et l'enregistrement (typiquement par l'autre personne) disparaissait sans un mot.
  // Vérifié en exécutant le Worker : un devis conservait sa note, une demande de RDV la perdait.
  // Les commentaires ne sont modifiés QUE par les routes ciblées /api/rdv/:id/comment.
  let comments = Array.isArray(r.comments) ? r.comments : [];
  try {
    const row = await db.prepare('SELECT data FROM rdv WHERE id = ?').bind(r.id).first();
    if (row && row.data) {
      const ex = safeParse(row.data);
      if (ex && Array.isArray(ex.comments)) comments = ex.comments;
    }
  } catch (e) { /* lecture impossible : on garde ce qu'on a, jamais bloquant */ }
  const data = Object.assign({}, r, { comments, comments_count: comments.length });
  await db.prepare(`
    INSERT INTO rdv (id, client_nom, client_prenom, statut, assigned_to, date_rdv, devis_id, date_creation, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET client_nom=excluded.client_nom, client_prenom=excluded.client_prenom,
      statut=excluded.statut, assigned_to=excluded.assigned_to, date_rdv=excluded.date_rdv,
      devis_id=excluded.devis_id, date_modification=excluded.date_modification, data=excluded.data
  `).bind(r.id, cl.nom || '', cl.prenom || '', r.statut || 'nouveau', r.assigned_to || null,
    r.date_rdv || null, r.devis_id || null, r.date_creation || now, r.date_modification || now, JSON.stringify(data)).run();
}

async function upsertOutillage(db, o) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO outillage (id, nom, categorie, date_modification, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET nom=excluded.nom, categorie=excluded.categorie,
      date_modification=excluded.date_modification, data=excluded.data
  `).bind(o.id, o.nom || '', o.categorie || '', o.date_modification || now, JSON.stringify(o)).run();
}

async function upsertFacture(db, f) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO factures (id, devis_id, client_nom, client_prenom, total_ttc, date, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET devis_id=excluded.devis_id, client_nom=excluded.client_nom,
      client_prenom=excluded.client_prenom, total_ttc=excluded.total_ttc, date=excluded.date,
      date_modification=excluded.date_modification, data=excluded.data
  `).bind(f.id, f.devis_id || '', (f.client && f.client.nom) || '', (f.client && f.client.prenom) || '',
    f.total_ttc || 0, f.date || now.slice(0, 10), f.date_modification || now, JSON.stringify(f)).run();
}
