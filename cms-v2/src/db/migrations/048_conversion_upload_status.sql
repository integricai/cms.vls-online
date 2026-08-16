-- Conversion Status: pending_upload | uploaded | extended_upload | failed
-- Also store the checkout phone so hash fallback can run without a customer join.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS student_phone TEXT;

ALTER TABLE payment_orders
  ALTER COLUMN conversion_upload_status SET DEFAULT 'pending_upload';

UPDATE payment_orders
SET conversion_upload_status = 'pending_upload'
WHERE conversion_upload_status IN ('pending', 'skipped');
