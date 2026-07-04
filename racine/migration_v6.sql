-- Racine — migration v6 (suivi des migrations, sauvegardes auto, anti-bruteforce). Exécuter UNE FOIS.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  first_attempt INTEGER NOT NULL,
  locked_until INTEGER
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

-- ta base a déjà les migrations v1 à v5 (elles ont été appliquées à la main avant ce suivi)
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  (2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  (3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  (4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  (5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  (6, CAST(strftime('%s','now') AS INTEGER) * 1000);
