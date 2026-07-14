-- Racine v12 — boîte de dépôt et durée d'action

ALTER TABLE notes ADD COLUMN inbox INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN effort_minutes INTEGER;

INSERT INTO schema_migrations (version, applied_at) VALUES
  (12, CAST(strftime('%s','now') AS INTEGER) * 1000);
