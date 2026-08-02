import type { ZenlerStudentSyncResult } from '../../shared/types';
import { sql } from '../db/client';
import { upsertCustomer } from '../models/customer';
import { listAllZenlerStudents, zenlerCredentialsConfigured } from './zenlerApi';

/**
 * One-time / pre-launch backfill of Zenler learners into `customers`.
 * After go-live, new enrollments update customers via Stripe checkout + sale recording.
 */
export async function syncZenlerStudentsToCustomers(): Promise<ZenlerStudentSyncResult> {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const result: ZenlerStudentSyncResult = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const zenlerUsers = await listAllZenlerStudents();
  result.fetched = zenlerUsers.length;
  const syncedAt = new Date();

  for (const user of zenlerUsers) {
    const email = String(user.email ?? '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    try {
      const firstName = String(user.first_name ?? '').trim() || null;
      const lastName = String(user.last_name ?? '').trim() || null;
      const zenlerUserId = String(user.id ?? '').trim() || null;
      const existed = await customerExistsByEmail(email);

      await upsertCustomer({
        email,
        firstName,
        lastName,
        zenlerUserId,
        source: 'zenler_sync',
        lastZenlerSyncedAt: syncedAt,
      });

      if (existed) result.updated += 1;
      else result.created += 1;
    } catch (err) {
      result.skipped += 1;
      const message = err instanceof Error ? err.message : String(err);
      if (result.errors.length < 25) {
        result.errors.push(`${email}: ${message}`);
      }
    }
  }

  return result;
}

async function customerExistsByEmail(email: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM customers WHERE LOWER(email) = ${email} LIMIT 1
  `;
  return Boolean(rows[0]);
}
