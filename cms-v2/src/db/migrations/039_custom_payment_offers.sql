-- ── Admin-created custom / resit payment offers ─────────────────────────────

CREATE TABLE IF NOT EXISTS custom_payment_offers (
  id                         SERIAL PRIMARY KEY,
  payment_order_id           INTEGER NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
  course_id                  INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  created_by_user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  student_first_name         TEXT NOT NULL,
  student_last_name          TEXT NOT NULL,
  student_email              TEXT NOT NULL,
  amount                     NUMERIC(12,2) NOT NULL,
  currency                   VARCHAR(8) NOT NULL DEFAULT 'USD',
  duration_days              INTEGER NOT NULL,
  discount_reason            TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  checkout_url               TEXT,
  email_sent_at              TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_payment_offers_amount_positive CHECK (amount > 0),
  CONSTRAINT custom_payment_offers_duration_positive CHECK (duration_days > 0)
);

CREATE INDEX IF NOT EXISTS custom_payment_offers_created_at_idx
  ON custom_payment_offers (created_at DESC);

CREATE INDEX IF NOT EXISTS custom_payment_offers_student_email_idx
  ON custom_payment_offers (LOWER(student_email));

CREATE INDEX IF NOT EXISTS custom_payment_offers_course_id_idx
  ON custom_payment_offers (course_id);
