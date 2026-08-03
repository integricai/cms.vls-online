import { sql } from '../db/client';
import type { StudentSyncState, StudentSyncStatus } from '../../shared/types';

interface DbRow {
  id: number;
  status: StudentSyncStatus;
  last_completed_page: number;
  page_size: number;
  total_pages: number | null;
  fetched: number;
  created_count: number;
  updated_count: number;
  skipped: number;
  last_error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

function rowToState(row: DbRow): StudentSyncState {
  return {
    status: row.status,
    lastCompletedPage: Number(row.last_completed_page ?? 0),
    pageSize: Number(row.page_size ?? 50),
    totalPages: row.total_pages == null ? null : Number(row.total_pages),
    fetched: Number(row.fetched ?? 0),
    created: Number(row.created_count ?? 0),
    updated: Number(row.updated_count ?? 0),
    skipped: Number(row.skipped ?? 0),
    lastError: row.last_error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    nextPage: row.status === 'completed'
      ? null
      : Number(row.last_completed_page ?? 0) + 1,
  };
}

export async function ensureStudentSyncStateRow(): Promise<void> {
  await sql`
    INSERT INTO student_sync_state (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getStudentSyncState(): Promise<StudentSyncState> {
  await ensureStudentSyncStateRow();
  const rows = await sql`SELECT * FROM student_sync_state WHERE id = 1`;
  return rowToState(rows[0] as DbRow);
}

export async function countZenlerSyncedCustomers(): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM customers
    WHERE source = 'zenler_sync'
       OR zenler_user_id IS NOT NULL
  `;
  return Number((rows[0] as { count: number } | undefined)?.count ?? 0);
}

/**
 * If progress was lost (e.g. pre-persistence sync), estimate resume page from
 * already-imported Zenler customers so Continue does not restart at page 1.
 */
export async function bootstrapStudentSyncProgressIfNeeded(
  pageSize = 50,
): Promise<StudentSyncState> {
  const state = await getStudentSyncState();
  if (state.lastCompletedPage > 0 || state.status === 'completed') return state;

  const imported = await countZenlerSyncedCustomers();
  if (imported < pageSize) return state;

  const estimatedPage = Math.floor(imported / pageSize);
  if (estimatedPage <= 0) return state;

  const rows = await sql`
    UPDATE student_sync_state
    SET status = 'stopped',
        last_completed_page = ${estimatedPage},
        page_size = ${pageSize},
        fetched = GREATEST(fetched, ${imported}),
        last_error = NULL,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markStudentSyncRunning(input: {
  pageSize: number;
  reset?: boolean;
}): Promise<StudentSyncState> {
  await ensureStudentSyncStateRow();
  if (input.reset) {
    const rows = await sql`
      UPDATE student_sync_state
      SET status = 'running',
          last_completed_page = 0,
          page_size = ${input.pageSize},
          total_pages = NULL,
          fetched = 0,
          created_count = 0,
          updated_count = 0,
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
    UPDATE student_sync_state
    SET status = 'running',
        page_size = ${input.pageSize},
        last_error = NULL,
        started_at = COALESCE(started_at, NOW()),
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markStudentSyncStopped(): Promise<StudentSyncState> {
  await ensureStudentSyncStateRow();
  const rows = await sql`
    UPDATE student_sync_state
    SET status = 'stopped',
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markStudentSyncPageComplete(input: {
  page: number;
  pageSize: number;
  totalPages: number;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  done: boolean;
  error?: string | null;
}): Promise<StudentSyncState> {
  const status: StudentSyncStatus = input.error
    ? 'failed'
    : input.done
      ? 'completed'
      : 'running';

  const rows = await sql`
    UPDATE student_sync_state
    SET status = ${status},
        last_completed_page = ${input.page},
        page_size = ${input.pageSize},
        total_pages = ${input.totalPages},
        fetched = ${input.fetched},
        created_count = ${input.created},
        updated_count = ${input.updated},
        skipped = ${input.skipped},
        last_error = ${input.error ?? null},
        completed_at = CASE WHEN ${input.done || Boolean(input.error)} THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}

export async function markStudentSyncFailed(error: string): Promise<StudentSyncState> {
  const rows = await sql`
    UPDATE student_sync_state
    SET status = 'failed',
        last_error = ${error},
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;
  return rowToState(rows[0] as DbRow);
}
