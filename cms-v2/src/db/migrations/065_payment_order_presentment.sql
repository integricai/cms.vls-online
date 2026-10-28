-- Local price the student saw at checkout. amount and currency stay the dollar charge.

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS presentment_amount NUMERIC(10, 2);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS presentment_currency TEXT;
