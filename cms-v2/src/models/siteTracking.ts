import { sql } from '../db/client';
import { eachIsoDay, dashboardRangeBounds, type DashboardRange } from '../../shared/salesFormat';
import type { TrackingReport } from '../../shared/siteTracking';
import { siteVisitorKey } from './siteAnalytics';
import type { ClassifiedTrackingVisit } from '../services/siteTracking';

type CountRow = { label: string | null; visitors: number };
type SourceRow = { source: string | null; medium: string | null; visitors: number };
type DayRow = { date: string | Date; visitors: number };
type EnrolmentRow = { campaign: string | null; currency: string | null; orders: number; amount: string | number };

function isoDay(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function counts(rows: CountRow[], emptyLabel: string): TrackingReport['channels'] {
  return rows.map(row => ({
    label: row.label?.trim() || emptyLabel,
    visitors: Number(row.visitors) || 0,
  }));
}

export async function recordTrackingVisit(
  ip: string,
  userAgent: string,
  visit: ClassifiedTrackingVisit,
  country: string | null,
  now = new Date(),
): Promise<void> {
  const visitedOn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const visitorKey = siteVisitorKey(ip, userAgent);
  await sql`
    INSERT INTO site_tracking_visits (
      visited_on, visitor_key, channel, source, medium, campaign, content, term,
      landing_path, country, device, locale
    ) VALUES (
      CAST(${visitedOn} AS date),
      ${visitorKey},
      ${visit.channel},
      ${visit.source},
      ${visit.medium},
      ${visit.campaign},
      ${visit.content},
      ${visit.term},
      ${visit.landingPath},
      ${country},
      ${visit.device},
      ${visit.locale}
    )
    ON CONFLICT (visited_on, visitor_key) DO NOTHING
  `;
}

export async function buildTrackingReport(range: DashboardRange, now = new Date()): Promise<TrackingReport> {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const bounds = dashboardRangeBounds(range, today);
  const [dayRows, channelRows, campaignRows, landingRows, countryRows, sourceRows, deviceRows, localeRows, enrolmentRows] = await Promise.all([
    sql`
      SELECT visited_on::text AS date, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY visited_on
      ORDER BY visited_on
    `,
    sql`
      SELECT channel AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY channel
      ORDER BY visitors DESC, channel
    `,
    sql`
      SELECT campaign AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
        AND campaign IS NOT NULL
      GROUP BY campaign
      ORDER BY visitors DESC, campaign
      LIMIT 12
    `,
    sql`
      SELECT landing_path AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY landing_path
      ORDER BY visitors DESC, landing_path
      LIMIT 12
    `,
    sql`
      SELECT country AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY country
      ORDER BY visitors DESC, country
      LIMIT 12
    `,
    sql`
      SELECT source, medium, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
        AND (source IS NOT NULL OR medium IS NOT NULL)
      GROUP BY source, medium
      ORDER BY visitors DESC, source, medium
      LIMIT 12
    `,
    sql`
      SELECT device AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY device
      ORDER BY visitors DESC, device
    `,
    sql`
      SELECT locale AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY locale
      ORDER BY visitors DESC, locale
    `,
    sql`
      SELECT
        COALESCE(NULLIF(BTRIM(utm_campaign), ''), NULLIF(BTRIM(gad_campaign_id), '')) AS campaign,
        currency,
        COUNT(*)::int AS orders,
        COALESCE(SUM(amount), 0) AS amount
      FROM payment_orders
      WHERE paid_at IS NOT NULL
        AND checkout_environment = 'production'
        AND COALESCE(status, 'Paid') <> 'Refunded'
        AND (paid_at AT TIME ZONE 'Europe/London')::date >= CAST(${bounds.start} AS date)
        AND (paid_at AT TIME ZONE 'Europe/London')::date <= CAST(${bounds.end} AS date)
      GROUP BY 1, currency
      ORDER BY orders DESC, campaign
      LIMIT 12
    `,
  ]);

  const byDay = new Map((dayRows as DayRow[]).map(row => [isoDay(row.date), Number(row.visitors) || 0]));
  const days = eachIsoDay(bounds.start, bounds.end).map(date => ({
    date,
    visitors: byDay.get(date) ?? 0,
  }));

  return {
    range,
    start: bounds.start,
    end: bounds.end,
    visitors: days.reduce((sum, day) => sum + day.visitors, 0),
    days,
    channels: counts(channelRows as CountRow[], 'Direct'),
    campaigns: counts(campaignRows as CountRow[], 'No campaign'),
    landingPages: counts(landingRows as CountRow[], '/'),
    countries: counts(countryRows as CountRow[], 'Unknown'),
    devices: counts(deviceRows as CountRow[], 'desktop'),
    locales: counts(localeRows as CountRow[], 'en'),
    sources: (sourceRows as SourceRow[]).map(row => ({
      source: row.source?.trim() || 'Not set',
      medium: row.medium?.trim() || 'Not set',
      visitors: Number(row.visitors) || 0,
    })),
    enrolments: (enrolmentRows as EnrolmentRow[]).map(row => ({
      campaign: row.campaign?.trim() || 'No campaign stored',
      currency: row.currency?.trim() || 'GBP',
      orders: Number(row.orders) || 0,
      amount: Number(row.amount) || 0,
    })),
  };
}
