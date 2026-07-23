import type { StoryblokConfig, StoryblokUploadedAsset } from './storyblokClient';
import { uploadStoryblokAssetCached } from './storyblokClient';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hero-stage';
}

function isUploadableImageSource(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  return /^https?:\/\//i.test(trimmed);
}

function isStoryblokAssetUrl(source: string): boolean {
  return /storyblok\.com/i.test(source);
}

async function uploadHeroStageImage(
  config: StoryblokConfig,
  cache: Map<string, Promise<StoryblokUploadedAsset>>,
  blok: Record<string, unknown>,
  folder = 'course-hero',
): Promise<{ blok: Record<string, unknown>; uploaded: boolean }> {
  const source = String(blok.migration_stage_image_url ?? '').trim();
  if (!source || !isUploadableImageSource(source) || isStoryblokAssetUrl(source)) {
    const { migration_stage_image_url: _url, migration_stage_image_alt: _alt, ...rest } = blok;
    return { blok: rest, uploaded: false };
  }

  const alt = String(blok.migration_stage_image_alt ?? blok.stage_caption_title ?? 'Hero stage image').trim();
  const slug = slugify(alt || 'hero-stage');

  try {
    const asset = await uploadStoryblokAssetCached(config, cache, {
      sourceUrl: source,
      filename: `${folder}/${slug}`,
      alt,
    });
    const { migration_stage_image_url: _url, migration_stage_image_alt: _alt, ...rest } = blok;
    return { blok: { ...rest, stage_image: asset }, uploaded: true };
  } catch {
    const { migration_stage_image_url: _url, migration_stage_image_alt: _alt, ...rest } = blok;
    return { blok: rest, uploaded: false };
  }
}

async function hydrateBlokTree(
  blok: Record<string, unknown>,
  config: StoryblokConfig,
  cache: Map<string, Promise<StoryblokUploadedAsset>>,
  warnings: string[],
): Promise<Record<string, unknown>> {
  let next = blok;

  if (blok.component === 'course_hero' && blok.stage_mode === 'image') {
    const hadSource = Boolean(String(blok.migration_stage_image_url ?? '').trim());
    const result = await uploadHeroStageImage(config, cache, blok);
    next = result.blok;
    if (hadSource && !result.uploaded) {
      warnings.push('Hero stage image could not be uploaded to Storyblok — upload it manually in the course hero blok.');
    }
  }

  if (blok.component === 'level_hero_main' && blok.stage_mode === 'image') {
    const hadSource = Boolean(String(blok.migration_stage_image_url ?? '').trim());
    const result = await uploadHeroStageImage(config, cache, blok, 'level-hero');
    next = result.blok;
    if (hadSource && !result.uploaded) {
      warnings.push('Hero stage image could not be uploaded to Storyblok — upload it manually in the level hero blok.');
    }
  }

  const entries = Object.entries(next);
  const hydratedEntries = await Promise.all(entries.map(async ([key, value]) => {
    if (Array.isArray(value)) {
      const items = await Promise.all(
        value.map(async (item) => (
          item && typeof item === 'object'
            ? hydrateBlokTree(item as Record<string, unknown>, config, cache, warnings)
            : item
        )),
      );
      return [key, items] as const;
    }
    return [key, value] as const;
  }));

  return Object.fromEntries(hydratedEntries);
}

export async function hydrateCourseHeroStageImages(
  content: Record<string, unknown>,
  config: StoryblokConfig | null,
): Promise<{ content: Record<string, unknown>; warnings: string[] }> {
  if (!config) return { content, warnings: [] };

  const cache = new Map<string, Promise<StoryblokUploadedAsset>>();
  const warnings: string[] = [];
  const body = Array.isArray(content.body) ? content.body as Record<string, unknown>[] : [];

  const hydratedBody = await Promise.all(
    body.map(async (blok) => hydrateBlokTree(blok, config, cache, warnings)),
  );

  return {
    content: { ...content, body: hydratedBody },
    warnings: [...new Set(warnings)],
  };
}
