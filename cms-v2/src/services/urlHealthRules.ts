import type { UrlHealthStatus } from '../../shared/urlHealth';

export const CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const RETRY_DELAY_MS = 60 * 1000;

export type PingOutcome = 'ok' | 'broken' | 'warning';

/**
 * 2xx/3xx is fine. 404, 410, 5xx and no answer (0) count as broken.
 * Anything else (401, 403, 429…) is usually bot protection or rate limiting,
 * so it shows as a warning and does not send an alert.
 */
export function classifyStatusCode(code: number): PingOutcome {
  if (code >= 200 && code < 400) return 'ok';
  if (code === 0 || code === 404 || code === 410 || code >= 500) return 'broken';
  return 'warning';
}

export type HealthRowState = {
  status: UrlHealthStatus;
  ping2At: Date | null;
  firstBrokenAt: Date | null;
  alertedAt: Date | null;
};

export type HealthRowUpdate = {
  status: UrlHealthStatus;
  /** Which ping slot (1–3) this ping is written to. Slot 1 clears slots 2 and 3. */
  slot: 1 | 2 | 3;
  firstBrokenAt: Date | null;
  alertedAt: Date | null;
  nextCheckAt: Date;
};

/** Which ping of the current check this is. */
export function pingSlot(row: Pick<HealthRowState, 'status' | 'ping2At'>): 1 | 2 | 3 {
  if (row.status !== 'retrying') return 1;
  return row.ping2At ? 3 : 2;
}

export function applyPing(row: HealthRowState, code: number, now: Date): HealthRowUpdate {
  const slot = pingSlot(row);
  const outcome = classifyStatusCode(code);
  const later = new Date(now.getTime() + CHECK_INTERVAL_MS);

  if (outcome !== 'broken') {
    // Recovered (or never broken): clear the breakage so a future one alerts again.
    return {
      status: outcome,
      slot,
      firstBrokenAt: null,
      alertedAt: null,
      nextCheckAt: later,
    };
  }

  // Keep the time of the first failed ping for as long as the URL stays broken.
  const firstBrokenAt = row.firstBrokenAt ?? now;

  if (slot < 3) {
    return {
      status: 'retrying',
      slot,
      firstBrokenAt,
      alertedAt: row.alertedAt,
      nextCheckAt: new Date(now.getTime() + RETRY_DELAY_MS),
    };
  }

  return {
    status: 'broken',
    slot,
    firstBrokenAt,
    alertedAt: row.alertedAt,
    nextCheckAt: later,
  };
}

/** Pull every <loc> out of a sitemap or sitemap index. */
export function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    locs.push(match[1].replace(/&amp;/g, '&'));
  }
  return locs;
}

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}
