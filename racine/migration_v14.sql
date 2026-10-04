-- Racine v14 — recettes développées : catégorie, étapes de préparation, portions

ALTER TABLE recipes ADD COLUMN category TEXT DEFAULT '';
ALTER TABLE recipes ADD COLUMN steps TEXT DEFAULT '';
ALTER TABLE recipes ADD COLUMN portions INTEGER;

INSERT INTO schema_migrations (version, applied_at) VALUES
  (14, CAST(strftime('%s','now') AS INTEGER) * 1000);
