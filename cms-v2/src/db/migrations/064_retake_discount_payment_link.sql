-- One-time payment link for a single-course discount.
-- The raw token is emailed once and only its hash is stored.

ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS full_amount NUMERIC(10, 2);
ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2);
ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS currency TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS retake_discount_codes_token_hash_idx
  ON retake_discount_codes (token_hash)
  WHERE token_hash IS NOT NULL;
