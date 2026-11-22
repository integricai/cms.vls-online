-- Zenler courses added on checkout C. Enrolment reads this as well as the primary course.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS upsell_zenler_course_ids TEXT[];
