-- A course may offer more than one active price for the same access length
-- (for example Gold Pack and One Year Access, both 365 days).

DROP INDEX IF EXISTS course_geo_prices_active_slot_idx;
