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

export function normalizeStoryblokToken(token: string): string {
  return token.trim().replace(/^Bearer\s+/i, '');
}

export function normalizeStoryblokSpaceId(spaceId: string): string {
  const trimmed = spaceId.trim();
  const match = trimmed.match(/(\d{4,})/);
  return match?.[1] ?? trimmed;
}

function managementBase(region: StoryblokRegion): string {
  return region === 'us'
    ? 'https://api-us.storyblok.com/v1'
    : 'https://mapi.storyblok.com/v1';
}

function formatFieldErrors(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
      .filter(Boolean)
      .map(message => (prefix ? `${prefix}: ${message}` : message));
  }

  const messages: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string') {
      messages.push(`${nextPrefix}: ${nested}`);
      continue;
    }
    messages.push(...formatFieldErrors(nested, nextPrefix));
  }
  return messages;
}

function formatStoryblokError(status: number, payload: unknown): string {
  if (status === 401) {
    return [
      'Storyblok authentication failed.',
      'Use a Personal access token from My account → Account settings → Personal access tokens.',
      'Do not use the Preview/Public token from Space settings → Access tokens.',
      'The token needs Stories (read + write) scope and access to this space.',
      'Also confirm the region matches your space (EU vs US).',
    ].join(' ');
  }

  if (status === 404) {
    return 'Storyblok space not found. Check the numeric space ID in Space settings → General.';
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const fieldMessages = [
      ...formatFieldErrors(record.story),
      ...formatFieldErrors(record.errors),
    ];
    if (fieldMessages.length) {
      return `Storyblok validation failed: ${fieldMessages.join('; ')}`;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return status === 422
        ? `Storyblok validation failed (HTTP 422): ${record.error}`
        : record.error;
    }
  }

  if (status === 422) {
    return [
      'Storyblok rejected the story payload (HTTP 422).',
      'Usually this means a required field is missing, a component is not allowed on the page type,',
      'or a slug/folder conflict exists. Check the component whitelist for `page` in Storyblok.',
    ].join(' ');
  }

  return `Storyblok API returned HTTP ${status}`;
}

function previewBase(region: StoryblokRegion): string {
  return region === 'us'
    ? 'https://api-us.storyblok.com/v2/cdn'
    : 'https://api.storyblok.com/v2/cdn';
}

function buildConfig(config: StoryblokConfig): StoryblokConfig {
  return {
    ...config,
    spaceId: normalizeStoryblokSpaceId(config.spaceId),
    accessToken: normalizeStoryblokToken(config.accessToken),
  };
}

export function isStoryblokApiError(err: unknown): err is StoryblokApiError {
  return err instanceof StoryblokApiError
    || (err instanceof Error && err.name === 'StoryblokApiError' && typeof (err as StoryblokApiError).status === 'number');
}

async function storyblokRequest<T>(
  rawConfig: StoryblokConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const config = buildConfig(rawConfig);
  let response: Response;
  try {
    response = await fetch(`${managementBase(config.region)}/spaces/${config.spaceId}${path}`, {
      method,
      headers: {
        Authorization: config.accessToken,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed';
    throw new StoryblokApiError(`Storyblok request failed: ${message}`, 502, cause);
  }

  let payload: { error?: string; [key: string]: unknown } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new StoryblokApiError(
      formatStoryblokError(response.status, payload),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function verifyStoryblokAccess(config: StoryblokConfig): Promise<{ spaceName: string }> {
  const normalized = buildConfig(config);
  await storyblokRequest<{ stories?: unknown[] }>(normalized, 'GET', '/stories?per_page=1');
  const data = await storyblokRequest<{ space?: { name?: string } }>(normalized, 'GET', '');
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
  fullSlug: string;
  content: Record<string, unknown>;
  publish?: boolean;
  isFolder?: boolean;
}

export async function upsertStory(
  config: StoryblokConfig,
  input: UpsertStoryInput,
): Promise<{ story: StoryblokStoryRef; created: boolean; previewUrl: string }> {
  const normalized = buildConfig(config);
  const existing = await findStoryBySlug(normalized, input.fullSlug);

  const payload = {
    story: {
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId,
      ...(input.isFolder
        ? { is_folder: true }
        : { content: input.content }),
    },
    publish: input.publish ? 1 : 0,
  };

  if (existing) {
    const data = await storyblokRequest<{ story: StoryblokStoryRef }>(
      normalized,
      'PUT',
      `/stories/${existing.id}`,
      payload,
    );
    return {
      story: data.story,
      created: false,
      previewUrl: `${previewBase(normalized.region)}/stories/${data.story.full_slug}?token=${encodeURIComponent(normalized.accessToken)}`,
    };
  }

  const data = await storyblokRequest<{ story: StoryblokStoryRef }>(
    normalized,
    'POST',
    '/stories',
    payload,
  );
  return {
    story: data.story,
    created: true,
    previewUrl: `${previewBase(normalized.region)}/stories/${data.story.full_slug}?token=${encodeURIComponent(normalized.accessToken)}`,
  };
}

/** @deprecated Use upsertStory */
export async function upsertCourseStory(
  config: StoryblokConfig,
  input: Omit<UpsertStoryInput, 'fullSlug'> & { parentId?: number },
): Promise<{ story: StoryblokStoryRef; created: boolean; previewUrl: string }> {
  const fullSlug = input.parentId ? `courses/${input.slug}` : input.slug;
  return upsertStory(config, { ...input, fullSlug });
}
