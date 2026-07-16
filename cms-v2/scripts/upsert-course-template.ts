import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import {
  buildMergedCourseStoryblokContent,
  buildTemplateOnlyCourseStoryblokContent,
} from '../src/services/buildCourseTemplateContent';
import { loadCourseTemplateFile } from '../src/services/courseTemplateParser';
import { scrapeCoursePage } from '../src/services/coursePageScraper';
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
  const templateOnly = process.argv.includes('--template-only');
  let zenlerCourseId = process.argv[4]?.trim() || '';

  if (!zenlerCourseId) {
    const courses = await listCourses();
    zenlerCourseId = courses.find((course) => course.slug === slug)?.zenlerCourseId ?? '';
  }
  if (!zenlerCourseId) {
    throw new Error(`Zenler course ID required for slug "${slug}". Pass it as a numeric CLI argument.`);
  }

  const sourceUrl = process.argv.find((arg) => arg.startsWith('http'))?.trim()
    || `https://vls-online.com/courses/${slug}`;

  let content: Record<string, unknown>;
  if (templateOnly) {
    console.log('Using static course.html template only (no live scrape).');
    content = buildTemplateOnlyCourseStoryblokContent(zenlerCourseId, courseCode, slug);
  } else {
    console.log('Scraping live course page:', sourceUrl);
    const scraped = await scrapeCoursePage(sourceUrl);
    if (!scraped.courseDescription) {
      console.warn('Warning: course description not detected on live page.');
    }
    if (!scraped.tabs.length) {
      console.warn('Warning: course tabs not detected on live page.');
    }
    console.log(
      'Scraped description:',
      scraped.courseDescription?.introP1?.length ?? 0,
      'chars intro,',
      (scraped.courseDescription?.introP2?.length ?? 0)
        + (scraped.courseDescription?.bodyText?.length ?? 0),
      'chars read-more,',
      scraped.tabs.length,
      'tabs',
    );
    content = buildMergedCourseStoryblokContent(scraped, zenlerCourseId);
  }

  const body = Array.isArray(content.body) ? content.body as Array<Record<string, unknown>> : [];

  console.log('Story sections:');
  for (const blok of body) {
    const nested = [
      ['items', blok.items],
      ['cards', blok.cards],
      ['stats', blok.stats],
      ['left', blok.left],
      ['right', blok.right],
      ['tabs', blok.tabs],
    ].filter(([, value]) => Array.isArray(value) && value.length)
      .map(([key, value]) => `${key}=${(value as unknown[]).length}`)
      .join(', ') || '—';
    console.log(`  ${String(blok.component).padEnd(24)} ${nested}`);
  }

  const intro = body.find((blok) => blok.component === 'course_introduction');
  if (intro) {
    console.log(
      'Introduction:',
      String(intro.title ?? ''),
      '| p1=',
      String(intro.paragraph_1 ?? '').length,
      'chars | p2=',
      String(intro.paragraph_2 ?? '').length,
      'chars',
    );
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
