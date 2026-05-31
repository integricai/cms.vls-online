-- ── Course admin metadata ───────────────────────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS course_level TEXT,
  ADD COLUMN IF NOT EXISTS course_option TEXT;

CREATE INDEX IF NOT EXISTS courses_sort_order_idx ON courses (sort_order, name);
CREATE INDEX IF NOT EXISTS courses_qualification_idx ON courses (qualification);
CREATE INDEX IF NOT EXISTS courses_course_level_idx ON courses (course_level);
CREATE INDEX IF NOT EXISTS courses_course_option_idx ON courses (course_option);

CREATE TABLE IF NOT EXISTS course_dropdown_options (
  id          SERIAL      PRIMARY KEY,
  kind        TEXT        NOT NULL CHECK (kind IN ('qualification', 'level', 'course_option')),
  value       TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, value)
);

CREATE INDEX IF NOT EXISTS course_dropdown_options_kind_idx ON course_dropdown_options (kind, sort_order, value);

INSERT INTO course_dropdown_options (kind, value, sort_order)
VALUES
  ('qualification', 'ACCA', 10),
  ('qualification', 'CIMA', 20),
  ('qualification', 'CMA', 30),
  ('qualification', 'CIA', 40),
  ('qualification', 'Dip-IFR / IFRS', 50),
  ('level', 'Foundation Diploma', 10),
  ('level', 'Applied Knowledge', 20),
  ('level', 'Applied Skills', 30),
  ('level', 'Strategic Professional', 40),
  ('level', 'Certificate Level', 50),
  ('level', 'Operational Level', 60),
  ('level', 'Management Level', 70),
  ('level', 'Strategic Level', 80),
  ('level', 'CMA Qualification', 90),
  ('level', 'CIA Qualification', 100),
  ('level', 'IFRS Qualification', 110),
  ('course_option', 'Full Course', 10),
  ('course_option', 'Revision Course', 20),
  ('course_option', 'Mock Exam', 30),
  ('course_option', 'Study Notes', 40),
  ('course_option', 'Bundle', 50),
  ('course_option', 'Annual Plan', 60),
  ('course_option', 'Coming Soon', 70)
ON CONFLICT (kind, value) DO NOTHING;
