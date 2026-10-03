-- Multi-course combo: store which Zenler courses the student selected for access (pricing uses zenler_course_id on the order).

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS access_zenler_course_ids TEXT[] DEFAULT NULL;

COMMENT ON COLUMN payment_orders.access_zenler_course_ids IS
  'Zenler course IDs to enroll after payment (multi-course combo); pricing uses zenler_course_id on the order.';
