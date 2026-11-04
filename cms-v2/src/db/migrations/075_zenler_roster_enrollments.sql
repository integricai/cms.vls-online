-- Zenler enrolments from 1 Nov 2025. Duration and validity are set by an admin.

CREATE TABLE IF NOT EXISTS zenler_roster_enrollments (
  zenler_course_id  TEXT NOT NULL,
  zenler_user_id    TEXT NOT NULL,
  email             TEXT NOT NULL,
  first_name        TEXT,
  last_name         TEXT,
  course_name       TEXT,
  enrollment_date   TIMESTAMPTZ NOT NULL,
  duration_days     INTEGER,
  validity_date     TIMESTAMPTZ,
  removed_at        TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (zenler_course_id, zenler_user_id)
);

CREATE INDEX IF NOT EXISTS zenler_roster_enrollments_enrollment_date_idx
  ON zenler_roster_enrollments (enrollment_date DESC);
