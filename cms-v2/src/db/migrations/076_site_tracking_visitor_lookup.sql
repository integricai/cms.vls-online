-- Returning visits look up earlier days for the same person.
CREATE INDEX IF NOT EXISTS site_tracking_visits_visitor_key_visited_on_idx
  ON site_tracking_visits (visitor_key, visited_on);
