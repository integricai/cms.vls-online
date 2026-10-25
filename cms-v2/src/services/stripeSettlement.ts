import type { CheckoutEnvironment } from '../../shared/types';
import { sql } from '../db/client';
import { savePaymentOrderSettlement } from '../models/paymentOrder';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { stripeSecretKeyForEnvironment } from './stripeCheckout';
import { parseStripeSettlement } from './stripeSettlementParse';

const FEE_BATCH = 40;

interface MissingFeeRow {
  id: number;
  payment_order_id: number;
  payment_id: string | null;
  checkout_environment: string | null;
}

function otherEnvironment(environment: CheckoutEnvironment): CheckoutEnvironment {
  return environment === 'production' ? 'staging' : 'production';
}

async function stripeGet(secretKey: string, path: string): Promise<unknown> {
  const response = await fetchWithTimeout(`https://api.stripe.com/v1${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
    timeoutMs: 20_000,
  });
  const body = await response.json() as { error?: { message?: string } };
  if (!response.ok) {
    const message = body.error?.message ?? `Stripe request failed (${response.status})`;
    const error = new Error(message) as Error & { missing?: boolean };
    if (response.status === 404 || /no such/i.test(message)) error.missing = true;
    throw error;
  }
  return body;
}

async function lookupOnce(paymentIntentId: string, environment: CheckoutEnvironment) {
  const secretKey = stripeSecretKeyForEnvironment(environment);
  const body = await stripeGet(
    secretKey,
    `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge.balance_transaction`,
  );
  return parseStripeSettlement(body);
}

/**
 * Stripe fees are not on the payment webhook. Read the balance transaction once
 * and store it. A live payment recorded against the test key is tried once on the other key.
 */
export async function lookupStripeSettlement(paymentIntentId: string, environment: CheckoutEnvironment) {
  try {
    return await lookupOnce(paymentIntentId, environment);
  } catch (err) {
    const missing = Boolean((err as { missing?: boolean }).missing);
    if (!missing) throw err;
    return lookupOnce(paymentIntentId, otherEnvironment(environment));
  }
}

async function missingFeeRows(fromDate: string, toDate: string): Promise<MissingFeeRow[]> {
  const rows = await sql`
    SELECT
      s.id,
      s.payment_order_id,
      COALESCE(po.stripe_payment_intent_id, po.provider_payment_id) AS payment_id,
      po.checkout_environment
    FROM sales s
    JOIN payment_orders po ON po.id = s.payment_order_id
    WHERE po.processor_fee IS NULL
      AND COALESCE(po.provider, 'stripe') <> 'paypal'
      AND COALESCE(po.stripe_payment_intent_id, po.provider_payment_id) IS NOT NULL
      AND (s.sold_at AT TIME ZONE 'Europe/London')::date >= CAST(${fromDate} AS date)
      AND (s.sold_at AT TIME ZONE 'Europe/London')::date <= CAST(${toDate} AS date)
    ORDER BY s.sold_at DESC, s.id DESC
    LIMIT ${FEE_BATCH}
  `;
  return rows as MissingFeeRow[];
}

export async function countMissingStripeFees(fromDate: string, toDate: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS remaining
    FROM sales s
    JOIN payment_orders po ON po.id = s.payment_order_id
    WHERE po.processor_fee IS NULL
      AND COALESCE(po.provider, 'stripe') <> 'paypal'
      AND COALESCE(po.stripe_payment_intent_id, po.provider_payment_id) IS NOT NULL
      AND (s.sold_at AT TIME ZONE 'Europe/London')::date >= CAST(${fromDate} AS date)
      AND (s.sold_at AT TIME ZONE 'Europe/London')::date <= CAST(${toDate} AS date)
  `;
  return Number((rows[0] as { remaining: number } | undefined)?.remaining ?? 0);
}

/** Fills up to one batch. PayPal-only sales are left blank. */
export async function syncStripeFees(fromDate: string, toDate: string): Promise<number> {
  const rows = await missingFeeRows(fromDate, toDate);
  let updated = 0;
  const queue = [...rows];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row?.payment_id) continue;
      const environment: CheckoutEnvironment = row.checkout_environment === 'production' ? 'production' : 'staging';
      try {
        const settlement = await lookupStripeSettlement(row.payment_id, environment);
        if (!settlement) continue;
        await savePaymentOrderSettlement(row.payment_order_id, {
          processorFee: settlement.fee,
          netAmount: settlement.net,
          paymentMethod: settlement.paymentMethod,
        });
        updated += 1;
      } catch (err) {
        console.error('[sales] stripe fee lookup failed', row.payment_order_id, err instanceof Error ? err.message : err);
      }
    }
  });
  await Promise.all(workers);
  return updated;
}
