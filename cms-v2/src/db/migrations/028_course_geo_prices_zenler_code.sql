-- Zenler payment-option id for bulk import matching + one active price per slot.

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS zenler_pricing_code TEXT;

-- Deactivate duplicate active prices in the same pricing slot (keep lowest id).
UPDATE course_geo_prices p
SET is_active = false,
    is_default = false,
    updated_at = NOW()
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY course_id,
                        pricing_mode,
                        COALESCE(duration_days, 0),
                        COALESCE(exam_session_month, 0),
                        COALESCE(exam_session_year, 0)
           ORDER BY id ASC
         ) AS rn
  FROM course_geo_prices
  WHERE is_active = true
) ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_zenler_pricing_code_idx
  ON course_geo_prices (course_id, zenler_pricing_code)
  WHERE zenler_pricing_code IS NOT NULL AND zenler_pricing_code <> '';

DROP INDEX IF EXISTS course_geo_prices_upsert_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS course_geo_prices_active_slot_idx
  ON course_geo_prices (
    course_id,
    pricing_mode,
    COALESCE(duration_days, 0),
    COALESCE(exam_session_month, 0),
    COALESCE(exam_session_year, 0)
  )
  WHERE is_active = true;
