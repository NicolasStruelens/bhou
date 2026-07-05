-- Racine — migration v8 (historique des versions d'une note). Exécuter UNE FOIS.

ALTER TABLE notes ADD COLUMN history TEXT DEFAULT '[]';

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (8, CAST(strftime('%s','now') AS INTEGER) * 1000);
