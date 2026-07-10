-- Storyblok story IDs exceed PostgreSQL INTEGER max (~2.1B).
ALTER TABLE content_migration_pages
  ALTER COLUMN storyblok_story_id TYPE BIGINT
  USING storyblok_story_id::bigint;
