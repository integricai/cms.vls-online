CREATE TABLE IF NOT EXISTS book_discount_codes (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  insert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_date DATE,
  customer_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_discount_codes_book_id ON book_discount_codes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_discount_codes_issue_date ON book_discount_codes(issue_date);
