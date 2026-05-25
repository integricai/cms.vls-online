import { sql } from '../db/client';
import type { Course } from '../../shared/types';

interface DbRow {
  id: number;
  zenler_course_id: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenler_url: string | null;
  is_active: boolean;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToCourse(row: DbRow): Course {
  return {
    id: row.id,
    zenlerCourseId: row.zenler_course_id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    level: row.level,
    status: row.status,
    zenlerUrl: row.zenler_url,
    isActive: row.is_active,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCourses(): Promise<Course[]> {
  const rows = await sql`SELECT * FROM courses ORDER BY name ASC`;
  return (rows as DbRow[]).map(rowToCourse);
}

export async function listActiveCourses(): Promise<Course[]> {
  const rows = await sql`SELECT * FROM courses WHERE is_active = true ORDER BY name ASC`;
  return (rows as DbRow[]).map(rowToCourse);
}

export async function getCourseByZenlerCourseId(zenlerCourseId: string): Promise<Course | null> {
  const rows = await sql`
    SELECT * FROM courses
    WHERE zenler_course_id = ${zenlerCourseId}
    LIMIT 1
  `;
  return rows[0] ? rowToCourse(rows[0] as DbRow) : null;
}

export async function upsertCourse(data: {
  zenlerCourseId: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenlerUrl: string | null;
}): Promise<{ course: Course; wasInserted: boolean }> {
  const rows = await sql`
    INSERT INTO courses (zenler_course_id, name, slug, category, level, status, zenler_url, is_active, last_synced_at)
    VALUES (
      ${data.zenlerCourseId},
      ${data.name},
      ${data.slug},
      ${data.category},
      ${data.level},
      ${data.status},
      ${data.zenlerUrl},
      true,
      NOW()
    )
    ON CONFLICT (zenler_course_id) DO UPDATE
      SET name           = EXCLUDED.name,
          slug           = EXCLUDED.slug,
          category       = EXCLUDED.category,
          level          = EXCLUDED.level,
          status         = EXCLUDED.status,
          zenler_url     = EXCLUDED.zenler_url,
          is_active      = true,
          last_synced_at = NOW(),
          updated_at     = NOW()
    RETURNING *, (xmax = 0) AS was_inserted
  `;
  const row = rows[0] as DbRow & { was_inserted: boolean };
  return { course: rowToCourse(row), wasInserted: row.was_inserted };
}

export async function deactivateCoursesNotIn(activeZenlerIds: string[]): Promise<number> {
  if (activeZenlerIds.length === 0) {
    const rows = await sql`
      UPDATE courses SET is_active = false, updated_at = NOW()
      WHERE is_active = true
      RETURNING id
    `;
    return rows.length;
  }
  const rows = await sql`
    UPDATE courses SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND NOT (zenler_course_id = ANY(${activeZenlerIds}))
    RETURNING id
  `;
  return rows.length;
}
