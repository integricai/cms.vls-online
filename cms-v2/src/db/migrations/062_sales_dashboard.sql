-- Stripe fee and the method the customer actually paid with.
-- Net is the amount after the processor fee.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS processor_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_method_label TEXT;

-- One row per person per London day. The key is a hash, not an IP address.
CREATE TABLE IF NOT EXISTS site_visitors (
  id           BIGSERIAL PRIMARY KEY,
  visited_on   DATE NOT NULL,
  visitor_key  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_visitors_day_key UNIQUE (visited_on, visitor_key)
);

CREATE INDEX IF NOT EXISTS site_visitors_visited_on_idx ON site_visitors (visited_on);

-- Enquiry-form leads. Zenler funnel leads are counted from the Zenler API.
CREATE TABLE IF NOT EXISTS site_leads (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  source      TEXT NOT NULL DEFAULT 'contact_form',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS site_leads_created_at_idx ON site_leads (created_at DESC);
