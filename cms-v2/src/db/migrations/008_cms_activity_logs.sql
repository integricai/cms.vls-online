-- ── CMS activity logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cms_activity_logs (
  id             BIGSERIAL   PRIMARY KEY,
  user_id        INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  user_email     TEXT,
  username       TEXT,
  user_role      TEXT,
  action         TEXT        NOT NULL,
  component_key  TEXT        NOT NULL,
  component_name TEXT,
  summary        TEXT        NOT NULL DEFAULT '',
  changed_paths  JSONB       NOT NULL DEFAULT '[]',
  before_json    JSONB,
  after_json     JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_activity_logs_user_id_idx ON cms_activity_logs (user_id);
CREATE INDEX IF NOT EXISTS cms_activity_logs_component_key_idx ON cms_activity_logs (component_key);
CREATE INDEX IF NOT EXISTS cms_activity_logs_created_at_idx ON cms_activity_logs (created_at DESC);
