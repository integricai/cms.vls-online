-- ── Geo / multi-location course prices ──────────────────────────────────────
-- Extends the existing `courses` table (do not recreate).
-- Kept separate from legacy `course_prices` (1:1 scrape/display pricing).

CREATE TABLE IF NOT EXISTS course_geo_prices (
  id                SERIAL         PRIMARY KEY,
  course_id         INTEGER        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name              TEXT           NOT NULL,
  currency          VARCHAR(8)     NOT NULL,
  amount            NUMERIC(12,2)  NOT NULL,
  compare_at_amount NUMERIC(12,2),
  country_code      VARCHAR(2),
  region            TEXT,
  geo_group         TEXT,
  is_default        BOOLEAN        NOT NULL DEFAULT false,
  is_active         BOOLEAN        NOT NULL DEFAULT true,
  stripe_price_id   TEXT,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  priority          INTEGER        NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT course_geo_prices_amount_positive CHECK (amount > 0),
  CONSTRAINT course_geo_prices_compare_at_valid CHECK (
    compare_at_amount IS NULL OR compare_at_amount >= amount
  ),
  CONSTRAINT course_geo_prices_valid_range CHECK (
    valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from
  )
);

-- Table may already exist from a later schema (e.g. country_code removed in 021).
-- Ensure legacy geo columns exist before indexes that reference them.
ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS compare_at_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS geo_group TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_upsert_key_idx
  ON course_geo_prices (
    course_id,
    (COALESCE(country_code, '')),
    currency,
    name
  );

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_one_active_default_idx
  ON course_geo_prices (course_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX IF NOT EXISTS course_geo_prices_course_id_idx ON course_geo_prices (course_id);
CREATE INDEX IF NOT EXISTS course_geo_prices_country_idx ON course_geo_prices (course_id, country_code)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS course_geo_prices_active_idx ON course_geo_prices (is_active);

-- ── Extend payment_orders for geo-priced checkout ───────────────────────────

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS course_price_id INTEGER REFERENCES course_geo_prices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS zenler_user_id TEXT,
  ADD COLUMN IF NOT EXISTS zenler_enrollment_status TEXT;

-- Allow geo-price checkout without a payment card option
ALTER TABLE payment_orders
  ALTER COLUMN payment_option_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS payment_orders_course_id_idx ON payment_orders (course_id);
CREATE INDEX IF NOT EXISTS payment_orders_course_price_id_idx ON payment_orders (course_price_id);
