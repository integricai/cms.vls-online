-- ── Customers & sales (normalized purchase records) ─────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                  SERIAL PRIMARY KEY,
  email               TEXT NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  country_code        VARCHAR(2),
  zenler_user_id      TEXT,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_lower_idx
  ON customers (LOWER(email));

CREATE INDEX IF NOT EXISTS customers_country_code_idx ON customers (country_code);

CREATE TABLE IF NOT EXISTS sales (
  id                SERIAL PRIMARY KEY,
  customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  course_id         INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  course_price_id   INTEGER REFERENCES course_geo_prices(id) ON DELETE RESTRICT,
  payment_order_id  INTEGER NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(8) NOT NULL DEFAULT 'USD',
  discount_percent  NUMERIC(5,2),
  duration_days     INTEGER NOT NULL,
  sold_at           TIMESTAMPTZ NOT NULL,
  expiry_date       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_duration_days_positive CHECK (duration_days > 0),
  CONSTRAINT sales_expiry_after_sold CHECK (expiry_date > sold_at)
);

CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON sales (customer_id);
CREATE INDEX IF NOT EXISTS sales_course_id_idx ON sales (course_id);
CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON sales (sold_at DESC);
CREATE INDEX IF NOT EXISTS sales_expiry_date_idx ON sales (expiry_date);

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS payment_orders_customer_id_idx ON payment_orders (customer_id);
