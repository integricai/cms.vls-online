-- Follow-up emails for website checkouts that were started but not paid.
-- One row per email and course. The cron sends up to three emails after the
-- checkout closes and sets each followup_N_sent_at as it goes.
-- Sending stops for good once stopped_at is set: the customer bought the course,
-- unsubscribed, or the address bounced or complained.

CREATE TABLE IF NOT EXISTS checkout_followups (
  id                  SERIAL PRIMARY KEY,
  email               TEXT NOT NULL,
  course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  last_order_id       INTEGER REFERENCES payment_orders(id) ON DELETE SET NULL,
  abandoned_at        TIMESTAMPTZ NOT NULL,
  followup_1_sent_at  TIMESTAMPTZ,
  followup_2_sent_at  TIMESTAMPTZ,
  followup_3_sent_at  TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  stop_reason         TEXT,
  purchased_order_id  INTEGER REFERENCES payment_orders(id) ON DELETE SET NULL,
  unsubscribe_token   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_followups_email_course_unique UNIQUE (email, course_id),
  CONSTRAINT checkout_followups_token_unique UNIQUE (unsubscribe_token),
  CONSTRAINT checkout_followups_email_lower_check CHECK (email = lower(email)),
  CONSTRAINT checkout_followups_stop_reason_check
    CHECK (stop_reason IS NULL OR stop_reason IN ('purchased', 'unsubscribed', 'bounced', 'complained', 'manual')),
  CONSTRAINT checkout_followups_stop_pair_check
    CHECK ((stopped_at IS NULL) = (stop_reason IS NULL))
);

-- The cron only looks at rows that are still active.
CREATE INDEX IF NOT EXISTS checkout_followups_active_idx
  ON checkout_followups (abandoned_at)
  WHERE stopped_at IS NULL;

-- Unsubscribe and purchase checks look rows up by email.
CREATE INDEX IF NOT EXISTS checkout_followups_email_idx
  ON checkout_followups (email);
