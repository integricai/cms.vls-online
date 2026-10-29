import { listSessionOrdersDueForExpiry } from '../models/paymentOrder';
import {
  countNamedSessionBackfill,
  listSalesNeedingSessionBackfill,
  markSaleSessionChecked,
  noteSessionBackfillFailure,
  saveBackfilledExamSession,
} from '../models/sale';
import { expireZenlerAccessForSessionOrder } from './zenlerEnrollmentEnsure';
import {
  normalizeExamSession,
  parseSessionLabel,
  sessionAccessDayCount,
  sessionAccessEndsAt,
} from '../../shared/sessionAccess';

const BACKFILL_BATCH = 25;
const EXPIRY_BATCH = 10;

export type SessionExpiryResult = {
  selected: number;
  expired: number;
  /** First time an enrolment failed to unenroll. Retries are not included. */
  failed: number;
  retryFailed: number;
};

/** Copy sittings already named on the order, then unenroll students whose 15th has ended. */
export async function expireDueSessionEnrollments(): Promise<SessionExpiryResult> {
  await backfillExamSessions();
  const orders = await listSessionOrdersDueForExpiry(EXPIRY_BATCH);
  let expired = 0;
  let failed = 0;
  let retryFailed = 0;
  for (const order of orders) {
    try {
      const outcome = await expireZenlerAccessForSessionOrder(order);
      if (outcome === 'first_failure') failed += 1;
      else if (outcome === 'retry_failure') retryFailed += 1;
      else expired += 1;
    } catch (err) {
      console.error('[session-expiry] unenroll failed before Zenler answered', order.id, err);
    }
  }
  return { selected: orders.length, expired, failed, retryFailed };
}

function sessionBackfillWritesEnabled(): boolean {
  const value = String(process.env.SESSION_BACKFILL_APPLY ?? '').trim().toLowerCase();
  return value === '1' || value === 'true';
}

/**
 * Older sales keep the catalogue length unless the order itself names the sitting.
 * Prices and offer rules are not consulted, because those can change after the sale.
 * Nothing is written until SESSION_BACKFILL_APPLY=true.
 */
async function backfillExamSessions(): Promise<void> {
  const named = await countNamedSessionBackfill();
  const write = sessionBackfillWritesEnabled();
  console.log(
    `[session-expiry] ${named} named sittings would be shortened`
    + (write ? '' : '; not writing until SESSION_BACKFILL_APPLY=true'),
  );
  if (!write) return;
  const rows = await listSalesNeedingSessionBackfill(BACKFILL_BATCH);
  for (const row of rows) {
    try {
      const session = normalizeExamSession(row.orderSessionMonth, row.orderSessionYear)
        ?? parseSessionLabel(row.optionType);
      if (!session) {
        await markSaleSessionChecked(row.saleId);
        continue;
      }
      const endsAt = sessionAccessEndsAt(session.month, session.year);
      if (endsAt.getTime() <= row.soldAt.getTime()) {
        await markSaleSessionChecked(row.saleId);
        continue;
      }
      await saveBackfilledExamSession({
        saleId: row.saleId,
        orderId: row.orderId,
        sessionMonth: session.month,
        sessionYear: session.year,
        durationDays: Math.max(sessionAccessDayCount(row.soldAt, session.month, session.year), 1),
        expiryDate: endsAt,
      });
    } catch (err) {
      console.error('[session-expiry] backfill failed', row.saleId, err);
      try {
        await noteSessionBackfillFailure(row.saleId);
      } catch (noteErr) {
        console.error('[session-expiry] could not record the backfill failure', row.saleId, noteErr);
      }
    }
  }
}
