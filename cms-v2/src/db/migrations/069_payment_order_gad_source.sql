-- Google Ads network on the click. gad_source names the surface (YouTube is 3).
-- gad_campaignid names the campaign. Older rows can still be labeled from landing_page.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS gad_source TEXT,
  ADD COLUMN IF NOT EXISTS gad_campaign_id TEXT;
