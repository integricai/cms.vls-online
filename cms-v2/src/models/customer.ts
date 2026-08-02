import { sql } from '../db/client';
import type {
  Customer,
  CustomerSource,
  StudentDetail,
  StudentListItem,
} from '../../shared/types';
import { listCourseSummariesForCustomer } from './customerCourseStatus';

interface DbRow {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country_code: string | null;
  zenler_user_id: string | null;
  stripe_customer_id: string | null;
  newsletter_subscribed: boolean;
  newsletter_subscribed_at: Date | null;
  mailerlite_subscriber_id: string | null;
  source: CustomerSource | null;
  last_zenler_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface StudentListDbRow extends DbRow {
  purchase_count: string | number;
  refund_count: string | number;
  course_names: string[] | null;
}

function rowToCustomer(row: DbRow): Customer {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    countryCode: row.country_code,
    zenlerUserId: row.zenler_user_id,
    stripeCustomerId: row.stripe_customer_id,
    newsletterSubscribed: Boolean(row.newsletter_subscribed),
    newsletterSubscribedAt: row.newsletter_subscribed_at,
    mailerliteSubscriberId: row.mailerlite_subscriber_id,
    source: row.source,
    lastZenlerSyncedAt: row.last_zenler_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStudentListItem(row: StudentListDbRow): StudentListItem {
  const customer = rowToCustomer(row);
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    countryCode: customer.countryCode,
    zenlerUserId: customer.zenlerUserId,
    stripeCustomerId: customer.stripeCustomerId,
    newsletterSubscribed: customer.newsletterSubscribed,
    newsletterSubscribedAt: customer.newsletterSubscribedAt,
    source: customer.source,
    lastZenlerSyncedAt: customer.lastZenlerSyncedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    purchaseCount: Number(row.purchase_count ?? 0),
    refundCount: Number(row.refund_count ?? 0),
    courseNames: Array.isArray(row.course_names)
      ? row.course_names.filter((name): name is string => Boolean(name))
      : [],
  };
}

export function splitStudentName(name: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`;
  return rows[0] ? rowToCustomer(rows[0] as DbRow) : null;
}

export async function upsertCustomer(data: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  zenlerUserId?: string | null;
  stripeCustomerId?: string | null;
  source?: CustomerSource | null;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: Date | null;
  mailerliteSubscriberId?: string | null;
  lastZenlerSyncedAt?: Date | null;
}): Promise<Customer> {
  const email = data.email.trim().toLowerCase();
  if (!email) throw new Error('Customer email is required');

  const newsletterSubscribed = data.newsletterSubscribed ?? null;
  const newsletterSubscribedAt = data.newsletterSubscribedAt ?? null;
  const mailerliteSubscriberId = data.mailerliteSubscriberId ?? null;
  const lastZenlerSyncedAt = data.lastZenlerSyncedAt ?? null;
  const source = data.source ?? null;

  const rows = await sql`
    INSERT INTO customers (
      email, first_name, last_name, phone, country_code, zenler_user_id, stripe_customer_id,
      newsletter_subscribed, newsletter_subscribed_at, mailerlite_subscriber_id, source,
      last_zenler_synced_at
    )
    VALUES (
      ${email},
      ${data.firstName ?? null},
      ${data.lastName ?? null},
      ${data.phone ?? null},
      ${data.countryCode ?? null},
      ${data.zenlerUserId ?? null},
      ${data.stripeCustomerId ?? null},
      ${newsletterSubscribed ?? false},
      ${newsletterSubscribedAt},
      ${mailerliteSubscriberId},
      ${source},
      ${lastZenlerSyncedAt}
    )
    ON CONFLICT ((LOWER(email)))
    DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
      last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      country_code = COALESCE(EXCLUDED.country_code, customers.country_code),
      zenler_user_id = COALESCE(EXCLUDED.zenler_user_id, customers.zenler_user_id),
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, customers.stripe_customer_id),
      newsletter_subscribed = CASE
        WHEN ${newsletterSubscribed}::boolean IS NULL THEN customers.newsletter_subscribed
        ELSE EXCLUDED.newsletter_subscribed
      END,
      newsletter_subscribed_at = COALESCE(EXCLUDED.newsletter_subscribed_at, customers.newsletter_subscribed_at),
      mailerlite_subscriber_id = COALESCE(EXCLUDED.mailerlite_subscriber_id, customers.mailerlite_subscriber_id),
      source = COALESCE(customers.source, EXCLUDED.source),
      last_zenler_synced_at = COALESCE(EXCLUDED.last_zenler_synced_at, customers.last_zenler_synced_at),
      updated_at = NOW()
    RETURNING *
  `;
  return rowToCustomer(rows[0] as DbRow);
}

export async function updateCustomerZenlerUserId(
  customerId: number,
  zenlerUserId: string | null,
): Promise<void> {
  await sql`
    UPDATE customers
    SET zenler_user_id = ${zenlerUserId},
        updated_at = NOW()
    WHERE id = ${customerId}
  `;
}

export type ListStudentsFilters = {
  search?: string;
  courseId?: number;
  newsletter?: 'all' | 'subscribed' | 'unsubscribed';
  hasRefund?: boolean;
  examStatus?: string;
};

export async function listStudents(filters: ListStudentsFilters = {}): Promise<StudentListItem[]> {
  const search = filters.search?.trim().toLowerCase() || null;
  const courseId = filters.courseId ?? null;
  const newsletter = filters.newsletter ?? 'all';
  const hasRefund = filters.hasRefund === true;
  const examStatus = filters.examStatus?.trim() || null;

  const rows = await sql`
    SELECT
      cu.*,
      COALESCE(stats.purchase_count, 0) AS purchase_count,
      COALESCE(stats.refund_count, 0) AS refund_count,
      stats.course_names
    FROM customers cu
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE po.status = 'Paid')::int AS purchase_count,
        COUNT(*) FILTER (WHERE po.status = 'Refunded')::int AS refund_count,
        ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) AS course_names
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.customer_id = cu.id
    ) stats ON TRUE
    WHERE (
      ${search}::text IS NULL
      OR LOWER(cu.email) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(cu.first_name, '')) LIKE '%' || ${search} || '%'
      OR LOWER(COALESCE(cu.last_name, '')) LIKE '%' || ${search} || '%'
    )
    AND (
      ${courseId}::int IS NULL
      OR EXISTS (
        SELECT 1 FROM sales s2
        WHERE s2.customer_id = cu.id AND s2.course_id = ${courseId}
      )
      OR EXISTS (
        SELECT 1 FROM customer_course_status ccs
        WHERE ccs.customer_id = cu.id AND ccs.course_id = ${courseId}
      )
    )
    AND (
      ${newsletter}::text = 'all'
      OR (${newsletter}::text = 'subscribed' AND cu.newsletter_subscribed = TRUE)
      OR (${newsletter}::text = 'unsubscribed' AND cu.newsletter_subscribed = FALSE)
    )
    AND (
      ${hasRefund}::boolean = FALSE
      OR COALESCE(stats.refund_count, 0) > 0
    )
    AND (
      ${examStatus}::text IS NULL
      OR EXISTS (
        SELECT 1 FROM customer_course_status ccs2
        WHERE ccs2.customer_id = cu.id
          AND ccs2.exam_status = ${examStatus}
      )
    )
    ORDER BY cu.updated_at DESC, cu.id DESC
  `;

  return (rows as StudentListDbRow[]).map(rowToStudentListItem);
}

export async function getStudentDetail(id: number): Promise<StudentDetail | null> {
  const rows = await sql`
    SELECT
      cu.*,
      COALESCE(stats.purchase_count, 0) AS purchase_count,
      COALESCE(stats.refund_count, 0) AS refund_count,
      stats.course_names
    FROM customers cu
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE po.status = 'Paid')::int AS purchase_count,
        COUNT(*) FILTER (WHERE po.status = 'Refunded')::int AS refund_count,
        ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) AS course_names
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.customer_id = cu.id
    ) stats ON TRUE
    WHERE cu.id = ${id}
  `;

  const row = rows[0] as StudentListDbRow | undefined;
  if (!row) return null;

  const base = rowToStudentListItem(row);
  const courses = await listCourseSummariesForCustomer(id);

  return {
    ...base,
    mailerliteSubscriberId: row.mailerlite_subscriber_id,
    courses,
  };
}
