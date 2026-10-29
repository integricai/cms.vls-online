-- Exam sittings. 067 is already the discount and settlement migration.
-- Columns only. Named sittings are shortened later, after SESSION_BACKFILL_APPLY=true.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_year SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_year SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_checked_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_check_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_unenroll_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_access_hold_until TIMESTAMPTZ;
