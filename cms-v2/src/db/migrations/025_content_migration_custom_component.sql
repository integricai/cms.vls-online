-- ── Generate Component phase ────────────────────────────────────────────────
-- Records the name of a custom Storyblok component created (via Generate Component)
-- for a page whose live layout matches no known template — Generate Structure uses
-- this to build the page body from that one custom component instead of blueprint sections.

ALTER TABLE content_migration_pages
  ADD COLUMN IF NOT EXISTS custom_component_name TEXT;
