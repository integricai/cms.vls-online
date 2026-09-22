-- Queued Storyblok slug changes and Cloudflare redirects for CMS course URLs.

CREATE TABLE IF NOT EXISTS course_url_changes (
  id                  SERIAL PRIMARY KEY,
  course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  from_path           TEXT NOT NULL,
  to_path             TEXT NOT NULL,
  storyblok_story_id  BIGINT,
  status              TEXT NOT NULL DEFAULT 'queued',
  error               TEXT,
  links_updated       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at        TIMESTAMPTZ,
  CONSTRAINT course_url_changes_status_check CHECK (
    status IN ('queued', 'rewriting', 'ready', 'published', 'failed', 'superseded')
  )
);

CREATE INDEX IF NOT EXISTS course_url_changes_status_idx
  ON course_url_changes (status, id);

CREATE UNIQUE INDEX IF NOT EXISTS course_url_changes_open_pair_idx
  ON course_url_changes (course_id, from_path, to_path)
  WHERE status IN ('queued', 'rewriting', 'ready', 'failed');

CREATE TABLE IF NOT EXISTS course_url_rewrite_state (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  page        INTEGER NOT NULL DEFAULT 1,
  active      BOOLEAN NOT NULL DEFAULT FALSE,
  last_error  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO course_url_rewrite_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
