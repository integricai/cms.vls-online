import { sql } from '../db/client';

export interface Customer {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
  zenlerUserId: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbRow {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country_code: string | null;
  zenler_user_id: string | null;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
}): Promise<Customer> {
  const email = data.email.trim().toLowerCase();
  if (!email) throw new Error('Customer email is required');

  const rows = await sql`
    INSERT INTO customers (
      email, first_name, last_name, phone, country_code, zenler_user_id, stripe_customer_id
    )
    VALUES (
      ${email},
      ${data.firstName ?? null},
      ${data.lastName ?? null},
      ${data.phone ?? null},
      ${data.countryCode ?? null},
      ${data.zenlerUserId ?? null},
      ${data.stripeCustomerId ?? null}
    )
    ON CONFLICT ((LOWER(email)))
    DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
      last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      country_code = COALESCE(EXCLUDED.country_code, customers.country_code),
      zenler_user_id = COALESCE(EXCLUDED.zenler_user_id, customers.zenler_user_id),
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, customers.stripe_customer_id),
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
