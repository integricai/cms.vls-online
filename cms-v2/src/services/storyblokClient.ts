import type { StoryblokRegion } from '../../shared/migrationTypes';

export interface StoryblokConfig {
  spaceId: string;
  accessToken: string;
  region: StoryblokRegion;
}

export interface StoryblokStoryRef {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
}

export class StoryblokApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 502, details: unknown = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function managementBase(region: StoryblokRegion): string {
  return region === 'us'
    ? 'https://api-us.storyblok.com/v1'
    : 'https://mapi.storyblok.com/v1';
}

function previewBase(region: StoryblokRegion): string {
  return region === 'us'
    ? 'https://api-us.storyblok.com/v2/cdn'
    : 'https://api.storyblok.com/v2/cdn';
}

async function storyblokRequest<T>(
  config: StoryblokConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${managementBase(config.region)}/spaces/${config.spaceId}${path}`, {
    method,
    headers: {
      Authorization: config.accessToken,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: { error?: string; [key: string]: unknown } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `Storyblok API returned HTTP ${response.status}`;
    throw new StoryblokApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function verifyStoryblokAccess(config: StoryblokConfig): Promise<{ spaceName: string }> {
  const data = await storyblokRequest<{ space?: { name?: string } }>(config, 'GET', '');
  return { spaceName: data.space?.name ?? 'Storyblok space' };
}

export async function findStoryBySlug(
  config: StoryblokConfig,
  slug: string,
): Promise<StoryblokStoryRef | null> {
  const data = await storyblokRequest<{ stories?: StoryblokStoryRef[] }>(
    config,
    'GET',
    `/stories?with_slug=${encodeURIComponent(slug)}`,
  );
  return data.stories?.[0] ?? null;
}

export async function findCoursesFolder(config: StoryblokConfig): Promise<StoryblokStoryRef | null> {
  const direct = await findStoryBySlug(config, 'courses');
  if (direct) return direct;

  const data = await storyblokRequest<{ stories?: StoryblokStoryRef[] }>(
    config,
    'GET',
    '/stories?folder_only=1&search_term=courses',
  );
  return data.stories?.find(story => story.slug === 'courses') ?? null;
}

export interface UpsertStoryInput {
  name: string;
  slug: string;
  parentId?: number;
  content: Record<string, unknown>;
  publish?: boolean;
}

export async function upsertCourseStory(
  config: StoryblokConfig,
  input: UpsertStoryInput,
): Promise<{ story: StoryblokStoryRef; created: boolean; previewUrl: string }> {
  const fullSlug = input.parentId ? `courses/${input.slug}` : input.slug;
  const existing = await findStoryBySlug(config, fullSlug);

  const payload = {
    story: {
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId,
      content: input.content,
    },
    publish: input.publish ? 1 : 0,
  };

  if (existing) {
    const data = await storyblokRequest<{ story: StoryblokStoryRef }>(
      config,
      'PUT',
      `/stories/${existing.id}`,
      payload,
    );
    return {
      story: data.story,
      created: false,
      previewUrl: `${previewBase(config.region)}/stories/${data.story.full_slug}?token=${encodeURIComponent(config.accessToken)}`,
    };
  }

  const data = await storyblokRequest<{ story: StoryblokStoryRef }>(
    config,
    'POST',
    '/stories',
    payload,
  );
  return {
    story: data.story,
    created: true,
    previewUrl: `${previewBase(config.region)}/stories/${data.story.full_slug}?token=${encodeURIComponent(config.accessToken)}`,
  };
}
