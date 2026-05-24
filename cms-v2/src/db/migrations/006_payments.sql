-- ── Courses (synced from Zenler) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id                SERIAL      PRIMARY KEY,
  zenler_course_id  TEXT        NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  slug              TEXT,
  category          TEXT,
  level             TEXT,
  status            TEXT,
  zenler_url        TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_zenler_course_id_idx ON courses (zenler_course_id);
CREATE INDEX IF NOT EXISTS courses_is_active_idx ON courses (is_active);

-- ── Course Payment Cards ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_payment_cards (
  id               SERIAL        PRIMARY KEY,
  course_id        INTEGER       NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  title            TEXT          NOT NULL,
  description      TEXT          NOT NULL DEFAULT '',
  normal_price     NUMERIC(10,2) NOT NULL,
  discount_price   NUMERIC(10,2),
  currency         TEXT          NOT NULL DEFAULT 'GBP',
  cta_button_text  TEXT          NOT NULL DEFAULT 'Enrol Now',
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS course_payment_cards_course_id_idx ON course_payment_cards (course_id);

-- ── Payment Transactions (schema only — Stripe logic not yet implemented) ─────

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                       SERIAL        PRIMARY KEY,
  course_payment_card_id   INTEGER       NOT NULL REFERENCES course_payment_cards(id) ON DELETE RESTRICT,
  course_id                INTEGER       NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  customer_email           TEXT          NOT NULL,
  amount_charged           NUMERIC(10,2) NOT NULL,
  currency                 TEXT          NOT NULL DEFAULT 'GBP',
  payment_status           TEXT          NOT NULL DEFAULT 'pending',
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paid_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_transactions_card_id_idx   ON payment_transactions (course_payment_card_id);
CREATE INDEX IF NOT EXISTS payment_transactions_course_id_idx ON payment_transactions (course_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx    ON payment_transactions (payment_status);
