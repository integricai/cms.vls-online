import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { buildTemplateOnlyCourseStoryblokContent } from '../src/services/buildCourseTemplateContent';
import { loadCourseTemplateFile } from '../src/services/courseTemplateParser';
import { findCoursesFolder, upsertStory } from '../src/services/storyblokClient';
import { listCourses } from '../src/models/course';

async function main() {
  const token = process.env.STORYBLOK_PERSONAL_TOKEN;
  const spaceId = process.env.STORYBLOK_SPACE_ID || '293626385802926';
  if (!token) {
    throw new Error('STORYBLOK_PERSONAL_TOKEN missing in vls-web/.env.local');
  }

  const config = {
    spaceId,
    accessToken: token,
    region: (process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu') as 'eu' | 'us',
  };

  const template = loadCourseTemplateFile();
  const slug = process.argv[2]?.trim() || 'sbr';
  const courseCode = process.argv[3]?.trim() || template.courseCode || 'SBR';
  let zenlerCourseId = process.argv[4]?.trim() || '';
  if (!zenlerCourseId) {
    const courses = await listCourses();
    zenlerCourseId = courses.find((course) => course.slug === slug)?.zenlerCourseId ?? '';
  }
  if (!zenlerCourseId) {
    throw new Error(`Zenler course ID required for slug "${slug}". Pass it as the 4th CLI argument.`);
  }

  const content = buildTemplateOnlyCourseStoryblokContent(zenlerCourseId, courseCode, slug);
  const body = Array.isArray(content.body) ? content.body as Array<Record<string, unknown>> : [];

  console.log('Template sections:');
  for (const blok of body) {
    const nested = [
      ['items', blok.items],
      ['cards', blok.cards],
      ['stats', blok.stats],
      ['left', blok.left],
      ['right', blok.right],
    ].filter(([, value]) => Array.isArray(value) && value.length)
      .map(([key, value]) => `${key}=${(value as unknown[]).length}`)
      .join(', ') || '—';
    console.log(`  ${String(blok.component).padEnd(24)} ${nested}`);
  }

  const coursesFolder = await findCoursesFolder(config);
  if (!coursesFolder) {
    throw new Error('Could not find Storyblok folder with slug "courses"');
  }

  const result = await upsertStory(config, {
    name: template.title,
    slug,
    parentId: coursesFolder.id,
    fullSlug: `courses/${slug}`,
    content,
    publish: true,
  });

  console.log('Upserted:', result.story.full_slug, 'id=', result.story.id, 'created=', result.created);
  console.log('Preview:', result.previewUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
