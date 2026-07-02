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
