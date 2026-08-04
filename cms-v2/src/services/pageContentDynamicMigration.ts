import type {
  MigrationTemplate,
  PageContentComponentPlan,
  PageContentComponentPlanSection,
  ScrapedGenericPage,
} from '../../shared/migrationTypes';
import type { MigrationTemplateBlueprint, TemplateSectionBlueprint } from '../../shared/migrationTemplateTypes';
import {
  isBlogPageTemplate,
  isCoursePageTemplate,
  isLevelPageTemplate,
  isPageContentTemplate,
} from '../../shared/migrationDestination';
import { MIGRATION_TEMPLATE_LABELS } from '../../shared/migrationTemplateLabels';
import { readPageContentFile } from './pageContentFileLoader';
import { scrapeGenericPageFromHtml } from './pageScraper';
import {
  buildPresetBlokFromSection,
  getMigrationTemplateBlueprint,
  listMigrationTemplateBlueprints,
  resolveHtmlSectionComponent,
  sanitizeBlokForStoryblok,
} from './migrationTemplateRegistry';
import { buildBlokFromTemplateSection } from './pageContentBuilder';
import { indexTemplateSections } from './pageSectionExtractor';

const SKIP_COMMENT_KEYS = new Set(['header', 'footer', 'breadcrumb', 'seo', 'structured-data', 'site-header']);

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanSectionLabel(comment: string): string {
  return comment
    .replace(/=+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Section';
}

function sectionKeyFromComment(comment: string): string {
  return comment
    .toLowerCase()
    .replace(/=+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'section';
}

/** True when HTML matches the qualification level page contract (hero + pathway/papers). */
export function looksLikeLevelPage(html: string): boolean {
  return /<!--\s*PATHWAY/i.test(html)
    && /class=["'][^"']*\bhero\b/i.test(html)
    && (/<!--\s*THE .+ PAPERS/i.test(html) || /class=["'][^"']*\bpath-grid\b/i.test(html) || /<!--\s*WHAT IS/i.test(html));
}

function sectionKeysFromHtml(html: string): string[] {
  const commentPattern = /<!--\s*([\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  const comments = [...html.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      key: sectionKeyFromComment(match[1]),
      raw: match[1].trim(),
    }))
    .filter(item => item.raw && item.raw.length <= 80 && !SKIP_COMMENT_KEYS.has(item.key));

  const keys: string[] = [];
  for (const match of html.matchAll(sectionPattern)) {
    const attrs = match[1];
    const index = match.index ?? 0;
    const classMatch = attrs.match(/class="([^"]*)"/i);
    const classes = (classMatch?.[1] ?? '').split(/\s+/).filter(Boolean);
    const nearestComment = [...comments]
      .filter(item => item.index <= index)
      .sort((a, b) => b.index - a.index)[0];
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    let key = nearestComment?.key ?? classes[0] ?? `section-${keys.length + 1}`;
    if (classes.includes('sec') && idMatch?.[1]) key = idMatch[1];
    if (!SKIP_COMMENT_KEYS.has(key)) keys.push(key);
  }
  return keys;
}

function scoreTemplateMatch(liveKeys: string[], template: MigrationTemplate): number {
  if (isPageContentTemplate(template) || isCoursePageTemplate(template) || isBlogPageTemplate(template)) {
    return 0;
  }
  try {
    const blueprint = getMigrationTemplateBlueprint(template);
    const eligible = blueprint.sections.filter(section => section.component !== 'enquiry_form');
    if (!eligible.length) return 0;

    let matches = 0;
    for (const section of eligible) {
      const hit = liveKeys.some(key => (
        key === section.key
        || key.includes(section.key)
        || section.key.includes(key)
      ));
      if (hit) matches += 1;
    }
    return matches / eligible.length;
  } catch {
    return 0;
  }
}

/**
 * Suggest the closest known templates/* layout for component mapping hints.
 * Non-level page-content files still migrate as template `page_content`.
 */
export function suggestPageContentTemplateMatch(html: string): MigrationTemplate {
  if (looksLikeLevelPage(html)) return 'qualification_level_page';

  const liveKeys = sectionKeysFromHtml(html);
  if (!liveKeys.length) return 'page_content';

  let best: { template: MigrationTemplate; score: number } | null = null;
  for (const blueprint of listMigrationTemplateBlueprints()) {
    const template = blueprint.template;
    if (isLevelPageTemplate(template)) continue;
    const score = scoreTemplateMatch(liveKeys, template);
    if (score < 0.45) continue;
    if (!best || score > best.score) best = { template, score };
  }

  return best?.template ?? 'page_content';
}

/** Template stored on the migration page for a page-content file. */
export function detectPageContentTemplate(html: string): MigrationTemplate {
  if (looksLikeLevelPage(html)) return 'qualification_level_page';
  return 'page_content';
}

export function buildComponentPlanFromHtml(
  html: string,
  filename: string,
  mappingTemplate: MigrationTemplate = 'page_content',
): PageContentComponentPlan {

  const commentPattern = /<!--\s*([\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;

  const comments = [...html.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      label: cleanSectionLabel(match[1]),
      key: sectionKeyFromComment(match[1]),
      raw: match[1].trim(),
    }))
    .filter(item => {
      if (!item.raw || item.raw.length > 80) return false;
      if (SKIP_COMMENT_KEYS.has(item.key)) return false;
      if (/profile:|duplicate this/i.test(item.raw)) return false;
      return true;
    });

  const sections: PageContentComponentPlanSection[] = [];

  for (const match of html.matchAll(sectionPattern)) {
    const attrs = match[1];
    const inner = match[2];
    const index = match.index ?? 0;
    const classMatch = attrs.match(/class="([^"]*)"/i);
    const classes = (classMatch?.[1] ?? '').split(/\s+/).filter(Boolean);
    const nearestComment = [...comments]
      .filter(item => item.index <= index)
      .sort((a, b) => b.index - a.index)[0];

    let key = nearestComment?.key ?? classes[0] ?? `section-${sections.length + 1}`;
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    if (classes.includes('sec') && idMatch?.[1]) key = idMatch[1];
    if (SKIP_COMMENT_KEYS.has(key)) continue;

    const heading = stripTags(
      inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
      ?? '',
    );
    const description = stripTags(
      inner.match(/<p[^>]*class="[^"]*(?:hero-lead|lead|hero-sub|sub)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? '',
    );

    sections.push({
      key,
      label: nearestComment?.label || heading || key,
      component: resolveHtmlSectionComponent(
        key,
        classes,
        mappingTemplate === 'qualification_level_page' ? 'page_content' : mappingTemplate,
      ),
      classes,
      sampleHeading: heading,
      sampleDescription: description.slice(0, 240),
    });
  }

  if (!sections.length) {
    sections.push({
      key: 'content',
      label: 'Content',
      component: 'content_section',
      classes: ['section'],
      sampleHeading: '',
      sampleDescription: '',
    });
  }

  return {
    source: 'page_content',
    filename,
    detectedTemplate: mappingTemplate === 'qualification_level_page' ? 'page_content' : mappingTemplate,
    sections,
  };
}

function planSectionBackground(component: string, classes: string[]): string {
  const joined = classes.join(' ').toLowerCase();
  if (
    component === 'book_meeting_hero'
    || component === 'faq_section'
    || classes.includes('band')
    || classes.includes('cta-band')
    || classes.includes('faq-band')
    || classes.includes('book')
    || /\bband\b/.test(joined)
  ) {
    return '#F2F6FF';
  }
  return '#FFFFFF';
}

export function blueprintFromComponentPlan(plan: PageContentComponentPlan): MigrationTemplateBlueprint {
  const sections: TemplateSectionBlueprint[] = plan.sections.map(section => ({
    key: section.key,
    label: section.label,
    component: section.component,
    classes: section.classes,
    isBand: section.classes.includes('band')
      || section.classes.includes('faq-band')
      || section.classes.includes('book')
      || section.component === 'book_meeting_hero'
      || section.component === 'faq_section',
    styles: {
      background_color: planSectionBackground(section.component, section.classes),
      padding_top: section.component === 'book_meeting_hero' ? 40 : 64,
      padding_bottom: section.component === 'book_meeting_hero' ? 70 : 64,
    },
    sampleHeading: section.sampleHeading,
    sampleDescription: section.sampleDescription,
  }));

  return {
    template: plan.detectedTemplate,
    fileName: plan.filename,
    filePath: plan.filename,
    tokens: {
      navy: '#0E2A57',
      ink: '#15233D',
      slate: '#3D4A63',
      blue: '#1E50C8',
      blueStrong: '#1A45B0',
      blueBright: '#3B73F0',
      blue50: '#F2F6FF',
      blue100: '#E7EEFD',
      blue200: '#D6E2FB',
      white: '#FFFFFF',
      green: '#1E9E6A',
      amber: '#F5A623',
    },
    sections,
  };
}

export function detectPageContentTemplateForFile(filename: string): MigrationTemplate {
  const { html } = readPageContentFile(filename);
  return detectPageContentTemplate(html);
}

export async function scrapePageContentFileDynamic(filename: string): Promise<{
  scraped: ScrapedGenericPage;
  warnings: string[];
  template: MigrationTemplate;
}> {
  const { html, summary } = readPageContentFile(filename);
  if (looksLikeLevelPage(html)) {
    throw new Error('Level pages must use scrapeLevelPageFile, not scrapePageContentFileDynamic');
  }

  const mappingTemplate = suggestPageContentTemplateMatch(html);
  const plan = buildComponentPlanFromHtml(html, summary.filename, mappingTemplate);

  const scraped = await scrapeGenericPageFromHtml(
    html,
    summary.canonicalUrl,
    'page_content',
    {
      skipAiFallback: true,
      slugOverride: summary.slug,
    },
  );

  scraped.title = scraped.title || summary.title;
  scraped.componentPlan = plan;

  const warnings = [
    ...(scraped.extractionWarnings ?? []),
    mappingTemplate === 'page_content'
      ? `Discovered ${plan.sections.length} section(s) from page-content HTML (dynamic component plan).`
      : `Discovered ${plan.sections.length} section(s); component mapping guided by "${MIGRATION_TEMPLATE_LABELS[mappingTemplate]}".`,
    ...plan.sections.map(section => `Section "${section.label}" → ${section.component}`),
  ];

  if (!scraped.templateSections.length) {
    warnings.push('No parseable template sections found — Migrate Content may fall back to richtext content_section blocks.');
  }

  return {
    scraped: {
      ...scraped,
      extractionWarnings: warnings,
    },
    warnings,
    template: 'page_content',
  };
}

/** Template stored on the migration page for a page-content file. */
export function resolvePageContentMigrationTemplate(filename: string): MigrationTemplate {
  const { html } = readPageContentFile(filename);
  return detectPageContentTemplate(html);
}

export function buildDynamicStructureBody(plan: PageContentComponentPlan): Record<string, unknown>[] {
  const blueprint = blueprintFromComponentPlan(plan);
  return blueprint.sections.map(section => buildPresetBlokFromSection(blueprint, section));
}

export async function buildDynamicStoryblokContent(
  scraped: ScrapedGenericPage,
  plan: PageContentComponentPlan,
): Promise<Record<string, unknown>> {
  const blueprint = blueprintFromComponentPlan(plan);
  const byKey = indexTemplateSections(scraped.templateSections ?? []);
  const body: Record<string, unknown>[] = [];

  for (const section of blueprint.sections) {
    const extracted = byKey.get(section.key)
      ?? [...byKey.entries()].find(([key]) => key.includes(section.key) || section.key.includes(key))?.[1];

    let blok: Record<string, unknown> | null = null;
    if (section.component === 'faq_section' && scraped.faq?.items?.length) {
      const faqItems = (extracted?.faqItems?.length ? extracted.faqItems : scraped.faq.items);
      blok = {
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'faq_section',
        title: scraped.faq.title || 'Frequently Asked Questions',
        icon: scraped.faq.icon || '❔',
        eyebrow: extracted?.eyebrow || section.label || 'Good to know',
        heading_prefix: extracted?.headingPrefix || section.sampleHeading || 'Booking questions, answered.',
        heading_accent: extracted?.headingAccent || '',
        background_color: '#F2F6FF',
        items: faqItems.map(item => ({
          _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          component: 'faq_item',
          answer_type: 'paragraph',
          question: item.question,
          answer_paragraph: item.answerText,
        })),
      };
    } else {
      blok = buildBlokFromTemplateSection(section, extracted, scraped, { allowTemplateFallback: false });
    }

    if (!blok && extracted) {
      blok = sanitizeBlokForStoryblok({
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'content_section',
        eyebrow: extracted.eyebrow || '',
        heading_prefix: extracted.headingPrefix || section.sampleHeading || section.label,
        heading_accent: extracted.headingAccent || '',
        body: extracted.body || extracted.lead || section.sampleDescription,
      });
    }

    if (blok) {
      body.push(sanitizeBlokForStoryblok({
        ...section.styles,
        ...blok,
        component: String(blok.component ?? section.component),
      }));
    }
  }

  if (!body.length) {
    body.push(sanitizeBlokForStoryblok({
      _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      component: 'content_section',
      heading_prefix: scraped.title,
      body: scraped.metaDescription,
    }));
  }

  const seo = (scraped.title || scraped.metaDescription)
    ? [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'seo',
        title: scraped.title,
        description: scraped.metaDescription,
        canonical_url: scraped.sourceUrl,
      }]
    : [];

  return {
    component: 'page',
    seo,
    body,
  };
}

export function templateReferenceFromPlan(plan: PageContentComponentPlan) {
  return {
    template: plan.detectedTemplate,
    label: MIGRATION_TEMPLATE_LABELS[plan.detectedTemplate],
    fileName: plan.filename,
    sectionCount: plan.sections.length,
    sections: plan.sections.map(section => ({
      key: section.key,
      label: section.label,
      component: section.component,
    })),
  };
}
