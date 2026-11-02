-- Paid customer payment forms with no course are sales too.
-- They have no course, no access length, and no expiry.

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

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_course_or_payment_order;

ALTER TABLE sales
  ADD CONSTRAINT sales_course_or_payment_order
  CHECK (
    (course_id IS NOT NULL AND duration_days IS NOT NULL AND expiry_date IS NOT NULL)
    OR (course_id IS NULL AND duration_days IS NULL AND expiry_date IS NULL)
  );

-- Record payment forms that were already paid and never became a sale.
INSERT INTO sales (
  customer_id,
  course_id,
  course_price_id,
  payment_order_id,
  amount,
  currency,
  discount_percent,
  duration_days,
  sold_at,
  expiry_date,
  country_code,
  assignment_status
)
SELECT
  COALESCE(po.customer_id, cu.id),
  NULL,
  NULL,
  po.id,
  po.amount,
  COALESCE(NULLIF(BTRIM(po.currency), ''), 'USD'),
  po.discount_percent,
  NULL,
  po.paid_at,
  NULL,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(po.country_code), ''), NULLIF(BTRIM(cu.country_code), '')) ~ '^[A-Za-z]{2}$'
      THEN UPPER(COALESCE(NULLIF(BTRIM(po.country_code), ''), NULLIF(BTRIM(cu.country_code), '')))
    ELSE NULL
  END,
  'AwaitingTutor'
FROM custom_payment_offers o
JOIN payment_orders po ON po.id = o.payment_order_id
LEFT JOIN customers cu ON LOWER(cu.email) = LOWER(o.student_email)
WHERE po.status = 'Paid'
  AND o.course_id IS NULL
  AND po.paid_at IS NOT NULL
  AND COALESCE(po.customer_id, cu.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales s WHERE s.payment_order_id = po.id
  );
