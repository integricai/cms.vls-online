-- Office copy of each discount-code email.

ALTER TABLE retake_discount_codes
  ADD COLUMN IF NOT EXISTS cc_email TEXT;
