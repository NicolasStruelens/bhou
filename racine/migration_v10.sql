-- Racine — migration v10 (recettes + listes de courses). Exécuter UNE FOIS.

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ingredients TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_recipes_deleted ON recipes(deleted_at);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (10, CAST(strftime('%s','now') AS INTEGER) * 1000);
