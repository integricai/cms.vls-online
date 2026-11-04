import { sql } from '../db/client';
import type { ActiveEnrollment, ActiveEnrollmentPage } from '../../shared/types';

interface ActiveEnrollmentDbRow {
  sale_id: number;
  payment_order_id: number;
  customer_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  course_id: number | null;
  course_name: string | null;
  zenler_course_id: string;
  expiry_date: Date;
  total_count: string | number;
}

let closuresReady: Promise<void> | null = null;

/** Records a manual unenrol of one Zenler course on a paid order. */
export function ensureCourseAccessClosures(): Promise<void> {
  closuresReady ??= sql`
    CREATE TABLE IF NOT EXISTS course_access_closures (
      payment_order_id  INTEGER NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
      zenler_course_id  TEXT NOT NULL,
      closed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (payment_order_id, zenler_course_id)
    )
  `.then(() => undefined).catch((err: unknown) => {
    closuresReady = null;
    throw err;
  });
  return closuresReady;
}

function rowToActiveEnrollment(row: ActiveEnrollmentDbRow): ActiveEnrollment {
  return {
    saleId: row.sale_id,
    paymentOrderId: row.payment_order_id,
    customerId: row.customer_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    courseId: row.course_id,
    courseName: row.course_name?.trim() || `Course ${row.zenler_course_id}`,
    zenlerCourseId: row.zenler_course_id,
    zenlerUserId: '',
    enrollmentDate: row.expiry_date,
    durationDays: null,
    expiryDate: row.expiry_date,
  };
}

export async function listActiveEnrollments(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ActiveEnrollmentPage> {
  await ensureCourseAccessClosures();
  const search = filters.search?.trim().toLowerCase() || null;
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const offset = (page - 1) * pageSize;

  const rows = await sql`
    SELECT active.*, COUNT(*) OVER() AS total_count
    FROM (
      SELECT
        s.id AS sale_id,
        s.payment_order_id,
        s.customer_id,
        s.expiry_date,
        cu.email,
        cu.first_name,
        cu.last_name,
        pc.id AS course_id,
        COALESCE(
          pc.name,
          CASE
            WHEN COALESCE(cardinality(po.access_zenler_course_ids), 0) = 0 THEN sc.name
            ELSE NULL
          END,
          'Course ' || paper.zenler_course_id
        ) AS course_name,
        paper.zenler_course_id
      FROM sales s
      JOIN payment_orders po ON po.id = s.payment_order_id
      JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN courses sc ON sc.id = s.course_id
      CROSS JOIN LATERAL (
        SELECT DISTINCT btrim(zenler_id) AS zenler_course_id
        FROM unnest(
          CASE
            WHEN COALESCE(cardinality(po.access_zenler_course_ids), 0) > 0
              THEN po.access_zenler_course_ids
            ELSE ARRAY[COALESCE(NULLIF(btrim(po.zenler_course_id), ''), sc.zenler_course_id)]
          END
        ) AS zenler_id
        WHERE btrim(zenler_id) ~ '^[0-9]+$'
      ) paper
      LEFT JOIN LATERAL (
        SELECT c.id, c.name
        FROM courses c
        WHERE c.zenler_course_id = paper.zenler_course_id
        ORDER BY c.id
        LIMIT 1
      ) pc ON TRUE
      WHERE po.status = 'Paid'
        AND s.expiry_date > NOW()
        AND (
          po.zenler_enrollment_status ILIKE 'enrolled%'
          OR po.zenler_enrollment_status = 'unenroll_failed'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM course_access_closures cac
          WHERE cac.payment_order_id = po.id
            AND cac.zenler_course_id = paper.zenler_course_id
        )
    ) active
    WHERE (
      ${search}::text IS NULL
      OR LOWER(active.email) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(active.first_name, '')) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(active.last_name, '')) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(active.course_name, '')) LIKE '%' || ${search} || '%'
    )
    ORDER BY active.expiry_date ASC, active.email ASC, active.course_name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const items = (rows as ActiveEnrollmentDbRow[]).map(rowToActiveEnrollment);
  const total = rows[0] ? Number((rows[0] as ActiveEnrollmentDbRow).total_count ?? 0) : 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  return { items, page, pageSize, total, totalPages };
}

/** Paid orders for this student that still grant this Zenler course. */
export async function listOpenOrderIdsForCourse(
  customerId: number,
  zenlerCourseId: string,
): Promise<number[]> {
  await ensureCourseAccessClosures();
  const rows = await sql`
    SELECT DISTINCT po.id
    FROM sales s
    JOIN payment_orders po ON po.id = s.payment_order_id
    LEFT JOIN courses sc ON sc.id = s.course_id
    WHERE s.customer_id = ${customerId}
      AND po.status = 'Paid'
      AND s.expiry_date > NOW()
      AND (
        po.zenler_enrollment_status ILIKE 'enrolled%'
        OR po.zenler_enrollment_status = 'unenroll_failed'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM course_access_closures cac
        WHERE cac.payment_order_id = po.id
          AND cac.zenler_course_id = ${zenlerCourseId}
      )
      AND (
        EXISTS (
          SELECT 1
          FROM unnest(COALESCE(po.access_zenler_course_ids, ARRAY[]::text[])) AS zenler_id
          WHERE btrim(zenler_id) = ${zenlerCourseId}
        )
        OR (
          COALESCE(cardinality(po.access_zenler_course_ids), 0) = 0
          AND (
            btrim(COALESCE(po.zenler_course_id, '')) = ${zenlerCourseId}
            OR sc.zenler_course_id = ${zenlerCourseId}
          )
        )
      )
  `;
  return (rows as Array<{ id: number }>).map((row) => row.id);
}

export async function listClosedZenlerCourseIds(paymentOrderId: number): Promise<string[]> {
  await ensureCourseAccessClosures();
  const rows = await sql`
    SELECT zenler_course_id
    FROM course_access_closures
    WHERE payment_order_id = ${paymentOrderId}
  `;
  return (rows as Array<{ zenler_course_id: string }>).map((row) => row.zenler_course_id);
}

export async function recordCourseAccessClosure(
  paymentOrderId: number,
  zenlerCourseId: string,
): Promise<void> {
  await ensureCourseAccessClosures();
  await sql`
    INSERT INTO course_access_closures (payment_order_id, zenler_course_id)
    VALUES (${paymentOrderId}, ${zenlerCourseId})
    ON CONFLICT (payment_order_id, zenler_course_id) DO NOTHING
  `;
}
