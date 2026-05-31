CREATE TABLE IF NOT EXISTS course_levels (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, level)
);

CREATE INDEX IF NOT EXISTS course_levels_level_idx ON course_levels (level);
CREATE INDEX IF NOT EXISTS course_levels_course_idx ON course_levels (course_id, sort_order, level);

INSERT INTO course_levels (course_id, level, sort_order)
SELECT id, course_level, 10
FROM courses
WHERE course_level IS NOT NULL
  AND BTRIM(course_level) <> ''
ON CONFLICT (course_id, level) DO NOTHING;
