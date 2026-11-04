import { sql } from '../db/client';
import {
  MANUAL_ACCESS_DURATIONS,
  ZENLER_ROSTER_FROM,
  type ActiveEnrollment,
  type ActiveEnrollmentPage,
} from '../../shared/types';

interface RosterDbRow {
  zenler_course_id: string;
  zenler_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  course_id: number | null;
  course_name: string | null;
  enrollment_date: Date;
  duration_days: number | null;
  validity_date: Date | null;
  sale_id: number | null;
  total_count: string | number;
}

let rosterReady: Promise<void> | null = null;

export function ensureZenlerRoster(): Promise<void> {
  rosterReady ??= sql`
    CREATE TABLE IF NOT EXISTS zenler_roster_enrollments (
      zenler_course_id  TEXT NOT NULL,
      zenler_user_id    TEXT NOT NULL,
      email             TEXT NOT NULL,
      first_name        TEXT,
      last_name         TEXT,
      course_name       TEXT,
      enrollment_date   TIMESTAMPTZ NOT NULL,
      duration_days     INTEGER,
      validity_date     TIMESTAMPTZ,
      removed_at        TIMESTAMPTZ,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (zenler_course_id, zenler_user_id)
    )
  `.then(() => undefined).catch((err: unknown) => {
    rosterReady = null;
    throw err;
  });
  return rosterReady;
}

export function isManualAccessDuration(value: number): boolean {
  return (MANUAL_ACCESS_DURATIONS as readonly number[]).includes(value);
}

export function enrollmentOnOrAfterCutoff(value: string | null | undefined): boolean {
  const day = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= ZENLER_ROSTER_FROM;
}

function rowToEnrollment(row: RosterDbRow): ActiveEnrollment {
  return {
    saleId: row.sale_id,
    paymentOrderId: null,
    customerId: null,
    zenlerUserId: row.zenler_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    courseId: row.course_id,
    courseName: row.course_name?.trim() || `Course ${row.zenler_course_id}`,
    zenlerCourseId: row.zenler_course_id,
    enrollmentDate: row.enrollment_date,
    durationDays: row.duration_days,
    expiryDate: row.validity_date,
  };
}

export async function upsertZenlerRosterEnrollment(input: {
  zenlerCourseId: string;
  zenlerUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  courseName: string | null;
  enrollmentDate: string;
}): Promise<void> {
  await ensureZenlerRoster();
  await sql`
    INSERT INTO zenler_roster_enrollments (
      zenler_course_id, zenler_user_id, email, first_name, last_name, course_name, enrollment_date
    )
    VALUES (
      ${input.zenlerCourseId},
      ${input.zenlerUserId},
      ${input.email},
      ${input.firstName},
      ${input.lastName},
      ${input.courseName},
      ${input.enrollmentDate}::timestamptz
    )
    ON CONFLICT (zenler_course_id, zenler_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      course_name = EXCLUDED.course_name,
      enrollment_date = EXCLUDED.enrollment_date,
      synced_at = NOW()
  `;
}

export async function listZenlerRoster(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
  unbounded?: boolean;
} = {}): Promise<ActiveEnrollmentPage> {
  await ensureZenlerRoster();
  const search = filters.search?.trim().toLowerCase() || null;
  const unbounded = filters.unbounded === true;
  const pageSize = unbounded
    ? 100000
    : Math.min(100, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const page = unbounded ? 1 : Math.max(1, Number(filters.page ?? 1) || 1);
  const offset = (page - 1) * pageSize;

  const rows = await sql`
    SELECT listed.*, COUNT(*) OVER() AS total_count
    FROM (
      SELECT
        r.zenler_course_id,
        r.zenler_user_id,
        r.email,
        r.first_name,
        r.last_name,
        r.enrollment_date,
        r.duration_days,
        r.validity_date,
        c.id AS course_id,
        COALESCE(c.name, r.course_name) AS course_name,
        sale.sale_id
      FROM zenler_roster_enrollments r
      LEFT JOIN LATERAL (
        SELECT id, name
        FROM courses
        WHERE zenler_course_id = r.zenler_course_id
        ORDER BY id
        LIMIT 1
      ) c ON TRUE
      LEFT JOIN LATERAL (
        SELECT s.id AS sale_id
        FROM customers cu
        JOIN sales s ON s.customer_id = cu.id
        JOIN payment_orders po ON po.id = s.payment_order_id
        LEFT JOIN courses sc ON sc.id = s.course_id
        WHERE LOWER(cu.email) = LOWER(r.email)
          AND po.status = 'Paid'
          AND (
            sc.zenler_course_id = r.zenler_course_id
            OR btrim(COALESCE(po.zenler_course_id, '')) = r.zenler_course_id
            OR r.zenler_course_id = ANY(COALESCE(po.access_zenler_course_ids, ARRAY[]::text[]))
          )
        ORDER BY s.expiry_date DESC NULLS LAST
        LIMIT 1
      ) sale ON TRUE
      WHERE r.removed_at IS NULL
        AND r.enrollment_date >= ${ZENLER_ROSTER_FROM}::date
    ) listed
    WHERE (
      ${search}::text IS NULL
      OR LOWER(listed.email) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(listed.first_name, '')) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(listed.last_name, '')) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(listed.course_name, '')) LIKE '%' || ${search} || '%'
    )
    ORDER BY listed.enrollment_date DESC, listed.email ASC, listed.course_name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const items = (rows as RosterDbRow[]).map(rowToEnrollment);
  const total = rows[0] ? Number((rows[0] as RosterDbRow).total_count ?? 0) : 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  return { items, page, pageSize, total, totalPages };
}

export async function saveRosterDuration(input: {
  zenlerCourseId: string;
  zenlerUserId: string;
  durationDays: number;
}): Promise<ActiveEnrollment> {
  await ensureZenlerRoster();
  const rows = await sql`
    UPDATE zenler_roster_enrollments
    SET duration_days = ${input.durationDays},
        validity_date = enrollment_date + make_interval(days => ${input.durationDays}),
        updated_at = NOW()
    WHERE zenler_course_id = ${input.zenlerCourseId}
      AND zenler_user_id = ${input.zenlerUserId}
      AND removed_at IS NULL
    RETURNING
      zenler_course_id,
      zenler_user_id,
      email,
      first_name,
      last_name,
      course_name,
      enrollment_date,
      duration_days,
      validity_date,
      NULL::int AS course_id,
      NULL::int AS sale_id
  `;
  const row = rows[0] as RosterDbRow | undefined;
  if (!row) throw new Error('Enrolment not found. Sync from Zenler and try again.');
  return rowToEnrollment(row);
}

export async function markRosterRemoved(zenlerCourseId: string, zenlerUserId: string): Promise<void> {
  await ensureZenlerRoster();
  await sql`
    UPDATE zenler_roster_enrollments
    SET removed_at = NOW(), updated_at = NOW()
    WHERE zenler_course_id = ${zenlerCourseId}
      AND zenler_user_id = ${zenlerUserId}
      AND removed_at IS NULL
  `;
}
