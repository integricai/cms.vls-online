-- Drop card-country / regional PPP verification columns (EvenDeals handles VPN).
-- Keeps stripe_refund_id and refunded_at for general payment history.

ALTER TABLE payment_orders
  DROP COLUMN IF EXISTS quoted_pricing_region,
  DROP COLUMN IF EXISTS payment_method_country,
  DROP COLUMN IF EXISTS regional_pricing_applied;
