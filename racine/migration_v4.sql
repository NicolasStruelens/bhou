-- Racine — migration v4 (tags, rappels datés, favoris presse-papier). À exécuter UNE FOIS dans la Console D1.

ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE notes ADD COLUMN remind_at INTEGER;
ALTER TABLE clips ADD COLUMN pinned INTEGER DEFAULT 0;
