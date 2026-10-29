-- Sitting chosen at checkout. Access runs until the 15th of that month.

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_year SMALLINT;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_year SMALLINT;
