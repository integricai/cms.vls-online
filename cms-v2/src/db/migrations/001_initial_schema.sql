CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE IF NOT EXISTS users (
  id                     SERIAL PRIMARY KEY,
  email                  TEXT        NOT NULL UNIQUE,
  password_hash          TEXT        NOT NULL,
  role                   user_role   NOT NULL DEFAULT 'viewer',
  reset_token            TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_reset_token_idx ON users (reset_token)
  WHERE reset_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS login_audit (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  email      TEXT        NOT NULL,
  success    BOOLEAN     NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_audit_user_id_idx ON login_audit (user_id);

CREATE INDEX IF NOT EXISTS login_audit_created_at_idx ON login_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS cms_content (
  key        TEXT        PRIMARY KEY,
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_by INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS snippets (
  id         SERIAL      PRIMARY KEY,
  key        TEXT        NOT NULL UNIQUE,
  title      TEXT        NOT NULL,
  html       TEXT        NOT NULL DEFAULT '',
  meta       JSONB       NOT NULL DEFAULT '{}',
  created_by INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cms_content (key) VALUES
  ('vls-header-config'),
  ('vls-footer'),
  ('vls-home-hero'),
  ('vls-faq'),
  ('vls-events'),
  ('vls-programs'),
  ('vls-team'),
  ('vls-banners'),
  ('vls-about-us'),
  ('vls-article-groups'),
  ('vls-form-config'),
  ('vls-feature-cards'),
  ('vls-feature-cards-2'),
  ('vls-feature-cards-3'),
  ('vls-left-generic-section'),
  ('vls-right-pane-section'),
  ('vls-steps-sections'),
  ('vls-promotion-sections'),
  ('vls-program-cards-v2'),
  ('vls-report-config'),
  ('vls-report-ty-config'),
  ('vls-cf-components'),
  ('vls-course-desc-components'),
  ('vls-course-hero-components'),
  ('vls-course-hero-right-components'),
  ('vls-course-tabs-components'),
  ('vls-dcs-components'),
  ('vls-dcs2-components'),
  ('vls-dcs3-components'),
  ('vls-desc-components'),
  ('vls-hero2-components'),
  ('vls-intro-components'),
  ('vls-page-hero-banner-components'),
  ('vls-page-hero-v2-components'),
  ('vls-page-left-hero-components'),
  ('vls-policy-components'),
  ('vls-reach-components'),
  ('vls-tabs-components')
ON CONFLICT (key) DO NOTHING;
