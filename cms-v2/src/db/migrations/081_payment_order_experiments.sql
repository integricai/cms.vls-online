-- Which experiment page a checkout visitor was shown.
-- The results screen joins these rows to paid orders.

CREATE TABLE IF NOT EXISTS payment_order_experiments (
  payment_order_id  INTEGER NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  experiment_id     INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_label     TEXT NOT NULL,
  PRIMARY KEY (payment_order_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS payment_order_experiments_variant_idx
  ON payment_order_experiments (experiment_id, variant_label);
