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

const SALES_PAGE_REQUIRED_MESSAGE =
  'You cannot create a course sales page without adding the course to Zenler first. Add it in Zenler, sync it in the CMS, then select it here.';

const CMS_COURSE_FIELD_COMPONENTS: Array<{
  name: string;
  required: boolean;
  displayName: string;
  description: string;
}> = [
  {
    name: 'course_page',
    required: true,
    displayName: 'CMS Course',
    description: SALES_PAGE_REQUIRED_MESSAGE,
  },
  {
    name: 'course_hero',
    required: true,
    displayName: 'CMS Course',
    description: SALES_PAGE_REQUIRED_MESSAGE,
  },
  {
    name: 'course_pricing',
    required: true,
    displayName: 'CMS Course',
    description: SALES_PAGE_REQUIRED_MESSAGE,
  },
  {
    name: 'course_curriculum',
    required: true,
    displayName: 'CMS Course',
    description: SALES_PAGE_REQUIRED_MESSAGE,
  },
  {
    name: 'zenler_curriculum',
    required: true,
    displayName: 'CMS Course',
    description: SALES_PAGE_REQUIRED_MESSAGE,
  },
  {
    name: 'faq_section',
    required: false,
    displayName: 'CMS Course',
    description: 'Optional. Filter FAQs to a CMS course. Leave empty for site-wide FAQs.',
  },
];

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

function cmsCourseOptionField(
  currentField: Record<string, unknown>,
  spec: (typeof CMS_COURSE_FIELD_COMPONENTS)[number],
): Record<string, unknown> {
  return {
    ...currentField,
    type: 'option',
    source: 'internal',
    datasource_slug: CMS_COURSES_DATASOURCE_SLUG,
    exclude_empty_option: spec.required,
    required: spec.required,
    display_name: spec.displayName,
    description: spec.description,
  };
}

function fieldNeedsUpdate(
  currentField: Record<string, unknown>,
  spec: (typeof CMS_COURSE_FIELD_COMPONENTS)[number],
): boolean {
  return currentField.type !== 'option'
    || currentField.source !== 'internal'
    || currentField.datasource_slug !== CMS_COURSES_DATASOURCE_SLUG
    || currentField.required !== spec.required
    || currentField.description !== spec.description
    || currentField.display_name !== spec.displayName;
}

async function ensureCmsCourseFields(config: StoryblokConfig): Promise<void> {
  for (const spec of CMS_COURSE_FIELD_COMPONENTS) {
    const component = await getStoryblokComponent(config, spec.name);
    if (!component?.id || !component.schema) continue;

    const current = component.schema.zenler_course_id;
    const currentField = current && typeof current === 'object'
      ? current as Record<string, unknown>
      : {};
    if (!fieldNeedsUpdate(currentField, spec)) continue;

    await updateStoryblokComponent(config, component.id, {
      schema: {
        ...component.schema,
        zenler_course_id: cmsCourseOptionField(currentField, spec),
      },
    });
  }
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
  await ensureCmsCourseFields(resolved);

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
