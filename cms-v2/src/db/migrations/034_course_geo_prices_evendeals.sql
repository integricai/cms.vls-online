-- Per-price Evendeals product id for localized discount selection.

ALTER TABLE course_geo_prices
  ADD COLUMN IF NOT EXISTS evendeals TEXT;
