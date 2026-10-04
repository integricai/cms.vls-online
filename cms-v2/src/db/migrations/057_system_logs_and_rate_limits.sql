-- Persisted CMS failures for the Settings > Logs page, plus shared rate-limit buckets.

CREATE TABLE IF NOT EXISTS cms_system_logs (
  id              BIGSERIAL   PRIMARY KEY,
  level           TEXT        NOT NULL DEFAULT 'error',
  area            TEXT        NOT NULL,
  explanation     TEXT        NOT NULL DEFAULT '',
  error_name      TEXT,
  error_message   TEXT,
  error_stack     TEXT,
  request_method  TEXT,
  request_url     TEXT,
  request_ip      TEXT,
  extra           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_system_logs_created_at_idx ON cms_system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS cms_system_logs_area_idx ON cms_system_logs (area);
CREATE INDEX IF NOT EXISTS cms_system_logs_level_idx ON cms_system_logs (level);

CREATE TABLE IF NOT EXISTS cms_rate_limits (
  bucket            TEXT        PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hit_count         INTEGER     NOT NULL DEFAULT 0
);
