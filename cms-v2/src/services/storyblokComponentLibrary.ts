import crypto from 'node:crypto';
import type { MigrationTemplate } from '../../shared/migrationTypes';
import type {
  ComponentLibraryPresetRef,
  ComponentLibrarySyncResult,
  MigrationTemplateBlueprint,
  TemplateSectionBlueprint,
} from '../../shared/migrationTemplateTypes';
import {
  buildPresetBlokFromSection,
  getMigrationTemplateBlueprint,
} from './migrationTemplateRegistry';
import {
  findStoryBySlug,
  StoryblokApiError,
  upsertStory,
  type StoryblokConfig,
  type StoryblokStoryRef,
} from './storyblokClient';

export const COMPONENT_LIBRARY_FOLDER = 'component-library';

function cloneBlokWithFreshUids(blok: Record<string, unknown>): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(blok)) as Record<string, unknown>;
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.component === 'string') {
      record._uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
    for (const value of Object.values(record)) walk(value);
  }
  walk(cloned);
  return cloned;
}

async function findOrCreateFolder(
  config: StoryblokConfig,
  slug: string,
  parentId?: number,
): Promise<StoryblokStoryRef> {
  const fullSlug = parentId ? `${COMPONENT_LIBRARY_FOLDER}/${slug}` : COMPONENT_LIBRARY_FOLDER;
  const existing = await findStoryBySlug(config, fullSlug);
  if (existing) return existing;

  const created = await upsertStory(config, {
    name: parentId ? slug.replace(/_/g, ' ') : 'Component Library',
    slug,
    parentId,
    fullSlug,
    content: { component: 'page', body: [] },
    isFolder: true,
    publish: false,
  });

  return created.story;
}

async function ensureLibraryFolder(config: StoryblokConfig): Promise<StoryblokStoryRef> {
  return findOrCreateFolder(config, 'component-library');
}

async function ensureTemplateFolder(
  config: StoryblokConfig,
  template: MigrationTemplate,
  libraryFolderId: number,
): Promise<StoryblokStoryRef> {
  return findOrCreateFolder(config, template, libraryFolderId);
}

function presetStorySlug(template: MigrationTemplate, sectionKey: string): string {
  return `${COMPONENT_LIBRARY_FOLDER}/${template}/${sectionKey}`;
}

export async function upsertLibraryPreset(
  config: StoryblokConfig,
  blueprint: MigrationTemplateBlueprint,
  section: TemplateSectionBlueprint,
  templateFolderId: number,
): Promise<ComponentLibraryPresetRef> {
  const presetBlok = buildPresetBlokFromSection(blueprint, section);
  const fullSlug = presetStorySlug(blueprint.template, section.key);

  const result = await upsertStory(config, {
    name: `${blueprint.template} / ${section.label}`.slice(0, 100),
    slug: section.key,
    parentId: templateFolderId,
    fullSlug,
    content: {
      component: 'page',
      body: [presetBlok],
    },
    publish: false,
  });

  return {
    template: blueprint.template,
    sectionKey: section.key,
    fullSlug,
    storyId: result.story.id,
    component: section.component,
    created: result.created,
  };
}

export async function syncTemplateComponentLibrary(
  config: StoryblokConfig,
  template: MigrationTemplate,
): Promise<ComponentLibrarySyncResult> {
  const blueprint = getMigrationTemplateBlueprint(template);
  const libraryFolder = await ensureLibraryFolder(config);
  const templateFolder = await ensureTemplateFolder(config, template, libraryFolder.id);

  const presets: ComponentLibraryPresetRef[] = [];
  const presetBloksBySection: Record<string, Record<string, unknown>> = {};
  let created = 0;
  let updated = 0;

  for (const section of blueprint.sections) {
    presetBloksBySection[section.key] = buildPresetBlokFromSection(blueprint, section);
    const preset = await upsertLibraryPreset(config, blueprint, section, templateFolder.id);
    presets.push(preset);
    if (preset.created) created += 1;
    else updated += 1;
  }

  return {
    folderSlug: COMPONENT_LIBRARY_FOLDER,
    presets,
    created,
    updated,
    presetBloksBySection,
  };
}

export async function getLibraryPresetBlok(
  config: StoryblokConfig,
  template: MigrationTemplate,
  sectionKey: string,
): Promise<Record<string, unknown> | null> {
  const fullSlug = presetStorySlug(template, sectionKey);
  const story = await findStoryBySlug(config, fullSlug);
  if (!story) return null;

  const data = await fetchStoryContent(config, story.id);
  const body = data?.content?.body;
  if (!Array.isArray(body) || !body[0] || typeof body[0] !== 'object') return null;
  return cloneBlokWithFreshUids(body[0] as Record<string, unknown>);
}

async function fetchStoryContent(
  config: StoryblokConfig,
  storyId: number,
): Promise<{ content?: { body?: unknown[] } } | null> {
  const regionBase = config.region === 'us'
    ? 'https://api-us.storyblok.com/v1'
    : 'https://mapi.storyblok.com/v1';
  const spaceId = config.spaceId.trim().match(/(\d{4,})/)?.[1] ?? config.spaceId.trim();
  const token = config.accessToken.trim().replace(/^Bearer\s+/i, '');

  const response = await fetch(`${regionBase}/spaces/${spaceId}/stories/${storyId}`, {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new StoryblokApiError(`Could not load component library preset story ${storyId}`, response.status);
  }

  return response.json() as Promise<{ content?: { body?: unknown[] } }>;
}

export function mergePresetWithData(
  preset: Record<string, unknown> | null,
  data: Record<string, unknown>,
  fallbackStyles: Record<string, string | number>,
): Record<string, unknown> {
  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  if (!preset) {
    return {
      _uid: uid,
      ...fallbackStyles,
      ...data,
    };
  }

  return {
    ...preset,
    ...data,
    _uid: uid,
  };
}

export { cloneBlokWithFreshUids };
