-- Racine — schéma D1

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  kind TEXT DEFAULT 'idee',       -- idee | todo | note
  pinned INTEGER DEFAULT 0,        -- "à ne pas oublier"
  done INTEGER DEFAULT 0,          -- pour les todo
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER               -- NULL = actif, sinon dans la corbeille
);
CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  label TEXT DEFAULT '',
  content TEXT NOT NULL,           -- texte, ou base64 si kind='file'
  kind TEXT DEFAULT 'text',        -- text | file
  filename TEXT,
  mime TEXT,
  device TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,              -- NULL = jamais (expiration dure, purge immédiate)
  deleted_at INTEGER               -- NULL = actif, sinon dans la corbeille
);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at);
