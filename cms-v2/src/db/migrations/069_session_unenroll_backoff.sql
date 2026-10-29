-- Next time a failed Zenler unenroll may be tried. 068 may already have been applied.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_unenroll_after TIMESTAMPTZ;
