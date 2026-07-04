-- Racine — migration v5 (liens entre notes). À exécuter UNE FOIS dans la Console D1.

ALTER TABLE notes ADD COLUMN links TEXT DEFAULT '';
