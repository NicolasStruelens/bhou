// ═══════════════════════════════════════════════════════════
// SOLARISCREEN API — Cloudflare Pages Function
// Fichier : functions/api/[[catchall]].js
// Gère toutes les routes /api/* automatiquement via Pages
// La liaison D1 "DB" se configure dans :
//   Cloudflare Dashboard → Pages → solariscreen → Settings
//   → Functions → D1 database bindings → variable name: DB
// ═══════════════════════════════════════════════════════════

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method;

  // ── Preflight CORS ──
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {

    // ══════════════════════════════════════
    // GET /api/devis — liste tous les devis
    // ══════════════════════════════════════
    if (path === '/api/devis' && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT id, client_nom, client_prenom, statut,
               total_ttc, date_creation, date_modification,
               IFNULL(CAST(json_extract(data, '$.photos_count')   AS INTEGER), 0) AS photos_count,
               IFNULL(CAST(json_extract(data, '$.comments_count') AS INTEGER), 0) AS comments_count
        FROM devis
        ORDER BY date_modification DESC
      `).all();
      return json({ ok: true, data: results });
    }

    // ══════════════════════════════════════
    // POST /api/devis — créer / upsert
    // ══════════════════════════════════════
    if (path === '/api/devis' && method === 'POST') {
      const devis = await request.json();
      if (!devis.id) return json({ ok: false, error: 'ID manquant' }, 400);
      await upsertDevis(env.DB, devis);
      return json({ ok: true, id: devis.id });
    }

    // ══════════════════════════════════════
    // Routes /api/devis/:id
    // ══════════════════════════════════════
    const idMatch = path.match(/^\/api\/devis\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];

      // GET /api/devis/:id — lire un devis complet
      if (method === 'GET') {
        const row = await env.DB.prepare(
          'SELECT data FROM devis WHERE id = ?'
        ).bind(id).first();
        if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
        return json({ ok: true, data: JSON.parse(row.data) });
      }

      // PUT /api/devis/:id — mettre à jour
      if (method === 'PUT') {
        const devis = await request.json();
        await upsertDevis(env.DB, { ...devis, id });
        return json({ ok: true });
      }

      // DELETE /api/devis/:id — supprimer
      if (method === 'DELETE') {
        const existing = await env.DB.prepare(
          'SELECT id FROM devis WHERE id = ?'
        ).bind(id).first();
        if (!existing) return json({ ok: false, error: 'Devis introuvable' }, 404);
        await env.DB.prepare('DELETE FROM devis WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ══════════════════════════════════════
    // GET /api/stats — statistiques avancées complètes
    // ══════════════════════════════════════
    if (path === '/api/stats' && method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT data, statut, total_ttc, date_creation FROM devis ORDER BY date_creation ASC'
      ).all();

      const stats = {
        total: results.length,
        by_status: {},
        by_month: {},
        nicolas: { gross:0, net:0, count:0, ca_ttc:0 },
        yannick: { gross:0, net:0, count:0, ca_ttc:0 },
        ca_total_ttc: 0, ca_signe_ttc: 0,
        total_material_ht: 0, total_install_ht: 0, total_extras_ht: 0,
        total_supplier: 0, total_tech: 0,
        benefice_materiel_brut: 0,
        nicolas_net_total: 0, yannick_net_total: 0,
        signes: 0, envoyes: 0, refuses: 0, annules: 0
      };

      for (const row of results) {
        let d;
        try { d = JSON.parse(row.data); } catch { continue; }
        const calc    = d.calculs     || {};
        const p2      = d.pricing_v2  || {};
        const sellers = p2.material?.sellers || {};
        const statut  = row.statut    || 'brouillon';
        const ttc     = calc.total_ttc || 0;

        stats.by_status[statut] = (stats.by_status[statut] || 0) + 1;

        const month = (d.date_creation || '').substring(0, 7);
        if (month) {
          if (!stats.by_month[month]) stats.by_month[month] = { ca_ttc:0, count:0, signes:0 };
          stats.by_month[month].ca_ttc += ttc;
          stats.by_month[month].count++;
          if (statut === 'signe' || statut === 'termine') stats.by_month[month].signes++;
        }

        stats.ca_total_ttc += ttc;
        if (statut === 'signe' || statut === 'termine') { stats.ca_signe_ttc += ttc; stats.signes++; }
        if (['envoye_client','relance_1','relance_2'].includes(statut)) stats.envoyes++;
        if (statut === 'refuse') stats.refuses++;
        if (statut === 'annule') stats.annules++;

        stats.total_material_ht += calc.total_catalog_ht      || 0;
        stats.total_install_ht  += calc.total_installation_ht || 0;
        stats.total_extras_ht   += calc.total_extras_ht       || 0;
        stats.total_supplier    += calc.supplier_estimate      || 0;
        stats.total_tech        += (calc.tech1_total || 0) + (calc.tech2_total || 0) + (calc.tools_total || 0);

        stats.nicolas.gross += calc.nicolas_gross || 0;
        stats.nicolas.net   += calc.nicolas_net   || 0;
        stats.yannick.gross += calc.yannick_gross || 0;
        stats.yannick.net   += calc.yannick_net   || 0;

        const principal = sellers.principal || 'nicolas';
        if (principal === 'nicolas')      { stats.nicolas.count++; stats.nicolas.ca_ttc += ttc; }
        else if (principal === 'yannick') { stats.yannick.count++; stats.yannick.ca_ttc += ttc; }
      }

      stats.benefice_materiel_brut = stats.total_material_ht * 0.23;
      stats.nicolas_net_total      = stats.nicolas.net;
      stats.yannick_net_total      = stats.yannick.net;
      stats.benefice_net_estime    = stats.nicolas.net + stats.yannick.net;
      stats.marge_pct = stats.total_material_ht > 0
        ? Math.round((stats.benefice_materiel_brut / stats.total_material_ht) * 100) : 0;
      stats.taux_conversion = stats.envoyes > 0
        ? Math.round((stats.signes / stats.envoyes) * 100) : 0;
      stats.ca_moyen = stats.total > 0
        ? Math.round(stats.ca_total_ttc / stats.total) : 0;

      return json({ ok: true, data: stats });
    }

    // ══════════════════════════════════════
    // GET /api/health — vérification
    // ══════════════════════════════════════
    if (path === '/api/health') {
      try {
        const count = await env.DB.prepare('SELECT COUNT(*) as n FROM devis').first();
        return json({ ok: true, devis_count: count?.n ?? 0, version: '2.0' });
      } catch(dbErr) {
        const needsSchema = dbErr.message?.includes('no such table');
        return json({
          ok: false,
          error: dbErr.message,
          needsSchema,
          hint: needsSchema
            ? 'Configurez la liaison D1 dans Pages Dashboard → Settings → Functions → D1 database bindings'
            : 'Erreur D1 inattendue'
        }, 500);
      }
    }

    return json({ ok: false, error: 'Route introuvable' }, 404);

  } catch (e) {
    console.error('Pages Function error:', e.message, e.stack);
    return json({ ok: false, error: e.message }, 500);
  }
}

// ── Helper : INSERT OR REPLACE ──
async function upsertDevis(db, devis) {
  const { id, client, statut, calculs, date_creation, date_modification } = devis;
  const now = new Date().toISOString();

  const photosCount   = (devis.items    || []).reduce((s, i) => s + ((i.photos || []).length), 0);
  const commentsCount = (devis.comments || []).length;
  const dataToStore   = { ...devis, photos_count: photosCount, comments_count: commentsCount };

  await db.prepare(`
    INSERT INTO devis
      (id, client_nom, client_prenom, statut, total_ttc, date_creation, date_modification, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      client_nom        = excluded.client_nom,
      client_prenom     = excluded.client_prenom,
      statut            = excluded.statut,
      total_ttc         = excluded.total_ttc,
      date_modification = excluded.date_modification,
      data              = excluded.data
  `).bind(
    id,
    client?.nom        || '',
    client?.prenom     || '',
    statut             || 'brouillon',
    calculs?.total_ttc || 0,
    date_creation      || now,
    date_modification  || now,
    JSON.stringify(dataToStore)
  ).run();
}
