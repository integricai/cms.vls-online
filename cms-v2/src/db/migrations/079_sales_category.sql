-- Sales can be a course, notes, a BPP book, a custom payment, or a discount offer.
-- Books and custom charges are not course enrolments, so course and access length can be empty.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE sales
  ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE sales
  ALTER COLUMN duration_days DROP NOT NULL;

ALTER TABLE sales
  ALTER COLUMN expiry_date DROP NOT NULL;

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_duration_days_positive;

ALTER TABLE sales
  ADD CONSTRAINT sales_duration_days_positive
  CHECK (duration_days IS NULL OR duration_days > 0);

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_expiry_after_sold;

ALTER TABLE sales
  ADD CONSTRAINT sales_expiry_after_sold
  CHECK (expiry_date IS NULL OR expiry_date > sold_at);

UPDATE sales AS s
SET category = labelled.category
FROM (
  SELECT
    sale.id,
    CASE
      WHEN po.option_type = 'BPP Book' THEN 'BPP Book'
      WHEN po.option_type = 'Custom payment' THEN 'Payment Order'
      WHEN po.option_type = 'Custom / Resit offer' THEN 'Discount Order'
      WHEN COALESCE(c.name, '') ILIKE '%notes%'
        OR COALESCE(c.course_page_url, '') ILIKE '%notes%'
        OR COALESCE(c.slug, '') ILIKE '%notes%'
        THEN 'Notes'
      ELSE 'Course'
    END AS category
  FROM sales AS sale
  JOIN payment_orders AS po ON po.id = sale.payment_order_id
  LEFT JOIN courses AS c ON c.id = sale.course_id
) AS labelled
WHERE s.id = labelled.id
  AND s.category IS NULL;

UPDATE sales
SET category = 'Course'
WHERE category IS NULL;

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_category_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_category_check
  CHECK (category IN ('Course', 'Notes', 'BPP Book', 'Payment Order', 'Discount Order'));

ALTER TABLE sales
  ALTER COLUMN category SET DEFAULT 'Course';

ALTER TABLE sales
  ALTER COLUMN category SET NOT NULL;

CREATE INDEX IF NOT EXISTS sales_category_idx ON sales (category);
