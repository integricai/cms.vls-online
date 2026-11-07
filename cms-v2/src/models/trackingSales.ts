import { summarizePaidOrders, type PaidOrderFact, type TrackingSales } from '../../shared/ga4Report';
import { sql } from '../db/client';

type OrderRow = {
  course_title: string | null;
  currency: string | null;
  amount: string | number | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbc: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export async function loadTrackingSales(start: string, end: string): Promise<TrackingSales> {
  const rows = await sql`
    SELECT
      course_title,
      currency,
      amount,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      fbc,
      utm_source,
      utm_medium,
      utm_campaign
    FROM payment_orders
    WHERE paid_at IS NOT NULL
      AND checkout_environment = 'production'
      AND COALESCE(status, 'Paid') <> 'Refunded'
      AND (paid_at AT TIME ZONE 'Europe/London')::date >= CAST(${start} AS date)
      AND (paid_at AT TIME ZONE 'Europe/London')::date <= CAST(${end} AS date)
  ` as OrderRow[];

  const facts: PaidOrderFact[] = rows.map(row => ({
    courseTitle: row.course_title,
    currency: row.currency,
    amount: Number(row.amount) || 0,
    gclid: row.gclid,
    gbraid: row.gbraid,
    wbraid: row.wbraid,
    fbclid: row.fbclid,
    fbc: row.fbc,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
  }));
  return summarizePaidOrders(facts);
}
