INSERT INTO cms_content (key)
VALUES ('vls-blog-header-config')
ON CONFLICT (key) DO NOTHING;
