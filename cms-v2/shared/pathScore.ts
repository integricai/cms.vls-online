import { trackingLookupPath } from './pageTracking';

export const SESSION_PAGE_LIMIT = 30;
export const PATH_SESSION_PAGE_SIZE = 40;
export const PATH_SCORE_LIMIT = 100;

export type PathOutcome = 'all' | 'paid' | 'dropped';

export function isPathOutcome(value: string): value is PathOutcome {
  return value === 'all' || value === 'paid' || value === 'dropped';
}

/** Payment success is the conversion. Locale prefixes are ignored. */
export function isPaymentSuccessPath(path: string): boolean {
  return trackingLookupPath(path) === '/payment-success';
}

export function pageScore(sessions: number, dropoffs: number): number {
  if (sessions <= 0) return 0;
  const kept = Math.max(0, sessions - dropoffs);
  return Math.round((kept / sessions) * 100);
}

export type PageScoreDraft = {
  path: string;
  sessions: number;
  dropoffs: number;
  conversions: number;
  score: number;
};

/**
 * One row per page. A drop-off is a session that ended on that page
 * without opening payment success. Seeing the page and later paying counts as a conversion.
 */
export function scoreSessionPages(sessions: string[][]): PageScoreDraft[] {
  const stats = new Map<string, { sessions: number; dropoffs: number; conversions: number }>();
  for (const pages of sessions) {
    const converted = pages.some(isPaymentSuccessPath);
    const exitPath = pages.length > 0 && !converted ? pages[pages.length - 1] : null;
    const seen = new Set<string>();
    for (const path of pages) {
      if (!path || isPaymentSuccessPath(path) || seen.has(path)) continue;
      seen.add(path);
      const row = stats.get(path) ?? { sessions: 0, dropoffs: 0, conversions: 0 };
      row.sessions += 1;
      if (exitPath === path) row.dropoffs += 1;
      if (converted) row.conversions += 1;
      stats.set(path, row);
    }
  }
  return [...stats.entries()]
    .map(([path, row]) => ({
      path,
      sessions: row.sessions,
      dropoffs: row.dropoffs,
      conversions: row.conversions,
      score: pageScore(row.sessions, row.dropoffs),
    }))
    .sort((left, right) => right.dropoffs - left.dropoffs || right.sessions - left.sessions || left.path.localeCompare(right.path));
}

export type PathSessionPage = { path: string; label: string };

export type PathSessionRow = {
  id: string;
  startedAt: string;
  channel: string;
  country: string | null;
  device: string;
  locale: string;
  pages: PathSessionPage[];
  converted: boolean;
  exitPath: string | null;
  exitLabel: string | null;
};

export type PathPageScore = PageScoreDraft & { label: string };

export type PathReport = {
  range: string;
  start: string;
  end: string;
  sessions: number;
  paid: number;
  dropped: number;
  scores: PathPageScore[];
  rows: PathSessionRow[];
  page: number;
  pageSize: number;
  total: number;
};
