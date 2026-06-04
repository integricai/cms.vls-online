CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt_text TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discounted_price NUMERIC(10,2),
  currency VARCHAR(8) NOT NULL DEFAULT 'GBP',
  stripe_url TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT 'https://vls-online.com/bppbooks',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(title, stripe_url)
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC);
