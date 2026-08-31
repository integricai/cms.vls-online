-- Public sales-page URL for a CMS course (Storyblok course page).
-- Not overwritten by the Zenler sync.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS course_page_url TEXT;

CREATE INDEX IF NOT EXISTS courses_course_page_url_idx
  ON courses (course_page_url)
  WHERE course_page_url IS NOT NULL;
