-- Retire session-based course prices and compare-at amounts.
-- Keep referenced session rows (payment_orders / sales FKs) as inactive history.

UPDATE course_geo_prices
SET compare_at_amount = NULL
WHERE compare_at_amount IS NOT NULL;

UPDATE course_geo_prices
SET is_active = false,
    is_default = false,
    updated_at = NOW()
WHERE pricing_mode = 'session'
  AND (is_active = true OR is_default = true);

DELETE FROM course_geo_prices p
WHERE p.pricing_mode = 'session'
  AND NOT EXISTS (
    SELECT 1 FROM payment_orders po WHERE po.course_price_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM sales s WHERE s.course_price_id = p.id
  );
