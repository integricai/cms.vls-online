import { sql } from '../db/client';
import {
  disableSiteUrlByFullSlug,
  disableSiteUrlByStoryId,
  upsertSiteUrl,
  type SiteUrlRecord,
} from '../models/siteUrl';
import {
  getStoryById,
  listStories,
  type StoryblokConfig,
  type StoryblokStoryRecord,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';
import {
  extractNoIndex,
  resolveSitemapGroup,
  storyblokSlugToPath,
} from './sitemapPaths';

interface StoryblokListStory extends StoryblokStoryRecord {
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const SYNC_PREFIXES = ['pages/', 'courses/', 'blog'] as const;

function isPublished(story: StoryblokListStory): boolean {
  return Boolean(story.published_at);
}

function lastmodFromStory(story: StoryblokListStory): string | null {
  return story.published_at || story.updated_at || story.created_at || null;
}

export async function upsertFromStoryblokStory(
  story: StoryblokListStory,
  options?: { preserveEnabled?: boolean; forceDisabled?: boolean },
): Promise<SiteUrlRecord | null> {
  const fullSlug = story.full_slug?.replace(/^\/+|\/+$/g, '') ?? '';
  if (!fullSlug || story.is_folder) return null;

  const group = resolveSitemapGroup(fullSlug);
  if (!group) return null;

  const path = storyblokSlugToPath(fullSlug);
  const noIndex = extractNoIndex(story.content);
  const shouldDisable = Boolean(options?.forceDisabled) || noIndex || !isPublished(story);

  return upsertSiteUrl({
    path,
    sitemapGroup: group,
    storyblokFullSlug: fullSlug,
    storyblokStoryId: story.id,
    title: story.name ?? '',
    isEnabled: !shouldDisable,
    lastmod: lastmodFromStory(story),
    preserveEnabled: options?.preserveEnabled && !shouldDisable && !noIndex,
  });
}

export async function syncSiteUrlsFromStoryblok(config?: StoryblokConfig | null): Promise<{
  scanned: number;
  upserted: number;
  skipped: number;
  disabled: number;
}> {
  const resolved = config ?? resolveStoryblokConfigFromEnv();
  if (!resolved) {
    throw new Error('Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN (and space/region).');
  }

  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  const seenStoryIds: number[] = [];

  for (const prefix of SYNC_PREFIXES) {
    const stories = await listStories(resolved, {
      starts_with: prefix === 'blog' ? 'blog' : prefix,
      per_page: 100,
    }) as StoryblokListStory[];

    for (const story of stories) {
      scanned += 1;
      if (story.is_folder) {
        skipped += 1;
        continue;
      }
      if (!isPublished(story)) {
        skipped += 1;
        continue;
      }

      // Bulk sync uses list data (content/no_index applied on webhook publish).
      const row = await upsertFromStoryblokStory(story, { preserveEnabled: true });
      if (row) {
        upserted += 1;
        if (row.storyblokStoryId != null) seenStoryIds.push(row.storyblokStoryId);
      } else {
        skipped += 1;
      }
    }
  }

  let disabled = 0;
  if (seenStoryIds.length) {
    const rows = await sql`
      UPDATE site_urls
      SET is_enabled = FALSE, updated_at = NOW()
      WHERE is_enabled = TRUE
        AND storyblok_story_id IS NOT NULL
        AND NOT (storyblok_story_id = ANY(${seenStoryIds}::bigint[]))
      RETURNING id
    ` as Array<{ id: number }>;
    disabled = rows.length;
  }

  return { scanned, upserted, skipped, disabled };
}

export type StoryblokSitemapWebhookPayload = {
  action?: string;
  text?: string;
  full_slug?: string;
  story_id?: number | string;
  storyId?: number | string;
};

export async function handleStoryblokSitemapWebhook(
  payload: StoryblokSitemapWebhookPayload,
  config?: StoryblokConfig | null,
): Promise<{ ok: true; result: string; row: SiteUrlRecord | null }> {
  const resolved = config ?? resolveStoryblokConfigFromEnv();
  if (!resolved) {
    throw new Error('Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN (and space/region).');
  }

  const action = (payload.action ?? payload.text ?? '').toLowerCase();
  const storyIdRaw = payload.story_id ?? payload.storyId;
  const storyId = storyIdRaw != null && storyIdRaw !== '' ? Number(storyIdRaw) : null;
  const fullSlug = typeof payload.full_slug === 'string'
    ? payload.full_slug.replace(/^\/+|\/+$/g, '')
    : '';

  const isUnpublish = action.includes('unpublish') || action.includes('deleted') || action.includes('delete');

  if (isUnpublish) {
    if (storyId != null && Number.isFinite(storyId)) {
      const row = await disableSiteUrlByStoryId(storyId);
      return { ok: true, result: 'disabled', row };
    }
    if (fullSlug) {
      const row = await disableSiteUrlByFullSlug(fullSlug);
      return { ok: true, result: 'disabled', row };
    }
    return { ok: true, result: 'ignored_no_identity', row: null };
  }

  if (storyId != null && Number.isFinite(storyId)) {
    const story = await getStoryById(resolved, storyId) as StoryblokListStory | null;
    if (!story) {
      return { ok: true, result: 'story_not_found', row: null };
    }
    // Preserve admin disables unless Storyblok SEO no_index forces off.
    const row = await upsertFromStoryblokStory(story, { preserveEnabled: true });
    return { ok: true, result: row ? 'upserted' : 'skipped', row };
  }

  if (fullSlug) {
    const stories = await listStories(resolved, { with_slug: fullSlug, per_page: 1 }) as StoryblokListStory[];
    const story = stories[0];
    if (!story) {
      return { ok: true, result: 'story_not_found', row: null };
    }
    const detailed = (await getStoryById(resolved, story.id) as StoryblokListStory | null) ?? story;
    const row = await upsertFromStoryblokStory(detailed, { preserveEnabled: true });
    return { ok: true, result: row ? 'upserted' : 'skipped', row };
  }

  return { ok: true, result: 'ignored_no_identity', row: null };
}
