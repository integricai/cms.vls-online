-- Sitemap source of truth: Storyblok pages tracked for search engines

CREATE TABLE IF NOT EXISTS site_urls (
  id                    SERIAL       PRIMARY KEY,
  path                  TEXT         NOT NULL,
  sitemap_group         TEXT         NOT NULL CHECK (sitemap_group IN ('pages', 'courses', 'blog')),
  storyblok_full_slug   TEXT         NOT NULL,
  storyblok_story_id    BIGINT,
  title                 TEXT         NOT NULL DEFAULT '',
  is_enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
  lastmod               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT site_urls_path_unique UNIQUE (path),
  CONSTRAINT site_urls_full_slug_unique UNIQUE (storyblok_full_slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_urls_storyblok_story_id
  ON site_urls (storyblok_story_id)
  WHERE storyblok_story_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_urls_group_enabled
  ON site_urls (sitemap_group, is_enabled);

CREATE INDEX IF NOT EXISTS idx_site_urls_enabled_path
  ON site_urls (is_enabled, path);
