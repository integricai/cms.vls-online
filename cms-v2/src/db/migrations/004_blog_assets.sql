CREATE TABLE IF NOT EXISTS cms_blog_assets (
  id           TEXT        PRIMARY KEY,
  filename     TEXT        NOT NULL,
  source_url   TEXT        NOT NULL,
  content_type TEXT        NOT NULL,
  size_bytes   INTEGER     NOT NULL,
  data         BYTEA       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_blog_assets_source_url_idx ON cms_blog_assets (source_url);
