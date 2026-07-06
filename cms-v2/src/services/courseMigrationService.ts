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

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function normalizeFaqQuestion(question: string): string {
  return question.replace(/^\d+\.\s*/, '').trim();
}

function buildHeroLayoutBlok(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  sourceUrl: string,
): Record<string, unknown> | null {
  if (!scraped.hero && !scraped.heroRight) return null;

  const left = scraped.hero
    ? [{
        _uid: blokUid(),
        component: 'course_hero',
        breadcrumb: scraped.hero.breadcrumb,
        zenler_course_id: zenlerCourseId,
        heading: scraped.hero.heading,
        description: scraped.hero.description,
        learn_section_label: scraped.hero.learnLabel || "WHAT YOU'LL LEARN",
        learn_items: scraped.hero.learnItems.map(item => ({
          _uid: blokUid(),
          component: 'course_hero_learn_item',
          title: item.title,
          subtitle: item.subtitle,
        })),
        schema_faq_section_id: `${sourceUrl}#faq`,
      }]
    : [{
        _uid: blokUid(),
        component: 'course_hero',
        zenler_course_id: zenlerCourseId,
        heading: scraped.title,
        description: scraped.metaDescription,
      }];

  const right = scraped.heroRight
    ? [{
        _uid: blokUid(),
        component: 'course_hero_right',
        section_label: scraped.heroRight.label || 'THIS COURSE INCLUDES',
        cta_text: scraped.heroRight.ctaText || 'Enrol Now →',
        cta_link: storyblokLink(scraped.heroRight.ctaUrl),
        items: scraped.heroRight.items.map(item => ({
          _uid: blokUid(),
          component: 'course_hero_right_item',
          icon: item.icon,
          title: item.title,
          description: item.description,
        })),
      }]
    : [{
        _uid: blokUid(),
        component: 'course_hero_right',
        section_label: 'THIS COURSE INCLUDES',
        items: [],
      }];

  return {
    _uid: blokUid(),
    component: 'course_hero_layout',
    left,
    right,
  };
}

function buildIntroductionBlok(scraped: ScrapedCoursePage): Record<string, unknown> | null {
  if (!scraped.courseDescription) return null;

  const desc = scraped.courseDescription;
  return {
    _uid: blokUid(),
    component: 'course_introduction',
    title: desc.title,
    paragraph_1: desc.introP1 || desc.introBold || desc.bodyText,
    paragraph_2: desc.introP2 || undefined,
  };
}

function buildTabsBlok(scraped: ScrapedCoursePage): Record<string, unknown> | null {
  if (!scraped.tabs.length) return null;

  return {
    _uid: blokUid(),
    component: 'course_tabs',
    tabs: scraped.tabs.map(tab => ({
      _uid: blokUid(),
      component: 'course_tab',
      icon: tab.icon,
      label: tab.label,
      blocks: [{
        _uid: blokUid(),
        component: 'course_tab_block',
        block_type: 'heading-para',
        heading: tab.label,
        paragraph: tab.contentText || tab.label,
      }],
    })),
  };
}

function buildFaqBlok(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  sourceUrl: string,
): Record<string, unknown> | null {
  if (!scraped.faq?.items.length) return null;

  return {
    _uid: blokUid(),
    component: 'faq_section',
    title: scraped.faq.title || 'Frequently Asked Questions',
    icon: scraped.faq.icon || '❔',
    zenler_course_id: zenlerCourseId,
    schema_id: `${sourceUrl}#faq`,
    items: scraped.faq.items.map(item => ({
      _uid: blokUid(),
      component: 'faq_item',
      answer_type: 'paragraph',
      question: normalizeFaqQuestion(item.question),
      answer_paragraph: item.answerText,
    })),
  };
}

function buildPricingBlok(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
): Record<string, unknown> | null {
  if (!zenlerCourseId) return null;

  return {
    _uid: blokUid(),
    component: 'course_pricing',
    title: 'Course Pricing',
    zenler_course_id: zenlerCourseId,
    cta_text: scraped.heroRight?.ctaText?.replace(/\s*→\s*$/, '') || 'Enrol Now',
    cta_link: storyblokLink(scraped.heroRight?.ctaUrl),
  };
}

function buildStoryblokContent(scraped: ScrapedCoursePage, zenlerCourseId: string): Record<string, unknown> {
  const sourceUrl = scraped.sourceUrl || `https://vls-online.com/courses/${scraped.slug}`;
  const body: Record<string, unknown>[] = [];

  const heroLayout = buildHeroLayoutBlok(scraped, zenlerCourseId, sourceUrl);
  if (heroLayout) body.push(heroLayout);

  const introduction = buildIntroductionBlok(scraped);
  if (introduction) body.push(introduction);

  const tabs = buildTabsBlok(scraped);
  if (tabs) body.push(tabs);

  const faq = buildFaqBlok(scraped, zenlerCourseId, sourceUrl);
  if (faq) body.push(faq);

  const pricing = buildPricingBlok(scraped, zenlerCourseId);
  if (pricing) body.push(pricing);

  const seo = (scraped.title || scraped.metaDescription)
    ? [{
        _uid: blokUid(),
        component: 'seo',
        title: scraped.title,
        description: scraped.metaDescription,
        canonical_url: sourceUrl,
      }]
    : [];

  return {
    component: 'course_page',
    title: scraped.title,
    zenler_course_id: zenlerCourseId,
    seo,
    body,
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
