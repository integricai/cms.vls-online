-- Optional cover ribbon for a BPP book. Null hides the ribbon.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER;
