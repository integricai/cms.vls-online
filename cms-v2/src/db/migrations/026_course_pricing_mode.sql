-- ── Course pricing: session vs duration mode ────────────────────────────────
-- Removes priority / valid_from / valid_until (no longer editable in the admin UI).
-- Adds pricing_mode + exam session (month/year) or duration (days) fields.

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_valid_range;

ALTER TABLE course_geo_prices
  DROP COLUMN IF EXISTS valid_from,
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS priority;

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'duration',
  ADD COLUMN IF NOT EXISTS exam_session_month SMALLINT,
  ADD COLUMN IF NOT EXISTS exam_session_year SMALLINT,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- Existing rows are duration-based. Backfill duration_days from the legacy
-- duration_months column so existing prices display sensibly.
UPDATE course_geo_prices
SET duration_days = duration_months * 30
WHERE duration_days IS NULL;

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_pricing_mode_valid;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_pricing_mode_valid
  CHECK (pricing_mode IN ('session', 'duration'));

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_exam_session_month_range;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_exam_session_month_range
  CHECK (exam_session_month IS NULL OR (exam_session_month BETWEEN 1 AND 12));

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_duration_days_positive;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_duration_days_positive
  CHECK (duration_days IS NULL OR duration_days > 0);

ALTER TABLE course_geo_prices
  DROP CONSTRAINT IF EXISTS course_geo_prices_pricing_mode_fields;

ALTER TABLE course_geo_prices
  ADD CONSTRAINT course_geo_prices_pricing_mode_fields
  CHECK (
    (pricing_mode = 'session' AND exam_session_month IS NOT NULL AND exam_session_year IS NOT NULL)
    OR
    (pricing_mode = 'duration' AND duration_days IS NOT NULL)
  );

-- Re-key upsert index on the new discriminators instead of the legacy
-- duration_months (which is no longer editable from the admin UI).
DROP INDEX IF EXISTS course_geo_prices_upsert_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_upsert_key_idx
  ON course_geo_prices (
    course_id,
    LOWER(name),
    pricing_mode,
    COALESCE(duration_days, 0),
    COALESCE(exam_session_month, 0),
    COALESCE(exam_session_year, 0)
  );
