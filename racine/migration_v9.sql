-- Racine — migration v9 (jeton de capture rapide iOS Raccourcis/Siri). Exécuter UNE FOIS.

CREATE TABLE IF NOT EXISTS quick_capture (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (9, CAST(strftime('%s','now') AS INTEGER) * 1000);
