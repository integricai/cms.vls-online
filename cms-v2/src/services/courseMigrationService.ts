import type { CourseMigrationRequest, CourseMigrationResult, ScrapedCoursePage } from '../../shared/migrationTypes';
import { listCourses } from '../models/course';
import { CoursePageScrapeError, scrapeCoursePage } from './coursePageScraper';
import {
  findCoursesFolder,
  StoryblokApiError,
  upsertCourseStory,
  verifyStoryblokAccess,
  type StoryblokConfig,
} from './storyblokClient';

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function richTextParagraph(text: string): string {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
}

function buildHeroRightRichtext(scraped: ScrapedCoursePage): string {
  if (!scraped.heroRight?.items.length) return '';
  const lines = scraped.heroRight.items.map(item => {
    const parts = [`<strong>${item.title}</strong>`];
    if (item.description) parts.push(item.description);
    if (item.badge) parts.push(`(${item.badge})`);
    return `<li>${parts.join(' — ')}</li>`;
  });
  const heading = scraped.heroRight.label || 'This course includes';
  return `<h3>${heading}</h3><ul>${lines.join('')}</ul>`;
}

function buildTabRichtext(scraped: ScrapedCoursePage): string {
  if (!scraped.tabs.length) return '';
  return scraped.tabs.map(tab => {
    const heading = tab.icon ? `${tab.icon} ${tab.label}` : tab.label;
    const body = tab.contentHtml || richTextParagraph(tab.contentText);
    return `<h3>${heading}</h3>${body}`;
  }).join('');
}

function buildLearnRichtext(scraped: ScrapedCoursePage): string {
  if (!scraped.hero?.learnItems.length) return '';
  const label = scraped.hero.learnLabel || "What you'll learn";
  const items = scraped.hero.learnItems.map(item => {
    const subtitle = item.subtitle ? ` — ${item.subtitle}` : '';
    return `<li><strong>${item.title}</strong>${subtitle}</li>`;
  });
  return `<h3>${label}</h3><ul>${items.join('')}</ul>`;
}

function buildStoryblokContent(scraped: ScrapedCoursePage, zenlerCourseId: string): Record<string, unknown> {
  const heroBlok = scraped.hero ? [{
    _uid: blokUid(),
    component: 'section_hero',
    eyebrow: scraped.hero.eyebrow || scraped.hero.tags.join(' · '),
    headline: scraped.hero.heading,
    subheadline: scraped.hero.description,
    breadcrumb: scraped.hero.breadcrumb,
    cta_label: scraped.heroRight?.ctaText ?? '',
    cta_link: scraped.heroRight?.ctaUrl ?? '',
  }] : [];

  const outcomeParts = [
    buildLearnRichtext(scraped),
    buildHeroRightRichtext(scraped),
  ].filter(Boolean);

  const outcomes = outcomeParts.length ? [{
    _uid: blokUid(),
    component: 'section_richtext',
    content: { type: 'doc', content: [] },
    body: outcomeParts.join('\n'),
  }] : [];

  const curriculumSummary = scraped.tabs.length ? [{
    _uid: blokUid(),
    component: 'section_richtext',
    content: { type: 'doc', content: [] },
    body: buildTabRichtext(scraped),
  }] : [];

  const courseDescription = scraped.courseDescription ? [{
    _uid: blokUid(),
    component: 'course_description',
    icon: scraped.courseDescription.icon,
    title: scraped.courseDescription.title,
    intro_bold: scraped.courseDescription.introBold,
    intro_paragraph_1: scraped.courseDescription.introP1,
    intro_paragraph_2: scraped.courseDescription.introP2,
    body: scraped.courseDescription.bodyHtml,
  }] : [];

  const faqItems = scraped.faq?.items.map(item => ({
    _uid: blokUid(),
    component: 'faq_item',
    question: item.question,
    answer: item.answerHtml || richTextParagraph(item.answerText),
  })) ?? [];

  const faq = faqItems.length ? [{
    _uid: blokUid(),
    component: 'section_faq',
    title: scraped.faq?.title ?? 'Frequently Asked Questions',
    icon: scraped.faq?.icon ?? '❔',
    items: faqItems,
  }] : [];

  const pricing = zenlerCourseId ? [{
    _uid: blokUid(),
    component: 'course_price_block',
    zenler_course_id: zenlerCourseId,
    layout_variant: 'default',
    show_compare: true,
  }] : [];

  return {
    component: 'course_page',
    title: scraped.title,
    slug: scraped.slug,
    zenler_course_id: zenlerCourseId,
    course_code: scraped.courseCode,
    seo_title: scraped.title,
    seo_description: scraped.metaDescription,
    hero: heroBlok,
    course_description: courseDescription,
    outcomes,
    curriculum_summary: curriculumSummary,
    pricing,
    faq,
  };
}

function collectWarnings(scraped: ScrapedCoursePage, zenlerCourseId: string): string[] {
  const warnings: string[] = [];
  if (!scraped.hero) warnings.push('Course hero section was not detected on the source page.');
  if (!scraped.heroRight?.items.length) warnings.push('Course hero right card was not detected.');
  if (!scraped.courseDescription) warnings.push('Course description section was not detected between hero and tabs.');
  if (!scraped.tabs.length) warnings.push('Course tabs section was not detected.');
  if (!scraped.faq?.items.length) warnings.push('FAQ section was not detected.');
  if (!zenlerCourseId) warnings.push('Zenler course ID was not found. Pricing blok was skipped.');
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  return warnings;
}

async function resolveZenlerCourseId(scraped: ScrapedCoursePage): Promise<string> {
  if (scraped.zenlerCourseId) return scraped.zenlerCourseId;
  const courses = await listCourses();
  const match = courses.find(course => course.slug === scraped.slug);
  return match?.zenlerCourseId ?? '';
}

export class CourseMigrationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function storyblokConfig(input: CourseMigrationRequest): StoryblokConfig {
  return {
    spaceId: input.storyblokSpaceId.trim(),
    accessToken: input.storyblokAccessToken.trim(),
    region: input.storyblokRegion,
  };
}

export async function migrateCoursePage(input: CourseMigrationRequest): Promise<CourseMigrationResult> {
  if (!input.pageUrl?.trim()) throw new CourseMigrationError('Course page URL is required');
  if (!input.storyblokSpaceId?.trim()) throw new CourseMigrationError('Storyblok space ID is required');
  if (!input.storyblokAccessToken?.trim()) throw new CourseMigrationError('Storyblok access token is required');

  const scraped = await scrapeCoursePage(input.pageUrl.trim());
  const zenlerCourseId = await resolveZenlerCourseId(scraped);
  const warnings = collectWarnings(scraped, zenlerCourseId);

  if (input.dryRun) {
    return { scraped, warnings };
  }

  const config = storyblokConfig(input);
  await verifyStoryblokAccess(config);

  const coursesFolder = await findCoursesFolder(config);
  if (!coursesFolder) {
    throw new CourseMigrationError(
      'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
      404,
    );
  }

  const content = buildStoryblokContent(scraped, zenlerCourseId);
  const upsert = await upsertCourseStory(config, {
    name: scraped.title || scraped.slug.toUpperCase(),
    slug: scraped.slug,
    parentId: coursesFolder.id,
    content,
    publish: Boolean(input.publish),
  });

  if (!upsert.created) {
    warnings.push('An existing Storyblok story was updated for this course slug.');
  }

  return {
    scraped,
    warnings,
    storyblok: {
      storyId: upsert.story.id,
      fullSlug: upsert.story.full_slug,
      previewUrl: upsert.previewUrl,
      created: upsert.created,
    },
  };
}

export { CoursePageScrapeError, StoryblokApiError };
