-- ── Course geo price duration ───────────────────────────────────────────────

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 6;

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_duration_months_range;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_duration_months_range
  CHECK (duration_months >= 1 AND duration_months <= 6);

DROP INDEX IF EXISTS course_geo_prices_upsert_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_upsert_key_idx
  ON course_geo_prices (
    course_id,
    (COALESCE(country_code, '')),
    currency,
    name,
    duration_months
  );

-- ── Tutors ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tutors (
  id          SERIAL       PRIMARY KEY,
  name        TEXT         NOT NULL,
  email       TEXT,
  role        TEXT,
  bio         TEXT,
  photo_url   TEXT,
  initials    TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tutors_is_active_idx ON tutors (is_active);
CREATE INDEX IF NOT EXISTS tutors_name_idx ON tutors (name);

CREATE TABLE IF NOT EXISTS tutor_courses (
  tutor_id    INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tutor_id, course_id)
);

CREATE INDEX IF NOT EXISTS tutor_courses_course_id_idx ON tutor_courses (course_id);
