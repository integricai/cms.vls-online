CREATE TABLE IF NOT EXISTS content_migration_pages (
  id                      SERIAL       PRIMARY KEY,
  origin_url              TEXT         NOT NULL UNIQUE,
  zenler_url              TEXT         NOT NULL,
  title                   TEXT,
  path                    TEXT         NOT NULL,
  template                TEXT         NOT NULL DEFAULT 'landing',
  suggested_destination   TEXT         NOT NULL,
  destination_slug        TEXT         NOT NULL,
  migrated_at             TIMESTAMPTZ,
  storyblok_story_id      BIGINT,
  scanned_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_migration_pages_template
  ON content_migration_pages (template);

CREATE INDEX IF NOT EXISTS idx_content_migration_pages_path
  ON content_migration_pages (path);
