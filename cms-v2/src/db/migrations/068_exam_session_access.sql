-- Exam sittings. 067 is already the discount and settlement migration.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS session_year SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_month SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_year SMALLINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_checked_at TIMESTAMPTZ;

-- Plan names such as "December 2026 session" already name the sitting.
UPDATE payment_orders AS po
SET
  session_month = names.month_number,
  session_year = (regexp_match(po.option_type, '([A-Za-z]+)[[:space:]]+([0-9]{4})'))[2]::int
FROM (
  VALUES
    ('january', 1), ('jan', 1),
    ('february', 2), ('feb', 2),
    ('march', 3), ('mar', 3),
    ('april', 4), ('apr', 4),
    ('may', 5),
    ('june', 6), ('jun', 6),
    ('july', 7), ('jul', 7),
    ('august', 8), ('aug', 8),
    ('september', 9), ('sept', 9), ('sep', 9),
    ('october', 10), ('oct', 10),
    ('november', 11), ('nov', 11),
    ('december', 12), ('dec', 12)
) AS names(month_name, month_number)
WHERE po.session_month IS NULL
  AND lower((regexp_match(po.option_type, '([A-Za-z]+)[[:space:]]+([0-9]{4})'))[1]) = names.month_name
  AND (regexp_match(po.option_type, '([A-Za-z]+)[[:space:]]+([0-9]{4})'))[2]::int BETWEEN 2000 AND 2100;

-- Access ends at the end of the 15th, London time. The counted days replace the catalogue length on the sale only.
UPDATE sales AS s
SET
  session_month = po.session_month,
  session_year = po.session_year,
  expiry_date = make_timestamptz(po.session_year, po.session_month, 16, 0, 0, 0, 'Europe/London') - interval '1 millisecond',
  duration_days = GREATEST(
    1,
    (make_timestamptz(po.session_year, po.session_month, 15, 0, 0, 0, 'Europe/London') AT TIME ZONE 'Europe/London')::date
      - (s.sold_at AT TIME ZONE 'Europe/London')::date
  ),
  session_checked_at = NOW()
FROM payment_orders AS po
WHERE po.id = s.payment_order_id
  AND s.session_month IS NULL
  AND po.session_month BETWEEN 1 AND 12
  AND po.session_year BETWEEN 2000 AND 2100
  AND make_timestamptz(po.session_year, po.session_month, 16, 0, 0, 0, 'Europe/London') - interval '1 millisecond' > s.sold_at;

-- A single plan is never a sitting, so those sales do not need the hourly check.
UPDATE sales AS s
SET session_checked_at = NOW()
WHERE s.session_checked_at IS NULL
  AND s.session_month IS NULL
  AND (
    SELECT COUNT(*)
    FROM course_geo_prices p
    WHERE p.course_id = s.course_id
      AND p.is_active = TRUE
      AND p.pricing_mode = 'duration'
  ) < 2;
