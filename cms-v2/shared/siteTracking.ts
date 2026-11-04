import { isIsoDate, londonToday, salesPresetBounds } from './salesFormat';

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
export type TrackingDay = { date: string; visitors: number };
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
