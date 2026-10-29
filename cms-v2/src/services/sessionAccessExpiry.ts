import { listSessionOrdersDueForExpiry } from '../models/paymentOrder';
import { expireZenlerAccessForSessionOrder } from './zenlerEnrollmentEnsure';

export type SessionExpiryResult = {
  selected: number;
  expired: number;
  failed: number;
};

/** Unenroll students whose exam sitting ended on the 15th. */
export async function expireDueSessionEnrollments(): Promise<SessionExpiryResult> {
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
