-- ── USD-only course pricing + discount columns ──────────────────────────────
-- Removes geo columns (ParityDeals handles regional pricing).
-- Adds discount_percent + discounted_price (computed final USD price).

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS discounted_price NUMERIC(12,2);

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_discount_percent_range;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_discount_percent_range
  CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_discounted_price_valid;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_discounted_price_valid
  CHECK (
    discounted_price IS NULL
    OR (discounted_price > 0 AND discounted_price <= amount)
  );

-- Consolidate duplicate geo rows before dropping location key (keep highest priority).
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY course_id, LOWER(name), duration_months
      ORDER BY priority DESC, id ASC
    ) AS keep_id
  FROM course_geo_prices
)
UPDATE payment_orders po
SET course_price_id = r.keep_id
FROM ranked r
WHERE po.course_price_id = r.id
  AND r.id <> r.keep_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY course_id, LOWER(name), duration_months
      ORDER BY priority DESC, id ASC
    ) AS rn
  FROM course_geo_prices
)
DELETE FROM course_geo_prices
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE course_geo_prices SET currency = 'USD';

DROP INDEX IF EXISTS course_geo_prices_country_idx;

ALTER TABLE course_geo_prices
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS geo_group;

DROP INDEX IF EXISTS course_geo_prices_upsert_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_upsert_key_idx
  ON course_geo_prices (course_id, LOWER(name), duration_months);

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_currency_usd;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_currency_usd CHECK (UPPER(currency) = 'USD');
