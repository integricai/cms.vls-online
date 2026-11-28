-- One browsing session and the pages opened in order.
-- session_key is a hash of the browser session id. Paths have no query string.
-- IP addresses, click ids, and browser strings are not stored.

CREATE TABLE IF NOT EXISTS site_tracking_sessions (
  id            BIGSERIAL PRIMARY KEY,
  session_key   TEXT NOT NULL,
  visitor_key   TEXT NOT NULL,
  started_on    DATE NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  CONSTRAINT site_tracking_sessions_key UNIQUE (session_key),
  CONSTRAINT site_tracking_sessions_channel_check CHECK (
    channel IN ('Google Ads', 'Meta', 'Other campaign', 'Organic search', 'Referral', 'Direct')
  ),
  CONSTRAINT site_tracking_sessions_device_check CHECK (device IN ('mobile', 'tablet', 'desktop')),
  CONSTRAINT site_tracking_sessions_locale_check CHECK (locale IN ('en', 'ar'))
);

CREATE INDEX IF NOT EXISTS site_tracking_sessions_started_on_idx
  ON site_tracking_sessions (started_on, started_at DESC);

CREATE TABLE IF NOT EXISTS site_tracking_pageviews (
  id          BIGSERIAL PRIMARY KEY,
  session_id  BIGINT NOT NULL REFERENCES site_tracking_sessions (id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_tracking_pageviews_position_unique UNIQUE (session_id, position),
  CONSTRAINT site_tracking_pageviews_position_check CHECK (position >= 1)
);

CREATE INDEX IF NOT EXISTS site_tracking_pageviews_session_idx
  ON site_tracking_pageviews (session_id, position);
