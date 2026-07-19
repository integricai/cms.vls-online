-- ── Header navigation mega-menu visibility ────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enable_in_navigation BOOLEAN NOT NULL DEFAULT true;

-- Active courses appear in navigation until toggled off individually.
UPDATE courses SET enable_in_navigation = true WHERE is_active = true;

CREATE INDEX IF NOT EXISTS courses_enable_in_navigation_idx
  ON courses (enable_in_navigation, sort_order, name);
