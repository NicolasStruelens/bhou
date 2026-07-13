-- Racine — migration v11 (préférences synchronisées entre appareils). Exécuter UNE FOIS.

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (11, CAST(strftime('%s','now') AS INTEGER) * 1000);
