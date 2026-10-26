ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant';

UPDATE users
SET role = 'assistant'
WHERE role = 'editor';
