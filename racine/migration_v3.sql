-- Racine — migration v3 (espaces / multi-projets). À exécuter UNE FOIS dans la Console D1.

ALTER TABLE notes ADD COLUMN space TEXT DEFAULT 'Général';
