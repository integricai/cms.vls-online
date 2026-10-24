-- Keep the customer's country on the sale itself, captured at purchase time.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

-- Prefer the country recorded on that checkout. Fall back to the customer record.
UPDATE sales AS s
SET country_code = UPPER(src.country_code)
FROM (
  SELECT
    sale.id,
    COALESCE(NULLIF(BTRIM(po.country_code), ''), NULLIF(BTRIM(cu.country_code), '')) AS country_code
  FROM sales AS sale
  LEFT JOIN payment_orders AS po ON po.id = sale.payment_order_id
  LEFT JOIN customers AS cu ON cu.id = sale.customer_id
) AS src
WHERE s.id = src.id
  AND s.country_code IS NULL
  AND src.country_code ~ '^[A-Za-z]{2}$';

CREATE INDEX IF NOT EXISTS sales_country_code_idx ON sales (country_code);
