-- Currency of processor_fee and net_amount. Stripe's balance is often USD
-- even when the student paid in another currency.

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS settlement_currency TEXT;
