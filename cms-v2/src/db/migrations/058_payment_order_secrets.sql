-- Encrypted school password for a pending checkout, cleared once the account exists.

CREATE TABLE IF NOT EXISTS payment_order_secrets (
  order_id INTEGER PRIMARY KEY,
  password_ciphertext TEXT,
  student_chose_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
