import { sql } from '../db/client';
import type { UrlHealthRow, UrlHealthStatus, UrlHealthSummary } from '../../shared/urlHealth';
import type { HealthRowUpdate } from '../services/urlHealthRules';

interface DbRow {
  url: string;
  status: UrlHealthStatus;
  last_checked_at: Date | null;
  last_status_code: number | null;
  last_error: string | null;
  ping_1_at: Date | null;
  ping_1_code: number | null;
  ping_2_at: Date | null;
  ping_2_code: number | null;
  ping_3_at: Date | null;
  ping_3_code: number | null;
  first_broken_at: Date | null;
  alerted_at: Date | null;
  next_check_at: Date;
}

export type UrlHealthRecord = {
  url: string;
  status: UrlHealthStatus;
  ping2At: Date | null;
  firstBrokenAt: Date | null;
  alertedAt: Date | null;
  lastStatusCode: number | null;
};

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

function ping(at: Date | null, code: number | null) {
  return at && code != null ? { at: new Date(at).toISOString(), code } : null;
}

function toRow(row: DbRow): UrlHealthRow {
  return {
    url: row.url,
    status: row.status,
    lastCheckedAt: iso(row.last_checked_at),
    lastStatusCode: row.last_status_code,
    lastError: row.last_error,
    pings: [
      ping(row.ping_1_at, row.ping_1_code),
      ping(row.ping_2_at, row.ping_2_code),
      ping(row.ping_3_at, row.ping_3_code),
    ],
    firstBrokenAt: iso(row.first_broken_at),
    alertedAt: iso(row.alerted_at),
    nextCheckAt: new Date(row.next_check_at).toISOString(),
  };
}

function toRecord(row: DbRow): UrlHealthRecord {
  return {
    url: row.url,
    status: row.status,
    ping2At: row.ping_2_at,
    firstBrokenAt: row.first_broken_at,
    alertedAt: row.alerted_at,
    lastStatusCode: row.last_status_code,
  };
}

export async function listUrlHealthRows(): Promise<UrlHealthRow[]> {
  const rows = await sql`
    SELECT * FROM url_health_checks
    ORDER BY CASE status
      WHEN 'broken' THEN 0 WHEN 'retrying' THEN 1 WHEN 'warning' THEN 2
      WHEN 'pending' THEN 3 ELSE 4 END,
      url ASC
  ` as DbRow[];
  return rows.map(toRow);
}

export function summarize(rows: UrlHealthRow[]): UrlHealthSummary {
  const summary: UrlHealthSummary = { total: rows.length, pending: 0, ok: 0, retrying: 0, broken: 0, warning: 0 };
  for (const row of rows) summary[row.status] += 1;
  return summary;
}

/** Add new sitemap URLs and stamp existing ones as still listed. */
export async function upsertSitemapUrls(urls: string[], seenAt: Date): Promise<void> {
  if (!urls.length) return;
  await sql`
    INSERT INTO url_health_checks (url, last_seen_in_sitemap_at, next_check_at)
    SELECT u, ${seenAt.toISOString()}::timestamptz, NOW()
    FROM unnest(${urls}::text[]) AS u
    ON CONFLICT (url) DO UPDATE
      SET last_seen_in_sitemap_at = EXCLUDED.last_seen_in_sitemap_at
  `;
}

/** Drop URLs that are no longer in the sitemap. */
export async function deleteUrlsNotSeenSince(seenAt: Date): Promise<number> {
  const rows = await sql`
    DELETE FROM url_health_checks
    WHERE last_seen_in_sitemap_at < ${seenAt.toISOString()}::timestamptz
    RETURNING url
  `;
  return rows.length;
}

export async function countUrlHealthRows(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM url_health_checks` as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Claim up to `limit` due rows. Retries go first. Claimed rows are pushed
 * 5 minutes out so an overlapping run skips them; the real next time is
 * written once the ping is done.
 */
export async function claimDueUrls(limit: number): Promise<UrlHealthRecord[]> {
  const rows = await sql`
    WITH due AS (
      SELECT url FROM url_health_checks
      WHERE next_check_at <= NOW()
      ORDER BY (status = 'retrying') DESC, next_check_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE url_health_checks c
    SET next_check_at = NOW() + INTERVAL '5 minutes'
    FROM due
    WHERE c.url = due.url
    RETURNING c.*
  ` as DbRow[];
  return rows.map(toRecord);
}

export async function saveUrlPing(
  url: string,
  at: Date,
  code: number,
  error: string | null,
  update: HealthRowUpdate,
): Promise<void> {
  const atIso = at.toISOString();
  const first = update.firstBrokenAt?.toISOString() ?? null;
  const alerted = update.alertedAt?.toISOString() ?? null;
  const next = update.nextCheckAt.toISOString();

  if (update.slot === 1) {
    await sql`
      UPDATE url_health_checks SET
        status = ${update.status}, last_checked_at = ${atIso}::timestamptz,
        last_status_code = ${code}, last_error = ${error},
        ping_1_at = ${atIso}::timestamptz, ping_1_code = ${code},
        ping_2_at = NULL, ping_2_code = NULL, ping_3_at = NULL, ping_3_code = NULL,
        first_broken_at = ${first}::timestamptz, alerted_at = ${alerted}::timestamptz,
        next_check_at = ${next}::timestamptz, updated_at = NOW()
      WHERE url = ${url}
    `;
  } else if (update.slot === 2) {
    await sql`
      UPDATE url_health_checks SET
        status = ${update.status}, last_checked_at = ${atIso}::timestamptz,
        last_status_code = ${code}, last_error = ${error},
        ping_2_at = ${atIso}::timestamptz, ping_2_code = ${code},
        first_broken_at = ${first}::timestamptz, alerted_at = ${alerted}::timestamptz,
        next_check_at = ${next}::timestamptz, updated_at = NOW()
      WHERE url = ${url}
    `;
  } else {
    await sql`
      UPDATE url_health_checks SET
        status = ${update.status}, last_checked_at = ${atIso}::timestamptz,
        last_status_code = ${code}, last_error = ${error},
        ping_3_at = ${atIso}::timestamptz, ping_3_code = ${code},
        first_broken_at = ${first}::timestamptz, alerted_at = ${alerted}::timestamptz,
        next_check_at = ${next}::timestamptz, updated_at = NOW()
      WHERE url = ${url}
    `;
  }
}

export async function listBrokenUnalerted(): Promise<UrlHealthRow[]> {
  const rows = await sql`
    SELECT * FROM url_health_checks
    WHERE status = 'broken' AND alerted_at IS NULL
    ORDER BY first_broken_at ASC NULLS LAST, url ASC
  ` as DbRow[];
  return rows.map(toRow);
}

export async function markAlerted(urls: string[]): Promise<void> {
  if (!urls.length) return;
  await sql`
    UPDATE url_health_checks SET alerted_at = NOW(), updated_at = NOW()
    WHERE url = ANY(${urls}::text[])
  `;
}

/** Make every URL due now (the "Check all now" button). */
export async function makeAllDue(): Promise<void> {
  await sql`
    UPDATE url_health_checks SET next_check_at = NOW()
    WHERE status <> 'retrying'
  `;
}

export type UrlHealthState = {
  sitemapSyncedAt: Date | null;
  sitemapUrlCount: number;
  lastRunAt: Date | null;
  lastError: string | null;
};

export async function getUrlHealthState(): Promise<UrlHealthState> {
  const rows = await sql`SELECT * FROM url_health_state WHERE id = 1` as Array<{
    sitemap_synced_at: Date | null;
    sitemap_url_count: number;
    last_run_at: Date | null;
    last_error: string | null;
  }>;
  const row = rows[0];
  return {
    sitemapSyncedAt: row?.sitemap_synced_at ?? null,
    sitemapUrlCount: row?.sitemap_url_count ?? 0,
    lastRunAt: row?.last_run_at ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function saveUrlHealthState(input: {
  sitemapSyncedAt?: Date;
  sitemapUrlCount?: number;
  lastError: string | null;
}): Promise<void> {
  const synced = input.sitemapSyncedAt?.toISOString() ?? null;
  const count = input.sitemapUrlCount ?? null;
  await sql`
    INSERT INTO url_health_state (id, sitemap_synced_at, sitemap_url_count, last_run_at, last_error)
    VALUES (1, ${synced}::timestamptz, COALESCE(${count}::int, 0), NOW(), ${input.lastError})
    ON CONFLICT (id) DO UPDATE SET
      sitemap_synced_at = COALESCE(EXCLUDED.sitemap_synced_at, url_health_state.sitemap_synced_at),
      sitemap_url_count = CASE WHEN ${count}::int IS NULL THEN url_health_state.sitemap_url_count ELSE EXCLUDED.sitemap_url_count END,
      last_run_at = NOW(),
      last_error = EXCLUDED.last_error
  `;
}
