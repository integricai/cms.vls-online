import type { Customer, CustomerSource, ZenlerStudentSyncResult } from '../../shared/types';
import { sql } from '../db/client';
import { listZenlerStudentsPage, zenlerCredentialsConfigured } from './zenlerApi';

const DEFAULT_PAGE_SIZE = 50;

interface UpsertRow {
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
  inserted: boolean;
}

/**
 * One-time / pre-launch backfill of Zenler learners into `customers`.
 * Processes a single Zenler page per call so the request stays under platform timeouts.
 * After go-live, new enrollments update customers via Stripe checkout + sale recording.
 */
export async function syncZenlerStudentsPage(input: {
  page?: number;
  pageSize?: number;
  totals?: {
    fetched?: number;
    created?: number;
    updated?: number;
    skipped?: number;
  };
} = {}): Promise<ZenlerStudentSyncResult> {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const page = Math.max(1, Number(input.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(input.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );
  const running = {
    fetched: Number(input.totals?.fetched ?? 0) || 0,
    created: Number(input.totals?.created ?? 0) || 0,
    updated: Number(input.totals?.updated ?? 0) || 0,
    skipped: Number(input.totals?.skipped ?? 0) || 0,
  };

  const batch = await listZenlerStudentsPage({ page, pageSize });
  const result: ZenlerStudentSyncResult = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    page: batch.page,
    pageSize: batch.pageSize,
    totalPages: Math.max(1, batch.totalPages),
    nextPage: null,
    done: true,
    totals: { ...running },
  };

  const syncedAt = new Date();

  for (const user of batch.items) {
    const email = String(user.email ?? '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    try {
      const firstName = String(user.first_name ?? '').trim() || null;
      const lastName = String(user.last_name ?? '').trim() || null;
      const zenlerUserId = String(user.id ?? '').trim() || null;
      const upserted = await upsertZenlerCustomer({
        email,
        firstName,
        lastName,
        zenlerUserId,
        syncedAt,
      });

      if (upserted.created) result.created += 1;
      else result.updated += 1;
      result.fetched += 1;
    } catch (err) {
      result.skipped += 1;
      const message = err instanceof Error ? err.message : String(err);
      if (result.errors.length < 25) {
        result.errors.push(`${email}: ${message}`);
      }
    }
  }

  result.totals = {
    fetched: running.fetched + result.fetched,
    created: running.created + result.created,
    updated: running.updated + result.updated,
    skipped: running.skipped + result.skipped,
  };

  if (batch.items.length === 0) {
    result.nextPage = null;
    result.done = true;
    result.totalPages = Math.max(1, batch.page > 1 ? batch.page - 1 : 1);
  } else if (batch.page < batch.totalPages) {
    result.nextPage = batch.page + 1;
    result.done = false;
  } else if (batch.items.length >= batch.pageSize) {
    // total_pages may be missing/under-reported; let the client probe the next page.
    result.nextPage = batch.page + 1;
    result.done = false;
    result.totalPages = Math.max(batch.totalPages, batch.page + 1);
  } else {
    result.nextPage = null;
    result.done = true;
    result.totalPages = batch.page;
  }

  return result;
}

async function upsertZenlerCustomer(input: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  zenlerUserId: string | null;
  syncedAt: Date;
}): Promise<{ customer: Customer; created: boolean }> {
  const rows = await sql`
    INSERT INTO customers (
      email, first_name, last_name, zenler_user_id, source, last_zenler_synced_at
    )
    VALUES (
      ${input.email},
      ${input.firstName},
      ${input.lastName},
      ${input.zenlerUserId},
      ${'zenler_sync'},
      ${input.syncedAt}
    )
    ON CONFLICT ((LOWER(email)))
    DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
      last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
      zenler_user_id = COALESCE(EXCLUDED.zenler_user_id, customers.zenler_user_id),
      source = COALESCE(customers.source, EXCLUDED.source),
      last_zenler_synced_at = EXCLUDED.last_zenler_synced_at,
      updated_at = NOW()
    RETURNING *, (xmax = 0) AS inserted
  `;

  const row = rows[0] as UpsertRow;
  return {
    customer: {
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
    },
    created: Boolean(row.inserted),
  };
}
