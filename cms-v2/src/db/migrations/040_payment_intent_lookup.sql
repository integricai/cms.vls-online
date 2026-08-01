-- Speed up Stripe refund webhook lookups by payment intent ID.
CREATE INDEX IF NOT EXISTS payment_orders_payment_intent_id_idx
  ON payment_orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
