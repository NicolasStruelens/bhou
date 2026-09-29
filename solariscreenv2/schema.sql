-- ═══════════════════════════════════════════════════════════
-- SOLARISCREEN — Schéma D1 (SQLite) — v3
-- Migration : wrangler d1 execute solariscreen-db --file=schema.sql --remote
-- (sans danger : tout est en CREATE TABLE IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════

-- ── DEVIS (existant) ──
CREATE TABLE IF NOT EXISTS devis (
  id                TEXT PRIMARY KEY,
  client_nom        TEXT NOT NULL DEFAULT '',
  client_prenom     TEXT NOT NULL DEFAULT '',
  statut            TEXT NOT NULL DEFAULT 'brouillon',
  total_ttc         REAL NOT NULL DEFAULT 0,
  date_creation     TEXT,
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);
CREATE INDEX IF NOT EXISTS idx_devis_modif  ON devis(date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_devis_client ON devis(client_nom, client_prenom);

-- ── CLIENTS (CRM — fiches d'enrichissement) ──
CREATE TABLE IF NOT EXISTS clients (
  key               TEXT PRIMARY KEY,   -- "nom|prenom" normalisé
  nom               TEXT NOT NULL DEFAULT '',
  prenom            TEXT NOT NULL DEFAULT '',
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_modif ON clients(date_modification DESC);

-- ── FACTURES ──
CREATE TABLE IF NOT EXISTS factures (
  id                TEXT PRIMARY KEY,   -- ex : F2026-001
  devis_id          TEXT,
  client_nom        TEXT NOT NULL DEFAULT '',
  client_prenom     TEXT NOT NULL DEFAULT '',
  total_ttc         REAL NOT NULL DEFAULT 0,
  date              TEXT,
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_factures_date  ON factures(date DESC);
CREATE INDEX IF NOT EXISTS idx_factures_devis ON factures(devis_id);

-- ── RDV (demandes de visite / leads avant devis) ──
CREATE TABLE IF NOT EXISTS rdv (
  id                TEXT PRIMARY KEY,   -- ex : RDV-2026-XXXXXX
  client_nom        TEXT NOT NULL DEFAULT '',
  client_prenom     TEXT NOT NULL DEFAULT '',
  statut            TEXT NOT NULL DEFAULT 'nouveau',   -- nouveau|a_contacter|rdv_fixe|visite|converti|annule
  assigned_to       TEXT,               -- 'nicolas' | 'yannick' | NULL
  date_rdv          TEXT,               -- date de visite fixée (ISO) ou NULL
  devis_id          TEXT,               -- devis créé après la visite (lien du dossier)
  date_creation     TEXT,
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rdv_statut ON rdv(statut);
CREATE INDEX IF NOT EXISTS idx_rdv_modif  ON rdv(date_modification DESC);

-- ── JOURNAL D'ACTIVITÉ (qui a fait quoi et quand — alimenté par les actions client) ──
CREATE TABLE IF NOT EXISTS activity (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                TEXT NOT NULL,        -- horodatage ISO (serveur)
  actor             TEXT,                 -- 'nicolas' | 'yannick' | e-mail brut | NULL
  action            TEXT NOT NULL,        -- ex : 'devis.statut', 'devis.delete', 'rdv.create', 'note.add'
  entity_type       TEXT,                 -- 'devis' | 'rdv' | 'facture' | 'client'
  entity_id         TEXT,
  label             TEXT,                 -- texte lisible : "Devis #123 (Depaepe) → Signé"
  meta              TEXT                  -- JSON optionnel
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts DESC);

-- ── OUTILLAGE (carnet de références perso : visserie, fixations, outils — photo + réf + lien d'achat) ──
-- Créée aussi à la volée par le backend (CREATE TABLE IF NOT EXISTS) : la migration n'est donc pas
-- indispensable, mais on la garde ici pour documenter le schéma complet.
CREATE TABLE IF NOT EXISTS outillage (
  id                TEXT PRIMARY KEY,
  nom               TEXT NOT NULL DEFAULT '',
  categorie         TEXT,
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outillage_modif ON outillage(date_modification DESC);

-- ── CONNEXIONS (historique de connexion Nicolas / Yannick, alimenté par nav.js) ──
CREATE TABLE IF NOT EXISTS connections (
  session_id        TEXT PRIMARY KEY,
  identity          TEXT,               -- 'nicolas' | 'yannick' | NULL
  email             TEXT NOT NULL DEFAULT '',
  start_time        TEXT NOT NULL,
  last_seen         TEXT NOT NULL,
  page_count        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_connections_start ON connections(start_time DESC);

-- ── DISPOS (exceptions de planning : congés, indisponibilités, disponibilité exceptionnelle) ──
-- On n'enregistre JAMAIS les créneaux libres : ils se déduisent de la trame hebdomadaire (réglages)
-- moins ce qui est déjà planifié. Seules les EXCEPTIONS méritent une ligne, d'où le peu de volume.
--   kind = 'indispo' : retire du temps (congé, rendez-vous perso, autre chantier)
--   kind = 'dispo'   : en ajoute (« exceptionnellement, ce samedi-là je peux »)
-- Table créée aussi à la volée par le backend : la migration n'est pas indispensable avant de
-- déployer, elle documente le schéma complet.
CREATE TABLE IF NOT EXISTS dispos (
  id                TEXT PRIMARY KEY,   -- ex : DISPO-2026-XXXXXX
  qui               TEXT NOT NULL DEFAULT '',   -- 'nicolas' | 'yannick'
  kind              TEXT NOT NULL DEFAULT 'indispo',
  du                TEXT NOT NULL DEFAULT '',   -- 'YYYY-MM-DD' (inclus)
  au                TEXT NOT NULL DEFAULT '',   -- 'YYYY-MM-DD' (inclus)
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispos_qui ON dispos(qui, du);
CREATE INDEX IF NOT EXISTS idx_dispos_au  ON dispos(au DESC);

-- ── SUJETS (le fil d'échange interne : à faire, questions, idées, choses en attente) ──
-- Pourquoi une table plutôt que des notes sur les dossiers : les échanges existaient déjà, mais
-- ENFERMÉS dans une fiche (demande de RDV, devis). Pour savoir si l'autre avait répondu, il fallait
-- rouvrir le bon dossier — donc savoir lequel. Et une idée qui ne concerne aucun client n'avait
-- nulle part où aller. Ici tout ce qui attend quelqu'un se lit au même endroit.
--   kind     = afaire | question | idee | attente
--   awaiting = de QUI on attend quelque chose (moteur du badge et du tri)
CREATE TABLE IF NOT EXISTS sujets (
  id                TEXT PRIMARY KEY,   -- ex : SUJ-2026-XXXXXX
  kind              TEXT NOT NULL DEFAULT 'afaire',
  statut            TEXT NOT NULL DEFAULT 'ouvert',   -- ouvert | fait
  auteur            TEXT,               -- signé par le serveur, jamais choisi dans un menu
  pour              TEXT,               -- 'nicolas' | 'yannick' | '' (les deux)
  awaiting          TEXT,               -- '' quand la balle n'est dans le camp de personne
  client_key        TEXT,               -- lien CRM facultatif
  devis_id          TEXT,               -- lien dossier facultatif
  echeance          TEXT,               -- 'YYYY-MM-DD' facultatif
  date_creation     TEXT,
  date_modification TEXT,
  data              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sujets_statut ON sujets(statut, date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_sujets_await  ON sujets(awaiting);
