// Racine — API same-origin (Cloudflare Pages Functions)
// Auth par mot de passe unique (env RACINE_PASSWORD) + session token en cookie HttpOnly, stockée en D1.

const SESSION_DAYS = 30;
const COOKIE_NAME = 'racine_session';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // corbeille purgée après 30 jours
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const BACKUP_KEEP = 14;
const SCHEMA_VERSION = 6;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function newId() {
  return crypto.randomUUID();
}

function parseCookies(req) {
  const header = req.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

async function getSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT token, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return token;
}

function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function requireAuth(request, env) {
  const token = await getSession(request, env);
  if (!token) return json({ error: 'unauthorized' }, 401);
  return null;
}

// ---------- handlers ----------

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();

  const attemptRow = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (attemptRow && attemptRow.locked_until && attemptRow.locked_until > now) {
    const waitMin = Math.ceil((attemptRow.locked_until - now) / 60000);
    return json({ error: `Trop de tentatives. Réessaie dans ${waitMin} min.` }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!env.RACINE_PASSWORD || password !== env.RACINE_PASSWORD) {
    let count = 1;
    let firstAttempt = now;
    if (attemptRow && (now - attemptRow.first_attempt) < LOGIN_WINDOW_MS) {
      count = attemptRow.count + 1;
      firstAttempt = attemptRow.first_attempt;
    }
    const lockedUntil = count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : null;
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, count, first_attempt, locked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET count = excluded.count, first_attempt = excluded.first_attempt, locked_until = excluded.locked_until`
    ).bind(ip, count, firstAttempt, lockedUntil).run();
    if (lockedUntil) {
      return json({ error: `Trop de tentatives. Réessaie dans ${Math.ceil(LOGIN_LOCKOUT_MS / 60000)} min.` }, 429);
    }
    return json({ error: 'mot de passe incorrect' }, 401);
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  const token = newId();
  await env.DB.prepare(
    'INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)'
  ).bind(token, now, now + SESSION_DAYS * 24 * 60 * 60 * 1000).run();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleLogout(request, env) {
  const token = await getSession(request, env);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}

async function handleMe(request, env) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  return json({ ok: true });
}

// ----- notes -----

async function purgeOldTrash(env) {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  await env.DB.prepare('DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?').bind(cutoff).run();
  await env.DB.prepare('DELETE FROM clips WHERE deleted_at IS NOT NULL AND deleted_at < ?').bind(cutoff).run();
}

async function listNotes(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY pinned DESC, position ASC, created_at ASC'
  ).all();
  return json({ notes: results });
}

async function listTrashNotes(env) {
  await purgeOldTrash(env);
  const { results } = await env.DB.prepare(
    'SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
  ).all();
  return json({ notes: results });
}

async function createNote(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = newId();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO notes (id, parent_id, title, content, kind, pinned, done, position, space, tags, remind_at, links, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.parent_id || null,
    String(body.title || '').slice(0, 500),
    String(body.content || '').slice(0, 20000),
    ['idee', 'todo', 'note'].includes(body.kind) ? body.kind : 'idee',
    body.pinned ? 1 : 0,
    body.position || 0,
    String(body.space || 'Général').trim().slice(0, 60) || 'Général',
    String(body.tags || '').slice(0, 300),
    body.remind_at ? Number(body.remind_at) : null,
    String(body.links || '').slice(0, 2000),
    now,
    now
  ).run();
  return json({ ok: true, id });
}

async function updateNote(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT id FROM notes WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'not found' }, 404);

  if ('parent_id' in body && body.parent_id) {
    if (body.parent_id === id) {
      return json({ error: 'boucle : une note ne peut pas être son propre parent' }, 400);
    }
    const descendants = await collectDescendants(id, env);
    if (descendants.includes(body.parent_id)) {
      return json({ error: 'boucle : le nouveau parent est une descendante de cette note' }, 400);
    }
  }

  const fields = [];
  const values = [];
  const map = {
    title: (v) => String(v).slice(0, 500),
    content: (v) => String(v).slice(0, 20000),
    kind: (v) => (['idee', 'todo', 'note'].includes(v) ? v : 'idee'),
    pinned: (v) => (v ? 1 : 0),
    done: (v) => (v ? 1 : 0),
    parent_id: (v) => v || null,
    position: (v) => Number(v) || 0,
    space: (v) => String(v || 'Général').trim().slice(0, 60) || 'Général',
    tags: (v) => String(v || '').slice(0, 300),
    remind_at: (v) => (v ? Number(v) : null),
    links: (v) => String(v || '').slice(0, 2000),
  };
  for (const key of Object.keys(map)) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(map[key](body[key]));
    }
  }
  if (!fields.length) return json({ ok: true });
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  await env.DB.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ ok: true });
}

async function collectDescendants(id, env) {
  let frontier = [id];
  const all = [id];
  while (frontier.length) {
    const placeholders = frontier.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT id FROM notes WHERE parent_id IN (${placeholders})`
    ).bind(...frontier).all();
    const children = results.map((r) => r.id);
    if (!children.length) break;
    all.push(...children);
    frontier = children;
  }
  return all;
}

async function deleteNote(id, env) {
  // corbeille : marque la note et ses descendants comme supprimées (pas de suppression réelle)
  const ids = await collectDescendants(id, env);
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(`UPDATE notes SET deleted_at = ? WHERE id IN (${placeholders})`)
    .bind(Date.now(), ...ids).run();
  return json({ ok: true, trashed: ids.length });
}

async function restoreNote(id, env) {
  // restaure la note et ses descendants ensemble (miroir de la mise à la corbeille)
  const ids = await collectDescendants(id, env);
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(`UPDATE notes SET deleted_at = NULL WHERE id IN (${placeholders})`).bind(...ids).run();
  return json({ ok: true, restored: ids.length });
}

async function purgeNote(id, env) {
  const ids = await collectDescendants(id, env);
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM notes WHERE id IN (${placeholders})`).bind(...ids).run();
  return json({ ok: true, deleted: ids.length });
}

// ----- clips (presse-papier universel) -----

const MAX_CLIP_BYTES = 800 * 1024; // ~800 Ko par entrée

async function purgeExpiredClips(env) {
  await env.DB.prepare('DELETE FROM clips WHERE expires_at IS NOT NULL AND expires_at < ?')
    .bind(Date.now()).run();
}

async function listClips(env) {
  await purgeExpiredClips(env);
  const { results } = await env.DB.prepare(
    'SELECT id, label, kind, filename, mime, device, pinned, created_at, expires_at, LENGTH(content) as size, ' +
    "CASE WHEN kind = 'file' THEN NULL ELSE content END as preview " +
    "FROM clips WHERE deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT 200"
  ).all();
  return json({ clips: results });
}

async function updateClip(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT id FROM clips WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'not found' }, 404);
  if ('pinned' in body) {
    await env.DB.prepare('UPDATE clips SET pinned = ? WHERE id = ?').bind(body.pinned ? 1 : 0, id).run();
  }
  return json({ ok: true });
}

async function listTrashClips(env) {
  await purgeOldTrash(env);
  const { results } = await env.DB.prepare(
    'SELECT id, label, kind, filename, mime, device, created_at, deleted_at, LENGTH(content) as size, ' +
    "CASE WHEN kind = 'file' THEN NULL ELSE content END as preview " +
    'FROM clips WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
  ).all();
  return json({ clips: results });
}

async function getClip(id, env) {
  const row = await env.DB.prepare('SELECT * FROM clips WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  if (row.expires_at && row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM clips WHERE id = ?').bind(id).run();
    return json({ error: 'expired' }, 410);
  }
  return json({ clip: row });
}

async function createClip(request, env) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || '');
  if (!content) return json({ error: 'contenu vide' }, 400);
  if (content.length > MAX_CLIP_BYTES) {
    return json({ error: 'contenu trop volumineux (max ~800 Ko)' }, 413);
  }
  const id = newId();
  const now = Date.now();
  let expiresAt = null;
  if (body.ttl_ms) expiresAt = now + Number(body.ttl_ms);

  await env.DB.prepare(
    `INSERT INTO clips (id, label, content, kind, filename, mime, device, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    String(body.label || '').slice(0, 200),
    content,
    body.kind === 'file' ? 'file' : 'text',
    body.filename ? String(body.filename).slice(0, 200) : null,
    body.mime ? String(body.mime).slice(0, 100) : null,
    String(body.device || '').slice(0, 100),
    now,
    expiresAt
  ).run();
  return json({ ok: true, id });
}

async function deleteClip(id, env) {
  await env.DB.prepare('UPDATE clips SET deleted_at = ? WHERE id = ?').bind(Date.now(), id).run();
  return json({ ok: true });
}

async function restoreClip(id, env) {
  await env.DB.prepare('UPDATE clips SET deleted_at = NULL WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function purgeClip(id, env) {
  await env.DB.prepare('DELETE FROM clips WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ----- export complet -----

async function exportAll(env) {
  const notes = await env.DB.prepare(
    'SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY created_at ASC'
  ).all();
  await purgeExpiredClips(env);
  const clips = await env.DB.prepare(
    'SELECT * FROM clips WHERE deleted_at IS NULL ORDER BY created_at ASC'
  ).all();
  return json({
    exported_at: Date.now(),
    notes: notes.results,
    clips: clips.results,
  });
}

// ----- sauvegardes -----

async function createBackup(env) {
  const notes = await env.DB.prepare('SELECT * FROM notes WHERE deleted_at IS NULL').all();
  const clips = await env.DB.prepare('SELECT * FROM clips WHERE deleted_at IS NULL').all();
  const id = newId();
  const now = Date.now();
  const data = JSON.stringify({ notes: notes.results, clips: clips.results });
  await env.DB.prepare('INSERT INTO backups (id, created_at, data) VALUES (?, ?, ?)').bind(id, now, data).run();
  await env.DB.prepare(
    `DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC LIMIT ?)`
  ).bind(BACKUP_KEEP).run();
  return json({ ok: true, id, created_at: now });
}

async function listBackups(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, LENGTH(data) as size FROM backups ORDER BY created_at DESC'
  ).all();
  return json({ backups: results });
}

async function getBackup(id, env) {
  const row = await env.DB.prepare('SELECT * FROM backups WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  let data;
  try { data = JSON.parse(row.data); } catch (e) { data = { notes: [], clips: [] }; }
  return json({ id: row.id, created_at: row.created_at, notes: data.notes, clips: data.clips });
}

// ----- état système -----

async function health(env) {
  const [notesCount, clipsCount, remindersCount, lastBackup, migrations] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM clips WHERE deleted_at IS NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL AND remind_at IS NOT NULL').first(),
    env.DB.prepare('SELECT created_at FROM backups ORDER BY created_at DESC LIMIT 1').first(),
    env.DB.prepare('SELECT MAX(version) as v FROM schema_migrations').first().catch(() => null),
  ]);
  return json({
    ok: true,
    db: true,
    schema_version: migrations && migrations.v ? migrations.v : null,
    schema_version_expected: SCHEMA_VERSION,
    notes: notesCount.c,
    clips: clipsCount.c,
    reminders: remindersCount.c,
    last_backup: lastBackup ? lastBackup.created_at : null,
  });
}

// ---------- routeur ----------

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = params.catchall || [];
  const method = request.method;

  try {
    if (parts[0] === 'login' && method === 'POST') return handleLogin(request, env);
    if (parts[0] === 'logout' && method === 'POST') return handleLogout(request, env);
    if (parts[0] === 'me' && method === 'GET') return handleMe(request, env);

    // tout le reste nécessite une session valide
    const denied = await requireAuth(request, env);
    if (denied) return denied;

    if (parts[0] === 'export' && parts.length === 1 && method === 'GET') return exportAll(env);
    if (parts[0] === 'health' && parts.length === 1 && method === 'GET') return health(env);

    if (parts[0] === 'backups') {
      if (parts.length === 1 && method === 'GET') return listBackups(env);
      if (parts.length === 1 && method === 'POST') return createBackup(env);
      if (parts.length === 2 && method === 'GET') return getBackup(parts[1], env);
    }

    if (parts[0] === 'notes') {
      if (parts.length === 1 && method === 'GET') return listNotes(env);
      if (parts.length === 1 && method === 'POST') return createNote(request, env);
      if (parts.length === 2 && parts[1] === 'trash' && method === 'GET') return listTrashNotes(env);
      if (parts.length === 2 && method === 'PUT') return updateNote(parts[1], request, env);
      if (parts.length === 2 && method === 'DELETE') return deleteNote(parts[1], env);
      if (parts.length === 3 && parts[2] === 'restore' && method === 'PUT') return restoreNote(parts[1], env);
      if (parts.length === 3 && parts[2] === 'purge' && method === 'DELETE') return purgeNote(parts[1], env);
    }

    if (parts[0] === 'clips') {
      if (parts.length === 1 && method === 'GET') return listClips(env);
      if (parts.length === 1 && method === 'POST') return createClip(request, env);
      if (parts.length === 2 && parts[1] === 'trash' && method === 'GET') return listTrashClips(env);
      if (parts.length === 2 && method === 'GET') return getClip(parts[1], env);
      if (parts.length === 2 && method === 'PUT') return updateClip(parts[1], request, env);
      if (parts.length === 2 && method === 'DELETE') return deleteClip(parts[1], env);
      if (parts.length === 3 && parts[2] === 'restore' && method === 'PUT') return restoreClip(parts[1], env);
      if (parts.length === 3 && parts[2] === 'purge' && method === 'DELETE') return purgeClip(parts[1], env);
    }

    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: 'server error', detail: String(err && err.message || err) }, 500);
  }
}
