-- ── Zenler student sync progress (resume / stop) ────────────────────────────

CREATE TABLE IF NOT EXISTS student_sync_state (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'idle',
  last_completed_page  INTEGER NOT NULL DEFAULT 0,
  page_size            INTEGER NOT NULL DEFAULT 50,
  total_pages          INTEGER,
  fetched              INTEGER NOT NULL DEFAULT 0,
  created_count        INTEGER NOT NULL DEFAULT 0,
  updated_count        INTEGER NOT NULL DEFAULT 0,
  skipped              INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_sync_state_singleton CHECK (id = 1),
  CONSTRAINT student_sync_state_status_check
    CHECK (status IN ('idle', 'running', 'stopped', 'failed', 'completed'))
);

INSERT INTO student_sync_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
