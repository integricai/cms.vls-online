-- ── Exam result request tokens (student self-report links) ──────────────────

CREATE TABLE IF NOT EXISTS exam_result_tokens (
  id           SERIAL PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  emailed_at   TIMESTAMPTZ,
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exam_result_tokens_customer_course_idx
  ON exam_result_tokens (customer_id, course_id);

CREATE INDEX IF NOT EXISTS exam_result_tokens_token_idx
  ON exam_result_tokens (token);

CREATE INDEX IF NOT EXISTS exam_result_tokens_expires_at_idx
  ON exam_result_tokens (expires_at);
