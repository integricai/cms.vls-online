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

export type TrackingCount = { label: string; visitors: number };
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
};

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
