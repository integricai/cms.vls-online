import { sql } from '../db/client';
import { londonToday } from '../../shared/salesFormat';
import {
  PATH_SCORE_LIMIT,
  PATH_SESSION_PAGE_SIZE,
  SESSION_PAGE_LIMIT,
  pageScore,
  type PageScoreDraft,
  type PathOutcome,
} from '../../shared/pathScore';
import { siteSessionKey, siteVisitorKey } from './siteAnalytics';
import type { ClassifiedTrackingVisit } from '../services/siteTracking';

type ScoreRow = { path: string; sessions: number; dropoffs: number; conversions: number };
type SummaryRow = { sessions: number; paid: number };
type SessionRow = {
  id: string | number;
  started_at: string | Date;
  channel: string;
  country: string | null;
  device: string;
  locale: string;
  converted: boolean;
};
type PageRow = { session_id: string | number; path: string; position: number };

export type StoredPathSession = {
  id: string;
  startedAt: string;
  channel: string;
  country: string | null;
  device: string;
  locale: string;
  pages: string[];
  converted: boolean;
};

export type StoredPathReport = {
  sessions: number;
  paid: number;
  dropped: number;
  scores: PageScoreDraft[];
  rows: StoredPathSession[];
  page: number;
  pageSize: number;
  total: number;
};

function isoTimestamp(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/** Open a session on the first page and append each later page. The same page twice in a row is ignored. */
export async function recordSessionPage(
  ip: string,
  userAgent: string,
  sessionId: string | null,
  visit: ClassifiedTrackingVisit,
  country: string | null,
  now = new Date(),
): Promise<void> {
  if (!sessionId) return;
  const sessionKey = siteSessionKey(sessionId);
  const startedOn = londonToday(now);
  await sql`
    INSERT INTO site_tracking_sessions (
      session_key, visitor_key, started_on, channel, source, medium, campaign, content, term,
      landing_path, country, device, locale
    ) VALUES (
      ${sessionKey},
      ${siteVisitorKey(ip, userAgent)},
      CAST(${startedOn} AS date),
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
    ON CONFLICT (session_key) DO NOTHING
  `;
  const found = await sql`
    SELECT id FROM site_tracking_sessions WHERE session_key = ${sessionKey}
  ` as Array<{ id: string | number }>;
  const id = found[0]?.id;
  if (id === undefined) return;
  await sql`
    WITH last AS (
      SELECT path, position
      FROM site_tracking_pageviews
      WHERE session_id = ${id}
      ORDER BY position DESC
      LIMIT 1
    ),
    next AS (
      SELECT
        COALESCE((SELECT position FROM last), 0) + 1 AS position,
        (SELECT path FROM last) AS last_path
    )
    INSERT INTO site_tracking_pageviews (session_id, path, position)
    SELECT ${id}, ${visit.landingPath}, position
    FROM next
    WHERE last_path IS DISTINCT FROM ${visit.landingPath}
      AND position <= ${SESSION_PAGE_LIMIT}
    ON CONFLICT (session_id, position) DO NOTHING
  `;
}

export async function buildPathReport(
  bounds: { start: string; end: string },
  outcome: PathOutcome,
  page: number,
): Promise<StoredPathReport> {
  const pageSize = PATH_SESSION_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const [summaryRows, scoreRows, totalRows, sessionRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(*) FILTER (WHERE converted)::int AS paid
      FROM (
        SELECT EXISTS (
          SELECT 1
          FROM site_tracking_pageviews p
          WHERE p.session_id = s.id
            AND regexp_replace(lower(rtrim(p.path, '/')), '^/(en|ar)/', '/') = '/payment-success'
        ) AS converted
        FROM site_tracking_sessions s
        WHERE s.started_on >= CAST(${bounds.start} AS date)
          AND s.started_on <= CAST(${bounds.end} AS date)
      ) people
    `,
    sql`
      WITH views AS (
        SELECT
          p.session_id,
          p.path,
          p.position,
          MAX(p.position) OVER (PARTITION BY p.session_id) AS last_position,
          MAX(
            CASE
              WHEN regexp_replace(lower(rtrim(p.path, '/')), '^/(en|ar)/', '/') = '/payment-success' THEN 1
              ELSE 0
            END
          ) OVER (PARTITION BY p.session_id) AS converted
        FROM site_tracking_pageviews p
        JOIN site_tracking_sessions s ON s.id = p.session_id
        WHERE s.started_on >= CAST(${bounds.start} AS date)
          AND s.started_on <= CAST(${bounds.end} AS date)
      ),
      pages AS (
        SELECT
          session_id,
          path,
          bool_or(position = last_position) AS is_exit,
          bool_or(converted = 1) AS converted
        FROM views
        WHERE regexp_replace(lower(rtrim(path, '/')), '^/(en|ar)/', '/') <> '/payment-success'
        GROUP BY session_id, path
      )
      SELECT
        path,
        COUNT(*)::int AS sessions,
        COUNT(*) FILTER (WHERE is_exit AND NOT converted)::int AS dropoffs,
        COUNT(*) FILTER (WHERE converted)::int AS conversions
      FROM pages
      GROUP BY path
      ORDER BY dropoffs DESC, sessions DESC, path
      LIMIT ${PATH_SCORE_LIMIT}
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT EXISTS (
          SELECT 1
          FROM site_tracking_pageviews p
          WHERE p.session_id = s.id
            AND regexp_replace(lower(rtrim(p.path, '/')), '^/(en|ar)/', '/') = '/payment-success'
        ) AS converted
        FROM site_tracking_sessions s
        WHERE s.started_on >= CAST(${bounds.start} AS date)
          AND s.started_on <= CAST(${bounds.end} AS date)
      ) people
      WHERE ${outcome} = 'all'
        OR (${outcome} = 'paid' AND converted)
        OR (${outcome} = 'dropped' AND NOT converted)
    `,
    sql`
      SELECT id, started_at, channel, country, device, locale, converted
      FROM (
        SELECT
          s.id,
          s.started_at,
          s.channel,
          s.country,
          s.device,
          s.locale,
          EXISTS (
            SELECT 1
            FROM site_tracking_pageviews p
            WHERE p.session_id = s.id
              AND regexp_replace(lower(rtrim(p.path, '/')), '^/(en|ar)/', '/') = '/payment-success'
          ) AS converted
        FROM site_tracking_sessions s
        WHERE s.started_on >= CAST(${bounds.start} AS date)
          AND s.started_on <= CAST(${bounds.end} AS date)
      ) people
      WHERE ${outcome} = 'all'
        OR (${outcome} = 'paid' AND converted)
        OR (${outcome} = 'dropped' AND NOT converted)
      ORDER BY started_at DESC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const summary = (summaryRows as SummaryRow[])[0];
  const sessions = Number(summary?.sessions) || 0;
  const paid = Number(summary?.paid) || 0;
  const listed = sessionRows as SessionRow[];
  const ids = listed.map(row => row.id);
  const pageRows = ids.length === 0
    ? []
    : await sql`
      SELECT session_id, path, position
      FROM site_tracking_pageviews
      WHERE session_id = ANY(${ids}::bigint[])
      ORDER BY session_id, position
    ` as PageRow[];
  const pagesBySession = new Map<string, string[]>();
  for (const row of pageRows) {
    const key = String(row.session_id);
    const list = pagesBySession.get(key) ?? [];
    list.push(row.path);
    pagesBySession.set(key, list);
  }

  return {
    sessions,
    paid,
    dropped: Math.max(0, sessions - paid),
    scores: (scoreRows as ScoreRow[]).map(row => {
      const viewed = Number(row.sessions) || 0;
      const dropoffs = Number(row.dropoffs) || 0;
      return {
        path: row.path,
        sessions: viewed,
        dropoffs,
        conversions: Number(row.conversions) || 0,
        score: pageScore(viewed, dropoffs),
      };
    }),
    rows: listed.map(row => ({
      id: String(row.id),
      startedAt: isoTimestamp(row.started_at),
      channel: row.channel,
      country: row.country,
      device: row.device,
      locale: row.locale,
      pages: pagesBySession.get(String(row.id)) ?? [],
      converted: row.converted === true,
    })),
    page,
    pageSize,
    total: Number((totalRows as Array<{ total: number }>)[0]?.total) || 0,
  };
}
