-- ── Configurable geo pricing regions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_regions (
  code              TEXT        PRIMARY KEY,
  label             TEXT        NOT NULL,
  discount_percent  NUMERIC(5,2) NOT NULL DEFAULT 0
                    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_region_countries (
  country_code  CHAR(2)     PRIMARY KEY,
  region_code   TEXT        NOT NULL REFERENCES pricing_regions (code) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pricing_region_countries_region_idx
  ON pricing_region_countries (region_code);

INSERT INTO pricing_regions (code, label, discount_percent, sort_order)
VALUES
  ('SOUTH_ASIA', 'South Asia', 30, 10),
  ('WEST_ASIA', 'West Asia', 25, 20),
  ('AFRICA', 'Africa', 25, 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pricing_region_countries (country_code, region_code)
VALUES
  ('PK', 'SOUTH_ASIA'), ('IN', 'SOUTH_ASIA'), ('BD', 'SOUTH_ASIA'),
  ('LK', 'SOUTH_ASIA'), ('NP', 'SOUTH_ASIA'), ('BT', 'SOUTH_ASIA'), ('MV', 'SOUTH_ASIA'),
  ('BH', 'WEST_ASIA'), ('KW', 'WEST_ASIA'), ('SA', 'WEST_ASIA'),
  ('AE', 'WEST_ASIA'), ('QA', 'WEST_ASIA'), ('OM', 'WEST_ASIA'),
  ('KE', 'AFRICA'), ('ZM', 'AFRICA'), ('ZW', 'AFRICA')
ON CONFLICT (country_code) DO NOTHING;
