import { listSessionOrdersDueForExpiry } from '../models/paymentOrder';
import {
  listSalesNeedingSessionBackfill,
  markSaleSessionChecked,
  saveBackfilledExamSession,
} from '../models/sale';
import { examSessionForCoursePrice } from './courseDisplayPricing';
import { expireZenlerAccessForSessionOrder } from './zenlerEnrollmentEnsure';
import {
  parseSessionLabel,
  sessionAccessDayCount,
  sessionAccessEndsAt,
} from '../../shared/sessionAccess';

export type SessionExpiryResult = {
  selected: number;
  expired: number;
  failed: number;
};

/** Fill sittings on older sales, then unenroll students whose 15th has ended. */
export async function expireDueSessionEnrollments(): Promise<SessionExpiryResult> {
  await backfillExamSessions();
  const orders = await listSessionOrdersDueForExpiry();
  let expired = 0;
  let failed = 0;
  for (const order of orders) {
    try {
      const closed = await expireZenlerAccessForSessionOrder(order);
      if (closed) expired += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error('[session-expiry] unenroll failed', order.id, err);
    }
  }
  return { selected: orders.length, expired, failed };
}

/** Older session purchases stored a catalogue length. Record the sitting they were shown. */
async function backfillExamSessions(): Promise<void> {
  const rows = await listSalesNeedingSessionBackfill(200);
  for (const row of rows) {
    try {
      const session = parseSessionLabel(row.optionType)
        ?? (row.coursePriceId
          ? await examSessionForCoursePrice(row.courseId, row.qualification, row.coursePriceId, row.soldAt)
          : null);
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
    }
  }
}
