import type { DashboardRange } from './salesFormat';

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
  range: DashboardRange;
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
