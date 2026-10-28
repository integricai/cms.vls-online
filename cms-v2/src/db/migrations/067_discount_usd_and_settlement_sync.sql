-- Dollar amount locked when a discount link is emailed, and a marker so fee
-- sync does not keep re-reading a settlement it cannot express in dollars.

ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS usd_full_amount NUMERIC(10, 2);
ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS usd_final_amount NUMERIC(10, 2);

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS settlement_synced_at TIMESTAMPTZ;
