-- Optional secondary line under the price title (session sitting or price name).

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS price_subtitle TEXT;

UPDATE course_geo_prices
SET price_subtitle = 'Complete course with tutor support'
WHERE price_subtitle IS NULL;
