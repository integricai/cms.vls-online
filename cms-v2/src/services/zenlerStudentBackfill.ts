import type { Customer, CustomerSource, ZenlerStudentSyncResult } from '../../shared/types';
import { sql } from '../db/client';
import {
  bootstrapStudentSyncProgressIfNeeded,
  getStudentSyncState,
  markStudentSyncFailed,
  markStudentSyncPageComplete,
  markStudentSyncRunning,
  markStudentSyncStopped,
} from '../models/studentSyncState';
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

export async function getZenlerStudentSyncStatus() {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }
  return bootstrapStudentSyncProgressIfNeeded(DEFAULT_PAGE_SIZE);
}

export async function stopZenlerStudentSync() {
  return markStudentSyncStopped();
}

/**
 * Process one Zenler page using persisted sync state.
 * action=continue resumes from last_completed_page+1
 * action=restart resets progress and starts at page 1
 */
export async function syncZenlerStudentsBatch(input: {
  action?: 'continue' | 'restart';
  pageSize?: number;
} = {}): Promise<ZenlerStudentSyncResult> {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const action = input.action === 'restart' ? 'restart' : 'continue';
  const pageSize = Math.min(
    100,
    Math.max(1, Number(input.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );

  // Estimate resume point from already-imported rows if state was never persisted.
  const bootstrapped = await bootstrapStudentSyncProgressIfNeeded(pageSize);

  const state = action === 'restart'
    ? await markStudentSyncRunning({ pageSize, reset: true })
    : await markStudentSyncRunning({ pageSize, reset: false });

  const page = action === 'restart' ? 1 : Math.max(1, state.lastCompletedPage + 1);
  const runningTotals = {
    fetched: action === 'restart' ? 0 : (state.fetched || bootstrapped.fetched),
    created: action === 'restart' ? 0 : state.created,
    updated: action === 'restart' ? 0 : state.updated,
    skipped: action === 'restart' ? 0 : state.skipped,
  };

  try {
    // Re-check stop flag right before Zenler fetch.
    const latest = await getStudentSyncState();
    if (latest.status === 'stopped') {
      return {
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        page: latest.lastCompletedPage,
        pageSize: latest.pageSize,
        totalPages: latest.totalPages ?? Math.max(1, latest.lastCompletedPage),
        nextPage: latest.nextPage,
        done: false,
        stopped: true,
        totals: {
          fetched: latest.fetched,
          created: latest.created,
          updated: latest.updated,
          skipped: latest.skipped,
        },
        syncState: latest,
      };
    }

    const batch = await listZenlerStudentsPage({ page, pageSize });
    const pageResult = {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };
    const syncedAt = new Date();

    for (const user of batch.items) {
      // Cooperative cancel: check periodically every 25 upserts.
      if (pageResult.fetched > 0 && pageResult.fetched % 25 === 0) {
        const maybeStopped = await getStudentSyncState();
        if (maybeStopped.status === 'stopped') {
          const partialTotals = {
            fetched: runningTotals.fetched + pageResult.fetched,
            created: runningTotals.created + pageResult.created,
            updated: runningTotals.updated + pageResult.updated,
            skipped: runningTotals.skipped + pageResult.skipped,
          };
          // Keep last fully completed page; do not advance mid-page.
          const syncState = await markStudentSyncStopped();
          return {
            ...pageResult,
            page: syncState.lastCompletedPage,
            pageSize,
            totalPages: batch.totalPages,
            nextPage: syncState.nextPage,
            done: false,
            stopped: true,
            totals: partialTotals,
            syncState,
          };
        }
      }

      const email = String(user.email ?? '').trim().toLowerCase();
      if (!email) {
        pageResult.skipped += 1;
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
        if (upserted.created) pageResult.created += 1;
        else pageResult.updated += 1;
        pageResult.fetched += 1;
      } catch (err) {
        pageResult.skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (pageResult.errors.length < 25) {
          pageResult.errors.push(`${email}: ${message}`);
        }
      }
    }

    const totals = {
      fetched: runningTotals.fetched + pageResult.fetched,
      created: runningTotals.created + pageResult.created,
      updated: runningTotals.updated + pageResult.updated,
      skipped: runningTotals.skipped + pageResult.skipped,
    };

    let totalPages = Math.max(1, batch.totalPages);
    let nextPage: number | null = null;
    let done = true;

    if (batch.items.length === 0) {
      nextPage = null;
      done = true;
      totalPages = Math.max(1, page > 1 ? page - 1 : 1);
    } else if (page < batch.totalPages) {
      nextPage = page + 1;
      done = false;
    } else if (batch.items.length >= batch.pageSize) {
      nextPage = page + 1;
      done = false;
      totalPages = Math.max(batch.totalPages, page + 1);
    } else {
      nextPage = null;
      done = true;
      totalPages = page;
    }

    // If stop was requested during the page, finish saving this page then mark stopped.
    const afterPage = await getStudentSyncState();
    const stopRequested = afterPage.status === 'stopped';

    const syncState = await markStudentSyncPageComplete({
      page,
      pageSize,
      totalPages,
      fetched: totals.fetched,
      created: totals.created,
      updated: totals.updated,
      skipped: totals.skipped,
      done: done && !stopRequested,
    });

    const finalState = stopRequested && !done
      ? await markStudentSyncStopped()
      : syncState;

    return {
      ...pageResult,
      page,
      pageSize,
      totalPages,
      nextPage: finalState.status === 'stopped' ? finalState.nextPage : nextPage,
      done: finalState.status === 'completed',
      stopped: finalState.status === 'stopped',
      totals,
      syncState: finalState,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const syncState = await markStudentSyncFailed(message);
    throw Object.assign(err instanceof Error ? err : new Error(message), { syncState });
  }
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
