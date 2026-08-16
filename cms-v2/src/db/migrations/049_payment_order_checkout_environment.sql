-- Tag each checkout as staging or production. Existing rows are staging
-- because the public site has not gone live yet.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS checkout_environment TEXT NOT NULL DEFAULT 'staging';

UPDATE payment_orders
SET checkout_environment = 'staging'
WHERE checkout_environment IS NULL
   OR checkout_environment NOT IN ('staging', 'production');

ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_checkout_environment_check;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_checkout_environment_check
  CHECK (checkout_environment IN ('staging', 'production'));

CREATE INDEX IF NOT EXISTS payment_orders_checkout_environment_idx
  ON payment_orders (checkout_environment, status, paid_at);
