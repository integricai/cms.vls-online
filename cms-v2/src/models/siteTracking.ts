import { sql } from '../db/client';
import { assembleTrackingDays, type TrackingRange, type TrackingReport } from '../../shared/siteTracking';
import { siteVisitorKey } from './siteAnalytics';
import type { ClassifiedTrackingVisit } from '../services/siteTracking';

type CountRow = { label: string | null; visitors: number };
type SourceRow = { source: string | null; medium: string | null; visitors: number };
type ChannelDayRow = { date: string | Date; label: string | null; visitors: number };
type AudienceRow = { unique_visits: number; returning_visits: number };
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

export async function buildTrackingReport(
  range: TrackingRange,
  bounds: { start: string; end: string },
): Promise<TrackingReport> {
  const [channelDayRows, audienceRows, channelRows, campaignRows, landingRows, countryRows, sourceRows, deviceRows, localeRows, enrolmentRows] = await Promise.all([
    sql`
      SELECT visited_on::text AS date, channel AS label, COUNT(*)::int AS visitors
      FROM site_tracking_visits
      WHERE visited_on >= CAST(${bounds.start} AS date)
        AND visited_on <= CAST(${bounds.end} AS date)
      GROUP BY visited_on, channel
      ORDER BY visited_on
    `,
    sql`
      SELECT
        COUNT(*)::int AS unique_visits,
        COUNT(*) FILTER (WHERE day_count > 1 OR has_earlier)::int AS returning_visits
      FROM (
        SELECT
          visits.visitor_key,
          COUNT(*)::int AS day_count,
          EXISTS (
            SELECT 1
            FROM site_tracking_visits earlier
            WHERE earlier.visitor_key = visits.visitor_key
              AND earlier.visited_on < CAST(${bounds.start} AS date)
          ) AS has_earlier
        FROM site_tracking_visits visits
        WHERE visits.visited_on >= CAST(${bounds.start} AS date)
          AND visits.visited_on <= CAST(${bounds.end} AS date)
        GROUP BY visits.visitor_key
      ) people
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

  const channelList = counts(channelRows as CountRow[], 'Direct');
  const days = assembleTrackingDays(
    bounds.start,
    bounds.end,
    (channelDayRows as ChannelDayRow[]).map(row => ({
      date: isoDay(row.date),
      channel: row.label?.trim() || 'Direct',
      visitors: Number(row.visitors) || 0,
    })),
    channelList.map(row => row.label),
  );
  const audience = (audienceRows as AudienceRow[])[0];

  return {
    range,
    start: bounds.start,
    end: bounds.end,
    visitors: days.reduce((sum, day) => sum + day.visitors, 0),
    uniqueVisits: Number(audience?.unique_visits) || 0,
    returningVisits: Number(audience?.returning_visits) || 0,
    days,
    channels: channelList,
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
