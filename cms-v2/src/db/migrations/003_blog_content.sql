INSERT INTO cms_content (key, data)
VALUES ('vls-blog-posts', '{"posts":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
