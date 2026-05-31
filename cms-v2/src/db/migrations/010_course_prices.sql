CREATE TABLE IF NOT EXISTS course_prices (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  regular_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GBP',
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  final_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  source_url TEXT,
  raw_price_text TEXT,
  last_scraped_price NUMERIC(10,2),
  last_scraped_at TIMESTAMPTZ,
  last_scrape_status VARCHAR(32) NOT NULL DEFAULT 'manual',
  last_scrape_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_prices_course_id ON course_prices(course_id);
CREATE INDEX IF NOT EXISTS idx_course_prices_updated_at ON course_prices(updated_at DESC);
