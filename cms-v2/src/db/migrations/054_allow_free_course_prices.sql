-- Free courses store a list price or discounted price of 0.

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_amount_positive;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_amount_positive
  CHECK (amount >= 0);

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_discounted_price_valid;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_discounted_price_valid
  CHECK (
    discounted_price IS NULL
    OR (discounted_price >= 0 AND discounted_price <= amount)
  );
