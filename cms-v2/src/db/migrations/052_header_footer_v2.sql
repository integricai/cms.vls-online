INSERT INTO cms_content (key)
VALUES
  ('vls-header-v2-config'),
  ('vls-footer-v2')
ON CONFLICT (key) DO NOTHING;
