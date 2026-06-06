ALTER TABLE books ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;

UPDATE books
SET quantity = counts.quantity
FROM (
  SELECT books.id, COUNT(book_discount_codes.id)::int AS quantity
  FROM books
  LEFT JOIN book_discount_codes ON book_discount_codes.book_id = books.id
  GROUP BY books.id
) AS counts
WHERE books.id = counts.id;
