-- Last-click attribution + Google Ads offline purchase upload state.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS gbraid TEXT,
  ADD COLUMN IF NOT EXISTS wbraid TEXT,
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS attr_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS attr_client_ip TEXT,
  ADD COLUMN IF NOT EXISTS attr_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversion_upload_status TEXT NOT NULL DEFAULT 'pending_upload',
  ADD COLUMN IF NOT EXISTS conversion_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversion_upload_error TEXT,
  ADD COLUMN IF NOT EXISTS conversion_upload_request_id TEXT;

CREATE INDEX IF NOT EXISTS payment_orders_conversion_upload_idx
  ON payment_orders (status, conversion_upload_status, paid_at);
