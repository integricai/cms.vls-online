-- Qualification → duration / exam-month offer rules (ACCA sessions, CIMA subscriptions, etc.)

CREATE TABLE IF NOT EXISTS qualification_offer_rules (
  id              SERIAL      PRIMARY KEY,
  qualification   TEXT        NOT NULL,
  offer_type      TEXT        NOT NULL
                  CHECK (offer_type IN ('exam_sessions', 'open')),
  duration_days   INTEGER[]   NOT NULL DEFAULT '{}',
  exam_months     INTEGER[]   NOT NULL DEFAULT '{}',
  cutoff_day      INTEGER     NULL
                  CHECK (cutoff_day IS NULL OR (cutoff_day >= 1 AND cutoff_day <= 28)),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qualification_offer_rules_qualification_uq UNIQUE (qualification)
);

CREATE INDEX IF NOT EXISTS qualification_offer_rules_active_idx
  ON qualification_offer_rules (is_active, sort_order);

INSERT INTO qualification_offer_rules (
  qualification, offer_type, duration_days, exam_months, cutoff_day, is_active, sort_order
)
VALUES
  ('ACCA', 'exam_sessions', ARRAY[90, 180], ARRAY[3, 6, 9, 12], 12, true, 10),
  ('CIMA', 'open', ARRAY[180, 365], ARRAY[]::INTEGER[], NULL, true, 20)
ON CONFLICT (qualification) DO NOTHING;
