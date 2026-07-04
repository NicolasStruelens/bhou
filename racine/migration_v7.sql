-- Racine — migration v7 (énergie, someday, presse-papier avancé, partage public). Exécuter UNE FOIS.

ALTER TABLE notes ADD COLUMN energy TEXT DEFAULT '';
ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'active';

ALTER TABLE clips ADD COLUMN burn INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN no_export INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN share_token TEXT;
ALTER TABLE clips ADD COLUMN share_expires_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_clips_share_token ON clips(share_token);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES
  (7, CAST(strftime('%s','now') AS INTEGER) * 1000);
