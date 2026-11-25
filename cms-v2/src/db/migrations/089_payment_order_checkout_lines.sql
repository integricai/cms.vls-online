-- Course price and add-on prices charged on one checkout, so the sales list can split the amount paid.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS checkout_lines JSONB;
