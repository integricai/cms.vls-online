-- A/B tests configured in the vault. The Cloudflare worker reads the running rows.
-- Assignment counts are filled when the worker sends the first visit for a variant.

CREATE TABLE IF NOT EXISTS experiments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  entry_path  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experiments_status_check CHECK (status IN ('draft', 'running', 'ended'))
);

CREATE UNIQUE INDEX IF NOT EXISTS experiments_one_running_entry_idx
  ON experiments (entry_path)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS experiment_variants (
  id             SERIAL PRIMARY KEY,
  experiment_id  INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  path           TEXT NOT NULL,
  weight         INTEGER NOT NULL,
  position       INTEGER NOT NULL,
  CONSTRAINT experiment_variants_weight_check CHECK (weight >= 1 AND weight <= 99),
  CONSTRAINT experiment_variants_label_unique UNIQUE (experiment_id, label),
  CONSTRAINT experiment_variants_path_unique UNIQUE (experiment_id, path)
);

CREATE INDEX IF NOT EXISTS experiment_variants_experiment_idx
  ON experiment_variants (experiment_id, position);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id  INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_label  TEXT NOT NULL,
  day            DATE NOT NULL,
  visitors       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (experiment_id, variant_label, day),
  CONSTRAINT experiment_assignments_visitors_check CHECK (visitors >= 0)
);
