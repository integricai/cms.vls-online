-- Analytics label for a public path. Storyblok sync does not write this column.
-- Sitemap XML reads path and lastmod only.

ALTER TABLE site_urls
  ADD COLUMN IF NOT EXISTS tracking_name TEXT NOT NULL DEFAULT '';
