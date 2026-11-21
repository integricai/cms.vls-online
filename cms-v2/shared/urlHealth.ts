export type UrlHealthStatus = 'pending' | 'ok' | 'retrying' | 'broken' | 'warning';

export type UrlHealthPing = {
  at: string;
  /** HTTP status, or 0 when the site did not answer in time. */
  code: number;
};

export type UrlHealthRow = {
  url: string;
  status: UrlHealthStatus;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  pings: Array<UrlHealthPing | null>;
  firstBrokenAt: string | null;
  alertedAt: string | null;
  nextCheckAt: string;
};

export type UrlHealthSummary = Record<UrlHealthStatus, number> & { total: number };

export type UrlHealthOverview = {
  summary: UrlHealthSummary;
  rows: UrlHealthRow[];
  sitemapSyncedAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

export type UrlHealthRunResult = {
  sitemapSynced: boolean;
  sitemapUrls: number;
  removed: number;
  checked: number;
  newlyBroken: number;
  alertsSent: number;
  errors: string[];
};
