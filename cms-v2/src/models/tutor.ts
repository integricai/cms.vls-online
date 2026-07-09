import { sql } from '../db/client';
import type { Tutor, TutorInput } from '../../shared/types';

interface DbRow {
  id: number;
  name: string;
  email: string | null;
  role: string | null;
  bio: string | null;
  photo_url: string | null;
  initials: string | null;
  is_active: boolean;
  course_ids?: number[];
  course_names?: string[];
  created_at: Date;
  updated_at: Date;
}

function rowToTutor(row: DbRow): Tutor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    bio: row.bio,
    photoUrl: row.photo_url,
    initials: row.initials,
    isActive: row.is_active,
    courseIds: row.course_ids ?? [],
    courseNames: row.course_names,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replaceTutorCourses(tutorId: number, courseIds: number[]): Promise<void> {
  await sql`DELETE FROM tutor_courses WHERE tutor_id = ${tutorId}`;
  const uniqueIds = [...new Set(courseIds.filter(id => Number.isInteger(id) && id > 0))];
  for (const courseId of uniqueIds) {
    await sql`
      INSERT INTO tutor_courses (tutor_id, course_id)
      VALUES (${tutorId}, ${courseId})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function listTutors(): Promise<Tutor[]> {
  const rows = await sql`
    SELECT
      t.*,
      COALESCE(array_remove(array_agg(c.id ORDER BY c.name ASC), NULL), ARRAY[]::integer[]) AS course_ids,
      COALESCE(array_remove(array_agg(c.name ORDER BY c.name ASC), NULL), ARRAY[]::text[]) AS course_names
    FROM tutors t
    LEFT JOIN tutor_courses tc ON tc.tutor_id = t.id
    LEFT JOIN courses c ON c.id = tc.course_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `;
  return (rows as DbRow[]).map(rowToTutor);
}

export async function getTutorById(id: number): Promise<Tutor | null> {
  const rows = await sql`
    SELECT
      t.*,
      COALESCE(array_remove(array_agg(c.id ORDER BY c.name ASC), NULL), ARRAY[]::integer[]) AS course_ids,
      COALESCE(array_remove(array_agg(c.name ORDER BY c.name ASC), NULL), ARRAY[]::text[]) AS course_names
    FROM tutors t
    LEFT JOIN tutor_courses tc ON tc.tutor_id = t.id
    LEFT JOIN courses c ON c.id = tc.course_id
    WHERE t.id = ${id}
    GROUP BY t.id
    LIMIT 1
  `;
  return rows[0] ? rowToTutor(rows[0] as DbRow) : null;
}

export async function createTutor(input: TutorInput): Promise<Tutor> {
  const rows = await sql`
    INSERT INTO tutors (name, email, role, bio, photo_url, initials, is_active)
    VALUES (
      ${input.name.trim()},
      ${input.email?.trim() || null},
      ${input.role?.trim() || null},
      ${input.bio?.trim() || null},
      ${input.photoUrl?.trim() || null},
      ${input.initials?.trim() || null},
      ${input.isActive !== false}
    )
    RETURNING *
  `;
  const created = rows[0] as DbRow;
  await replaceTutorCourses(created.id, input.courseIds ?? []);
  const tutor = await getTutorById(created.id);
  if (!tutor) throw new Error('Failed to create tutor');
  return tutor;
}

export async function updateTutor(id: number, input: Partial<TutorInput>): Promise<Tutor | null> {
  const existing = await getTutorById(id);
  if (!existing) return null;

  const rows = await sql`
    UPDATE tutors
    SET name = ${input.name !== undefined ? input.name.trim() : existing.name},
        email = ${input.email !== undefined ? (input.email?.trim() || null) : existing.email},
        role = ${input.role !== undefined ? (input.role?.trim() || null) : existing.role},
        bio = ${input.bio !== undefined ? (input.bio?.trim() || null) : existing.bio},
        photo_url = ${input.photoUrl !== undefined ? (input.photoUrl?.trim() || null) : existing.photoUrl},
        initials = ${input.initials !== undefined ? (input.initials?.trim() || null) : existing.initials},
        is_active = ${input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows[0]) return null;

  if (input.courseIds !== undefined) {
    await replaceTutorCourses(id, input.courseIds);
  }

  return getTutorById(id);
}

export async function deactivateTutor(id: number): Promise<Tutor | null> {
  return updateTutor(id, { isActive: false });
}

export async function deleteTutor(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM tutors WHERE id = ${id} RETURNING id`;
  return Boolean(rows[0]);
}
