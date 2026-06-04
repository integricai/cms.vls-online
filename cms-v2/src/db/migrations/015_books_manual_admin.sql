ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_books_is_active_sort_order
  ON books(is_active, sort_order ASC, title ASC);
