-- First-party visit detail for the Vault Tracking page.
-- Separate from site_visitors, which stays a daily headcount for Sales.
-- The key is a hash. Click ids, IP addresses, and browser strings are not stored.

CREATE TABLE IF NOT EXISTS site_tracking_visits (
  id            BIGSERIAL PRIMARY KEY,
  visited_on    DATE NOT NULL,
  visitor_key   TEXT NOT NULL,
  channel       TEXT NOT NULL,
  source        TEXT,
  medium        TEXT,
  campaign      TEXT,
  content       TEXT,
  term          TEXT,
  landing_path  TEXT NOT NULL,
  country       TEXT,
  device        TEXT NOT NULL,
  locale        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_tracking_visits_day_key UNIQUE (visited_on, visitor_key),
  CONSTRAINT site_tracking_visits_channel_check CHECK (
    channel IN ('Google Ads', 'Meta', 'Other campaign', 'Organic search', 'Referral', 'Direct')
  ),
  CONSTRAINT site_tracking_visits_device_check CHECK (device IN ('mobile', 'tablet', 'desktop')),
  CONSTRAINT site_tracking_visits_locale_check CHECK (locale IN ('en', 'ar'))
);

CREATE INDEX IF NOT EXISTS site_tracking_visits_visited_on_idx
  ON site_tracking_visits (visited_on);
