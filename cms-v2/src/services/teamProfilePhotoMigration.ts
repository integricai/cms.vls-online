import type { StoryblokConfig, StoryblokUploadedAsset } from './storyblokClient';
import { uploadStoryblokAssetCached } from './storyblokClient';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team-member';
}

function isUploadablePhotoSource(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  return /^https?:\/\//i.test(trimmed);
}

function isStoryblokAssetUrl(source: string): boolean {
  return /storyblok\.com/i.test(source);
}

async function uploadProfilePhoto(
  config: StoryblokConfig,
  cache: Map<string, Promise<StoryblokUploadedAsset>>,
  profile: Record<string, unknown>,
): Promise<StoryblokUploadedAsset | null> {
  const source = String(profile.migration_photo_url ?? '').trim();
  if (!source || !isUploadablePhotoSource(source) || isStoryblokAssetUrl(source)) {
    return null;
  }

  const name = String(profile.name ?? 'team-member').trim() || 'team-member';
  try {
    return await uploadStoryblokAssetCached(config, cache, {
      sourceUrl: source,
      filename: `team/${slugify(name)}`,
      alt: name,
    });
  } catch {
    return null;
  }
}

export async function hydrateTeamProfilePhotos(
  blok: Record<string, unknown> | null,
  config: StoryblokConfig | null,
): Promise<Record<string, unknown> | null> {
  if (!blok || blok.component !== 'team_profiles' || !config) return blok;
  if (!Array.isArray(blok.profiles) || !blok.profiles.length) return blok;

  const cache = new Map<string, Promise<StoryblokUploadedAsset>>();
  const profiles = await Promise.all(
    (blok.profiles as Record<string, unknown>[]).map(async (profile) => {
      const asset = await uploadProfilePhoto(config, cache, profile);
      if (!asset) return profile;

      const { migration_photo_url: _removed, ...rest } = profile;
      return { ...rest, photo: asset };
    }),
  );

  return { ...blok, profiles };
}
