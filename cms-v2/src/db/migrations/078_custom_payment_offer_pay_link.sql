-- The emailed custom-payment link is ours. Stripe is opened when the student clicks.
-- Only the token hash is stored.

ALTER TABLE custom_payment_offers ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS custom_payment_offers_token_hash_idx
  ON custom_payment_offers (token_hash)
  WHERE token_hash IS NOT NULL;
