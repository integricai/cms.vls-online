-- Health check for every URL in the live sitemap.
-- One row per URL. The cron overwrites the row on every check, so the table
-- only grows when the sitemap grows.
--
-- A check is up to three pings. The first is the scheduled hourly ping. A 404,
-- 410, 5xx or no response is pinged again after 1 minute and again a minute
-- later. ping_1..ping_3 hold the latest check's pings and are cleared when the
-- next check starts. If all three fail, the row becomes 'broken', and
-- first_broken_at keeps the time of the first failed ping until the URL
-- recovers. alerted_at is set once the alert email for this breakage has gone
-- out, so one breakage sends one email.

CREATE TABLE IF NOT EXISTS url_health_checks (
  url                      TEXT PRIMARY KEY,
  status                   TEXT NOT NULL DEFAULT 'pending',
  last_checked_at          TIMESTAMPTZ,
  last_status_code         INTEGER,
  last_error               TEXT,
  ping_1_at                TIMESTAMPTZ,
  ping_1_code              INTEGER,
  ping_2_at                TIMESTAMPTZ,
  ping_2_code              INTEGER,
  ping_3_at                TIMESTAMPTZ,
  ping_3_code              INTEGER,
  first_broken_at          TIMESTAMPTZ,
  alerted_at               TIMESTAMPTZ,
  next_check_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_in_sitemap_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT url_health_checks_status_check
    CHECK (status IN ('pending', 'ok', 'retrying', 'broken', 'warning'))
);

CREATE INDEX IF NOT EXISTS url_health_checks_due_idx
  ON url_health_checks (next_check_at);

-- Single row: when the URL list was last read from the sitemap.
CREATE TABLE IF NOT EXISTS url_health_state (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  sitemap_synced_at  TIMESTAMPTZ,
  sitemap_url_count  INTEGER NOT NULL DEFAULT 0,
  last_run_at        TIMESTAMPTZ,
  last_error         TEXT,
  CONSTRAINT url_health_state_single_row CHECK (id = 1)
);
