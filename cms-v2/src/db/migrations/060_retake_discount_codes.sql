-- One-time retake codes issued to a named student for one course.

CREATE TABLE IF NOT EXISTS retake_discount_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  student_email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  cc_email TEXT,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(10, 2) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  payment_order_id INTEGER REFERENCES payment_orders(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retake_discount_codes_type_check CHECK (discount_type IN ('percent', 'fixed')),
  CONSTRAINT retake_discount_codes_value_check CHECK (discount_value > 0)
);

CREATE INDEX IF NOT EXISTS retake_discount_codes_email_idx
  ON retake_discount_codes (student_email);

CREATE INDEX IF NOT EXISTS retake_discount_codes_course_idx
  ON retake_discount_codes (course_id);
