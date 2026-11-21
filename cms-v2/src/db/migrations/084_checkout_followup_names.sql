-- The follow-up row already keeps the email. First and last name let the
-- reminder greet the buyer, and let Failed Payments show who they are.
ALTER TABLE checkout_followups
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;
