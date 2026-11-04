-- Manual unenrol of one Zenler course on a paid order.
-- A combo order can close one paper and keep the rest open.

CREATE TABLE IF NOT EXISTS course_access_closures (
  payment_order_id  INTEGER NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  zenler_course_id  TEXT NOT NULL,
  closed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payment_order_id, zenler_course_id)
);
