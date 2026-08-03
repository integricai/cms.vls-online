import { sql } from '../db/client';
import type { EnrollmentSyncState, StudentSyncStatus } from '../../shared/types';

interface DbRow {
  id: number;
  status: StudentSyncStatus;
  course_index: number;
  course_id: number | null;
  last_completed_page: number;
  page_size: number;
  total_courses: number | null;
  total_pages_in_course: number | null;
  fetched: number;
  linked: number;
  created_customers: number;
  skipped: number;
  last_error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

function rowToState(row: DbRow): EnrollmentSyncState {
  return {
    status: row.status,
    courseIndex: Number(row.course_index ?? 0),
    courseId: row.course_id == null ? null : Number(row.course_id),
    lastCompletedPage: Number(row.last_completed_page ?? 0),
    pageSize: Number(row.page_size ?? 100),
    totalCourses: row.total_courses == null ? null : Number(row.total_courses),
    totalPagesInCourse: row.total_pages_in_course == null ? null : Number(row.total_pages_in_course),
    fetched: Number(row.fetched ?? 0),
    linked: Number(row.linked ?? 0),
    createdCustomers: Number(row.created_customers ?? 0),
    skipped: Number(row.skipped ?? 0),
    lastError: row.last_error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureEnrollmentSyncStateRow(): Promise<void> {
  await sql`
    INSERT INTO enrollment_sync_state (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getEnrollmentSyncState(): Promise<EnrollmentSyncState> {
  await ensureEnrollmentSyncStateRow();
  const rows = await sql`SELECT * FROM enrollment_sync_state WHERE id = 1`;
  return rowToState(rows[0] as DbRow);
}

export async function markEnrollmentSyncRunning(input: {
  pageSize: number;
  totalCourses: number;
  reset?: boolean;
}): Promise<EnrollmentSyncState> {
  await ensureEnrollmentSyncStateRow();
  if (input.reset) {
    const rows = await sql`
      UPDATE enrollment_sync_state
      SET status = 'running',
          course_index = 0,
          course_id = NULL,
          last_completed_page = 0,
          page_size = ${input.pageSize},
          total_courses = ${input.totalCourses},
          total_pages_in_course = NULL,
          fetched = 0,
          linked = 0,
          created_customers = 0,
          skipped = 0,
          last_error = NULL,
          started_at = NOW(),
          completed_at = NULL,
          updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `;
    return rowToState(rows[0] as DbRow);
  }

  const rows = await sql`
    UPDATE enrollment_sync_state
    SET status = 'running',
        page_size = ${input.pageSize},
        total_courses = ${input.totalCourses},
        last_error = NULL,
        started_at = COALESCE(started_at, NOW()),
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markEnrollmentSyncStopped(): Promise<EnrollmentSyncState> {
  await ensureEnrollmentSyncStateRow();
  const rows = await sql`
    UPDATE enrollment_sync_state
    SET status = 'stopped',
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markEnrollmentSyncProgress(input: {
  status: StudentSyncStatus;
  courseIndex: number;
  courseId: number | null;
  lastCompletedPage: number;
  pageSize: number;
  totalCourses: number;
  totalPagesInCourse: number | null;
  fetched: number;
  linked: number;
  createdCustomers: number;
  skipped: number;
  error?: string | null;
}): Promise<EnrollmentSyncState> {
  const rows = await sql`
    UPDATE enrollment_sync_state
    SET status = ${input.status},
        course_index = ${input.courseIndex},
        course_id = ${input.courseId},
        last_completed_page = ${input.lastCompletedPage},
        page_size = ${input.pageSize},
        total_courses = ${input.totalCourses},
        total_pages_in_course = ${input.totalPagesInCourse},
        fetched = ${input.fetched},
        linked = ${input.linked},
        created_customers = ${input.createdCustomers},
        skipped = ${input.skipped},
        last_error = ${input.error ?? null},
        completed_at = CASE
          WHEN ${input.status}::text IN ('completed', 'failed') THEN NOW()
          ELSE completed_at
        END,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markEnrollmentSyncFailed(error: string): Promise<EnrollmentSyncState> {
  const rows = await sql`
    UPDATE enrollment_sync_state
    SET status = 'failed',
        last_error = ${error},
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}
