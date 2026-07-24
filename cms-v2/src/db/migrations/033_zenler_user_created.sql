-- Track whether Zenler account was created during checkout enrollment.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS zenler_user_created BOOLEAN NOT NULL DEFAULT FALSE;
