-- ── Trusted course payment options and Stripe orders ────────────────────────

ALTER TABLE course_payment_cards
  ADD COLUMN IF NOT EXISTS option_type TEXT,
  ADD COLUMN IF NOT EXISTS is_discount_active BOOLEAN NOT NULL DEFAULT false;

UPDATE course_payment_cards
SET is_discount_active = true
WHERE discount_price IS NOT NULL
  AND discount_price > 0
  AND is_discount_active = false;

CREATE INDEX IF NOT EXISTS course_payment_cards_active_idx ON course_payment_cards (is_active);

CREATE TABLE IF NOT EXISTS payment_orders (
  id                         SERIAL        PRIMARY KEY,
  payment_option_id          INTEGER       NOT NULL REFERENCES course_payment_cards(id) ON DELETE RESTRICT,
  zenler_course_id           TEXT          NOT NULL,
  course_title               TEXT          NOT NULL,
  option_type                TEXT,
  student_name               TEXT,
  student_email              TEXT,
  amount                     NUMERIC(10,2) NOT NULL,
  currency                   TEXT          NOT NULL DEFAULT 'GBP',
  status                     TEXT          NOT NULL DEFAULT 'Pending',
  stripe_checkout_session_id TEXT          UNIQUE,
  stripe_payment_intent_id   TEXT,
  stripe_customer_email      TEXT,
  confirmation_email_sent_at TIMESTAMPTZ,
  admin_email_sent_at        TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paid_at                    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_orders_payment_option_id_idx ON payment_orders (payment_option_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders (status);
CREATE INDEX IF NOT EXISTS payment_orders_session_id_idx ON payment_orders (stripe_checkout_session_id);
