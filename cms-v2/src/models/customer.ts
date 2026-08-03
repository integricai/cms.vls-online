import { sql } from '../db/client';
import type {
  Customer,
  CustomerSource,
  StudentDetail,
  StudentListItem,
  StudentListPage,
  StudentPurchaseFilter,
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
  total_count?: string | number;
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
  hasPurchased?: StudentPurchaseFilter;
  examStatus?: string;
  page?: number;
  pageSize?: number;
  /** When true, ignore pagination and return all matching rows (admin exports / bulk email). */
  unbounded?: boolean;
};

export async function listStudents(filters: ListStudentsFilters = {}): Promise<StudentListPage> {
  const search = filters.search?.trim().toLowerCase() || null;
  const courseId = filters.courseId ?? null;
  const newsletter = filters.newsletter ?? 'all';
  const hasRefund = filters.hasRefund === true;
  const hasPurchased = filters.hasPurchased ?? 'all';
  const examStatus = filters.examStatus?.trim() || null;
  const unbounded = filters.unbounded === true;
  const pageSize = unbounded
    ? 100000
    : Math.min(100, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const page = unbounded ? 1 : Math.max(1, Number(filters.page ?? 1) || 1);
  const offset = (page - 1) * pageSize;

  const rows = await sql`
    SELECT
      cu.*,
      COALESCE(stats.purchase_count, 0) AS purchase_count,
      COALESCE(stats.refund_count, 0) AS refund_count,
      course_stats.course_names,
      COUNT(*) OVER() AS total_count
    FROM customers cu
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE po.status = 'Paid')::int AS purchase_count,
        COUNT(*) FILTER (WHERE po.status = 'Refunded')::int AS refund_count
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE s.customer_id = cu.id
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT x.name) FILTER (WHERE x.name IS NOT NULL) AS course_names
      FROM (
        SELECT c.name
        FROM sales s
        JOIN courses c ON c.id = s.course_id
        WHERE s.customer_id = cu.id
        UNION
        SELECT c.name
        FROM customer_course_status ccs
        JOIN courses c ON c.id = ccs.course_id
        WHERE ccs.customer_id = cu.id
      ) x
    ) course_stats ON TRUE
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
      ${hasPurchased}::text = 'all'
      OR (
        ${hasPurchased}::text = 'yes'
        AND (
          COALESCE(stats.purchase_count, 0) > 0
          OR EXISTS (
            SELECT 1 FROM customer_course_status ccs_has
            WHERE ccs_has.customer_id = cu.id
          )
        )
      )
      OR (${hasPurchased}::text = 'cms' AND COALESCE(stats.purchase_count, 0) > 0)
      OR (
        ${hasPurchased}::text = 'no'
        AND COALESCE(stats.purchase_count, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM customer_course_status ccs_no
          WHERE ccs_no.customer_id = cu.id
        )
      )
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
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const items = (rows as StudentListDbRow[]).map(rowToStudentListItem);
  const total = rows[0] ? Number((rows[0] as StudentListDbRow).total_count ?? 0) : 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getStudentDetail(id: number): Promise<StudentDetail | null> {
  const rows = await sql`
    SELECT
      cu.*,
      COALESCE(stats.purchase_count, 0) AS purchase_count,
      COALESCE(stats.refund_count, 0) AS refund_count,
      course_stats.course_names
    FROM customers cu
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE po.status = 'Paid')::int AS purchase_count,
        COUNT(*) FILTER (WHERE po.status = 'Refunded')::int AS refund_count
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE s.customer_id = cu.id
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT x.name) FILTER (WHERE x.name IS NOT NULL) AS course_names
      FROM (
        SELECT c.name
        FROM sales s
        JOIN courses c ON c.id = s.course_id
        WHERE s.customer_id = cu.id
        UNION
        SELECT c.name
        FROM customer_course_status ccs
        JOIN courses c ON c.id = ccs.course_id
        WHERE ccs.customer_id = cu.id
      ) x
    ) course_stats ON TRUE
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
