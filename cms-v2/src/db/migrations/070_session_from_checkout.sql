-- Sittings written by checkout. Rows an older copy of 068 already shortened stay false,
-- so the expiry job leaves them until SESSION_BACKFILL_APPLY=true.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_from_checkout BOOLEAN NOT NULL DEFAULT false;
