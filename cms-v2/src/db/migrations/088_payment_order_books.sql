-- Books ticked on checkout C. The sales list reads this with the course that was purchased.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS book_ids INTEGER[];
