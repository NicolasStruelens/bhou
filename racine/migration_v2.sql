-- Racine — migration v2 (corbeille). À exécuter UNE FOIS dans la Console D1
-- si la base existe déjà (déploiement initial fait avant cette mise à jour).

ALTER TABLE notes ADD COLUMN deleted_at INTEGER;
ALTER TABLE clips ADD COLUMN deleted_at INTEGER;
