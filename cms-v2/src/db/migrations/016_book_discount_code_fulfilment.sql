ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE book_discount_codes
SET used = TRUE
WHERE used = FALSE
  AND (issue_date IS NOT NULL OR customer_email <> '');

CREATE INDEX IF NOT EXISTS idx_book_discount_codes_used_book_id
  ON book_discount_codes(book_id, used, insert_date ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_book_discount_codes_stripe_session_id
  ON book_discount_codes(stripe_session_id);
