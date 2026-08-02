-- ── Students: extend customers + per-course exam status ─────────────────────
-- Zenler sync is a one-time pre-launch backfill. After go-live, customers are
-- upserted on each CMS/Stripe enrollment.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS newsletter_subscribed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS newsletter_subscribed_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS mailerlite_subscriber_id TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_zenler_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS customers_newsletter_subscribed_idx
  ON customers (newsletter_subscribed);

CREATE INDEX IF NOT EXISTS customers_source_idx ON customers (source);

CREATE INDEX IF NOT EXISTS customers_zenler_user_id_idx
  ON customers (zenler_user_id);

CREATE TABLE IF NOT EXISTS customer_course_status (
  id                     SERIAL PRIMARY KEY,
  customer_id            INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  course_id              INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exam_status            TEXT NOT NULL DEFAULT 'unknown',
  exam_status_updated_at TIMESTAMPTZ,
  exam_status_source     TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_course_status_exam_status_check
    CHECK (exam_status IN ('unknown', 'awaiting_result', 'passed', 'failed')),
  CONSTRAINT customer_course_status_exam_source_check
    CHECK (
      exam_status_source IS NULL
      OR exam_status_source IN ('manual', 'student_link')
    ),
  CONSTRAINT customer_course_status_customer_course_unique
    UNIQUE (customer_id, course_id)
);

CREATE INDEX IF NOT EXISTS customer_course_status_customer_id_idx
  ON customer_course_status (customer_id);

CREATE INDEX IF NOT EXISTS customer_course_status_course_id_idx
  ON customer_course_status (course_id);

CREATE INDEX IF NOT EXISTS customer_course_status_exam_status_idx
  ON customer_course_status (exam_status);
