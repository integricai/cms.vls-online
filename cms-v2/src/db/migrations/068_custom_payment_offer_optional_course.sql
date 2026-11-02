-- Custom payment offers may describe a charge instead of selecting a course.
-- Those orders have no course and no access duration.

ALTER TABLE custom_payment_offers
  ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE custom_payment_offers
  ALTER COLUMN duration_days DROP NOT NULL;

ALTER TABLE custom_payment_offers
  DROP CONSTRAINT IF EXISTS custom_payment_offers_duration_positive;

ALTER TABLE custom_payment_offers
  ADD CONSTRAINT custom_payment_offers_duration_positive
  CHECK (duration_days IS NULL OR duration_days > 0);
