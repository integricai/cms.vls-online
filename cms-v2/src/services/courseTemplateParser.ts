import fs from 'fs';
import type { MigrationTemplate } from '../../shared/migrationTypes';
import { getMigrationTemplateBlueprint } from './migrationTemplateRegistry';
import { isCoursePageTemplate } from '../../shared/migrationDestination';
import { stripTemplateTags } from './templateSectionParsers';
import { defaultCourseTabsTemplate, type TemplateCourseTab } from './courseTabBuilder';

export type ParsedCourseMetaItem = {
  showStars: boolean;
  starsText: string;
  boldText: string;
  text: string;
  icon: 'none' | 'chart' | 'calendar' | 'modules' | 'clock';
};

export type ParsedCourseLearnItem = {
  title: string;
};

export type ParsedCourseSubmetaItem = {
  value: string;
  label: string;
};

export type ParsedCourseTutorStat = {
  value: string;
  label: string;
};

export type ParsedCourseReviewCard = {
  quote: string;
  initials: string;
  name: string;
  role: string;
};

export type ParsedCourseRatingBar = {
  label: string;
  percent: number;
};

export type ParsedCourseFaqItem = {
  question: string;
  answer: string;
};

export type ParsedCourseSessionOption = {
  title: string;
  subtitle: string;
  price: string;
  badge: string;
  ctaSuffix: string;
  isDefault: boolean;
};

export type CoursePricingLayout = 'standard' | 'session_selector';
export type CourseStageMode = 'video' | 'image' | 'none';

export type ParsedCourseTemplate = {
  title: string;
  metaDescription: string;
  courseCode: string;
  eyebrow: string;
  heading: string;
  description: string;
  metaItems: ParsedCourseMetaItem[];
  languageLabel: string;
  tutorName: string;
  tutorRole: string;
  tutorInitials: string;
  videoTitle: string;
  videoSubtitle: string;
  videoDuration: string;
  videoUrl: string;
  stageMode: CourseStageMode;
  stageImageUrl: string;
  stageImageAlt: string;
  stageCaptionTitle: string;
  stageCaptionSubtitle: string;
  introductionTitle: string;
  introductionParagraph1: string;
  introductionParagraph2: string;
  courseTabs: TemplateCourseTab[];
  priceNow: string;
  priceWas: string;
  priceSave: string;
  priceAccess: string;
  priceNote: string;
  pricingLayout: CoursePricingLayout;
  sessionSelectorLabel: string;
  ctaTextPrefix: string;
  sessionOptions: ParsedCourseSessionOption[];
  primaryCtaText: string;
  secondaryCtaText: string;
  includesLabel: string;
  includesItems: string[];
  bestValueTag: string;
  bestValueText: string;
  bestValueLinkText: string;
  learnEyebrow: string;
  learnHeadingPrefix: string;
  learnHeadingAccent: string;
  learnItems: ParsedCourseLearnItem[];
  curriculumEyebrow: string;
  curriculumHeadingPrefix: string;
  curriculumHeadingAccent: string;
  curriculumSubmeta: ParsedCourseSubmetaItem[];
  tutorEyebrow: string;
  tutorHeadingPrefix: string;
  tutorHeadingAccent: string;
  tutorCardName: string;
  tutorCardRole: string;
  tutorCardInitials: string;
  tutorBio: string;
  tutorStats: ParsedCourseTutorStat[];
  reviewsEyebrow: string;
  reviewsHeadingPrefix: string;
  reviewsHeadingAccent: string;
  reviewsScore: string;
  reviewsLabel: string;
  ratingBars: ParsedCourseRatingBar[];
  reviewCards: ParsedCourseReviewCard[];
  faqEyebrow: string;
  faqHeadingPrefix: string;
  faqHeadingAccent: string;
  faqItems: ParsedCourseFaqItem[];
  ctaEyebrow: string;
  ctaHeadingPrefix: string;
  ctaHeadingAccent: string;
  ctaBody: string;
  ctaPrimaryText: string;
  ctaSecondaryText: string;
};

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTemplateTags(match[1]) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

function splitHeading(html: string): { prefix: string; accent: string } {
  const match = html.match(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/i);
  if (!match) return { prefix: '', accent: '' };
  const inner = match[2];
  const accentMatch = inner.match(/<span[^>]*class="[^"]*accent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const accent = accentMatch ? stripTemplateTags(accentMatch[1]) : '';
  const prefix = stripTemplateTags(inner.replace(/<span[^>]*class="[^"]*accent[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ''));
  return { prefix, accent };
}

function sectionHtml(html: string, key: string): string {
  const commentPattern = /<!--\s*([\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  const comments = [...html.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      key: match[1].toLowerCase().replace(/=+/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));

  for (const match of html.matchAll(sectionPattern)) {
    const index = match.index ?? 0;
    const nearest = [...comments]
      .filter(item => item.index <= index)
      .sort((a, b) => b.index - a.index)[0];
    const sectionKey = nearest?.key ?? '';
    if (sectionKey.includes(key) || key.includes(sectionKey)) {
      return `<section${match[1]}>${match[2]}</section>`;
    }
  }
  return '';
}

function parseMetaItems(heroHtml: string): ParsedCourseMetaItem[] {
  const row = heroHtml.match(/<div class="meta-row"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  if (!row) return [];

  return allMatches(row, /<span class="meta-item"[^>]*>([\s\S]*?)<\/span>/gi).map(match => {
    const block = match[1];
    const showStars = /class="stars"/i.test(block);
    const starsText = stripTemplateTags(block.match(/<span class="stars"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const boldText = stripTemplateTags(block.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? '');
    const text = stripTemplateTags(block.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<span class="stars"[\s\S]*?<\/span>/i, '').replace(/<b[\s\S]*?<\/b>/gi, ''));
    let icon: ParsedCourseMetaItem['icon'] = 'none';
    if (/M3 3v18h18/.test(block)) icon = 'chart';
    else if (/rect x="3" y="4"/.test(block)) icon = 'calendar';
    else if (/circle cx="12" cy="12" r="9"/.test(block) && /M12 7v5l3 2/.test(block) && /modules/i.test(text)) icon = 'modules';
    else if (/circle cx="12" cy="12" r="9"/.test(block) && /M12 7v5l3 2/.test(block)) icon = 'clock';
    return { showStars, starsText, boldText, text, icon };
  }).filter(item => item.text || item.boldText || item.starsText);
}

function parseSessionOptions(sideHtml: string): {
  label: string;
  ctaPrefix: string;
  options: ParsedCourseSessionOption[];
} | null {
  if (!/<div class="session-options"/i.test(sideHtml)) return null;

  const selector = sideHtml.match(/<div class="session-selector"[^>]*>([\s\S]*?)<\/div>\s*(?:<a class="btn|<div class="includes")/i)?.[1] ?? '';
  const label = firstMatch(selector, /<h4 class="session-label"[^>]*>([\s\S]*?)<\/h4>/i) || 'Choose your exam session';
  const ctaPrefix = stripTemplateTags(
    sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*data-cta-prefix=["']([^"']+)["']/i)?.[1]
    ?? sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.split('·')[0]
    ?? 'Enrol now',
  ).trim();

  const options = allMatches(sideHtml, /<label class="session-option"([^>]*)>([\s\S]*?)<\/label>/gi).map((match, index) => {
    const attrs = match[1] ?? '';
    const block = match[2] ?? '';
    const title = firstMatch(block, /<span class="session-title"[^>]*>([\s\S]*?)<\/span>/i);
    const ctaSuffix = attrs.match(/data-cta-suffix=["']([^"']+)["']/i)?.[1]?.trim()
      || title.replace(/\s+\d{4}\s+/i, ' ').replace(/\s+session$/i, ' session').trim();
    return {
      title,
      subtitle: firstMatch(block, /<span class="session-subtitle"[^>]*>([\s\S]*?)<\/span>/i),
      price: firstMatch(block, /<span class="session-price"[^>]*>([\s\S]*?)<\/span>/i),
      badge: firstMatch(block, /<span class="session-badge"[^>]*>([\s\S]*?)<\/span>/i),
      ctaSuffix,
      isDefault: /<input[^>]+checked/i.test(block) || index === 0,
    };
  }).filter(option => option.title && option.price);

  return options.length ? { label, ctaPrefix, options } : null;
}

function parseIncludes(sideHtml: string): { label: string; items: string[] } {
  const includes = sideHtml.match(/<div class="includes"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const label = firstMatch(includes, /<h4[^>]*>([\s\S]*?)<\/h4>/i) || 'This course includes';
  const items = allMatches(includes, /<li[^>]*>[\s\S]*?<\/li>/gi)
    .map(match => stripTemplateTags(match[0].replace(/<span class="ico"[\s\S]*?<\/span>/i, '')))
    .filter(Boolean);
  return { label, items };
}

function parseSecHead(sectionHtml: string): { eyebrow: string; prefix: string; accent: string } {
  const secStart = sectionHtml.search(/<div class="sec-head"/i);
  const slice = secStart >= 0 ? sectionHtml.slice(secStart) : sectionHtml;
  const eyebrow = firstMatch(slice, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i);
  const heading = splitHeading(slice);
  return { eyebrow, prefix: heading.prefix, accent: heading.accent };
}

function parseSubmeta(sectionHtml: string): ParsedCourseSubmetaItem[] {
  const block = sectionHtml.match(/<div class="submeta"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  return allMatches(block, /<span[^>]*>([\s\S]*?)<\/span>/gi).map(match => {
    const inner = match[1];
    const value = stripTemplateTags(inner.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? '');
    const label = stripTemplateTags(inner.replace(/<b[\s\S]*?<\/b>/gi, ''));
    return { value, label };
  }).filter(item => item.value || item.label);
}

export function parseCourseTemplateHtml(html: string): ParsedCourseTemplate {
  const heroSection = sectionHtml(html, 'hero') || html.match(/<section class="hero"[\s\S]*?<\/section>/i)?.[0] || '';
  const introSection = sectionHtml(html, 'course-description') || html.match(/<div class="wrap course-intro"[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/i)?.[0] || '';
  const learnSection = sectionHtml(html, 'what-you-ll-learn') || sectionHtml(html, 'learn');
  const curriculumSection = sectionHtml(html, 'course-content') || sectionHtml(html, 'content');
  const tutorSection = sectionHtml(html, 'your-tutor') || sectionHtml(html, 'tutor');
  const reviewsSection = sectionHtml(html, 'student-reviews') || sectionHtml(html, 'reviews');
  const faqSection = sectionHtml(html, 'faq');
  const ctaSection = html.match(/<section class="cta-band"[\s\S]*?<\/section>/i)?.[0] ?? sectionHtml(html, 'cta');

  const heroHead = parseSecHead(heroSection);
  const learnHead = parseSecHead(learnSection);
  const curriculumHead = parseSecHead(curriculumSection);
  const tutorHead = parseSecHead(tutorSection);
  const reviewsHead = parseSecHead(reviewsSection);
  const faqHead = parseSecHead(faqSection);

  const sideHtml = heroSection.match(/<aside class="side"[^>]*>([\s\S]*?)<\/aside>/i)?.[1] ?? '';
  const sessionPricing = parseSessionOptions(sideHtml);
  const priceCard = sideHtml.match(/<div class="price-card"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="bestvalue"|$)/i)?.[1] ?? sideHtml;
  const includes = parseIncludes(sideHtml);
  const bestValue = sideHtml.match(/<div class="bestvalue"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const defaultSession = sessionPricing?.options.find(option => option.isDefault) ?? sessionPricing?.options[0];

  const byline = heroSection.match(/<div class="byline"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const videoStage = heroSection.match(/<div class="video-stage"[^>]*>([\s\S]*?)<\/div>/i)?.[0] ?? '';
  const video = videoStage.match(/<div class="video-stage"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const videoUrl = heroSection.match(/<div class="video-stage"[^>]*data-video-url=["']([^"']*)["']/i)?.[1]?.trim() ?? '';
  const heroImageBlock = heroSection.match(/<figure class="hero-image"[^>]*>([\s\S]*?)<\/figure>/i)?.[0] ?? '';
  const stageImageUrl = heroImageBlock.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const stageImageAlt = heroImageBlock.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1]?.trim() ?? '';
  const captionBlock = heroImageBlock.match(/<figcaption class="hi-caption"[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '';
  const stageCaptionTitle = firstMatch(captionBlock, /<div class="t"[^>]*>([\s\S]*?)<\/div>/i);
  const stageCaptionSubtitle = firstMatch(captionBlock, /<div class="s"[^>]*>([\s\S]*?)<\/div>/i);
  const stageMode: CourseStageMode = videoUrl ? 'video' : stageImageUrl ? 'image' : 'none';

  const tutorCard = tutorSection.match(/<div class="tutor-card"[^>]*>([\s\S]*)<\/div>\s*<\/div>\s*<\/section>/i)?.[1] ?? tutorSection;

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s*[—–-]\s*Vertex Learning Solutions.*$/i, '').trim();
  const metaDescription = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);

  return {
    title: title || 'Course',
    metaDescription,
    courseCode: title.match(/\(([^)]+)\)/)?.[1]?.trim() || 'SBR',
    eyebrow: firstMatch(heroSection, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i) || heroHead.eyebrow,
    heading: firstMatch(heroSection, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || heroHead.prefix,
    description: firstMatch(heroSection, /<p class="hero-lead"[^>]*>([\s\S]*?)<\/p>/i),
    metaItems: parseMetaItems(heroSection),
    languageLabel: stripTemplateTags(heroSection.match(/<span class="lang-pill"[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/i, '') ?? 'English'),
    tutorName: firstMatch(byline, /<div class="bt"[^>]*>([\s\S]*?)<\/div>/i),
    tutorRole: firstMatch(byline, /<div class="bs"[^>]*>([\s\S]*?)<\/div>/i),
    tutorInitials: firstMatch(byline, /<div class="avatar"[^>]*>([\s\S]*?)<\/div>/i),
    videoTitle: firstMatch(video, /<div class="t"[^>]*>([\s\S]*?)<\/div>/i),
    videoSubtitle: firstMatch(video, /<div class="s"[^>]*>([\s\S]*?)<\/div>/i),
    videoDuration: firstMatch(video, /<span class="vs-time"[^>]*>([\s\S]*?)<\/span>/i),
    videoUrl,
    stageMode,
    stageImageUrl,
    stageImageAlt,
    stageCaptionTitle,
    stageCaptionSubtitle,
    introductionTitle: firstMatch(introSection, /<h2[^>]*>([\s\S]*?)<\/h2>/i) || 'Exam Paper Overview',
    introductionParagraph1: firstMatch(introSection, /<p class="course-intro-p1"[^>]*>([\s\S]*?)<\/p>/i)
      || firstMatch(introSection, /<p[^>]*>([\s\S]*?)<\/p>/i),
    introductionParagraph2: firstMatch(introSection, /<p class="course-intro-p2"[^>]*>([\s\S]*?)<\/p>/i),
    courseTabs: defaultCourseTabsTemplate(),
    priceNow: sessionPricing
      ? firstMatch(priceCard, /<span class="price-now"[^>]*>([\s\S]*?)<\/span>/i) || defaultSession?.price || ''
      : firstMatch(priceCard, /<span class="price-now"[^>]*>([\s\S]*?)<\/span>/i),
    priceWas: sessionPricing ? '' : firstMatch(priceCard, /<span class="price-was"[^>]*>([\s\S]*?)<\/span>/i),
    priceSave: sessionPricing ? '' : firstMatch(priceCard, /<div class="price-save"[^>]*>([\s\S]*?)<\/div>/i),
    priceAccess: stripTemplateTags(priceCard.match(/<div class="price-access"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? ''),
    priceNote: sessionPricing ? '' : firstMatch(priceCard, /<div class="price-note"[^>]*>([\s\S]*?)<\/div>/i),
    pricingLayout: sessionPricing ? 'session_selector' : 'standard',
    sessionSelectorLabel: sessionPricing?.label ?? '',
    ctaTextPrefix: sessionPricing?.ctaPrefix ?? 'Enrol now',
    sessionOptions: sessionPricing?.options ?? [],
    primaryCtaText: sessionPricing
      ? stripTemplateTags(
        sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]
        ?? `${sessionPricing.ctaPrefix} · ${defaultSession?.ctaSuffix ?? ''}`,
      )
      : stripTemplateTags(priceCard.match(/<a class="btn btn-primary[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? 'Enrol now'),
    secondaryCtaText: stripTemplateTags(priceCard.match(/<a class="btn btn-ghost[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? 'Book a free consultation'),
    includesLabel: includes.label,
    includesItems: includes.items,
    bestValueTag: firstMatch(bestValue, /<div class="bv-tag"[^>]*>([\s\S]*?)<\/div>/i),
    bestValueText: firstMatch(bestValue, /<p[^>]*>([\s\S]*?)<\/p>/i),
    bestValueLinkText: stripTemplateTags(bestValue.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? ''),
    learnEyebrow: learnHead.eyebrow,
    learnHeadingPrefix: learnHead.prefix,
    learnHeadingAccent: learnHead.accent,
    learnItems: allMatches(learnSection, /<div class="learn-item"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
      .map(match => ({ title: stripTemplateTags(match[1]) }))
      .filter(item => item.title),
    curriculumEyebrow: curriculumHead.eyebrow,
    curriculumHeadingPrefix: curriculumHead.prefix,
    curriculumHeadingAccent: curriculumHead.accent,
    curriculumSubmeta: parseSubmeta(curriculumSection),
    tutorEyebrow: tutorHead.eyebrow,
    tutorHeadingPrefix: tutorHead.prefix,
    tutorHeadingAccent: tutorHead.accent,
    tutorCardName: firstMatch(tutorCard, /<div class="tname"[^>]*>([\s\S]*?)<\/div>/i),
    tutorCardRole: firstMatch(tutorCard, /<div class="trole"[^>]*>([\s\S]*?)<\/div>/i),
    tutorCardInitials: firstMatch(tutorCard, /<div class="big-avatar"[^>]*>([\s\S]*?)<\/div>/i),
    tutorBio: firstMatch(tutorCard, /<p class="tbio"[^>]*>([\s\S]*?)<\/p>/i),
    tutorStats: allMatches(tutorCard, /<div>\s*<div class="v"[^>]*>([\s\S]*?)<\/div>\s*<div class="k"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi)
      .map(match => ({ value: stripTemplateTags(match[1]), label: stripTemplateTags(match[2]) }))
      .filter(item => item.value || item.label),
    reviewsEyebrow: reviewsHead.eyebrow,
    reviewsHeadingPrefix: reviewsHead.prefix,
    reviewsHeadingAccent: reviewsHead.accent,
    reviewsScore: firstMatch(reviewsSection, /<div class="score-card"[^>]*>[\s\S]*?<div class="big"[^>]*>([\s\S]*?)<\/div>/i),
    reviewsLabel: firstMatch(reviewsSection, /<div class="based"[^>]*>([\s\S]*?)<\/div>/i),
    ratingBars: allMatches(reviewsSection, /<div class="bar-row"[^>]*>[\s\S]*?<span class="lbl"[^>]*>([\s\S]*?)<\/span>[\s\S]*?style="width:([\d.]+)%"/gi)
      .map(match => ({ label: stripTemplateTags(match[1]), percent: Number(match[2]) || 0 })),
    reviewCards: allMatches(reviewsSection, /<div class="review"[^>]*>([\s\S]*?)<div class="r-author"[\s\S]*?<\/div>\s*<\/div>/gi).map(match => {
      const block = match[1] + match[0].slice(match[1].length);
      const full = match[0];
      return {
        quote: firstMatch(full, /<p[^>]*>([\s\S]*?)<\/p>/i),
        initials: firstMatch(full, /<span class="ra-av"[^>]*>([\s\S]*?)<\/span>/i),
        name: firstMatch(full, /<div class="ra-name"[^>]*>([\s\S]*?)<\/div>/i),
        role: firstMatch(full, /<div class="ra-role"[^>]*>([\s\S]*?)<\/div>/i),
      };
    }).filter(item => item.quote),
    faqEyebrow: faqHead.eyebrow,
    faqHeadingPrefix: faqHead.prefix,
    faqHeadingAccent: faqHead.accent,
    faqItems: allMatches(faqSection, /<details class="qa"[^>]*>([\s\S]*?)<\/details>/gi).map(match => {
      const block = match[1];
      const question = stripTemplateTags(block.match(/<summary>([\s\S]*?)<span class="qa-icon"/i)?.[1] ?? '');
      const answer = stripTemplateTags(block.match(/<div class="qa-body"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
      return { question, answer };
    }).filter(item => item.question && item.answer),
    ctaEyebrow: firstMatch(ctaSection, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i),
    ctaHeadingPrefix: splitHeading(ctaSection).prefix,
    ctaHeadingAccent: splitHeading(ctaSection).accent,
    ctaBody: firstMatch(ctaSection, /<div class="cta-panel"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i),
    ctaPrimaryText: stripTemplateTags(ctaSection.match(/<a class="btn btn-primary"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? ''),
    ctaSecondaryText: stripTemplateTags(ctaSection.match(/<a class="btn btn-outline-blue"[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? ''),
  };
}

export function loadCourseTemplateFile(template: MigrationTemplate = 'course'): ParsedCourseTemplate {
  const blueprint = getMigrationTemplateBlueprint(isCoursePageTemplate(template) ? template : 'course');
  const html = fs.readFileSync(blueprint.filePath, 'utf8');
  return parseCourseTemplateHtml(html);
}
