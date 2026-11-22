-- Courses offered as upsells from another course. The vault course list is the only writer.

CREATE TABLE IF NOT EXISTS course_upsells (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  upsell_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, upsell_course_id),
  CONSTRAINT course_upsells_not_self CHECK (course_id <> upsell_course_id)
);

CREATE INDEX IF NOT EXISTS course_upsells_upsell_idx ON course_upsells (upsell_course_id);
