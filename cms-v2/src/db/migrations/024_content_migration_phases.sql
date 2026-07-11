-- ── Content migration phase tracking ────────────────────────────────────────
-- Persists intermediate state for the 3-phase Migrate Content workflow so that
-- Preview Scrape, Generate Structure, and Migrate Content are independently
-- re-runnable instead of one ephemeral, all-in-one request.

ALTER TABLE content_migration_pages
  ADD COLUMN IF NOT EXISTS scraped_data JSONB,
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scrape_warnings JSONB,
  ADD COLUMN IF NOT EXISTS structure_data JSONB,
  ADD COLUMN IF NOT EXISTS structure_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_story_id BIGINT;
