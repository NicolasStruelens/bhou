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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  if (!accessOk(request, env)) return json({ ok: false, error: 'Non authentifié' }, 401);

  try {
    // ══════════ DEVIS ══════════
    if (path === '/api/devis' && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT id, client_nom, client_prenom, statut, total_ttc, date_creation, date_modification,
               IFNULL(CAST(json_extract(data, '$.photos_count')   AS INTEGER), 0) AS photos_count,
               IFNULL(CAST(json_extract(data, '$.comments_count') AS INTEGER), 0) AS comments_count
        FROM devis ORDER BY date_modification DESC
      `).all();
      return json({ ok: true, data: results });
    }
    if (path === '/api/devis' && method === 'POST') {
      const devis = await request.json();
      if (!devis.id) return json({ ok: false, error: 'ID manquant' }, 400);
      await upsertDevis(env.DB, devis);
      return json({ ok: true, id: devis.id });
    }
    let m = path.match(/^\/api\/devis\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const row = await env.DB.prepare('SELECT data FROM devis WHERE id = ?').bind(id).first();
        if (!row) return json({ ok: false, error: 'Devis introuvable' }, 404);
        return json({ ok: true, data: JSON.parse(row.data) });
      }
      if (method === 'PUT') { const d = await request.json(); await upsertDevis(env.DB, { ...d, id }); return json({ ok: true }); }
      if (method === 'DELETE') {
        const ex = await env.DB.prepare('SELECT id FROM devis WHERE id = ?').bind(id).first();
        if (!ex) return json({ ok: false, error: 'Devis introuvable' }, 404);
        await env.DB.prepare('DELETE FROM devis WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
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
        return json({ ok: true, data: JSON.parse(row.data) });
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
        return json({ ok: true, data: JSON.parse(row.data) });
      }
      if (method === 'DELETE') { await env.DB.prepare('DELETE FROM factures WHERE id = ?').bind(id).run(); return json({ ok: true }); }
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

async function upsertDevis(db, devis) {
  const { id, client, statut, calculs, date_creation, date_modification } = devis;
  const now = new Date().toISOString();
  const photosCount = (devis.items || []).reduce((s, i) => s + ((i.photos || []).length), 0);
  const commentsCount = (devis.comments || []).length;
  const dataToStore = { ...devis, photos_count: photosCount, comments_count: commentsCount };
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
