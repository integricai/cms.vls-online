-- ── Regional pricing verification on payment orders ─────────────────────────

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS quoted_pricing_region TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS regional_pricing_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payment_orders_refunded_at_idx ON payment_orders (refunded_at)
  WHERE refunded_at IS NOT NULL;
