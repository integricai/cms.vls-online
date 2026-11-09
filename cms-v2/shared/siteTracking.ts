import { eachIsoDay, isIsoDate, londonToday, salesPresetBounds } from './salesFormat';

export const TRACKING_PRESETS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'] as const;
export type TrackingPreset = (typeof TRACKING_PRESETS)[number];
export type TrackingRange = TrackingPreset | 'custom';
export const TRACKING_CUSTOM_MAX_DAYS = 366;

export function isTrackingPreset(value: string): value is TrackingPreset {
  return (TRACKING_PRESETS as readonly string[]).includes(value);
}

export function trackingPresetBounds(preset: TrackingPreset, today = londonToday()): { start: string; end: string } {
  return salesPresetBounds(preset, today) ?? { start: today, end: today };
}

function inclusiveDayCount(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}

/** Null when a date is missing, the end is before the start, or the span is longer than a year. */
export function trackingCustomBounds(start: string, end: string): { start: string; end: string } | null {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return null;
  if (inclusiveDayCount(start, end) > TRACKING_CUSTOM_MAX_DAYS) return null;
  return { start, end };
}

export type TrackingCount = {
  label: string;
  visitors: number;
  meta?: boolean;
  google?: boolean;
};
export type TrackingSourceRow = { source: string; medium: string; visitors: number };
export type TrackingDay = {
  date: string;
  visitors: number;
  channels: Record<string, number>;
};

export type TrackingChannelDay = { date: string; channel: string; visitors: number };

/** One row per calendar day, with a zero for every channel that had no visits that day. */
export function assembleTrackingDays(
  start: string,
  end: string,
  rows: TrackingChannelDay[],
  channelOrder: string[],
): TrackingDay[] {
  const byDate = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const channel = row.channel.trim() || 'Direct';
    const bucket = byDate.get(date) ?? new Map<string, number>();
    bucket.set(channel, (bucket.get(channel) ?? 0) + (Number(row.visitors) || 0));
    byDate.set(date, bucket);
  }
  return eachIsoDay(start, end).map(date => {
    const bucket = byDate.get(date) ?? new Map<string, number>();
    const channels: Record<string, number> = {};
    for (const channel of channelOrder) channels[channel] = bucket.get(channel) ?? 0;
    for (const [channel, count] of bucket) {
      if (!(channel in channels)) channels[channel] = count;
    }
    let visitors = 0;
    for (const count of bucket.values()) visitors += count;
    return { date, visitors, channels };
  });
}

export type TrackingEnrolment = {
  campaign: string;
  currency: string;
  orders: number;
  amount: number;
  /** A Meta click or Meta utm_source was stored on at least one order in the group. */
  meta?: boolean;
  /** A Google click, Google utm_source, or Google campaign id was stored on at least one order. */
  google?: boolean;
  /** The displayed id came from gad_campaign_id because utm_campaign was empty. */
  fromGoogleId?: boolean;
};

export type CampaignNetwork = {
  meta?: boolean;
  google?: boolean;
  fromGoogleId?: boolean;
};

/**
 * Current Meta ad ids are 15–24 digits and start with 120.
 * Google Ads campaign ids are shorter, so this does not claim those.
 */
export function isMetaCampaignId(value: string): boolean {
  return /^120\d{12,21}$/.test(value);
}

/** Name a stored campaign. Numeric ids are Meta or Google only when the click says so. */
export function campaignLabel(value: string, network: CampaignNetwork = {}): string {
  if (value === 'No campaign' || value === 'No campaign stored') return value;
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    text = value.trim();
  }
  text = text.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^\d{3,24}$/.test(text)) return text;
  // A long 120… id is Meta even when an older Google click is still stored on the order.
  if (isMetaCampaignId(text)) return `Meta campaign ${text}`;
  // Google wins over a leftover Meta click when the id itself is a Google campaign id.
  if (network.fromGoogleId || network.google) return `Google campaign ${text}`;
  if (network.meta) return `Meta campaign ${text}`;
  return text;
}

export type TrackingReport = {
  range: TrackingRange;
  start: string;
  end: string;
  visitors: number;
  uniqueVisits: number;
  returningVisits: number;
  days: TrackingDay[];
  channels: TrackingCount[];
  campaigns: TrackingCount[];
  landingPages: TrackingCount[];
  countries: TrackingCount[];
  devices: TrackingCount[];
  locales: TrackingCount[];
  sources: TrackingSourceRow[];
  enrolments: TrackingEnrolment[];
};
