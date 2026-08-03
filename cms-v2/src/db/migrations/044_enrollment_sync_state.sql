-- ── Zenler enrollment backfill progress (per course page) ───────────────────

CREATE TABLE IF NOT EXISTS enrollment_sync_state (
  id                      INTEGER PRIMARY KEY DEFAULT 1,
  status                  TEXT NOT NULL DEFAULT 'idle',
  course_index            INTEGER NOT NULL DEFAULT 0,
  course_id               INTEGER,
  last_completed_page     INTEGER NOT NULL DEFAULT 0,
  page_size               INTEGER NOT NULL DEFAULT 100,
  total_courses           INTEGER,
  total_pages_in_course   INTEGER,
  fetched                 INTEGER NOT NULL DEFAULT 0,
  linked                  INTEGER NOT NULL DEFAULT 0,
  created_customers       INTEGER NOT NULL DEFAULT 0,
  skipped                 INTEGER NOT NULL DEFAULT 0,
  last_error              TEXT,
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT enrollment_sync_state_singleton CHECK (id = 1),
  CONSTRAINT enrollment_sync_state_status_check
    CHECK (status IN ('idle', 'running', 'stopped', 'failed', 'completed'))
);

INSERT INTO enrollment_sync_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
