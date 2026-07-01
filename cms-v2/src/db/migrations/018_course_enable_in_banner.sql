-- ── Course finder banner visibility ─────────────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enable_in_banner BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing banner behaviour: active courses stay included until toggled off.
UPDATE courses SET enable_in_banner = true WHERE is_active = true;

CREATE INDEX IF NOT EXISTS courses_enable_in_banner_idx ON courses (enable_in_banner, sort_order, name);
