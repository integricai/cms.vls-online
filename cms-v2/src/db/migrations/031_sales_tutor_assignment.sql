-- ── Tutor commission + sale assignment / claim invites ──────────────────────

ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE tutors
  DROP CONSTRAINT IF EXISTS tutors_commission_percent_range;

ALTER TABLE tutors
  ADD CONSTRAINT tutors_commission_percent_range
  CHECK (commission_percent >= 0 AND commission_percent <= 100);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES tutors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_status TEXT NOT NULL DEFAULT 'AwaitingTutor',
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_assignment_status_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_assignment_status_check
  CHECK (assignment_status IN ('AwaitingTutor', 'Assigned', 'AdminAssigned'));

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_commission_percent_range;

ALTER TABLE sales
  ADD CONSTRAINT sales_commission_percent_range
  CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100));

CREATE INDEX IF NOT EXISTS sales_tutor_id_idx ON sales (tutor_id);
CREATE INDEX IF NOT EXISTS sales_assignment_status_idx ON sales (assignment_status);

CREATE TABLE IF NOT EXISTS sale_tutor_invites (
  id           SERIAL PRIMARY KEY,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  tutor_id     INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  emailed_at   TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sale_id, tutor_id)
);

CREATE INDEX IF NOT EXISTS sale_tutor_invites_sale_id_idx ON sale_tutor_invites (sale_id);
CREATE INDEX IF NOT EXISTS sale_tutor_invites_tutor_id_idx ON sale_tutor_invites (tutor_id);
CREATE INDEX IF NOT EXISTS sale_tutor_invites_token_idx ON sale_tutor_invites (token);
