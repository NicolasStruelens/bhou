-- Racine v13 — date de clôture fiable pour la Récolte

ALTER TABLE notes ADD COLUMN completed_at INTEGER;

-- Les éléments déjà terminés reçoivent la meilleure date historique disponible.
UPDATE notes
SET completed_at = COALESCE(updated_at, created_at)
WHERE done = 1 AND completed_at IS NULL;

-- Un élément terminé ne doit plus continuer à réclamer l'attention.
UPDATE notes
SET remind_at = NULL
WHERE done = 1 AND remind_at IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at) VALUES
  (13, CAST(strftime('%s','now') AS INTEGER) * 1000);
