import fs from 'fs';
import type { MigrationTemplate, ScrapedCoursePage } from '../../shared/migrationTypes';
import { DEFAULT_TRUSTPILOT_CAROUSEL_EMBED } from '../../shared/trustpilotDefaults';
import type { ParsedCourseTemplate } from './courseTemplateParser';
import { loadCourseTemplateFile } from './courseTemplateParser';
import {
  buildHeroRightBlokFromTemplate,
  mergeCourseWithTemplate,
} from './buildCourseTemplateContent';
import { getMigrationTemplateBlueprint, sanitizeBlokForStoryblok } from './migrationTemplateRegistry';
import { stripTemplateTags } from './templateSectionParsers';

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function pickText(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

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
  const comments = [...html.matchAll(commentPattern)].map(match => ({
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

function parseSecHead(section: string): { eyebrow: string; prefix: string; accent: string; description: string } {
  const secStart = section.search(/<div class="sec-head"/i);
  const slice = secStart >= 0 ? section.slice(secStart) : section;
  const eyebrow = firstMatch(slice, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i);
  const heading = splitHeading(slice);
  const description = firstMatch(slice, /<p(?![^>]*class="[^"]*course-intro)[^>]*>([\s\S]*?)<\/p>/i);
  return { eyebrow, prefix: heading.prefix, accent: heading.accent, description };
}

function loadRevisionHtml(): string {
  return fs.readFileSync(getMigrationTemplateBlueprint('revision_course').filePath, 'utf8');
}

function buildStatsBlok(html: string): Record<string, unknown> {
  const section = sectionHtml(html, 'stats');
  const items = allMatches(section, /<div class="stat"[^>]*>\s*<div class="num"[^>]*>([\s\S]*?)<\/div>\s*<div class="lab"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({
      _uid: uid(),
      component: 'stat_item',
      value: stripTemplateTags(match[1].replace(/<span[\s\S]*?<\/span>/gi, '')),
      label: stripTemplateTags(match[2]),
    }))
    .filter(item => item.value || item.label);

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'stats_band',
    items,
    background_color: '#FFFFFF',
    padding_top: 8,
    padding_bottom: 40,
  });
}

function buildSyllabusBlok(html: string): Record<string, unknown> {
  const section = sectionHtml(html, 'syllabus');
  const head = parseSecHead(section);
  const cards = allMatches(section, /<div class="syl-card"[^>]*>([\s\S]*?)<\/div>/gi).map(match => {
    const block = match[1];
    return {
      _uid: uid(),
      component: 'revision_syllabus_card',
      badge: firstMatch(block, /<div class="syl-badge"[^>]*>([\s\S]*?)<\/div>/i),
      title: firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
      body: firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i),
    };
  }).filter(card => card.title || card.body);

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'revision_syllabus_section',
    eyebrow: head.eyebrow,
    heading_prefix: head.prefix,
    heading_accent: head.accent,
    description: head.description,
    cards,
    background_color: '#FFFFFF',
    padding_top: 80,
    padding_bottom: 80,
  });
}

function buildStepsBlok(html: string): Record<string, unknown> {
  const section = sectionHtml(html, 'how-it-works');
  const head = parseSecHead(section);
  const steps = allMatches(section, /<div class="step"[^>]*>([\s\S]*?)<\/div>/gi).map(match => {
    const block = match[1];
    return {
      _uid: uid(),
      component: 'revision_step_item',
      number: firstMatch(block, /<div class="snum"[^>]*>([\s\S]*?)<\/div>/i),
      title: firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
      body: firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i),
    };
  }).filter(step => step.title || step.body);

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'revision_steps_section',
    eyebrow: head.eyebrow,
    heading_prefix: head.prefix,
    heading_accent: head.accent,
    steps,
    background_color: '#F2F6FF',
    padding_top: 80,
    padding_bottom: 80,
  });
}

function buildExamFormatBlok(html: string): Record<string, unknown> {
  const section = sectionHtml(html, 'exam-format') || sectionHtml(html, 'exam');
  const head = parseSecHead(section);
  const facts = allMatches(section, /<div class="fact"[^>]*>\s*<div class="fv"[^>]*>([\s\S]*?)<\/div>\s*<div class="fk"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({
      _uid: uid(),
      component: 'revision_exam_fact',
      value: stripTemplateTags(match[1]),
      label: stripTemplateTags(match[2]),
    }))
    .filter(item => item.value || item.label);

  const rows = allMatches(section, /<div class="row"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="row"|<\/div>\s*<\/div>)/gi).map((match, index, all) => {
    const block = match[1];
    return {
      _uid: uid(),
      component: 'revision_exam_row',
      title: firstMatch(block, /<div class="rt"[^>]*>([\s\S]*?)<\/div>/i),
      subtitle: firstMatch(block, /<div class="rs"[^>]*>([\s\S]*?)<\/div>/i),
      marks: firstMatch(block, /<div class="rm"[^>]*>([\s\S]*?)<\/div>/i),
      is_total: index === all.length - 1,
    };
  }).filter(row => row.title || row.marks);

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'revision_exam_format_section',
    eyebrow: head.eyebrow,
    heading_prefix: head.prefix,
    heading_accent: head.accent,
    description: head.description,
    facts,
    rows,
    background_color: '#F2F6FF',
    padding_top: 80,
    padding_bottom: 80,
  });
}

function buildRelatedBlok(html: string): Record<string, unknown> {
  const section = sectionHtml(html, 'related');
  const head = parseSecHead(section);
  const cards = allMatches(section, /<a class="rel-card"[^>]*>([\s\S]*?)<\/a>/gi).map(match => {
    const attrs = match[0].match(/<a class="rel-card"[^>]*>/i)?.[0] ?? '';
    const href = attrs.match(/href=["']([^"']*)["']/i)?.[1] ?? '#';
    const block = match[1];
    return {
      _uid: uid(),
      component: 'revision_related_card',
      tag: firstMatch(block, /<div class="rel-tag"[^>]*>([\s\S]*?)<\/div>/i),
      title: firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
      body: firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i),
      link_text: stripTemplateTags(block.match(/<span class="rel-more"[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? 'View course'),
      ...(storyblokLink(href) ? { link: storyblokLink(href) } : {}),
    };
  }).filter(card => card.title || card.body);

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'revision_related_section',
    eyebrow: head.eyebrow,
    heading_prefix: head.prefix,
    heading_accent: head.accent,
    cards,
    background_color: '#F2F6FF',
    padding_top: 80,
    padding_bottom: 80,
  });
}

export function buildRevisionCourseStoryblokFromTemplate(
  data: ParsedCourseTemplate,
  options: {
    zenlerCourseId: string;
    sourceUrl: string;
    slug: string;
  },
): Record<string, unknown> {
  const { zenlerCourseId, sourceUrl, slug } = options;
  const courseRef = pickText(zenlerCourseId, data.courseCode, slug.toUpperCase());
  const html = loadRevisionHtml();

  const heroLayout = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_hero_layout',
    left: [{
      _uid: uid(),
      component: 'course_hero',
      zenler_course_id: zenlerCourseId,
      eyebrow: data.eyebrow,
      heading: data.heading,
      description: data.description,
      language_label: data.languageLabel,
      tutor_name: data.tutorName,
      tutor_role: data.tutorRole,
      tutor_initials: data.tutorInitials,
      stage_mode: data.stageMode !== 'none'
        ? data.stageMode
        : (data.videoTitle || data.videoUrl ? 'video' : ''),
      stage_caption_title: data.stageMode === 'image' ? data.stageCaptionTitle : '',
      stage_caption_subtitle: data.stageMode === 'image' ? data.stageCaptionSubtitle : '',
      video_title: data.videoTitle,
      video_subtitle: data.videoSubtitle,
      video_duration: data.videoDuration,
      video_url: data.videoUrl,
      meta_items: data.metaItems.map(item => ({
        _uid: uid(),
        component: 'course_meta_item',
        show_stars: item.showStars,
        stars_text: item.starsText,
        bold_text: item.boldText,
        text: item.text,
        icon: item.icon,
      })),
    }],
    right: [buildHeroRightBlokFromTemplate(data)],
  });

  const introduction = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_introduction',
    title: data.introductionTitle,
    paragraph_1: data.introductionParagraph1,
    paragraph_2: data.introductionParagraph2,
    read_more_label: 'Read more',
    read_less_label: 'Read less',
  });

  const learnSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_learn_section',
    eyebrow: data.learnEyebrow,
    heading_prefix: data.learnHeadingPrefix,
    heading_accent: data.learnHeadingAccent,
    items: data.learnItems.map(item => ({
      _uid: uid(),
      component: 'course_hero_learn_item',
      title: item.title,
    })),
  });

  const curriculum = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_curriculum',
    course_id: courseRef,
    zenler_course_id: zenlerCourseId,
    eyebrow: data.curriculumEyebrow,
    heading_prefix: data.curriculumHeadingPrefix,
    heading_accent: data.curriculumHeadingAccent,
    submeta_items: data.curriculumSubmeta.map(item => ({
      _uid: uid(),
      component: 'course_submeta_item',
      value: item.value,
      label: item.label,
    })),
    show_lesson_durations: true,
  });

  const tutorSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_tutor_section',
    eyebrow: data.tutorEyebrow,
    heading_prefix: data.tutorHeadingPrefix,
    heading_accent: data.tutorHeadingAccent,
    name: pickText(data.tutorCardName, data.tutorName, 'Course tutor'),
    role: pickText(data.tutorCardRole, data.tutorRole),
    initials: pickText(data.tutorCardInitials, data.tutorInitials, 'T'),
    bio: pickText(data.tutorBio),
    stats: data.tutorStats.map(stat => ({
      _uid: uid(),
      component: 'stat_item',
      value: stat.value,
      label: stat.label,
    })),
  });

  const testimonials = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'testimonials',
    layout: 'trustpilot',
    trustpilot_embed: DEFAULT_TRUSTPILOT_CAROUSEL_EMBED,
    eyebrow: data.reviewsEyebrow,
    title_prefix: data.reviewsHeadingPrefix,
    title_accent: data.reviewsHeadingAccent,
  });

  const faqSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'faq_section',
    zenler_course_id: zenlerCourseId,
    eyebrow: data.faqEyebrow,
    heading_prefix: data.faqHeadingPrefix,
    heading_accent: data.faqHeadingAccent,
    title: pickText(`${data.faqHeadingPrefix} ${data.faqHeadingAccent}`.trim(), 'Frequently asked questions'),
    items: data.faqItems.map(item => ({
      _uid: uid(),
      component: 'faq_item',
      answer_type: 'paragraph',
      question: item.question,
      answer_paragraph: item.answer,
    })),
  });

  const promotion = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'promotion_section',
    eyebrow: data.ctaEyebrow,
    title: data.ctaHeadingPrefix,
    title_accent: data.ctaHeadingAccent,
    subtitle: data.ctaBody,
    cta_text: data.ctaPrimaryText,
    cta_link: storyblokLink('#'),
    secondary_cta_text: data.ctaSecondaryText,
    secondary_cta_link: storyblokLink('/bookmeeting'),
  });

  const seo = (data.title || data.metaDescription)
    ? [{
        _uid: uid(),
        component: 'seo',
        title: data.title,
        description: data.metaDescription,
        canonical_url: sourceUrl,
      }]
    : [];

  return {
    component: 'course_page',
    title: data.title,
    zenler_course_id: zenlerCourseId,
    seo,
    body: [
      heroLayout,
      buildStatsBlok(html),
      introduction,
      learnSection,
      buildSyllabusBlok(html),
      buildStepsBlok(html),
      curriculum,
      buildExamFormatBlok(html),
      tutorSection,
      testimonials,
      faqSection,
      buildRelatedBlok(html),
      promotion,
    ],
  };
}

export function buildMergedRevisionCourseStoryblokContent(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  template: MigrationTemplate = 'revision_course',
): Record<string, unknown> {
  const merged = mergeCourseWithTemplate(scraped, loadCourseTemplateFile(template));
  const sourceUrl = scraped.sourceUrl || `https://vls-online.com/courses/${scraped.slug}`;
  return buildRevisionCourseStoryblokFromTemplate(merged, {
    zenlerCourseId,
    sourceUrl,
    slug: scraped.slug,
  });
}

export function buildRevisionCourseStructureBody(): Record<string, unknown>[] {
  const data = loadCourseTemplateFile('revision_course');
  const built = buildRevisionCourseStoryblokFromTemplate(data, {
    zenlerCourseId: '',
    sourceUrl: 'https://vls-online.com/courses/revision',
    slug: 'revision',
  });
  return Array.isArray(built.body) ? built.body as Record<string, unknown>[] : [];
}
