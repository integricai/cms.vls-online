import type { ScrapedCoursePage, ScrapedFaqItem } from '../../shared/migrationTypes';
import { parseCourseTemplateHtml } from './courseTemplateParser';
import { readPageContentFile } from './pageContentFileLoader';

function slugFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    return pathname.split('/').filter(Boolean).pop() || 'page';
  } catch {
    return 'page';
  }
}

function buildHeroFromParsed(
  parsed: ReturnType<typeof parseCourseTemplateHtml>,
): ScrapedCoursePage['hero'] {
  return {
    breadcrumb: '',
    breadcrumbItems: [],
    eyebrow: parsed.eyebrow,
    heading: parsed.heading,
    description: parsed.description,
    tags: [],
    learnLabel: parsed.learnEyebrow || "WHAT YOU'LL LEARN",
    learnItems: parsed.learnItems.map(item => ({ title: item.title, subtitle: '' })),
  };
}

function buildHeroRightFromParsed(parsed: ReturnType<typeof parseCourseTemplateHtml>) {
  return {
    label: parsed.includesLabel || 'THIS COURSE INCLUDES',
    items: parsed.includesItems.map(title => ({
      icon: '✓',
      title,
      description: '',
      badge: '',
    })),
    ctaText: parsed.primaryCtaText,
    ctaUrl: 'https://vls-online.com/contactform',
  };
}

function buildCourseDescription(parsed: ReturnType<typeof parseCourseTemplateHtml>): ScrapedCoursePage['courseDescription'] {
  if (!parsed.introductionTitle && !parsed.introductionParagraph1 && !parsed.introductionParagraph2) {
    return null;
  }

  return {
    icon: '',
    title: parsed.introductionTitle,
    introBold: parsed.introductionTitle,
    introP1: parsed.introductionParagraph1,
    introP2: parsed.introductionParagraph2,
    bodyHtml: '',
    bodyText: [parsed.introductionParagraph1, parsed.introductionParagraph2].filter(Boolean).join('\n\n'),
    source: 'cms',
  };
}

function buildFaq(parsed: ReturnType<typeof parseCourseTemplateHtml>): ScrapedCoursePage['faq'] {
  const items: ScrapedFaqItem[] = parsed.faqItems.map(item => ({
    question: item.question,
    answerHtml: item.answer,
    answerText: item.answer,
  }));

  if (!items.length) return null;

  return {
    title: `${parsed.faqHeadingPrefix} ${parsed.faqHeadingAccent}`.trim() || 'Frequently Asked Questions',
    icon: '❔',
    items,
  };
}

function buildTestimonials(parsed: ReturnType<typeof parseCourseTemplateHtml>): ScrapedCoursePage['testimonials'] {
  if (!parsed.reviewCards.length) return null;

  return {
    eyebrow: parsed.reviewsEyebrow,
    titlePrefix: parsed.reviewsHeadingPrefix,
    titleAccent: parsed.reviewsHeadingAccent,
    subtitle: parsed.reviewsLabel,
    cards: parsed.reviewCards.map(card => ({
      quote: card.quote,
      author: card.name,
      role: card.role,
    })),
  };
}

function buildPromotion(parsed: ReturnType<typeof parseCourseTemplateHtml>): ScrapedCoursePage['promotion'] {
  if (!parsed.ctaHeadingPrefix && !parsed.ctaBody) return null;

  return {
    title: `${parsed.ctaHeadingPrefix} ${parsed.ctaHeadingAccent}`.trim(),
    subtitle: parsed.ctaBody,
    ctaText: parsed.ctaPrimaryText,
    ctaUrl: '#',
  };
}

export function scrapePageContentFile(filename: string): ScrapedCoursePage {
  const { html, summary } = readPageContentFile(filename);
  const parsed = parseCourseTemplateHtml(html);
  const slug = summary.slug || slugFromUrl(summary.canonicalUrl);
  const warnings: string[] = [];

  if (parsed.stageMode !== 'image') {
    warnings.push('No hero image stage was detected — set stage mode to Image in Storyblok after migration.');
  }

  if (parsed.pricingLayout !== 'session_selector') {
    warnings.push('Session-selector pricing sidebar was not detected in the page-content file.');
  }

  return {
    sourceUrl: summary.canonicalUrl,
    slug,
    title: summary.title || parsed.title,
    metaDescription: parsed.metaDescription,
    zenlerCourseId: '',
    courseCode: parsed.courseCode || slug.toUpperCase(),
    hero: buildHeroFromParsed(parsed),
    heroRight: buildHeroRightFromParsed(parsed),
    courseDescription: buildCourseDescription(parsed),
    tabs: [],
    heroVideoUrl: parsed.stageMode === 'video' ? parsed.videoUrl || null : null,
    stageMode: parsed.stageMode,
    stageImageUrl: parsed.stageImageUrl || null,
    stageImageAlt: parsed.stageImageAlt || null,
    stageCaptionTitle: parsed.stageCaptionTitle || null,
    stageCaptionSubtitle: parsed.stageCaptionSubtitle || null,
    faq: buildFaq(parsed),
    testimonials: buildTestimonials(parsed),
    promotion: buildPromotion(parsed),
    hasCourseFinderBanner: false,
    schemaDescription: parsed.metaDescription,
    extractionWarnings: warnings,
  };
}

export function collectPageContentScrapeWarnings(scraped: ScrapedCoursePage): string[] {
  const warnings = [...(scraped.extractionWarnings ?? [])];
  if (!scraped.hero?.heading) warnings.push('Hero heading was not detected.');
  if (!scraped.courseDescription) warnings.push('Course introduction section was not detected.');
  if (!scraped.faq?.items.length) warnings.push('FAQ section was not detected.');
  if (scraped.stageMode === 'image' && !scraped.stageImageUrl) {
    warnings.push('Hero image URL was not found — upload an image manually in Storyblok.');
  }
  if (!scraped.zenlerCourseId) {
    warnings.push('No Zenler course ID — pricing sidebar uses scraped session options from the file.');
  }
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  return warnings;
}
