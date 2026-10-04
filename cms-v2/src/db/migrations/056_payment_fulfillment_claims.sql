-- Expiring email claims, separate from the sent timestamp, and a fulfillment
-- attempt time so reconciliation rotates through failures instead of always
-- retrying the oldest rows.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS confirmation_email_claim_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_email_claim_token TEXT,
  ADD COLUMN IF NOT EXISTS admin_email_claim_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_email_claim_token TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_attempted_at TIMESTAMPTZ;
