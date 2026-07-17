import { mergeCourseWithTemplate } from './buildCourseTemplateContent';
import { loadCourseTemplateFile } from './courseTemplateParser';
import type { ScrapedCoursePage } from '../../shared/migrationTypes';
import { sanitizeStoryContentForStoryblok } from './storyblokStorySanitizer';
import { isStoryblokRichtextDoc } from './storyblokRichtext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const template = loadCourseTemplateFile();

const scraped: ScrapedCoursePage = {
  sourceUrl: 'https://vls-online.com/courses/afm',
  slug: 'afm',
  title: 'ACCA AFM',
  metaDescription: 'AFM meta',
  zenlerCourseId: '123',
  courseCode: 'AFM',
  hero: null,
  heroRight: null,
  courseDescription: {
    icon: '📖',
    title: 'About This Course',
    introBold: 'ACCA AFM Exam Paper Overview',
    introP1: 'AFM paragraph one.',
    introP2: '',
    bodyHtml: '',
    bodyText: '',
    source: 'zenler',
  },
  tabs: [],
  heroVideoUrl: null,
  faq: {
    title: 'FAQ',
    icon: '❔',
    items: [{ question: 'AFM Q1?', answerHtml: '<p>A1</p>', answerText: 'A1' }],
  },
  testimonials: null,
  promotion: null,
  hasCourseFinderBanner: false,
  schemaDescription: '',
  extractionWarnings: [],
};

const merged = mergeCourseWithTemplate(scraped, template);

assert(merged.introductionParagraph1.includes('AFM paragraph one'), 'paragraph 1 uses scraped text');
assert(!merged.introductionParagraph1.includes('Exam Paper Overview') || merged.introductionParagraph1.includes('AFM paragraph'), 'paragraph 1 is not just the heading');
assert(!merged.introductionParagraph2.includes('SBR'), 'paragraph 2 must not fall back to SBR template');
assert(merged.faqItems[0]?.question === 'AFM Q1?', 'FAQ uses scraped items when present');
assert(merged.faqItems.length === 1, 'FAQ does not pad with template items');

const headingDuplicateScraped: ScrapedCoursePage = {
  ...scraped,
  courseDescription: {
    icon: '📖',
    title: 'About This Course',
    introBold: 'ACCA AFM Exam Paper Overview',
    introP1: 'ACCA AFM Exam Paper Overview',
    introP2: 'This course is for ACCA Strategic Professional students who want advanced financial management preparation.',
    bodyHtml: '',
    bodyText: '',
    source: 'zenler',
  },
};
const headingMerged = mergeCourseWithTemplate(headingDuplicateScraped, template);
assert(
  headingMerged.introductionParagraph1.includes('Strategic Professional'),
  'heading duplicate is skipped so paragraph 1 keeps the body text',
);
assert(headingMerged.introductionTitle === 'ACCA AFM Exam Paper Overview', 'title stays the scraped heading');

const sanitized = sanitizeStoryContentForStoryblok({
  component: 'course_page',
  title: 'AFM',
  body: [{
    _uid: 'abc',
    component: 'course_introduction',
    title: 'Overview',
    paragraph_1: 'Intro one',
    paragraph_2: 'Intro two',
  }],
});

const intro = (sanitized.body as Record<string, unknown>[])[0];
assert(isStoryblokRichtextDoc(intro.paragraph_1), 'story sanitizer coerces nested richtext');

console.log('buildCourseTemplateContent.test.ts: all assertions passed');
