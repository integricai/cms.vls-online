import { listCourses } from '../models/course';
import {
  createStoryblokDatasource,
  createStoryblokDatasourceEntry,
  deleteStoryblokDatasourceEntry,
  getStoryblokComponent,
  listStoryblokDatasourceEntries,
  listStoryblokDatasources,
  updateStoryblokComponent,
  updateStoryblokDatasourceEntry,
  type StoryblokConfig,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';

export const CMS_COURSES_DATASOURCE_SLUG = 'cms-courses';

export type StoryblokDatasourceSyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  deleted: number;
  error?: string;
};

function entryName(course: { name: string; zenlerCourseId: string; isActive: boolean }): string {
  const label = `${course.name} (${course.zenlerCourseId})`;
  return course.isActive ? label : `${label} [inactive]`;
}

async function ensureDatasource(config: StoryblokConfig): Promise<{ id: number; slug: string }> {
  const existing = (await listStoryblokDatasources(config))
    .find(item => item.slug === CMS_COURSES_DATASOURCE_SLUG);
  if (existing) return existing;
  return createStoryblokDatasource(config, {
    name: 'CMS Courses',
    slug: CMS_COURSES_DATASOURCE_SLUG,
  });
}

async function ensureCoursePageField(config: StoryblokConfig): Promise<void> {
  const component = await getStoryblokComponent(config, 'course_page');
  if (!component?.id || !component.schema) return;

  const current = component.schema.zenler_course_id;
  const currentField = current && typeof current === 'object'
    ? current as Record<string, unknown>
    : {};

  const alreadyLinked = currentField.type === 'option'
    && currentField.source === 'internal'
    && currentField.datasource_slug === CMS_COURSES_DATASOURCE_SLUG;
  if (alreadyLinked) return;

  await updateStoryblokComponent(config, component.id, {
    schema: {
      ...component.schema,
      zenler_course_id: {
        ...currentField,
        type: 'option',
        source: 'internal',
        datasource_slug: CMS_COURSES_DATASOURCE_SLUG,
        required: true,
        display_name: currentField.display_name ?? 'CMS Course',
        description: 'Link this sales page to a CMS course. The value is the Zenler course ID used for pricing and curriculum.',
      },
    },
  });
}

export async function syncCmsCoursesStoryblokDatasource(
  config?: StoryblokConfig | null,
): Promise<StoryblokDatasourceSyncResult> {
  const resolved = config ?? resolveStoryblokConfigFromEnv();
  if (!resolved) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      deleted: 0,
      error: 'Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.',
    };
  }

  const datasource = await ensureDatasource(resolved);
  await ensureCoursePageField(resolved);

  const [courses, existing] = await Promise.all([
    listCourses(),
    listStoryblokDatasourceEntries(resolved, datasource.id),
  ]);

  const wanted = new Map(
    courses
      .filter(course => course.zenlerCourseId)
      .map(course => [course.zenlerCourseId, entryName(course)]),
  );
  const byValue = new Map(existing.map(entry => [entry.value, entry]));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const [value, name] of wanted) {
    const current = byValue.get(value);
    if (!current) {
      await createStoryblokDatasourceEntry(resolved, {
        datasourceId: datasource.id,
        name,
        value,
      });
      created += 1;
      continue;
    }
    if (current.name !== name) {
      await updateStoryblokDatasourceEntry(resolved, current.id, { name, value });
      updated += 1;
    }
  }

  for (const entry of existing) {
    if (wanted.has(entry.value)) continue;
    await deleteStoryblokDatasourceEntry(resolved, entry.id);
    deleted += 1;
  }

  return { ok: true, created, updated, deleted };
}
