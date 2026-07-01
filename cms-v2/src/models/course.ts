import { sql } from '../db/client';
import type { Course, CourseDropdownKind, CourseDropdownOption } from '../../shared/types';

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
  enable_in_banner: boolean;
  sort_order: number;
  qualification: string | null;
  course_level: string | null;
  course_levels?: string[];
  course_option: string | null;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DropdownOptionDbRow {
  id: number;
  kind: CourseDropdownKind;
  value: string;
  sort_order: number;
  is_active: boolean;
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
    enableInBanner: row.enable_in_banner,
    sortOrder: row.sort_order,
    qualification: row.qualification,
    courseLevel: row.course_level,
    courseLevels: row.course_levels ?? (row.course_level ? [row.course_level] : []),
    courseOption: row.course_option,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDropdownOption(row: DropdownOptionDbRow): CourseDropdownOption {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCourses(): Promise<Course[]> {
  const rows = await sql`
    SELECT c.*,
      COALESCE(array_remove(array_agg(cl.level ORDER BY cl.sort_order ASC, cl.level ASC), NULL), ARRAY[]::text[]) AS course_levels
    FROM courses c
    LEFT JOIN course_levels cl ON cl.course_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `;
  return (rows as DbRow[]).map(rowToCourse);
}

export async function listActiveCourses(): Promise<Course[]> {
  const rows = await sql`
    SELECT c.*,
      COALESCE(array_remove(array_agg(cl.level ORDER BY cl.sort_order ASC, cl.level ASC), NULL), ARRAY[]::text[]) AS course_levels
    FROM courses c
    LEFT JOIN course_levels cl ON cl.course_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `;
  return (rows as DbRow[]).map(rowToCourse);
}

export async function listBannerCourses(): Promise<Course[]> {
  const rows = await sql`
    SELECT c.*,
      COALESCE(array_remove(array_agg(cl.level ORDER BY cl.sort_order ASC, cl.level ASC), NULL), ARRAY[]::text[]) AS course_levels
    FROM courses c
    LEFT JOIN course_levels cl ON cl.course_id = c.id
    WHERE c.is_active = true AND c.enable_in_banner = true
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `;
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
          last_synced_at = NOW(),
          updated_at     = NOW()
    RETURNING *, (xmax = 0) AS was_inserted
  `;
  const row = rows[0] as DbRow & { was_inserted: boolean };
  return { course: rowToCourse(row), wasInserted: row.was_inserted };
}

export async function updateCourseAdminMetadata(
  id: number,
  data: {
    isActive?: boolean;
    enableInBanner?: boolean;
    sortOrder?: number;
    qualification?: string | null;
    courseLevel?: string | null;
    courseLevels?: string[];
    courseOption?: string | null;
  },
): Promise<Course | null> {
  const existingRows = await sql`SELECT * FROM courses WHERE id = ${id} LIMIT 1`;
  const existing = existingRows[0] as DbRow | undefined;
  if (!existing) return null;

  const rows = await sql`
    UPDATE courses
    SET is_active          = ${data.isActive ?? existing.is_active},
        enable_in_banner   = ${data.enableInBanner ?? existing.enable_in_banner},
        sort_order         = ${data.sortOrder ?? existing.sort_order},
        qualification = ${data.qualification === undefined ? existing.qualification : data.qualification},
        course_level  = ${data.courseLevel === undefined ? existing.course_level : data.courseLevel},
        course_option = ${data.courseOption === undefined ? existing.course_option : data.courseOption},
        updated_at    = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return null;

  if (data.courseLevels !== undefined) {
    const cleanLevels = Array.from(new Set(data.courseLevels.map(level => level.trim()).filter(Boolean)));
    await sql`DELETE FROM course_levels WHERE course_id = ${id}`;
    for (let index = 0; index < cleanLevels.length; index++) {
      await sql`
        INSERT INTO course_levels (course_id, level, sort_order)
        VALUES (${id}, ${cleanLevels[index]}, ${(index + 1) * 10})
        ON CONFLICT (course_id, level) DO UPDATE
          SET sort_order = EXCLUDED.sort_order
      `;
    }
  }

  const fresh = (await listCourses()).find(course => course.id === id);
  return fresh ?? rowToCourse(rows[0] as DbRow);
}

export async function reorderCourses(ids: number[]): Promise<Course[]> {
  if (ids.length === 0) return listCourses();
  await sql`
    WITH incoming AS (
      SELECT * FROM UNNEST(${ids}::int[]) WITH ORDINALITY AS t(id, ord)
    )
    UPDATE courses c
    SET sort_order = incoming.ord::int,
        updated_at = NOW()
    FROM incoming
    WHERE c.id = incoming.id
  `;
  return listCourses();
}

export async function listCourseDropdownOptions(): Promise<CourseDropdownOption[]> {
  const rows = await sql`
    SELECT * FROM course_dropdown_options
    WHERE is_active = true
    ORDER BY kind ASC, sort_order ASC, value ASC
  `;
  return (rows as DropdownOptionDbRow[]).map(rowToDropdownOption);
}

export async function replaceCourseDropdownOptions(
  valuesByKind: Record<CourseDropdownKind, string[]>,
): Promise<CourseDropdownOption[]> {
  await sql`UPDATE course_dropdown_options SET is_active = false, updated_at = NOW()`;

  for (const [kind, values] of Object.entries(valuesByKind) as Array<[CourseDropdownKind, string[]]>) {
    for (let index = 0; index < values.length; index++) {
      const value = values[index]?.trim();
      if (!value) continue;
      await sql`
        INSERT INTO course_dropdown_options (kind, value, sort_order, is_active)
        VALUES (${kind}, ${value}, ${(index + 1) * 10}, true)
        ON CONFLICT (kind, value) DO UPDATE
          SET sort_order = EXCLUDED.sort_order,
              is_active = true,
              updated_at = NOW()
      `;
    }
  }

  return listCourseDropdownOptions();
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
