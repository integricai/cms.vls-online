import { listSessionOrdersDueForExpiry } from '../models/paymentOrder';
import {
  listSalesNeedingSessionBackfill,
  listSessionBackfillSources,
  markSaleSessionChecked,
  noteSessionBackfillFailure,
  saveBackfilledExamSession,
  type SessionBackfillSource,
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
const EXPIRY_BUDGET_MS = 45_000;

let sessionBackfillPreviewClear = false;

export type SessionExpiryResult = {
  selected: number;
  expired: number;
  /** First time an enrolment failed to unenroll. Retries are not included. */
  failed: number;
  retryFailed: number;
};

/** Copy sittings already named on the order, then unenroll students whose 15th has ended. */
export async function expireDueSessionEnrollments(): Promise<SessionExpiryResult> {
  const writeBackfill = sessionBackfillWritesEnabled();
  await backfillExamSessions(writeBackfill);
  const started = Date.now();
  const orders = await listSessionOrdersDueForExpiry(EXPIRY_BATCH, writeBackfill);
  let expired = 0;
  let failed = 0;
  let retryFailed = 0;
  for (const order of orders) {
    if (Date.now() - started > EXPIRY_BUDGET_MS) break;
    try {
      const outcome = await expireZenlerAccessForSessionOrder(order, started + EXPIRY_BUDGET_MS);
      if (outcome === 'first_failure') failed += 1;
      else if (outcome === 'retry_failure') retryFailed += 1;
      else if (outcome !== 'stopped') expired += 1;
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
async function backfillExamSessions(write: boolean): Promise<void> {
  if (sessionBackfillPreviewClear && !write) return;
  const preview = previewNamedSittings(await listSessionBackfillSources());
  if (preview.toShorten.length === 0 && preview.alreadyCut.length === 0) {
    sessionBackfillPreviewClear = true;
    if (!write) return;
  } else {
    sessionBackfillPreviewClear = false;
    console.log(
      `[session-expiry] ${preview.toShorten.length} named sittings would be shortened`
      + ` (orders ${formatOrderIds(preview.toShorten)}).`
      + ` ${preview.alreadyCut.length} were already shortened`
      + ` (orders ${formatOrderIds(preview.alreadyCut)}).`
      + ` ${preview.loseAccessNow.length} would lose access now because the 15th has passed`
      + ` (orders ${formatOrderIds(preview.loseAccessNow)})`
      + (write ? '' : '. Not writing or unenrolling those until SESSION_BACKFILL_APPLY=true'),
    );
  }
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

function formatOrderIds(orderIds: number[]): string {
  if (orderIds.length === 0) return 'none';
  const shown = orderIds.slice(0, 50);
  const extra = orderIds.length - shown.length;
  return shown.join(', ') + (extra > 0 ? `, and ${extra} more` : '');
}

/** Same sitting rules as the writer. SQL does not parse month names. */
function previewNamedSittings(rows: SessionBackfillSource[]): {
  toShorten: number[];
  alreadyCut: number[];
  loseAccessNow: number[];
} {
  const toShorten: number[] = [];
  const alreadyCut: number[] = [];
  const loseAccessNow: number[] = [];
  const seen = new Set<number>();
  const now = Date.now();
  for (const row of rows) {
    if (seen.has(row.orderId)) continue;
    const session = normalizeExamSession(row.saleSessionMonth, row.saleSessionYear)
      ?? normalizeExamSession(row.orderSessionMonth, row.orderSessionYear)
      ?? parseSessionLabel(row.optionType);
    if (!session) continue;
    const endsAt = sessionAccessEndsAt(session.month, session.year).getTime();
    const soldAt = row.soldAt instanceof Date ? row.soldAt.getTime() : new Date(row.soldAt).getTime();
    const alreadyWritten = row.saleSessionMonth != null;
    if (!alreadyWritten && endsAt <= soldAt) continue;
    seen.add(row.orderId);
    if (alreadyWritten) alreadyCut.push(row.orderId);
    else toShorten.push(row.orderId);
    if (endsAt <= now) loseAccessNow.push(row.orderId);
  }
  return { toShorten, alreadyCut, loseAccessNow };
}
