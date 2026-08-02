import { sql } from '../db/client';
import type {
  CustomerCourseStatus,
  ExamStatus,
  ExamStatusSource,
  PaymentOrderStatus,
  StudentCourseSummary,
} from '../../shared/types';

interface DbRow {
  id: number;
  customer_id: number;
  course_id: number;
  exam_status: ExamStatus;
  exam_status_updated_at: Date | null;
  exam_status_source: ExamStatusSource | null;
  created_at: Date;
  updated_at: Date;
}

interface CourseSummaryDbRow {
  course_id: number;
  course_name: string | null;
  zenler_course_id: string | null;
  payment_status: PaymentOrderStatus | null;
  sale_id: number | null;
  sold_at: Date | null;
  refunded_at: Date | null;
  exam_status: ExamStatus | null;
  exam_status_updated_at: Date | null;
  exam_status_source: ExamStatusSource | null;
}

export function rowToCustomerCourseStatus(row: DbRow): CustomerCourseStatus {
  return {
    id: row.id,
    customerId: row.customer_id,
    courseId: row.course_id,
    examStatus: row.exam_status,
    examStatusUpdatedAt: row.exam_status_updated_at,
    examStatusSource: row.exam_status_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Ensure a per-course status row exists (exam unknown by default). */
export async function ensureCustomerCourseStatus(
  customerId: number,
  courseId: number,
): Promise<CustomerCourseStatus> {
  const rows = await sql`
    INSERT INTO customer_course_status (customer_id, course_id, exam_status)
    VALUES (${customerId}, ${courseId}, 'unknown')
    ON CONFLICT (customer_id, course_id)
    DO UPDATE SET updated_at = customer_course_status.updated_at
    RETURNING *
  `;
  return rowToCustomerCourseStatus(rows[0] as DbRow);
}

const VALID_EXAM_STATUSES: ExamStatus[] = ['unknown', 'awaiting_result', 'passed', 'failed'];

export function parseExamStatus(value: unknown): ExamStatus | null {
  const status = String(value ?? '').trim() as ExamStatus;
  return VALID_EXAM_STATUSES.includes(status) ? status : null;
}

export async function setCustomerExamStatus(input: {
  customerId: number;
  courseId: number;
  examStatus: ExamStatus;
  examStatusSource: ExamStatusSource;
}): Promise<CustomerCourseStatus> {
  const rows = await sql`
    INSERT INTO customer_course_status (
      customer_id, course_id, exam_status, exam_status_updated_at, exam_status_source
    )
    VALUES (
      ${input.customerId},
      ${input.courseId},
      ${input.examStatus},
      NOW(),
      ${input.examStatusSource}
    )
    ON CONFLICT (customer_id, course_id)
    DO UPDATE SET
      exam_status = EXCLUDED.exam_status,
      exam_status_updated_at = NOW(),
      exam_status_source = EXCLUDED.exam_status_source,
      updated_at = NOW()
    RETURNING *
  `;
  return rowToCustomerCourseStatus(rows[0] as DbRow);
}

export async function listCourseSummariesForCustomer(
  customerId: number,
): Promise<StudentCourseSummary[]> {
  const rows = await sql`
    SELECT
      c.id AS course_id,
      c.name AS course_name,
      c.zenler_course_id,
      sale_info.payment_status,
      sale_info.sale_id,
      sale_info.sold_at,
      sale_info.refunded_at,
      COALESCE(ccs.exam_status, 'unknown') AS exam_status,
      ccs.exam_status_updated_at,
      ccs.exam_status_source
    FROM courses c
    INNER JOIN (
      SELECT DISTINCT course_id FROM sales WHERE customer_id = ${customerId}
      UNION
      SELECT course_id FROM customer_course_status WHERE customer_id = ${customerId}
    ) linked ON linked.course_id = c.id
    LEFT JOIN customer_course_status ccs
      ON ccs.customer_id = ${customerId} AND ccs.course_id = c.id
    LEFT JOIN LATERAL (
      SELECT
        s.id AS sale_id,
        s.sold_at,
        po.status AS payment_status,
        po.refunded_at
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE s.customer_id = ${customerId}
        AND s.course_id = c.id
      ORDER BY
        CASE WHEN po.status = 'Paid' THEN 0 WHEN po.status = 'Refunded' THEN 1 ELSE 2 END,
        s.sold_at DESC
      LIMIT 1
    ) sale_info ON TRUE
    ORDER BY COALESCE(sale_info.sold_at, ccs.updated_at, c.created_at) DESC NULLS LAST
  `;

  return (rows as CourseSummaryDbRow[]).map((row) => ({
    courseId: row.course_id,
    courseName: row.course_name,
    zenlerCourseId: row.zenler_course_id,
    paymentStatus: row.payment_status,
    saleId: row.sale_id,
    soldAt: row.sold_at,
    refundedAt: row.refunded_at,
    examStatus: row.exam_status ?? 'unknown',
    examStatusUpdatedAt: row.exam_status_updated_at,
    examStatusSource: row.exam_status_source,
  }));
}
