// Racine — API same-origin (Cloudflare Pages Functions)
// Auth par mot de passe unique (env RACINE_PASSWORD) + session token en cookie HttpOnly, stockée en D1.

const SESSION_DAYS = 30;
const COOKIE_NAME = 'racine_session';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // corbeille purgée après 30 jours
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const BACKUP_KEEP = 14;
const SCHEMA_VERSION = 13;
const BACKUP_DEDUP_MS = 20 * 60 * 60 * 1000;
const QUICK_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const IMPORT_MAX_ITEMS = 2000;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function newId() {
  return crypto.randomUUID();
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).byteLength;
}

function validId(value) {
  return /^[a-zA-Z0-9-]{16,80}$/.test(String(value || ''));
}

function timestampOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function clipTypeHint(content, kind) {
  if (kind === 'file') return 'file';
  const text = String(content || '').trim();
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text) ||
      /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|authorization)\s*[:=]\s*\S+/i.test(text) ||
      /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text)) return 'secret';
  if (/^https?:\/\/\S+$/.test(text)) {
    try {
      const url = new URL(text);
      const sensitiveKeys = ['token', 'key', 'secret', 'password', 'signature', 'sig', 'access_token', 'api_key'];
      if (sensitiveKeys.some((key) => (url.searchParams.get(key) || '').length >= 8)) return 'secret';
    } catch (e) {}
    return 'url';
  }
  if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(text)) {
    try { JSON.parse(text); return 'json'; } catch (e) {}
  }
  if (/^(sudo\s|ssh\s|curl\s|git\s|npm\s|docker\s|powershell|\$\s|>\s)/i.test(text) ||
      /^[A-Za-z0-9_.\/-]+\s+--?[a-z]/.test(text)) return 'command';
  const looksSecret = text.indexOf('\n') === -1 && text.length >= 8 && text.length <= 100 &&
    /[A-Za-z]/.test(text) && /[0-9]/.test(text) && !/\s/.test(text);
  return looksSecret ? 'secret' : 'text';
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
  await env.DB.prepare('DELETE FROM recipes WHERE deleted_at IS NOT NULL AND deleted_at < ?').bind(cutoff).run();
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

function normalizeEffort(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.max(1, Math.min(480, Math.round(minutes))) : null;
}

async function createNote(request, env) {
  const body = await request.json().catch(() => ({}));
  const requestedId = String(body.id || '');
  const id = validId(requestedId) ? requestedId : newId();
  const now = Date.now();
  const title = String(body.title || '').trim().slice(0, 500);
  if (!title) return json({ error: 'titre vide' }, 400);
  if (body.parent_id) {
    if (body.parent_id === id) return json({ error: 'boucle : une note ne peut pas être son propre parent' }, 400);
    const parent = await env.DB.prepare(
      'SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL'
    ).bind(String(body.parent_id)).first();
    if (!parent) return json({ error: 'parent introuvable' }, 400);
  }
  // created_at/updated_at/history ne sont honorés que s'ils sont fournis (restauration d'export/sauvegarde) ;
  // une création normale depuis l'app ne les envoie jamais et obtient donc l'horodatage courant.
  let history = '[]';
  if (Array.isArray(body.history)) {
    history = JSON.stringify(body.history.slice(-HISTORY_MAX));
  }
  const isDone = !!body.done;
  const completedAt = isDone ? (timestampOrNull(body.completed_at) || timestampOrNull(body.updated_at) || now) : null;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notes (id, parent_id, title, content, kind, pinned, done, position, space, tags, remind_at, links, energy, status, inbox, effort_minutes, history, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.parent_id || null,
    title,
    String(body.content || '').slice(0, 20000),
    ['idee', 'todo', 'note'].includes(body.kind) ? body.kind : 'idee',
    body.pinned ? 1 : 0,
    isDone ? 1 : 0,
    body.position || 0,
    String(body.space || 'Général').trim().slice(0, 60) || 'Général',
    String(body.tags || '').slice(0, 300),
    isDone ? null : timestampOrNull(body.remind_at),
    String(body.links || '').slice(0, 2000),
    ['2min', 'facile', 'profond', 'urgent', 'attente', ''].includes(body.energy) ? body.energy : '',
    body.status === 'someday' ? 'someday' : 'active',
    body.inbox ? 1 : 0,
    normalizeEffort(body.effort_minutes),
    history,
    completedAt,
    body.created_at ? Number(body.created_at) : now,
    body.updated_at ? Number(body.updated_at) : now
  ).run();
  return json({ ok: true, id });
}

const HISTORY_MAX = 10;

async function updateNote(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare(
    'SELECT title, content, tags, energy, history, updated_at, done FROM notes WHERE id = ?'
  ).bind(id).first();
  if (!existing) return json({ error: 'not found' }, 404);

  if ('parent_id' in body && body.parent_id) {
    if (body.parent_id === id) {
      return json({ error: 'boucle : une note ne peut pas être son propre parent' }, 400);
    }
    const descendants = await collectDescendants(id, env);
    if (descendants.includes(body.parent_id)) {
      return json({ error: 'boucle : le nouveau parent est une descendante de cette note' }, 400);
    }
    const parent = await env.DB.prepare(
      'SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL'
    ).bind(String(body.parent_id)).first();
    if (!parent) return json({ error: 'parent introuvable' }, 400);
  }
  if ('title' in body && !String(body.title || '').trim()) return json({ error: 'titre vide' }, 400);

  const fields = [];
  const values = [];
  const map = {
    title: (v) => String(v).trim().slice(0, 500),
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
    energy: (v) => (['2min', 'facile', 'profond', 'urgent', 'attente', ''].includes(v) ? v : ''),
    status: (v) => (v === 'someday' ? 'someday' : 'active'),
    inbox: (v) => (v ? 1 : 0),
    effort_minutes: normalizeEffort,
  };
  for (const key of Object.keys(map)) {
    if (key in body) {
      if (key === 'remind_at' && body.done) continue;
      fields.push(`${key} = ?`);
      values.push(map[key](body[key]));
    }
  }
  if ('done' in body) {
    fields.push('completed_at = ?');
    values.push(body.done ? Date.now() : null);
    if (body.done) {
      fields.push('remind_at = ?');
      values.push(null);
    }
  }
  if (!fields.length) return json({ ok: true });

  // historique : ne snapshotter que sur une édition de contenu réelle (pas un simple pin/done/déplacement)
  const touchesContent = ['title', 'content', 'tags', 'energy'].some((k) => k in body);
  if (touchesContent) {
    let history = [];
    try { history = JSON.parse(existing.history || '[]'); } catch (e) { history = []; }
    history.push({
      title: existing.title,
      content: existing.content,
      tags: existing.tags,
      energy: existing.energy,
      updated_at: existing.updated_at,
    });
    if (history.length > HISTORY_MAX) history = history.slice(history.length - HISTORY_MAX);
    fields.push('history = ?');
    values.push(JSON.stringify(history));
  }

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  await env.DB.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ ok: true });
}

async function collectDescendants(id, env) {
  let frontier = [id];
  const all = [id];
  const seen = new Set(all);
  while (frontier.length) {
    const placeholders = frontier.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT id FROM notes WHERE parent_id IN (${placeholders})`
    ).bind(...frontier).all();
    const children = results.map((r) => r.id).filter((childId) => {
      if (seen.has(childId)) return false;
      seen.add(childId);
      return true;
    });
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
    'SELECT id, label, kind, filename, mime, device, pinned, burn, no_export, share_token, share_expires_at, ' +
    'created_at, expires_at, LENGTH(CAST(content AS BLOB)) as size, ' +
    "CASE WHEN kind = 'file' THEN NULL ELSE content END as raw_preview " +
    "FROM clips WHERE deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT 200"
  ).all();
  const clips = results.map((row) => {
    const hint = clipTypeHint(row.raw_preview, row.kind);
    const preview = hint === 'secret' ? null : String(row.raw_preview || '').slice(0, 1200);
    const { raw_preview, ...safe } = row;
    return { ...safe, preview, type_hint: hint, preview_truncated: hint !== 'secret' && String(raw_preview || '').length > 1200 };
  });
  return json({ clips });
}

async function updateClip(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT id, content, kind FROM clips WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'not found' }, 404);
  if ('pinned' in body) {
    await env.DB.prepare('UPDATE clips SET pinned = ? WHERE id = ?').bind(body.pinned ? 1 : 0, id).run();
  }
  if ('no_export' in body) {
    const mustProtect = clipTypeHint(existing.content, existing.kind) === 'secret';
    await env.DB.prepare('UPDATE clips SET no_export = ? WHERE id = ?').bind(body.no_export || mustProtect ? 1 : 0, id).run();
    if (mustProtect && !body.no_export) return json({ ok: true, protected_secret: true });
  }
  if (body.share === true) {
    const token = newId();
    const ttl = Math.max(60 * 1000, Number(body.share_ttl_ms) || 60 * 60 * 1000);
    const expiresAt = Date.now() + Math.min(ttl, 24 * 60 * 60 * 1000); // 24h max
    await env.DB.prepare('UPDATE clips SET share_token = ?, share_expires_at = ? WHERE id = ?').bind(token, expiresAt, id).run();
    return json({ ok: true, share_token: token, share_expires_at: expiresAt });
  }
  if (body.share === false) {
    await env.DB.prepare('UPDATE clips SET share_token = NULL, share_expires_at = NULL WHERE id = ?').bind(id).run();
  }
  return json({ ok: true });
}

async function getPublicClip(token, env) {
  const row = await env.DB.prepare(
    'SELECT * FROM clips WHERE share_token = ? AND deleted_at IS NULL'
  ).bind(token).first();
  if (!row) return json({ error: 'not found' }, 404);
  if (!row.share_expires_at || row.share_expires_at < Date.now()) {
    return json({ error: 'ce lien de partage a expiré' }, 410);
  }
  if (row.expires_at && row.expires_at < Date.now()) {
    return json({ error: 'expired' }, 410);
  }
  // Un lien public est réellement à usage unique : une seule requête peut le consommer.
  const consumed = await env.DB.prepare(
    'UPDATE clips SET share_token = NULL, share_expires_at = NULL WHERE id = ? AND share_token = ?'
  ).bind(row.id, token).run();
  if (!consumed.meta || consumed.meta.changes !== 1) return json({ error: 'ce lien a déjà été utilisé' }, 410);
  if (row.burn) await env.DB.prepare('DELETE FROM clips WHERE id = ?').bind(row.id).run();
  return json({
    clip: {
      label: row.label,
      kind: row.kind,
      content: row.content,
      filename: row.filename,
      mime: row.mime,
    },
  });
}

// ----- capture rapide par jeton (iOS Raccourcis / Siri / Action Button) -----
// un seul jeton actif à la fois ; volontairement protégé UNIQUEMENT par le secret du jeton
// (comme /api/public/:token), car un raccourci Apple Shortcuts ne peut pas porter le cookie de session

async function getQuickToken(env) {
  const row = await env.DB.prepare('SELECT token, created_at FROM quick_capture LIMIT 1').first();
  const expired = row && row.created_at + QUICK_TOKEN_MAX_AGE_MS < Date.now();
  if (expired) await env.DB.prepare('DELETE FROM quick_capture').run();
  return json({
    token: row && !expired ? row.token : null,
    created_at: row && !expired ? row.created_at : null,
    expires_at: row && !expired ? row.created_at + QUICK_TOKEN_MAX_AGE_MS : null,
  });
}

async function createQuickToken(env) {
  const token = newId();
  const now = Date.now();
  await env.DB.prepare('DELETE FROM quick_capture').run();
  await env.DB.prepare('INSERT INTO quick_capture (token, created_at) VALUES (?, ?)').bind(token, now).run();
  return json({ ok: true, token, created_at: now, expires_at: now + QUICK_TOKEN_MAX_AGE_MS });
}

async function revokeQuickToken(env) {
  await env.DB.prepare('DELETE FROM quick_capture').run();
  return json({ ok: true });
}

async function quickCapture(token, request, env) {
  const row = await env.DB.prepare('SELECT token, created_at FROM quick_capture WHERE token = ?').bind(token).first();
  if (!row) return json({ error: 'jeton invalide ou révoqué' }, 404);
  if (row.created_at + QUICK_TOKEN_MAX_AGE_MS < Date.now()) {
    await env.DB.prepare('DELETE FROM quick_capture WHERE token = ?').bind(token).run();
    return json({ error: 'jeton expiré : régénère-le dans Racine' }, 410);
  }
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim().slice(0, 500);
  if (!text) return json({ error: 'texte vide' }, 400);
  const id = newId();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO notes (id, parent_id, title, content, kind, pinned, done, position, space, tags, inbox, created_at, updated_at)
     VALUES (?, NULL, ?, '', 'idee', 0, 0, 0, 'Général', '#raccourci', 1, ?, ?)`
  ).bind(id, text, now, now).run();
  return json({ ok: true, id });
}

async function listTrashClips(env) {
  await purgeOldTrash(env);
  const { results } = await env.DB.prepare(
    'SELECT id, label, kind, filename, mime, device, created_at, deleted_at, LENGTH(CAST(content AS BLOB)) as size, ' +
    "CASE WHEN kind = 'file' THEN NULL ELSE content END as raw_preview " +
    'FROM clips WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
  ).all();
  const clips = results.map((row) => {
    const hint = clipTypeHint(row.raw_preview, row.kind);
    const { raw_preview, ...safe } = row;
    return { ...safe, preview: hint === 'secret' ? null : String(raw_preview || '').slice(0, 1200), type_hint: hint };
  });
  return json({ clips });
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

async function consumeClip(id, env) {
  const row = await env.DB.prepare(
    'SELECT id, burn FROM clips WHERE id = ? AND deleted_at IS NULL'
  ).bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  if (!row.burn) return json({ ok: true, consumed: false });
  await env.DB.prepare('DELETE FROM clips WHERE id = ?').bind(id).run();
  return json({ ok: true, consumed: true });
}

async function createClip(request, env) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || '');
  if (!content) return json({ error: 'contenu vide' }, 400);
  if (byteLength(content) > MAX_CLIP_BYTES) {
    return json({ error: 'contenu trop volumineux (max ~800 Ko)' }, 413);
  }
  const id = newId();
  const now = Date.now();
  let expiresAt = null;
  if (body.ttl_ms) expiresAt = now + Number(body.ttl_ms);
  if (body.expires_at) expiresAt = Number(body.expires_at);
  const hint = clipTypeHint(content, body.kind);
  const protectedSecret = hint === 'secret';
  if (protectedSecret) {
    expiresAt = Math.min(expiresAt || (now + 60 * 60 * 1000), now + 60 * 60 * 1000);
  }

  await env.DB.prepare(
    `INSERT INTO clips (id, label, content, kind, filename, mime, device, pinned, burn, no_export, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    String(body.label || '').slice(0, 200),
    content,
    body.kind === 'file' ? 'file' : 'text',
    body.filename ? String(body.filename).slice(0, 200) : null,
    body.mime ? String(body.mime).slice(0, 100) : null,
    String(body.device || '').slice(0, 100),
    body.pinned ? 1 : 0,
    body.burn || protectedSecret ? 1 : 0,
    body.no_export || protectedSecret ? 1 : 0,
    body.created_at ? Number(body.created_at) : now,
    expiresAt
  ).run();
  return json({ ok: true, id, protected_secret: protectedSecret, type_hint: hint });
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

// ----- recettes & listes de courses -----

const MAX_INGREDIENTS = 100;

function sanitizeIngredients(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_INGREDIENTS).map((it) => {
    const qtyNum = it && it.qty !== undefined && it.qty !== null && it.qty !== '' ? Number(it.qty) : NaN;
    return {
      name: String((it && it.name) || '').slice(0, 120),
      have: !!(it && it.have),
      qty: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : null,
      unit: ['piece', 'g', 'kg'].includes(it && it.unit) ? it.unit : 'piece',
    };
  }).filter((it) => it.name);
}

async function listRecipes(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM recipes WHERE deleted_at IS NULL ORDER BY created_at DESC'
  ).all();
  return json({ recipes: results });
}

async function listTrashRecipes(env) {
  await purgeOldTrash(env);
  const { results } = await env.DB.prepare(
    'SELECT * FROM recipes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
  ).all();
  return json({ recipes: results });
}

async function createRecipe(request, env) {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim().slice(0, 200);
  if (!title) return json({ error: 'titre vide' }, 400);
  const id = newId();
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO recipes (id, title, ingredients, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    id,
    title,
    JSON.stringify(sanitizeIngredients(body.ingredients)),
    body.created_at ? Number(body.created_at) : now,
    body.updated_at ? Number(body.updated_at) : now
  ).run();
  return json({ ok: true, id });
}

async function updateRecipe(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT id FROM recipes WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'not found' }, 404);

  const fields = [];
  const values = [];
  if ('title' in body) {
    const title = String(body.title || '').trim().slice(0, 200);
    if (!title) return json({ error: 'titre vide' }, 400);
    fields.push('title = ?');
    values.push(title);
  }
  if ('ingredients' in body) {
    fields.push('ingredients = ?');
    values.push(JSON.stringify(sanitizeIngredients(body.ingredients)));
  }
  if (!fields.length) return json({ ok: true });
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  await env.DB.prepare(`UPDATE recipes SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ ok: true });
}

async function deleteRecipe(id, env) {
  await env.DB.prepare('UPDATE recipes SET deleted_at = ? WHERE id = ?').bind(Date.now(), id).run();
  return json({ ok: true });
}

async function restoreRecipe(id, env) {
  await env.DB.prepare('UPDATE recipes SET deleted_at = NULL WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function purgeRecipe(id, env) {
  await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ----- préférences (synchronisées entre appareils : espaces connus, couleurs, mode matinal, rappels) -----

async function getPreferences(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM preferences').all();
  const map = {};
  results.forEach((r) => { map[r.key] = r.value; });
  return json({ preferences: map });
}

async function setPreferences(request, env) {
  const body = await request.json().catch(() => ({}));
  const now = Date.now();
  const keys = Object.keys(body || {}).slice(0, 20);
  for (const key of keys) {
    const value = String(body[key]).slice(0, 5000);
    await env.DB.prepare(
      `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(key.slice(0, 100), value, now).run();
  }
  return json({ ok: true });
}

// ----- import atomique, rejouable sans doublons -----

function parseHistory(raw) {
  let history = raw;
  if (typeof history === 'string') {
    try { history = JSON.parse(history); } catch (e) { history = []; }
  }
  return Array.isArray(history) ? JSON.stringify(history.slice(-HISTORY_MAX)) : '[]';
}

function importError(message, status = 400) {
  return json({ error: message }, status);
}

async function importAll(request, env) {
  const raw = await request.text();
  if (byteLength(raw) > IMPORT_MAX_BYTES) return importError('fichier trop volumineux (5 Mo maximum)', 413);
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return importError('JSON invalide'); }

  const data = payload && payload.data ? payload.data : payload;
  const mode = payload && payload.mode === 'replace' ? 'replace' : 'merge';
  const dryRun = !!(payload && payload.dry_run);
  if (!data || !Array.isArray(data.notes)) return importError('format Racine non reconnu');

  const notes = data.notes;
  const clips = Array.isArray(data.clips) ? data.clips : [];
  const recipes = Array.isArray(data.recipes) ? data.recipes : [];
  const preferenceMap = data.preferences && typeof data.preferences === 'object' && !Array.isArray(data.preferences)
    ? data.preferences : {};
  if (notes.length + clips.length + recipes.length > IMPORT_MAX_ITEMS) {
    return importError(`import limité à ${IMPORT_MAX_ITEMS} éléments`, 413);
  }

  const warnings = [];
  const noteIds = new Set();
  for (const note of notes) {
    if (!note || !validId(note.id)) return importError('une note possède un identifiant invalide');
    if (noteIds.has(note.id)) return importError('identifiant de note dupliqué dans le fichier');
    if (!String(note.title || '').trim()) return importError('une note possède un titre vide');
    noteIds.add(note.id);
  }

  const availableIds = new Set(noteIds);
  if (mode === 'merge') {
    const existing = await env.DB.prepare('SELECT id FROM notes WHERE deleted_at IS NULL').all();
    existing.results.forEach((row) => availableIds.add(row.id));
  }

  const parentMap = new Map();
  try {
    notes.forEach((note) => {
      const parentId = note.parent_id ? String(note.parent_id) : null;
      if (parentId && !availableIds.has(parentId)) throw new Error('IMPORT_ORPHAN');
      if (parentId === note.id) throw new Error('IMPORT_CYCLE');
      parentMap.set(note.id, parentId);
    });
  } catch (err) {
    if (err.message === 'IMPORT_ORPHAN') return importError('hiérarchie invalide : un parent est absent');
    return importError('hiérarchie invalide : une boucle a été détectée');
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error('IMPORT_CYCLE');
    visiting.add(id);
    const parentId = parentMap.get(id);
    if (parentId && parentMap.has(parentId)) visit(parentId);
    visiting.delete(id);
    visited.add(id);
  }
  try {
    noteIds.forEach(visit);
  } catch (err) {
    if (err.message === 'IMPORT_ORPHAN') return importError('hiérarchie invalide : un parent est absent');
    return importError('hiérarchie invalide : une boucle a été détectée');
  }

  const now = Date.now();
  const cleanNotes = notes.map((note) => {
    const done = !!note.done;
    const rawLinks = String(note.links || '').split(',').map((id) => id.trim()).filter(Boolean);
    const links = rawLinks.filter((id) => availableIds.has(id) && id !== note.id);
    if (links.length !== rawLinks.length) warnings.push('Certains liens de notes invalides seront ignorés.');
    return {
      id: String(note.id),
      parent_id: note.parent_id ? String(note.parent_id) : null,
      title: String(note.title).trim().slice(0, 500),
      content: String(note.content || '').slice(0, 20000),
      kind: ['idee', 'todo', 'note'].includes(note.kind) ? note.kind : 'idee',
      pinned: note.pinned ? 1 : 0,
      done: done ? 1 : 0,
      position: Number(note.position) || 0,
      space: String(note.space || 'Général').trim().slice(0, 60) || 'Général',
      tags: String(note.tags || '').slice(0, 300),
      remind_at: done ? null : timestampOrNull(note.remind_at),
      links: links.join(','),
      energy: ['2min', 'facile', 'profond', 'urgent', 'attente', ''].includes(note.energy) ? note.energy : '',
      status: note.status === 'someday' ? 'someday' : 'active',
      inbox: note.inbox ? 1 : 0,
      effort_minutes: normalizeEffort(note.effort_minutes),
      history: parseHistory(note.history),
      completed_at: done ? (timestampOrNull(note.completed_at) || timestampOrNull(note.updated_at) || now) : null,
      created_at: timestampOrNull(note.created_at) || now,
      updated_at: timestampOrNull(note.updated_at) || now,
    };
  });

  const cleanClips = [];
  clips.forEach((clip) => {
    if (!clip || !clip.content) return;
    if (byteLength(clip.content) > MAX_CLIP_BYTES) {
      warnings.push('Un élément du presse-papiers trop volumineux sera ignoré.');
      return;
    }
    const expiresAt = timestampOrNull(clip.expires_at);
    if (expiresAt && expiresAt < now) {
      warnings.push('Un élément du presse-papiers déjà expiré sera ignoré.');
      return;
    }
    const kind = clip.kind === 'file' ? 'file' : 'text';
    const hint = clipTypeHint(clip.content, kind);
    const protectedSecret = hint === 'secret';
    if (protectedSecret && (!clip.burn || !clip.no_export || !expiresAt || expiresAt > now + 60 * 60 * 1000)) {
      warnings.push('Un secret ancien sera protégé automatiquement (1 h, lecture unique, hors export).');
    }
    cleanClips.push({
      id: validId(clip.id) ? String(clip.id) : newId(),
      label: String(clip.label || '').slice(0, 200),
      content: String(clip.content),
      kind,
      filename: clip.filename ? String(clip.filename).slice(0, 200) : null,
      mime: clip.mime ? String(clip.mime).slice(0, 100) : null,
      device: String(clip.device || '').slice(0, 100),
      pinned: clip.pinned ? 1 : 0,
      burn: clip.burn || protectedSecret ? 1 : 0,
      no_export: clip.no_export || protectedSecret ? 1 : 0,
      created_at: timestampOrNull(clip.created_at) || now,
      expires_at: protectedSecret ? Math.min(expiresAt || now + 60 * 60 * 1000, now + 60 * 60 * 1000) : expiresAt,
    });
  });

  const cleanRecipes = recipes.map((recipe) => {
    let ingredients = recipe && recipe.ingredients;
    if (typeof ingredients === 'string') {
      try { ingredients = JSON.parse(ingredients); } catch (e) { ingredients = []; }
    }
    return {
      id: validId(recipe && recipe.id) ? String(recipe.id) : newId(),
      title: String((recipe && recipe.title) || '').trim().slice(0, 200),
      ingredients: JSON.stringify(sanitizeIngredients(ingredients)),
      created_at: timestampOrNull(recipe && recipe.created_at) || now,
      updated_at: timestampOrNull(recipe && recipe.updated_at) || now,
    };
  }).filter((recipe) => recipe.title);

  const preferenceEntries = Object.keys(preferenceMap).slice(0, 50).map((key) => ({
    key: String(key).slice(0, 100),
    value: String(preferenceMap[key]).slice(0, 5000),
  })).filter((entry) => entry.key);
  const uniqueWarnings = Array.from(new Set(warnings));
  const report = {
    mode,
    counts: { notes: cleanNotes.length, clips: cleanClips.length, recipes: cleanRecipes.length, preferences: preferenceEntries.length },
    warnings: uniqueWarnings,
  };
  if (dryRun) return json({ ok: true, preview: report });
  if (mode === 'replace') await createBackup(null, env);

  const statements = [];
  if (mode === 'replace') {
    statements.push(
      env.DB.prepare('DELETE FROM notes'),
      env.DB.prepare('DELETE FROM clips'),
      env.DB.prepare('DELETE FROM recipes'),
      env.DB.prepare('DELETE FROM preferences')
    );
  }

  cleanNotes.forEach((note) => {
    statements.push(env.DB.prepare(
      `INSERT INTO notes (id, parent_id, title, content, kind, pinned, done, position, space, tags, remind_at, links, energy, status, inbox, effort_minutes, history, completed_at, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id, title=excluded.title, content=excluded.content,
       kind=excluded.kind, pinned=excluded.pinned, done=excluded.done, position=excluded.position, space=excluded.space,
       tags=excluded.tags, remind_at=excluded.remind_at, links=excluded.links, energy=excluded.energy,
       status=excluded.status, inbox=excluded.inbox, effort_minutes=excluded.effort_minutes, history=excluded.history,
       completed_at=excluded.completed_at, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=NULL`
    ).bind(
      note.id, note.parent_id, note.title, note.content, note.kind, note.pinned, note.done, note.position,
      note.space, note.tags, note.remind_at, note.links, note.energy, note.status, note.inbox,
      note.effort_minutes, note.history, note.completed_at, note.created_at, note.updated_at
    ));
  });
  cleanClips.forEach((clip) => {
    statements.push(env.DB.prepare(
      `INSERT INTO clips (id, label, content, kind, filename, mime, device, pinned, burn, no_export, share_token, share_expires_at, created_at, expires_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET label=excluded.label, content=excluded.content, kind=excluded.kind,
       filename=excluded.filename, mime=excluded.mime, device=excluded.device, pinned=excluded.pinned,
       burn=excluded.burn, no_export=excluded.no_export, share_token=NULL, share_expires_at=NULL,
       created_at=excluded.created_at, expires_at=excluded.expires_at, deleted_at=NULL`
    ).bind(
      clip.id, clip.label, clip.content, clip.kind, clip.filename, clip.mime, clip.device, clip.pinned,
      clip.burn, clip.no_export, clip.created_at, clip.expires_at
    ));
  });
  cleanRecipes.forEach((recipe) => {
    statements.push(env.DB.prepare(
      `INSERT INTO recipes (id, title, ingredients, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, ingredients=excluded.ingredients,
       created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=NULL`
    ).bind(recipe.id, recipe.title, recipe.ingredients, recipe.created_at, recipe.updated_at));
  });
  preferenceEntries.forEach((entry) => {
    statements.push(env.DB.prepare(
      `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    ).bind(entry.key, entry.value, now));
  });

  if (statements.length) await env.DB.batch(statements);
  return json({ ok: true, imported: report });
}

// ----- export complet -----

async function exportAll(env) {
  const notes = await env.DB.prepare(
    'SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY created_at ASC'
  ).all();
  await purgeExpiredClips(env);
  const clips = await env.DB.prepare(
    'SELECT * FROM clips WHERE deleted_at IS NULL AND no_export = 0 ORDER BY created_at ASC'
  ).all();
  const recipes = await env.DB.prepare(
    'SELECT * FROM recipes WHERE deleted_at IS NULL ORDER BY created_at ASC'
  ).all();
  const preferences = await env.DB.prepare('SELECT key, value FROM preferences').all();
  const preferenceMap = {};
  preferences.results.forEach((row) => { preferenceMap[row.key] = row.value; });
  return json({
    format: 'racine',
    format_version: 2,
    schema_version: SCHEMA_VERSION,
    exported_at: Date.now(),
    notes: notes.results,
    clips: clips.results,
    recipes: recipes.results,
    preferences: preferenceMap,
  });
}

// ----- sauvegardes -----

async function createBackup(request, env) {
  const body = request ? await request.json().catch(() => ({})) : {};
  const force = !!body.force;
  if (!force) {
    const recent = await env.DB.prepare(
      'SELECT id, created_at FROM backups WHERE created_at > ? ORDER BY created_at DESC LIMIT 1'
    ).bind(Date.now() - BACKUP_DEDUP_MS).first();
    if (recent) return json({ ok: true, id: recent.id, created_at: recent.created_at, reused: true });
  }
  const notes = await env.DB.prepare('SELECT * FROM notes WHERE deleted_at IS NULL').all();
  const clips = await env.DB.prepare('SELECT * FROM clips WHERE deleted_at IS NULL AND no_export = 0').all();
  const recipes = await env.DB.prepare('SELECT * FROM recipes WHERE deleted_at IS NULL').all();
  const preferences = await env.DB.prepare('SELECT key, value FROM preferences').all();
  const preferenceMap = {};
  preferences.results.forEach((row) => { preferenceMap[row.key] = row.value; });
  const id = newId();
  const now = Date.now();
  const data = JSON.stringify({
    format: 'racine',
    format_version: 2,
    schema_version: SCHEMA_VERSION,
    exported_at: now,
    notes: notes.results,
    clips: clips.results,
    recipes: recipes.results,
    preferences: preferenceMap,
  });
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
  try { data = JSON.parse(row.data); } catch (e) { data = { notes: [], clips: [], recipes: [], preferences: {} }; }
  return json({
    id: row.id,
    created_at: row.created_at,
    format: data.format || 'racine',
    format_version: data.format_version || 1,
    schema_version: data.schema_version || null,
    notes: data.notes || [],
    clips: data.clips || [],
    recipes: data.recipes || [],
    preferences: data.preferences || {},
  });
}

// ----- état système -----

async function health(env) {
  const [notesCount, clipsCount, remindersCount, recipesCount, doneReminders, doneOpenBranches, lastBackup, migrations] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM clips WHERE deleted_at IS NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL AND remind_at IS NOT NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM recipes WHERE deleted_at IS NULL').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL AND done = 1 AND remind_at IS NOT NULL').first(),
    env.DB.prepare(
      'SELECT COUNT(DISTINCT p.id) as c FROM notes p JOIN notes c ON c.parent_id = p.id ' +
      'WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL AND p.done = 1 AND c.done = 0'
    ).first(),
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
    recipes: recipesCount.c,
    completed_with_reminder: doneReminders.c,
    completed_with_open_children: doneOpenBranches.c,
    last_backup: lastBackup ? lastBackup.created_at : null,
  });
}

async function repairDataHealth(env) {
  const statements = [env.DB.prepare(
    'UPDATE notes SET remind_at = NULL WHERE deleted_at IS NULL AND done = 1 AND remind_at IS NOT NULL'
  )];
  const clips = await env.DB.prepare(
    'SELECT id, content, kind, burn, no_export, expires_at FROM clips WHERE deleted_at IS NULL'
  ).all();
  const now = Date.now();
  let secretsProtected = 0;
  clips.results.forEach((clip) => {
    if (clipTypeHint(clip.content, clip.kind) !== 'secret') return;
    if (clip.burn && clip.no_export && clip.expires_at && clip.expires_at <= now + 60 * 60 * 1000) return;
    secretsProtected += 1;
    statements.push(env.DB.prepare(
      'UPDATE clips SET burn = 1, no_export = 1, expires_at = ? WHERE id = ?'
    ).bind(Math.min(timestampOrNull(clip.expires_at) || now + 60 * 60 * 1000, now + 60 * 60 * 1000), clip.id));
  });
  const results = await env.DB.batch(statements);
  const first = results[0];
  return json({
    ok: true,
    reminders_cleared: first && first.meta && first.meta.changes ? first.meta.changes : 0,
    secrets_protected: secretsProtected,
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
    // partage public : volontairement AVANT la vérification de session (accessible sans connexion),
    // protégé uniquement par un jeton long, aléatoire, à usage unique et à expiration courte
    if (parts[0] === 'public' && parts.length === 2 && method === 'GET') return getPublicClip(parts[1], env);
    // capture rapide (iOS Raccourcis/Siri) : même logique, volontairement avant la session —
    // un raccourci Apple Shortcuts ne peut pas transporter le cookie de session
    if (parts[0] === 'quick' && parts.length === 2 && method === 'POST') return quickCapture(parts[1], request, env);

    // tout le reste nécessite une session valide
    const denied = await requireAuth(request, env);
    if (denied) return denied;

    if (parts[0] === 'export' && parts.length === 1 && method === 'GET') return exportAll(env);
    if (parts[0] === 'import' && parts.length === 1 && method === 'POST') return importAll(request, env);
    if (parts[0] === 'health' && parts.length === 1 && method === 'GET') return health(env);
    if (parts[0] === 'maintenance' && parts[1] === 'repair' && parts.length === 2 && method === 'POST') {
      return repairDataHealth(env);
    }

    if (parts[0] === 'preferences') {
      if (parts.length === 1 && method === 'GET') return getPreferences(env);
      if (parts.length === 1 && method === 'PUT') return setPreferences(request, env);
    }

    if (parts[0] === 'quick-token') {
      if (parts.length === 1 && method === 'GET') return getQuickToken(env);
      if (parts.length === 1 && method === 'POST') return createQuickToken(env);
      if (parts.length === 1 && method === 'DELETE') return revokeQuickToken(env);
    }

    if (parts[0] === 'backups') {
      if (parts.length === 1 && method === 'GET') return listBackups(env);
      if (parts.length === 1 && method === 'POST') return createBackup(request, env);
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
      if (parts.length === 3 && parts[2] === 'consume' && method === 'POST') return consumeClip(parts[1], env);
      if (parts.length === 3 && parts[2] === 'restore' && method === 'PUT') return restoreClip(parts[1], env);
      if (parts.length === 3 && parts[2] === 'purge' && method === 'DELETE') return purgeClip(parts[1], env);
    }

    if (parts[0] === 'recipes') {
      if (parts.length === 1 && method === 'GET') return listRecipes(env);
      if (parts.length === 1 && method === 'POST') return createRecipe(request, env);
      if (parts.length === 2 && parts[1] === 'trash' && method === 'GET') return listTrashRecipes(env);
      if (parts.length === 2 && method === 'PUT') return updateRecipe(parts[1], request, env);
      if (parts.length === 2 && method === 'DELETE') return deleteRecipe(parts[1], env);
      if (parts.length === 3 && parts[2] === 'restore' && method === 'PUT') return restoreRecipe(parts[1], env);
      if (parts.length === 3 && parts[2] === 'purge' && method === 'DELETE') return purgeRecipe(parts[1], env);
    }

    return json({ error: 'not found' }, 404);
  } catch (err) {
    const payload = { error: 'server error' };
    if (env && env.DEBUG === 'true') payload.detail = String(err && err.message || err);
    return json(payload, 500);
  }
}
