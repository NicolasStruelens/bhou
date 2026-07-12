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
      // Suivi d'ouverture : horodatage à chaque consultation (conservé sur les 50 dernières).
      // Débounce de 10s pour éviter qu'un simple rechargement de page (ou un aspirateur de
      // liens) ne multiplie les écritures D1 sans information supplémentaire.
      const now = new Date();
      const views = d.review_views || [];
      const last = views.length ? new Date(views[views.length - 1]) : null;
      if (!last || (now - last) > 10000) {
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
        quantite: it.quantite || 1, prix_catalogue_ht: it.prix_catalogue_ht || 0,
        // Photos d'ouverture (mesures, visualiseur couleur) uniquement — jamais les photos SAV
        // (tickets internes), qui vivent dans un tableau séparé (d.sav_tickets) jamais lu ici.
        photos: it.photos || [],
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
          toile: it.toile || it.collection || '', emplacement: it.emplacement || '', etage: it.etage || '',
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
      if (body.action === 'accept') {
        if (!decidable) return json({ ok: false, error: 'Ce devis a déjà été traité.' }, 409);
        await env.DB.prepare(`UPDATE devis SET
            data = json_set(data, '$.client_accepted', json('true'), '$.client_accepted_at', ?1, '$.date_modification', ?1),
            date_modification = ?1 ${WHERE.replace('?', '?2')}`)
          .bind(nowIso, token).run();
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
                     '$.date_modification', ?2),
            date_modification = ?2 ${WHERE.replace('?', '?3')}`)
          .bind(comment, nowIso, token).run();
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
               json_extract(data, '$.review_views') AS review_views_json,
               json_extract(data, '$.sav_tickets') AS sav_tickets_json,
               json_extract(data, '$.client') AS client_json,
               COALESCE(json_extract(data, '$.item_types'),
                        (SELECT json_group_array(t) FROM (SELECT DISTINCT json_extract(je.value, '$.type') AS t
                           FROM json_each(data, '$.items') je WHERE json_extract(je.value, '$.type') IS NOT NULL))) AS item_types_json
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
        delete r.client_json; delete r.statut_history_json; delete r.chantier_json; delete r.checklist_json; delete r.review_views_json; delete r.sav_tickets_json; delete r.item_types_json;
        return { ...r, client, statut_history, chantier, checklist, review_views, sav_tickets, item_types };
      });
      return json({ ok: true, data });
    }
    if (path === '/api/devis' && method === 'POST') {
      const body = await request.json();
      const { _expected_date_modification, ...devis } = body;
      if (!devis.id) return json({ ok: false, error: 'ID manquant' }, 400);
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
      await upsertDevis(env.DB, devis);
      return json({ ok: true, id: devis.id });
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
        ? env.DB.prepare('SELECT id, ts, actor, action, entity_type, entity_id, label FROM activity WHERE ts > ? ORDER BY ts DESC LIMIT 200').bind(since)
        : env.DB.prepare('SELECT id, ts, actor, action, entity_type, entity_id, label FROM activity ORDER BY ts DESC LIMIT 200');
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

async function upsertDevis(db, devis) {
  const { id, client, statut, calculs, date_creation, date_modification } = devis;
  const now = new Date().toISOString();
  const photosCount = (devis.items || []).reduce((s, i) => s + ((i.photos || []).length), 0);
  const commentsCount = (devis.comments || []).length;
  // Dénormalise les types de produits présents (petit tableau de chaînes) pour que la liste
  // /api/devis n'ait pas à extraire les items complets (avec leurs photos base64) juste pour ça.
  const itemTypes = [...new Set((devis.items || []).map(i => i.type).filter(Boolean))];
  const dataToStore = { ...devis, photos_count: photosCount, comments_count: commentsCount, item_types: itemTypes };
  await db.prepare(`
    INSERT INTO devis (id, client_nom, client_prenom, statut, total_ttc, date_creation, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET client_nom=excluded.client_nom, client_prenom=excluded.client_prenom,
      statut=excluded.statut, total_ttc=excluded.total_ttc, date_modification=excluded.date_modification, data=excluded.data
  `).bind(id, (client && client.nom) || '', (client && client.prenom) || '', statut || 'brouillon',
    (calculs && calculs.total_ttc) || 0, date_creation || now, date_modification || now, JSON.stringify(dataToStore)).run();
}

async function upsertClient(db, c) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO clients (key, nom, prenom, date_modification, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET nom=excluded.nom, prenom=excluded.prenom,
      date_modification=excluded.date_modification, data=excluded.data
  `).bind(c.key, c.nom || '', c.prenom || '', c.date_modification || now, JSON.stringify(c)).run();
}

async function upsertRdv(db, r) {
  const now = new Date().toISOString();
  const cl = r.client || {};
  await db.prepare(`
    INSERT INTO rdv (id, client_nom, client_prenom, statut, assigned_to, date_rdv, devis_id, date_creation, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET client_nom=excluded.client_nom, client_prenom=excluded.client_prenom,
      statut=excluded.statut, assigned_to=excluded.assigned_to, date_rdv=excluded.date_rdv,
      devis_id=excluded.devis_id, date_modification=excluded.date_modification, data=excluded.data
  `).bind(r.id, cl.nom || '', cl.prenom || '', r.statut || 'nouveau', r.assigned_to || null,
    r.date_rdv || null, r.devis_id || null, r.date_creation || now, r.date_modification || now, JSON.stringify(r)).run();
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
