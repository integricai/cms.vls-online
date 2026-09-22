import { sql } from '../db/client';

export type CourseUrlChangeStatus =
  | 'queued'
  | 'rewriting'
  | 'ready'
  | 'published'
  | 'failed'
  | 'superseded';

export type CourseUrlChange = {
  id: number;
  courseId: number;
  courseName: string;
  fromPath: string;
  toPath: string;
  storyblokStoryId: number | null;
  status: CourseUrlChangeStatus;
  error: string | null;
  linksUpdated: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type CourseUrlChangeSummary = {
  queued: number;
  rewriting: number;
  ready: number;
  failed: number;
};

export type CourseUrlRewriteState = {
  page: number;
  active: boolean;
  lastError: string | null;
};

interface DbRow {
  id: number;
  course_id: number;
  course_name: string;
  from_path: string;
  to_path: string;
  storyblok_story_id: string | number | null;
  status: CourseUrlChangeStatus;
  error: string | null;
  links_updated: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

function storyId(value: string | number | null): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRow(row: DbRow): CourseUrlChange {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    fromPath: row.from_path,
    toPath: row.to_path,
    storyblokStoryId: storyId(row.storyblok_story_id),
    status: row.status,
    error: row.error,
    linksUpdated: row.links_updated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function listOpenCourseUrlChanges(): Promise<CourseUrlChange[]> {
  const rows = await sql`
    SELECT c.id, c.course_id, courses.name AS course_name, c.from_path, c.to_path,
           c.storyblok_story_id, c.status, c.error, c.links_updated,
           c.created_at, c.updated_at, c.published_at
    FROM course_url_changes c
    JOIN courses ON courses.id = c.course_id
    WHERE c.status IN ('queued', 'rewriting', 'ready', 'failed')
    ORDER BY c.id ASC
  ` as DbRow[];
  return rows.map(mapRow);
}

export async function listCourseUrlChangesByStatus(status: CourseUrlChangeStatus): Promise<CourseUrlChange[]> {
  const rows = await sql`
    SELECT c.id, c.course_id, courses.name AS course_name, c.from_path, c.to_path,
           c.storyblok_story_id, c.status, c.error, c.links_updated,
           c.created_at, c.updated_at, c.published_at
    FROM course_url_changes c
    JOIN courses ON courses.id = c.course_id
    WHERE c.status = ${status}
    ORDER BY c.id ASC
  ` as DbRow[];
  return rows.map(mapRow);
}

export async function summarizeCourseUrlChanges(): Promise<CourseUrlChangeSummary> {
  const rows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM course_url_changes
    WHERE status IN ('queued', 'rewriting', 'ready', 'failed')
    GROUP BY status
  ` as Array<{ status: CourseUrlChangeStatus; count: number }>;

  const summary: CourseUrlChangeSummary = { queued: 0, rewriting: 0, ready: 0, failed: 0 };
  for (const row of rows) {
    if (row.status === 'queued' || row.status === 'rewriting' || row.status === 'ready' || row.status === 'failed') {
      summary[row.status] = Number(row.count);
    }
  }
  return summary;
}

export async function listRecentCourseUrlFailures(limit = 20): Promise<CourseUrlChange[]> {
  const rows = await sql`
    SELECT c.id, c.course_id, courses.name AS course_name, c.from_path, c.to_path,
           c.storyblok_story_id, c.status, c.error, c.links_updated,
           c.created_at, c.updated_at, c.published_at
    FROM course_url_changes c
    JOIN courses ON courses.id = c.course_id
    WHERE c.status = 'failed'
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  ` as DbRow[];
  return rows.map(mapRow);
}

async function getCourseUrlChange(id: number): Promise<CourseUrlChange | null> {
  const rows = await sql`
    SELECT c.id, c.course_id, courses.name AS course_name, c.from_path, c.to_path,
           c.storyblok_story_id, c.status, c.error, c.links_updated,
           c.created_at, c.updated_at, c.published_at
    FROM course_url_changes c
    JOIN courses ON courses.id = c.course_id
    WHERE c.id = ${id}
    LIMIT 1
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertCourseUrlChange(input: {
  courseId: number;
  fromPath: string;
  toPath: string;
  storyblokStoryId: number;
}): Promise<CourseUrlChange> {
  const rows = await sql`
    INSERT INTO course_url_changes (course_id, from_path, to_path, storyblok_story_id, status)
    VALUES (${input.courseId}, ${input.fromPath}, ${input.toPath}, ${input.storyblokStoryId}, 'queued')
    RETURNING id
  ` as Array<{ id: number }>;
  const saved = await getCourseUrlChange(rows[0].id);
  if (!saved) throw new Error('Could not read the queued course URL change');
  return saved;
}

export async function resetCourseUrlChange(id: number, input: {
  fromPath: string;
  toPath: string;
  storyblokStoryId: number;
}): Promise<void> {
  await sql`
    UPDATE course_url_changes
    SET from_path = ${input.fromPath},
        to_path = ${input.toPath},
        storyblok_story_id = ${input.storyblokStoryId},
        status = 'queued',
        error = NULL,
        links_updated = 0,
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markCourseUrlChangeRewriting(id: number, storyblokStoryId: number): Promise<void> {
  await sql`
    UPDATE course_url_changes
    SET status = 'rewriting',
        storyblok_story_id = ${storyblokStoryId},
        error = NULL,
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markCourseUrlChangeFailed(id: number, error: string): Promise<void> {
  await sql`
    UPDATE course_url_changes
    SET status = 'failed',
        error = ${error.slice(0, 2000)},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markRewritingCourseUrlChangesReady(linksUpdated: number): Promise<number> {
  const rows = await sql`
    UPDATE course_url_changes
    SET status = 'ready',
        links_updated = ${linksUpdated},
        error = NULL,
        updated_at = NOW()
    WHERE status = 'rewriting'
    RETURNING id
  `;
  return rows.length;
}

export async function markCourseUrlChangesPublished(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await sql`
    UPDATE course_url_changes
    SET status = 'published',
        published_at = NOW(),
        error = NULL,
        updated_at = NOW()
    WHERE id = ANY(${ids}::int[])
  `;
}

export async function getCourseUrlRewriteState(): Promise<CourseUrlRewriteState> {
  const rows = await sql`
    SELECT page, active, last_error
    FROM course_url_rewrite_state
    WHERE id = 1
    LIMIT 1
  ` as Array<{ page: number; active: boolean; last_error: string | null }>;
  const row = rows[0];
  if (!row) return { page: 1, active: false, lastError: null };
  return { page: row.page, active: row.active, lastError: row.last_error };
}

export async function saveCourseUrlRewriteState(state: CourseUrlRewriteState): Promise<void> {
  await sql`
    INSERT INTO course_url_rewrite_state (id, page, active, last_error)
    VALUES (1, ${state.page}, ${state.active}, ${state.lastError})
    ON CONFLICT (id) DO UPDATE
      SET page = EXCLUDED.page,
          active = EXCLUDED.active,
          last_error = EXCLUDED.last_error,
          updated_at = NOW()
  `;
}
