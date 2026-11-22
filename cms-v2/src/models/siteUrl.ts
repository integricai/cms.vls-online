import { sql } from '../db/client';
import { autoTrackingName, trackingLookupPath } from '../../shared/pageTracking';
import {
  isExcludedFromSitemap,
  SITEMAP_EXCLUDED_FOLDERS,
  SITEMAP_EXCLUDED_PATHS,
  type SitemapGroup,
} from '../services/sitemapPaths';

export interface SiteUrlRecord {
  id: number;
  path: string;
  sitemapGroup: SitemapGroup;
  storyblokFullSlug: string;
  storyblokStoryId: number | null;
  title: string;
  trackingName: string;
  isEnabled: boolean;
  lastmod: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  id: number;
  path: string;
  sitemap_group: string;
  storyblok_full_slug: string;
  storyblok_story_id: string | number | null;
  title: string;
  tracking_name: string;
  is_enabled: boolean;
  lastmod: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapRow(row: DbRow): SiteUrlRecord {
  const storyId = row.storyblok_story_id == null ? null : Number(row.storyblok_story_id);
  return {
    id: row.id,
    path: row.path,
    sitemapGroup: row.sitemap_group as SitemapGroup,
    storyblokFullSlug: row.storyblok_full_slug,
    storyblokStoryId: storyId != null && Number.isFinite(storyId) ? storyId : null,
    title: row.title ?? '',
    trackingName: row.tracking_name ?? '',
    isEnabled: Boolean(row.is_enabled),
    lastmod: toIso(row.lastmod),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

export interface UpsertSiteUrlInput {
  path: string;
  sitemapGroup: SitemapGroup;
  storyblokFullSlug: string;
  storyblokStoryId?: number | null;
  title?: string;
  isEnabled?: boolean;
  lastmod?: Date | string | null;
  /** When true, do not overwrite an existing admin `is_enabled` choice. */
  preserveEnabled?: boolean;
}

/** Automatic page name for a public page, or null when the stored name should stay. */
function trackingAssignment(existing: DbRow | null, path: string, fullSlug: string): string | null {
  if (isExcludedFromSitemap(fullSlug) || isExcludedFromSitemap(path)) return null;
  const next = autoTrackingName(
    existing
      ? { path: existing.path, trackingName: existing.tracking_name ?? '' }
      : null,
    path,
  );
  if (next == null) return null;
  if (existing && next === (existing.tracking_name ?? '').trim()) return null;
  return next;
}

export async function listSiteUrls(filters?: {
  group?: SitemapGroup | 'all';
  enabled?: 'all' | 'enabled' | 'disabled';
  q?: string;
}): Promise<SiteUrlRecord[]> {
  const group = filters?.group && filters.group !== 'all' ? filters.group : null;
  const enabledFilter = filters?.enabled ?? 'all';
  const q = filters?.q?.trim().toLowerCase() || null;

  let rows: DbRow[];

  if (group && enabledFilter !== 'all' && q) {
    const enabled = enabledFilter === 'enabled';
    rows = await sql`
      SELECT * FROM site_urls
      WHERE sitemap_group = ${group}
        AND is_enabled = ${enabled}
        AND (lower(path) LIKE ${`%${q}%`} OR lower(title) LIKE ${`%${q}%`} OR lower(tracking_name) LIKE ${`%${q}%`} OR lower(storyblok_full_slug) LIKE ${`%${q}%`})
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (group && enabledFilter !== 'all') {
    const enabled = enabledFilter === 'enabled';
    rows = await sql`
      SELECT * FROM site_urls
      WHERE sitemap_group = ${group} AND is_enabled = ${enabled}
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (group && q) {
    rows = await sql`
      SELECT * FROM site_urls
      WHERE sitemap_group = ${group}
        AND (lower(path) LIKE ${`%${q}%`} OR lower(title) LIKE ${`%${q}%`} OR lower(tracking_name) LIKE ${`%${q}%`} OR lower(storyblok_full_slug) LIKE ${`%${q}%`})
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (enabledFilter !== 'all' && q) {
    const enabled = enabledFilter === 'enabled';
    rows = await sql`
      SELECT * FROM site_urls
      WHERE is_enabled = ${enabled}
        AND (lower(path) LIKE ${`%${q}%`} OR lower(title) LIKE ${`%${q}%`} OR lower(tracking_name) LIKE ${`%${q}%`} OR lower(storyblok_full_slug) LIKE ${`%${q}%`})
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (group) {
    rows = await sql`
      SELECT * FROM site_urls
      WHERE sitemap_group = ${group}
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (enabledFilter !== 'all') {
    const enabled = enabledFilter === 'enabled';
    rows = await sql`
      SELECT * FROM site_urls
      WHERE is_enabled = ${enabled}
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else if (q) {
    rows = await sql`
      SELECT * FROM site_urls
      WHERE lower(path) LIKE ${`%${q}%`}
         OR lower(title) LIKE ${`%${q}%`}
         OR lower(tracking_name) LIKE ${`%${q}%`}
         OR lower(storyblok_full_slug) LIKE ${`%${q}%`}
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  } else {
    rows = await sql`
      SELECT * FROM site_urls
      ORDER BY sitemap_group ASC, path ASC
    ` as DbRow[];
  }

  return rows.map(mapRow);
}

export async function listEnabledSiteUrls(group?: SitemapGroup): Promise<SiteUrlRecord[]> {
  const rows = group
    ? await sql`
        SELECT *
        FROM site_urls
        WHERE is_enabled = TRUE AND sitemap_group = ${group}
        ORDER BY path ASC
      ` as DbRow[]
    : await sql`
        SELECT *
        FROM site_urls
        WHERE is_enabled = TRUE
        ORDER BY sitemap_group ASC, path ASC
      ` as DbRow[];

  return rows.map(mapRow);
}

export async function getSiteUrlById(id: number): Promise<SiteUrlRecord | null> {
  const rows = await sql`SELECT * FROM site_urls WHERE id = ${id}` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertSiteUrl(input: UpsertSiteUrlInput): Promise<SiteUrlRecord> {
  const title = input.title?.trim() ?? '';
  const storyId = input.storyblokStoryId ?? null;
  const lastmod = input.lastmod ? new Date(input.lastmod) : null;
  const lastmodIso = lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod.toISOString() : null;
  const preserveEnabled = Boolean(input.preserveEnabled);
  const isEnabled = input.isEnabled ?? true;

  if (storyId != null) {
    const existing = await sql`
      SELECT * FROM site_urls WHERE storyblok_story_id = ${storyId} LIMIT 1
    ` as DbRow[];

    if (existing[0]) {
      const assignedName = trackingAssignment(existing[0], input.path, input.storyblokFullSlug);
      const rows = await sql`
        UPDATE site_urls
        SET
          path = ${input.path},
          sitemap_group = ${input.sitemapGroup},
          storyblok_full_slug = ${input.storyblokFullSlug},
          title = CASE WHEN ${title} = '' THEN title ELSE ${title} END,
          tracking_name = CASE WHEN ${assignedName != null} THEN ${assignedName ?? ''} ELSE tracking_name END,
          is_enabled = CASE WHEN ${preserveEnabled} THEN is_enabled ELSE ${isEnabled} END,
          lastmod = COALESCE(${lastmodIso}::timestamptz, lastmod),
          updated_at = NOW()
        WHERE storyblok_story_id = ${storyId}
        RETURNING *
      ` as DbRow[];
      return mapRow(rows[0]);
    }
  }

  const bySlug = await sql`
    SELECT * FROM site_urls WHERE storyblok_full_slug = ${input.storyblokFullSlug} LIMIT 1
  ` as DbRow[];

  if (bySlug[0]) {
    const assignedName = trackingAssignment(bySlug[0], input.path, input.storyblokFullSlug);
    const rows = await sql`
      UPDATE site_urls
      SET
        path = ${input.path},
        sitemap_group = ${input.sitemapGroup},
        storyblok_story_id = COALESCE(${storyId}, storyblok_story_id),
        title = CASE WHEN ${title} = '' THEN title ELSE ${title} END,
        tracking_name = CASE WHEN ${assignedName != null} THEN ${assignedName ?? ''} ELSE tracking_name END,
        is_enabled = CASE WHEN ${preserveEnabled} THEN is_enabled ELSE ${isEnabled} END,
        lastmod = COALESCE(${lastmodIso}::timestamptz, lastmod),
        updated_at = NOW()
      WHERE storyblok_full_slug = ${input.storyblokFullSlug}
      RETURNING *
    ` as DbRow[];
    return mapRow(rows[0]);
  }

  // Path may already exist from an older slug — take over that row.
  const byPath = await sql`
    SELECT * FROM site_urls WHERE path = ${input.path} LIMIT 1
  ` as DbRow[];

  if (byPath[0]) {
    const assignedName = trackingAssignment(byPath[0], input.path, input.storyblokFullSlug);
    const rows = await sql`
      UPDATE site_urls
      SET
        sitemap_group = ${input.sitemapGroup},
        storyblok_full_slug = ${input.storyblokFullSlug},
        storyblok_story_id = COALESCE(${storyId}, storyblok_story_id),
        title = CASE WHEN ${title} = '' THEN title ELSE ${title} END,
        tracking_name = CASE WHEN ${assignedName != null} THEN ${assignedName ?? ''} ELSE tracking_name END,
        is_enabled = CASE WHEN ${preserveEnabled} THEN is_enabled ELSE ${isEnabled} END,
        lastmod = COALESCE(${lastmodIso}::timestamptz, lastmod),
        updated_at = NOW()
      WHERE path = ${input.path}
      RETURNING *
    ` as DbRow[];
    return mapRow(rows[0]);
  }

  const assignedName = trackingAssignment(null, input.path, input.storyblokFullSlug) ?? '';
  const rows = await sql`
    INSERT INTO site_urls (
      path,
      sitemap_group,
      storyblok_full_slug,
      storyblok_story_id,
      title,
      tracking_name,
      is_enabled,
      lastmod
    )
    VALUES (
      ${input.path},
      ${input.sitemapGroup},
      ${input.storyblokFullSlug},
      ${storyId},
      ${title},
      ${assignedName},
      ${isEnabled},
      ${lastmodIso}
    )
    RETURNING *
  ` as DbRow[];

  return mapRow(rows[0]);
}

export async function setSiteUrlTrackingName(id: number, trackingName: string): Promise<SiteUrlRecord | null> {
  const rows = await sql`
    UPDATE site_urls
    SET tracking_name = ${trackingName}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Fill blank page names on public sitemap rows. Internal pages and edited names stay as they are. */
export async function fillBlankPublicTrackingNames(): Promise<{ updated: number; skipped: number }> {
  const rows = await sql`
    SELECT id, path, storyblok_full_slug
    FROM site_urls
    WHERE tracking_name = ''
    ORDER BY id
  ` as Array<{ id: number; path: string; storyblok_full_slug: string }>;

  const ids: number[] = [];
  const names: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = trackingAssignment(null, row.path, row.storyblok_full_slug ?? '');
    if (!name) {
      skipped += 1;
      continue;
    }
    ids.push(Number(row.id));
    names.push(name);
  }
  if (!ids.length) return { updated: 0, skipped };

  const updated = await sql`
    UPDATE site_urls AS site
    SET tracking_name = incoming.name, updated_at = NOW()
    FROM unnest(${ids}::int[], ${names}::text[]) AS incoming(id, name)
    WHERE site.id = incoming.id
      AND site.tracking_name = ''
    RETURNING site.id
  ` as Array<{ id: number }>;
  return { updated: updated.length, skipped };
}

/** Paths that have a tracking name. Storyblok sync does not clear these. */
export async function listTrackingNames(): Promise<Record<string, string>> {
  const rows = await sql`
    SELECT path, tracking_name
    FROM site_urls
    WHERE tracking_name <> ''
    ORDER BY path
  ` as Array<{ path: string; tracking_name: string }>;
  const names: Record<string, string> = {};
  for (const row of rows) {
    const path = trackingLookupPath(row.path);
    const name = row.tracking_name.trim();
    if (path && name) names[path] = name;
  }
  return names;
}

export async function setSiteUrlEnabled(id: number, isEnabled: boolean): Promise<SiteUrlRecord | null> {
  const rows = await sql`
    UPDATE site_urls
    SET is_enabled = ${isEnabled}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function disableSiteUrlByStoryId(storyId: number): Promise<SiteUrlRecord | null> {
  const rows = await sql`
    UPDATE site_urls
    SET is_enabled = FALSE, updated_at = NOW()
    WHERE storyblok_story_id = ${storyId}
    RETURNING *
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Turn off one internal URL already stored from an earlier sync. */
export async function disableExcludedSiteUrl(input: {
  fullSlug: string;
  path: string;
  storyId?: number | null;
}): Promise<SiteUrlRecord | null> {
  const storyId = input.storyId != null && Number.isFinite(input.storyId) ? input.storyId : null;
  const rows = await sql`
    UPDATE site_urls
    SET is_enabled = FALSE, updated_at = NOW()
    WHERE is_enabled = TRUE
      AND (
        path = ${input.path}
        OR storyblok_full_slug = ${input.fullSlug}
        OR (${storyId}::bigint IS NOT NULL AND storyblok_story_id = ${storyId})
      )
    RETURNING *
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Turn off internal folders and the other excluded pages.
 * Matches the public path and the Storyblok slug, including a `pages/` prefix.
 */
export async function disableExcludedSitemapUrls(): Promise<number> {
  const excludedSlugs = [
    ...SITEMAP_EXCLUDED_PATHS.map((path) => path.slice(1)),
    ...SITEMAP_EXCLUDED_PATHS.map((path) => `pages${path}`),
  ];
  const folderPaths = SITEMAP_EXCLUDED_FOLDERS.map((folder) => `/${folder}`);
  const folderPathPrefixes = SITEMAP_EXCLUDED_FOLDERS.map((folder) => `/${folder}/%`);
  const folderSlugs = SITEMAP_EXCLUDED_FOLDERS.flatMap((folder) => [folder, `pages/${folder}`]);
  const folderSlugPrefixes = SITEMAP_EXCLUDED_FOLDERS.flatMap((folder) => [`${folder}/%`, `pages/${folder}/%`]);
  const rows = await sql`
    UPDATE site_urls
    SET is_enabled = FALSE, updated_at = NOW()
    WHERE is_enabled = TRUE
      AND (
        path = ANY(${folderPaths}::text[])
        OR path LIKE ANY(${folderPathPrefixes}::text[])
        OR path = ANY(${[...SITEMAP_EXCLUDED_PATHS]}::text[])
        OR storyblok_full_slug = ANY(${folderSlugs}::text[])
        OR storyblok_full_slug LIKE ANY(${folderSlugPrefixes}::text[])
        OR storyblok_full_slug = ANY(${excludedSlugs}::text[])
      )
    RETURNING id
  ` as Array<{ id: number }>;
  return rows.length;
}

export async function disableSiteUrlByFullSlug(fullSlug: string): Promise<SiteUrlRecord | null> {
  const rows = await sql`
    UPDATE site_urls
    SET is_enabled = FALSE, updated_at = NOW()
    WHERE storyblok_full_slug = ${fullSlug}
    RETURNING *
  ` as DbRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function countSiteUrlsByGroup(): Promise<Record<SitemapGroup, { total: number; enabled: number }>> {
  const rows = await sql`
    SELECT
      sitemap_group,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_enabled)::int AS enabled
    FROM site_urls
    GROUP BY sitemap_group
  ` as Array<{ sitemap_group: SitemapGroup; total: number; enabled: number }>;

  const result: Record<SitemapGroup, { total: number; enabled: number }> = {
    pages: { total: 0, enabled: 0 },
    courses: { total: 0, enabled: 0 },
    blog: { total: 0, enabled: 0 },
  };

  for (const row of rows) {
    result[row.sitemap_group] = { total: Number(row.total), enabled: Number(row.enabled) };
  }
  return result;
}
