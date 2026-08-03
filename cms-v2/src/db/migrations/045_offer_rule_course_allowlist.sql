-- Optional course allowlist for exam-session offer rules.
-- Empty array = apply to all courses with that qualification (legacy behaviour).
-- Non-empty = only listed course IDs get Mar/Jun/Sep/Dec session labels;
-- other courses keep duration/day plan labels from the price tool.

ALTER TABLE qualification_offer_rules
  ADD COLUMN IF NOT EXISTS course_ids INTEGER[] NOT NULL DEFAULT '{}';
