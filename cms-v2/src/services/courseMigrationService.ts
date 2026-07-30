import type {
  ComponentLibrarySummary,
  ContentPhaseResult,
  CourseMigrationRequest,
  MigrationPageRecord,
  MigrationTemplate,
  PageMigrationRequest,
  PageMigrationResult,
  ScrapedBlogPost,
  ScrapedCoursePage,
  ScrapedGenericPage,
  ScrapePhaseResult,
  ScrapedTabPanel,
  StoryblokCredentials,
  StructurePhaseResult,
  TemplateReferenceSummary,
} from '../../shared/migrationTypes';
import {
  getMigrationPageById,
  getMigrationPageByOriginUrl,
  getScrapedData,
  markMigrationPageMigrated,
  saveScrapeResult,
  saveStructureResult,
  updateMigrationPageSource,
} from '../models/migrationPage';
import { listCourses } from '../models/course';
import { buildSchemaBreadcrumbBloks } from './breadcrumbUtils';
import { CoursePageScrapeError, scrapeCoursePage } from './coursePageScraper';
import { buildTabBlocksFromPanel } from './courseTabBuilder';
import { DEFAULT_TRUSTPILOT_CAROUSEL_EMBED } from '../../shared/trustpilotDefaults';
import { genericBreadcrumbText, scrapeGenericPage } from './pageScraper';
import {
  slugifySegment,
  storyFullSlug,
  suggestDestinationSlug,
  usesCoursesFolder,
  usesBlogFolder,
  isBlogPageTemplate,
  isCoursePageTemplate,
  isLevelPageTemplate,
} from '../../shared/migrationDestination';
import { MIGRATION_TEMPLATE_LABELS, TEMPLATES_WITH_FULL_FALLBACK } from '../../shared/migrationTemplateLabels';
import {
  ensureBlogFolder,
  findCoursesFolder,
  getStoryblokComponent,
  StoryblokApiError,
  upsertStory,
  validateStoryblokRootBloks,
  verifyStoryblokAccess,
  type StoryblokConfig,
} from './storyblokClient';
import { collectBlogScrapeWarnings, scrapeBlogPage } from './blogPageScraper';
import {
  buildBlogPostStoryblokContent,
  buildBlogPostStructureContent,
} from './buildBlogPostStoryblokContent';
import {
  applyTemplateStyles,
  buildPresetBlokFromSection,
  getMigrationTemplateBlueprint,
  sanitizeBlokForStoryblok,
} from './migrationTemplateRegistry';
import {
  getLibraryPresetBlok,
  mergePresetWithData,
  syncTemplateComponentLibrary,
} from './storyblokComponentLibrary';
import { hydrateTeamProfilePhotos } from './teamProfilePhotoMigration';
import { buildBlokFromTemplateSection } from './pageContentBuilder';
import { buildMergedCourseStoryblokContent, buildHeroRightBlokFromTemplate, mapScrapedCourseIntroduction } from './buildCourseTemplateContent';
import { hydrateCourseHeroStageImages } from './heroStageImageMigration';
import { collectLevelPageScrapeWarnings, scrapeLevelPageFile } from './levelPageScraper';
import {
  buildLevelPageStoryblokContent,
  buildLevelPageStructureBody,
} from './buildLevelPageStoryblokContent';
import {
  buildMergedRevisionCourseStoryblokContent,
  buildRevisionCourseStructureBody,
} from './buildRevisionCourseStoryblokContent';
import type { ScrapedLevelPage } from '../../shared/levelPageTypes';
import { loadCourseTemplateFile } from './courseTemplateParser';
import { indexTemplateSections, parseTemplateSectionsFromHtml, resolveTemplateSections, sectionHasLiveMatch, isPageBuilderLegalHtml } from './pageSectionExtractor';
import type { TemplateSectionBlueprint } from '../../shared/migrationTemplateTypes';
import { analyzeUnmatchedLayout } from './genericLayoutAnalyzer';
import { buildCustomComponentBody } from './componentGenerationService';

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

function buildTabBlocks(tab: ScrapedTabPanel): Record<string, unknown>[] {
  return buildTabBlocksFromPanel(tab);
}

function buildHeroLayoutBlok(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  sourceUrl: string,
): Record<string, unknown> | null {
  if (!scraped.hero && !scraped.heroRight) return null;

  const breadcrumbItems = scraped.hero?.breadcrumbItems ?? [];
  const schemaBreadcrumbs = buildSchemaBreadcrumbBloks(breadcrumbItems);

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
        schema_breadcrumb_id: `${sourceUrl}#breadcrumb`,
        schema_breadcrumbs: schemaBreadcrumbs,
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
        show_reviews_summary: true,
        reviews_stars: '★★★★★',
        reviews_label: 'Based on 308 reviews',
      }]
    : [{
        _uid: blokUid(),
        component: 'course_hero_right',
        section_label: 'THIS COURSE INCLUDES',
        show_reviews_summary: true,
        reviews_stars: '★★★★★',
        reviews_label: 'Based on 308 reviews',
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
  const mapped = mapScrapedCourseIntroduction(scraped.courseDescription);
  if (!mapped) return null;

  return {
    _uid: blokUid(),
    component: 'course_introduction',
    title: mapped.title,
    paragraph_1: mapped.paragraph1,
    paragraph_2: mapped.paragraph2 || undefined,
    read_more_label: 'Read more',
    read_less_label: 'Read less',
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
      blocks: buildTabBlocks(tab),
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

function buildCurriculumBlok(zenlerCourseId: string, courseCode: string): Record<string, unknown> | null {
  if (!zenlerCourseId && !courseCode) return null;
  // Prefer Zenler ID — site slugs change; Zenler IDs are the stable curriculum key.
  const courseId = zenlerCourseId || courseCode;
  return {
    _uid: blokUid(),
    component: 'course_curriculum',
    course_id: courseId,
    zenler_course_id: zenlerCourseId,
  };
}

function buildTestimonialsBlok(scraped: ScrapedCoursePage): Record<string, unknown> {
  const testimonials = scraped.testimonials;

  return {
    _uid: blokUid(),
    component: 'testimonials',
    layout: 'trustpilot',
    trustpilot_embed: DEFAULT_TRUSTPILOT_CAROUSEL_EMBED,
    eyebrow: testimonials?.eyebrow || 'Student reviews',
    title_prefix: testimonials?.titlePrefix || 'What students say about their experience with Vertex',
    title_accent: testimonials?.titleAccent || '',
    subtitle: testimonials?.subtitle || '',
  };
}

function buildPromotionBlok(scraped: ScrapedCoursePage): Record<string, unknown> | null {
  if (!scraped.promotion) return null;

  return {
    _uid: blokUid(),
    component: 'promotion_section',
    title: scraped.promotion.title,
    subtitle: scraped.promotion.subtitle,
    cta_text: scraped.promotion.ctaText,
    cta_link: storyblokLink(scraped.promotion.ctaUrl),
  };
}

function buildCourseFinderBannerBlok(): Record<string, unknown> {
  return {
    _uid: blokUid(),
    component: 'course_finder_banner',
  };
}

function buildCourseStoryblokContent(scraped: ScrapedCoursePage, zenlerCourseId: string): Record<string, unknown> {
  const sourceUrl = scraped.sourceUrl || `https://vls-online.com/courses/${scraped.slug}`;
  const body: Record<string, unknown>[] = [];

  const heroLayout = buildHeroLayoutBlok(scraped, zenlerCourseId, sourceUrl);
  if (heroLayout) body.push(heroLayout);

  const introduction = buildIntroductionBlok(scraped);
  if (introduction) body.push(introduction);

  const tabs = buildTabsBlok(scraped);
  if (tabs) body.push(tabs);

  const curriculum = buildCurriculumBlok(zenlerCourseId, scraped.courseCode);
  if (curriculum) body.push(curriculum);

  const faq = buildFaqBlok(scraped, zenlerCourseId, sourceUrl);
  if (faq) body.push(faq);

  const testimonials = buildTestimonialsBlok(scraped);
  if (testimonials) body.push(testimonials);

  const pricing = buildPricingBlok(scraped, zenlerCourseId);
  if (pricing) body.push(pricing);

  const promotion = buildPromotionBlok(scraped);
  if (promotion) body.push(promotion);

  if (scraped.hasCourseFinderBanner) body.push(buildCourseFinderBannerBlok());

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

function usesTemplateFallback(template: MigrationTemplate): boolean {
  return TEMPLATES_WITH_FULL_FALLBACK.includes(template);
}

function buildGenericFaqBlok(scraped: ScrapedGenericPage, sourceUrl: string): Record<string, unknown> | null {
  if (!scraped.faq?.items.length) return null;

  return {
    _uid: blokUid(),
    component: 'faq_section',
    title: scraped.faq.title || 'Frequently Asked Questions',
    icon: scraped.faq.icon || '❔',
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

function buildGenericStoryblokContent(
  scraped: ScrapedGenericPage,
  template: MigrationTemplate,
): Record<string, unknown> {
  const sourceUrl = scraped.sourceUrl;
  const body: Record<string, unknown>[] = [];

  if (template === 'home') {
    body.push({
      _uid: blokUid(),
      component: 'home_hero_section',
      hero: [{
        _uid: blokUid(),
        component: 'home_hero',
        heading: scraped.title,
        description: scraped.metaDescription,
      }],
    });
  }

  for (const section of scraped.sections) {
    body.push({
      _uid: blokUid(),
      component: 'content_cta_block',
      heading_prefix: section.heading || scraped.title,
      description: section.bodyText || section.heading,
    });
  }

  if (template === 'form') {
    body.push({
      _uid: blokUid(),
      component: 'enquiry_form',
    });
  }

  const faq = buildGenericFaqBlok(scraped, sourceUrl);
  if (faq) body.push(faq);

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
    component: 'page',
    seo,
    body,
  };
}

function collectCourseWarnings(scraped: ScrapedCoursePage, zenlerCourseId: string): string[] {
  const warnings: string[] = [...(scraped.extractionWarnings ?? [])];
  if (!scraped.hero) warnings.push('Course hero section was not detected on the source page.');
  if (!scraped.heroRight?.items.length) warnings.push('Course hero right card was not detected.');
  if (!scraped.courseDescription) warnings.push('Course description section was not detected between hero and tabs.');
  if (!scraped.tabs.length) warnings.push('Course tabs section was not detected.');
  if (!scraped.faq?.items.length) warnings.push('FAQ section was not detected.');
  if (!scraped.testimonials?.cards.length) warnings.push('Testimonials section was not detected.');
  if (!scraped.promotion) warnings.push('Promotion section was not detected.');
  if (!scraped.hasCourseFinderBanner) warnings.push('Course finder banner was not detected.');
  if (!zenlerCourseId) warnings.push('Zenler course ID was not found. Pricing and curriculum bloks were skipped.');
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  if (scraped.hero?.breadcrumbItems.some(item => !item.url)) {
    warnings.push('Some breadcrumb items are missing URLs.');
  }
  return warnings;
}

function collectGenericWarnings(scraped: ScrapedGenericPage): string[] {
  const warnings: string[] = [...(scraped.extractionWarnings ?? [])];
  if (!scraped.sections.length) warnings.push('No content sections were detected on the source page.');
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  if (!scraped.breadcrumbItems.length) warnings.push('Breadcrumb trail was not detected.');
  if (!scraped.faq?.items.length) warnings.push('FAQ section was not detected.');
  return warnings;
}

function pickText(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function applySessionPricingHeroRight(
  body: Record<string, unknown>[],
  template: MigrationTemplate,
): Record<string, unknown>[] {
  if (template !== 'course_dual_price') return body;
  const parsed = loadCourseTemplateFile('course_dual_price');
  if (parsed.pricingLayout !== 'session_selector') return body;
  const heroRight = buildHeroRightBlokFromTemplate(parsed);
  return body.map(blok => (
    blok.component === 'course_hero_layout'
      ? { ...blok, right: [heroRight] }
      : blok
  ));
}

function enrichCourseStructureBody(
  body: Record<string, unknown>[],
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  destinationSlug: string,
): Record<string, unknown>[] {
  // Prefer Zenler ID — site slugs change; Zenler IDs are the stable curriculum key.
  const courseRef = pickText(
    zenlerCourseId,
    scraped.courseCode,
    destinationSlug.toUpperCase(),
    scraped.slug.toUpperCase(),
  );

  return body.map(blok => {
    const component = typeof blok.component === 'string' ? blok.component : '';

    if (component === 'course_hero_layout' && Array.isArray(blok.left)) {
      return {
        ...blok,
        left: blok.left.map(item => {
          if (!item || typeof item !== 'object') return item;
          const hero = item as Record<string, unknown>;
          return hero.component === 'course_hero'
            ? { ...hero, zenler_course_id: zenlerCourseId || hero.zenler_course_id }
            : hero;
        }),
      };
    }

    if (component === 'course_curriculum') {
      return {
        ...blok,
        course_id: courseRef,
        zenler_course_id: zenlerCourseId || blok.zenler_course_id,
      };
    }

    if (component === 'course_tutor_section') {
      return {
        ...blok,
        name: pickText(typeof blok.name === 'string' ? blok.name : undefined, 'Course tutor'),
      };
    }

    if (component === 'course_introduction') {
      const mapped = mapScrapedCourseIntroduction(scraped.courseDescription);
      if (!mapped) return blok;
      return {
        ...blok,
        title: mapped.title,
        paragraph_1: mapped.paragraph1,
        paragraph_2: mapped.paragraph2 || undefined,
        read_more_label: pickText(
          typeof blok.read_more_label === 'string' ? blok.read_more_label : undefined,
          'Read more',
        ),
        read_less_label: pickText(
          typeof blok.read_less_label === 'string' ? blok.read_less_label : undefined,
          'Read less',
        ),
      };
    }

    return blok;
  });
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

function storyblokConfig(input: Pick<PageMigrationRequest, 'storyblokSpaceId' | 'storyblokAccessToken' | 'storyblokRegion'>): StoryblokConfig {
  return {
    spaceId: input.storyblokSpaceId.trim(),
    accessToken: input.storyblokAccessToken.trim(),
    region: input.storyblokRegion,
  };
}

function normalizeDestinationSlug(raw: string): string {
  return slugifySegment(raw.trim());
}

function templateReferenceSummary(template: MigrationTemplate): TemplateReferenceSummary {
  const blueprint = getMigrationTemplateBlueprint(template);
  return {
    template,
    label: MIGRATION_TEMPLATE_LABELS[template],
    fileName: blueprint.fileName,
    sectionCount: blueprint.sections.length,
    sections: blueprint.sections.map(section => ({
      key: section.key,
      label: section.label,
      component: section.component,
    })),
  };
}

async function syncLibrarySafely(
  config: StoryblokConfig,
  template: MigrationTemplate,
  warnings: string[],
): Promise<{ summary: ComponentLibrarySummary; presetBloksBySection: Record<string, Record<string, unknown>> } | undefined> {
  if (isBlogPageTemplate(template)) return undefined;

  try {
    const librarySync = await syncTemplateComponentLibrary(config, template);
    warnings.push(
      `Synced ${librarySync.presets.length} reusable component presets in Storyblok/${librarySync.folderSlug}/${template}.`,
    );
    return {
      summary: {
        folderSlug: librarySync.folderSlug,
        presetsCreated: librarySync.created,
        presetsUpdated: librarySync.updated,
        presets: librarySync.presets.map(preset => ({
          fullSlug: preset.fullSlug,
          component: preset.component,
          created: preset.created,
        })),
      },
      presetBloksBySection: librarySync.presetBloksBySection,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown component library sync error';
    warnings.push(`Component library sync skipped: ${message}. Page migration will continue without presets.`);
    return undefined;
  }
}

async function validateGenericPageSchema(
  config: StoryblokConfig,
  template: MigrationTemplate,
): Promise<void> {
  const blueprint = getMigrationTemplateBlueprint(template);
  const bodyComponents = blueprint.sections.map(section => section.component);
  const validation = await validateStoryblokRootBloks(config, 'page', bodyComponents);

  const problems: string[] = [];
  if (validation.missingComponents.length) {
    problems.push(`missing component schemas: ${validation.missingComponents.join(', ')}`);
  }
  if (validation.missingFromWhitelist.length) {
    problems.push(`not allowed in the page body whitelist: ${validation.missingFromWhitelist.join(', ')}`);
  }

  if (problems.length) {
    throw new CourseMigrationError(
      [
        `Storyblok page schema is not ready for the ${template} migration.`,
        problems.join('; '),
        'Push the latest component schemas from vls-online-v2/storyblok/components, then try the migration again.',
      ].join(' '),
      422,
    );
  }
}

async function stylizeBlok(
  blok: Record<string, unknown> | null,
  template: MigrationTemplate,
  sectionKey: string,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
  config: StoryblokConfig | null,
): Promise<Record<string, unknown> | null> {
  if (!blok) return null;

  const blueprint = getMigrationTemplateBlueprint(template);
  const section = blueprint.sections.find(item => item.key === sectionKey)
    ?? blueprint.sections.find(item => sectionKey.includes(item.key));

  const styled = applyTemplateStyles(blueprint, section?.key ?? sectionKey, blok);
  if (!section) return sanitizeBlokForStoryblok(styled);

  const cachedPreset = presetBloksBySection?.[section.key] ?? null;
  if (cachedPreset) {
    return sanitizeBlokForStoryblok(mergePresetWithData(cachedPreset, styled, section.styles));
  }

  if (!config) return sanitizeBlokForStoryblok(styled);

  try {
    const preset = await getLibraryPresetBlok(config, template, section.key);
    return sanitizeBlokForStoryblok(mergePresetWithData(preset, styled, section.styles));
  } catch {
    return sanitizeBlokForStoryblok(styled);
  }
}

async function buildCourseStoryblokContentAsync(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  template: MigrationTemplate,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
  config: StoryblokConfig | null,
): Promise<{ content: Record<string, unknown>; warnings: string[] }> {
  const base = template === 'revision_course'
    ? buildMergedRevisionCourseStoryblokContent(scraped, zenlerCourseId, template)
    : buildMergedCourseStoryblokContent(scraped, zenlerCourseId, template);
  const blueprint = getMigrationTemplateBlueprint(template);
  const body = Array.isArray(base.body) ? base.body as Record<string, unknown>[] : [];

  const mapped: Array<Record<string, unknown> | null> = [];
  for (const blok of body) {
    const component = String(blok.component ?? '');
    const section = blueprint.sections.find(item => item.component === component);
    const sectionKey = section?.key ?? 'section';
    mapped.push(await stylizeBlok(blok, template, sectionKey, presetBloksBySection, config));
  }

  let content: Record<string, unknown> = {
    ...base,
    body: mapped.filter(Boolean),
  };

  if (scraped.stageMode === 'image' && scraped.stageImageUrl) {
    content = injectHeroStageImageSources(content, scraped);
  }

  return hydrateCourseHeroStageImages(content, config);
}

function injectHeroStageImageSources(
  content: Record<string, unknown>,
  scraped: ScrapedCoursePage,
): Record<string, unknown> {
  const body = Array.isArray(content.body) ? content.body as Record<string, unknown>[] : [];

  return {
    ...content,
    body: body.map((blok) => {
      if (blok.component !== 'course_hero_layout' || !Array.isArray(blok.left)) return blok;
      return {
        ...blok,
        left: blok.left.map((item) => {
          if (!item || typeof item !== 'object') return item;
          const hero = item as Record<string, unknown>;
          if (hero.component !== 'course_hero') return item;
          return {
            ...hero,
            stage_mode: 'image',
            migration_stage_image_url: scraped.stageImageUrl,
            migration_stage_image_alt: scraped.stageImageAlt ?? scraped.stageCaptionTitle ?? '',
          };
        }),
      };
    }),
  };
}

function collapseLegalBody(body: Record<string, unknown>[]): Record<string, unknown>[] {
  const hero = body.find((blok) => blok.component === 'legal_hero');
  const articleIndex = body.findIndex((blok) => blok.component === 'legal_article');
  if (articleIndex < 0) return body;

  const sections = body.filter((blok) => blok.component === 'legal_section');
  const article = {
    ...body[articleIndex],
    ...(sections.length ? { sections } : {}),
  };

  return [hero, article].filter(Boolean) as Record<string, unknown>[];
}

function buildMinimalLegalStructureBody(
  blueprint: ReturnType<typeof getMigrationTemplateBlueprint>,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
): Record<string, unknown>[] {
  const heroSection = blueprint.sections.find(section => section.component === 'legal_hero');
  const articleSection = blueprint.sections.find(section => section.component === 'legal_article');
  const hero = heroSection
    ? (presetBloksBySection?.[heroSection.key] ?? buildPresetBlokFromSection(blueprint, heroSection))
    : null;
  const article = articleSection
    ? (presetBloksBySection?.[articleSection.key] ?? buildPresetBlokFromSection(blueprint, articleSection))
    : null;
  return collapseLegalBody([hero, article].filter(Boolean) as Record<string, unknown>[]);
}

async function buildPageBuilderLegalStoryblokContentAsync(
  scraped: ScrapedGenericPage,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
  config: StoryblokConfig | null,
): Promise<Record<string, unknown>> {
  const blueprint = getMigrationTemplateBlueprint('legal');
  const byKey = indexTemplateSections(scraped.templateSections ?? []);
  const heroBlueprint = blueprint.sections.find(section => section.component === 'legal_hero');
  const articleBlueprint = blueprint.sections.find(section => section.component === 'legal_article');
  const sectionPreset = blueprint.sections.find(section => section.component === 'legal_section');
  const body: Record<string, unknown>[] = [];

  if (heroBlueprint) {
    const heroBlok = buildBlokFromTemplateSection(heroBlueprint, byKey.get('legal-hero'), scraped);
    const styled = await stylizeBlok(heroBlok, 'legal', heroBlueprint.key, presetBloksBySection, config);
    if (styled) body.push(styled);
  }

  if (articleBlueprint) {
    const articleBlok = buildBlokFromTemplateSection(articleBlueprint, byKey.get('legal-article'), scraped);
    const styled = await stylizeBlok(articleBlok, 'legal', articleBlueprint.key, presetBloksBySection, config);
    if (styled) body.push(styled);
  }

  for (const [key, extracted] of byKey) {
    if (key === 'legal-hero' || key === 'legal-article') continue;
    const dynamicBlueprint: TemplateSectionBlueprint = {
      key,
      label: extracted.legalSectionHeading || key,
      component: 'legal_section',
      classes: ['sec'],
      isBand: false,
      styles: sectionPreset?.styles ?? {},
      sampleHeading: extracted.legalSectionHeading || key,
      sampleDescription: extracted.body?.slice(0, 240) ?? '',
    };
    const blok = buildBlokFromTemplateSection(dynamicBlueprint, extracted, scraped);
    const styled = await stylizeBlok(
      blok,
      'legal',
      sectionPreset?.key ?? key,
      presetBloksBySection,
      config,
    );
    if (styled) body.push(styled);
  }

  const finalBody = collapseLegalBody(body);
  const sourceUrl = scraped.sourceUrl;
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
    component: 'page',
    seo,
    body: finalBody,
  };
}

export async function buildGenericStoryblokContentAsync(
  scraped: ScrapedGenericPage,
  template: MigrationTemplate,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
  config: StoryblokConfig | null,
): Promise<Record<string, unknown>> {
  if (template === 'legal' && scraped.rawHtml && isPageBuilderLegalHtml(scraped.rawHtml)) {
    return buildPageBuilderLegalStoryblokContentAsync(scraped, presetBloksBySection, config);
  }

  const blueprint = getMigrationTemplateBlueprint(template);
  const sourceUrl = scraped.sourceUrl;
  const extractedByKey = resolveTemplateSections(template, scraped.templateSections ?? []);
  const body: Record<string, unknown>[] = [];

  for (const section of blueprint.sections) {
    if (!sectionHasLiveMatch(section.key, section.component, scraped, template)) {
      continue;
    }

    const extracted = extractedByKey.get(section.key);
    const allowTemplateFallback = usesTemplateFallback(template);
    let blok: Record<string, unknown> | null = null;

    if (section.component === 'home_hero_section') {
      blok = {
        _uid: blokUid(),
        component: 'home_hero_section',
        hero: [{
          _uid: blokUid(),
          component: 'home_hero',
          heading: scraped.title,
          description: scraped.metaDescription,
        }],
      };
    } else if (section.component === 'enquiry_form') {
      blok = { _uid: blokUid(), component: 'enquiry_form' };
    } else if (section.component === 'faq_section' && scraped.faq?.items?.length) {
      blok = buildGenericFaqBlok(scraped, sourceUrl);
    } else if (section.component === 'faq_section' && allowTemplateFallback) {
      blok = buildBlokFromTemplateSection(section, extracted, scraped, { allowTemplateFallback: true });
    } else {
      blok = buildBlokFromTemplateSection(section, extracted, scraped, { allowTemplateFallback });
    }

    blok = await hydrateTeamProfilePhotos(blok, config);

    const styled = await stylizeBlok(blok, template, section.key, presetBloksBySection, config);
    if (styled) {
      body.push(styled);
    } else if (allowTemplateFallback) {
      const preset = presetBloksBySection?.[section.key]
        ?? buildPresetBlokFromSection(blueprint, section);
      if (preset) body.push(preset);
    }
  }

  if (!body.length) {
    return buildGenericStoryblokContent(scraped, template);
  }

  const finalBody = template === 'legal' ? collapseLegalBody(body) : body;

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
    component: 'page',
    seo,
    body: finalBody,
  };
}

export async function migratePage(input: PageMigrationRequest): Promise<PageMigrationResult> {
  if (!input.pageUrl?.trim()) throw new CourseMigrationError('Origin page URL is required');
  if (!input.dryRun) {
    if (!input.storyblokSpaceId?.trim()) throw new CourseMigrationError('Storyblok space ID is required');
    if (!input.storyblokAccessToken?.trim()) throw new CourseMigrationError('Storyblok access token is required');
  }

  const template = input.template;
  const destinationSlug = normalizeDestinationSlug(
    input.destinationSlug?.trim() || suggestDestinationSlug(input.pageUrl.trim(), template),
  );
  const fullSlug = storyFullSlug(template, destinationSlug);
  const templateReference = templateReferenceSummary(template);

  if (isBlogPageTemplate(template)) {
    const scraped = await scrapeBlogPage(input.pageUrl.trim());
    const warnings = collectBlogScrapeWarnings(scraped);

    if (input.dryRun) {
      return { template, destinationSlug, fullSlug, scraped, warnings, templateReference };
    }

    const config = storyblokConfig(input);
    await verifyStoryblokAccess(config);
    const missingBlogComponents = await detectMissingBlogComponents(config);
    if (missingBlogComponents.length) {
      throw new CourseMigrationError(
        `Missing Storyblok blog components: ${missingBlogComponents.join(', ')}`,
        400,
      );
    }

    const built = await buildBlogPostStoryblokContent(scraped, config);
    warnings.push(...built.warnings);
    const upsert = await upsertStory(config, {
      name: scraped.title || destinationSlug,
      slug: destinationSlug,
      parentId: built.parentFolderId,
      fullSlug: storyFullSlug(template, destinationSlug, { useBlogFolder: true }),
      content: built.content,
      publish: Boolean(input.publish),
    });

    if (!upsert.created) {
      warnings.push('An existing Storyblok story was updated for this destination slug.');
    }

    try {
      const dbPage = await getMigrationPageByOriginUrl(scraped.sourceUrl);
      if (dbPage) await markMigrationPageMigrated(dbPage.id, upsert.story.id);
    } catch (err) {
      warnings.push(`Story created in Storyblok but migration tracking update failed: ${err instanceof Error ? err.message : 'Unknown database error'}`);
    }

    return {
      template,
      destinationSlug,
      fullSlug: upsert.story.full_slug,
      scraped,
      warnings,
      templateReference,
      storyblok: {
        storyId: upsert.story.id,
        fullSlug: upsert.story.full_slug,
        previewUrl: upsert.previewUrl,
        created: upsert.created,
      },
    };
  }

  if (isCoursePageTemplate(template)) {
    const scraped = await scrapeCoursePage(input.pageUrl.trim());
    const zenlerCourseId = await resolveZenlerCourseId(scraped);
    const warnings = collectCourseWarnings(scraped, zenlerCourseId);

    if (input.dryRun) {
      return { template, destinationSlug, fullSlug, scraped, warnings, templateReference };
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

    const librarySync = await syncLibrarySafely(config, template, warnings);

    const built = await buildCourseStoryblokContentAsync(
      scraped,
      zenlerCourseId,
      template,
      librarySync?.presetBloksBySection ?? null,
      config,
    );
    warnings.push(...built.warnings);
    const upsert = await upsertStory(config, {
      name: scraped.title || scraped.slug.toUpperCase(),
      slug: destinationSlug,
      parentId: coursesFolder.id,
      fullSlug,
      content: built.content,
      publish: Boolean(input.publish),
    });

    if (!upsert.created) {
      warnings.push('An existing Storyblok story was updated for this destination slug.');
    }

    try {
      const dbPage = await getMigrationPageByOriginUrl(scraped.sourceUrl);
      if (dbPage) await markMigrationPageMigrated(dbPage.id, upsert.story.id);
    } catch (err) {
      warnings.push(`Story created in Storyblok but migration tracking update failed: ${err instanceof Error ? err.message : 'Unknown database error'}`);
    }

    return {
      template,
      destinationSlug,
      fullSlug,
      scraped,
      warnings,
      templateReference,
      componentLibrary: librarySync?.summary,
      storyblok: {
        storyId: upsert.story.id,
        fullSlug: upsert.story.full_slug,
        previewUrl: upsert.previewUrl,
        created: upsert.created,
      },
    };
  }

  const scraped = await scrapeGenericPage(input.pageUrl.trim(), template);
  const warnings = collectGenericWarnings(scraped);

  if (input.dryRun) {
    return { template, destinationSlug, fullSlug, scraped, warnings, templateReference };
  }

  const config = storyblokConfig(input);
  await verifyStoryblokAccess(config);
  await validateGenericPageSchema(config, template);

  const librarySync = await syncLibrarySafely(config, template, warnings);

  const content = await buildGenericStoryblokContentAsync(
    scraped,
    template,
    librarySync?.presetBloksBySection ?? null,
    config,
  );
  const upsert = await upsertStory(config, {
    name: scraped.title || genericBreadcrumbText(scraped) || destinationSlug,
    slug: destinationSlug,
    fullSlug,
    content,
    publish: Boolean(input.publish),
  });

  if (!upsert.created) {
    warnings.push('An existing Storyblok story was updated for this destination slug.');
  }

  try {
    const dbPage = await getMigrationPageByOriginUrl(scraped.sourceUrl);
    if (dbPage) await markMigrationPageMigrated(dbPage.id, upsert.story.id);
  } catch (err) {
    warnings.push(`Story created in Storyblok but migration tracking update failed: ${err instanceof Error ? err.message : 'Unknown database error'}`);
  }

  return {
    template,
    destinationSlug,
    fullSlug,
    scraped,
    warnings,
    templateReference,
    componentLibrary: librarySync?.summary,
    storyblok: {
      storyId: upsert.story.id,
      fullSlug: upsert.story.full_slug,
      previewUrl: upsert.previewUrl,
      created: upsert.created,
    },
  };
}

/** Backward-compatible course migration entry point. */
export async function migrateCoursePage(input: CourseMigrationRequest): Promise<PageMigrationResult> {
  return migratePage({
    pageUrl: input.pageUrl,
    template: input.template ?? 'course',
    destinationSlug: input.destinationSlug ?? '',
    storyblokSpaceId: input.storyblokSpaceId,
    storyblokAccessToken: input.storyblokAccessToken,
    storyblokRegion: input.storyblokRegion,
    publish: input.publish,
    dryRun: input.dryRun,
  });
}

function storyblokConfigFromCredentials(credentials: StoryblokCredentials): StoryblokConfig {
  return {
    spaceId: credentials.storyblokSpaceId.trim(),
    accessToken: credentials.storyblokAccessToken.trim(),
    region: credentials.storyblokRegion,
  };
}

const LEVEL_PAGE_TOP_LEVEL_COMPONENTS = [
  'level_page_hero',
  'level_intro_section',
  'level_pathway_section',
  'level_papers_section',
  'level_why_section',
  'level_reviews_section',
  'level_faq_section',
  'level_cta_section',
];

/** Nestable children — must exist in Storyblok but are not page.body whitelist entries. */
const LEVEL_PAGE_NESTABLE_COMPONENTS = [
  'level_hero_main',
  'level_pricing_sidebar',
  'level_breadcrumb_item',
  'level_meta_item',
  'level_session_option',
  'level_include_item',
  'level_pathway_step',
  'level_paper_group',
  'level_paper_module',
  'level_submeta_item',
  'level_why_item',
  'level_rating_bar',
  'level_review_card',
  'level_faq_item',
];

function collectLevelPageWarnings(scraped: ScrapedLevelPage): string[] {
  return collectLevelPageScrapeWarnings(scraped);
}

async function buildLevelPageStoryblokContentAsync(
  scraped: ScrapedLevelPage,
  config: StoryblokConfig,
): Promise<{ content: Record<string, unknown>; warnings: string[] }> {
  const base = buildLevelPageStoryblokContent(scraped);
  const hydrated = await hydrateCourseHeroStageImages(base, config);
  return { content: hydrated.content, warnings: hydrated.warnings };
}

function resolveDestinationSlug(page: MigrationPageRecord): string {
  return normalizeDestinationSlug(
    page.destinationSlug?.trim() || suggestDestinationSlug(page.originUrl, page.template),
  );
}

function migrationUsesCoursesFolder(page: MigrationPageRecord, template: MigrationTemplate): boolean {
  if (page.sourceType === 'file') return false;
  return usesCoursesFolder(template);
}

function migrationUsesBlogFolder(page: MigrationPageRecord, template: MigrationTemplate): boolean {
  if (page.sourceType === 'file') return false;
  return usesBlogFolder(template);
}

function rootComponentForTemplate(template: MigrationTemplate): string {
  if (isBlogPageTemplate(template)) return 'blog_post';
  return isCoursePageTemplate(template) ? 'course_page' : 'page';
}

async function detectMissingBlogComponents(config: StoryblokConfig): Promise<string[]> {
  const required = ['blog_post', 'blog_takeaway_item', 'blog_faq_item', 'seo'] as const;
  const missing: string[] = [];
  for (const component of required) {
    const exists = Boolean(await getStoryblokComponent(config, component));
    if (!exists) missing.push(component);
  }
  return missing;
}

async function detectMissingLevelPageComponents(config: StoryblokConfig): Promise<string[]> {
  const rootComponent = 'page';
  const validation = await validateStoryblokRootBloks(
    config,
    rootComponent,
    [...LEVEL_PAGE_TOP_LEVEL_COMPONENTS],
  );

  const missing = new Set<string>(validation.missingComponents);
  if (!validation.rootExists) missing.add(rootComponent);
  for (const component of validation.missingFromWhitelist) {
    missing.add(`${component} (not allowed in ${rootComponent} body whitelist)`);
  }

  const nestableChecks = await Promise.all(
    LEVEL_PAGE_NESTABLE_COMPONENTS.map(async (component) => ({
      component,
      exists: Boolean(await getStoryblokComponent(config, component)),
    })),
  );
  for (const check of nestableChecks.filter(item => !item.exists)) {
    missing.add(check.component);
  }

  return Array.from(missing);
}

async function detectMissingComponents(
  config: StoryblokConfig,
  template: MigrationTemplate,
  blueprint: ReturnType<typeof getMigrationTemplateBlueprint>,
): Promise<string[]> {
  const rootComponent = rootComponentForTemplate(template);
  const bodyComponents = Array.from(new Set(blueprint.sections.map(section => section.component)));

  const validation = await validateStoryblokRootBloks(config, rootComponent, bodyComponents);

  const missing = new Set<string>(validation.missingComponents);
  if (!validation.rootExists) missing.add(rootComponent);
  for (const component of validation.missingFromWhitelist) {
    missing.add(`${component} (not allowed in ${rootComponent} body whitelist)`);
  }
  return Array.from(missing);
}

/**
 * Course pages use a fixed builder-function mapping (not blueprint sections), so this only
 * applies to generic templates. Returns the labels of every blueprint section that has zero
 * matching content on the actually-scraped live page — i.e. sections that would otherwise be
 * filled with the static template reference file's own sample copy instead of real content.
 */
function detectUnmatchedSections(
  blueprint: ReturnType<typeof getMigrationTemplateBlueprint>,
  scraped: ScrapedGenericPage,
): string[] {
  const liveByKey = indexTemplateSections(scraped.templateSections ?? []);
  return blueprint.sections
    .filter(section => section.component !== 'enquiry_form' && !liveByKey.has(section.key))
    .map(section => section.label || section.key);
}

/** Phase 1: scrape every detail from the source page and persist it, without touching Storyblok. */
export async function previewScrapePage(
  pageId: number,
  options?: { source?: 'live' | 'file'; filename?: string },
): Promise<ScrapePhaseResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);

  const useFileSource = options?.source === 'file'
    || page.sourceType === 'file'
    || Boolean(page.pageContentFilename);
  const filename = options?.filename || page.pageContentFilename;

  if (useFileSource) {
    if (!filename) {
      throw new CourseMigrationError('Select a page-content file before scraping.', 400);
    }
    if (page.template !== 'qualification_level_page') {
      throw new CourseMigrationError('File scraping is only supported for the Qualification Level Page template.', 400);
    }

    const scraped = scrapeLevelPageFile(filename);
    const warnings = collectLevelPageScrapeWarnings(scraped);
    await saveScrapeResult(pageId, { scraped, warnings });
    await updateMigrationPageSource(pageId, { sourceType: 'file', pageContentFilename: filename });
    const updatedPage = await getMigrationPageById(pageId);
    return { page: updatedPage ?? page, scraped, warnings };
  }

  if (isCoursePageTemplate(page.template)) {
    const scraped = await scrapeCoursePage(page.originUrl);
    const zenlerCourseId = await resolveZenlerCourseId(scraped);
    const warnings = collectCourseWarnings(scraped, zenlerCourseId);
    await saveScrapeResult(pageId, { scraped, warnings });
    const updatedPage = await getMigrationPageById(pageId);
    return { page: updatedPage ?? page, scraped, warnings };
  }

  if (isBlogPageTemplate(page.template)) {
    const scraped = await scrapeBlogPage(page.originUrl);
    const warnings = collectBlogScrapeWarnings(scraped);
    await saveScrapeResult(pageId, { scraped, warnings });
    const updatedPage = await getMigrationPageById(pageId);
    return { page: updatedPage ?? page, scraped, warnings };
  }

  const scraped = await scrapeGenericPage(page.originUrl, page.template);
  const warnings = collectGenericWarnings(scraped);
  await saveScrapeResult(pageId, { scraped, warnings });
  const updatedPage = await getMigrationPageById(pageId);
  return { page: updatedPage ?? page, scraped, warnings };
}

/**
 * Used once a page has been through Generate Component: builds the draft story body from that
 * one custom component (re-analyzed from the stored raw HTML) instead of the template blueprint,
 * since a page like this was never going to match any blueprint section in the first place.
 */
async function generateCustomComponentStructure(
  page: MigrationPageRecord,
  pageId: number,
  config: StoryblokConfig,
  template: MigrationTemplate,
  templateReference: TemplateReferenceSummary,
  scraped: ScrapedGenericPage,
): Promise<StructurePhaseResult> {
  const componentName = page.customComponentName as string;
  if (!scraped.rawHtml) {
    throw new CourseMigrationError(
      'No raw HTML saved for this page — run Preview Scrape again before Generate Structure.',
      400,
    );
  }

  const analysis = analyzeUnmatchedLayout(scraped.rawHtml, scraped.title || page.title || page.path);
  const body = buildCustomComponentBody(componentName, analysis);

  const destinationSlug = resolveDestinationSlug(page);
  const fullSlug = storyFullSlug(template, destinationSlug);
  const rootComponent = rootComponentForTemplate(template);

  const upsert = await upsertStory(config, {
    name: page.title || destinationSlug,
    slug: destinationSlug,
    fullSlug,
    content: { component: rootComponent, seo: [], body },
    publish: false,
  });

  const warnings: string[] = [
    `Structure built from the custom component "${componentName}" instead of the "${template}" template blueprint.`,
  ];
  if (!upsert.created) {
    warnings.push('An existing Storyblok story at this destination was updated with the generated structure.');
  }

  await saveStructureResult(pageId, {
    structure: { templateReference, componentLibrary: null },
    draftStoryId: upsert.story.id,
  });

  const updatedPage = await getMigrationPageById(pageId);

  return {
    page: updatedPage ?? page,
    templateReference,
    missingComponents: [],
    unmatchedSections: [],
    draftStory: {
      storyId: upsert.story.id,
      fullSlug: upsert.story.full_slug,
      previewUrl: upsert.previewUrl,
      created: upsert.created,
    },
    warnings,
  };
}

/**
 * Phase 2: match scraped sections against the template blueprint and Storyblok's component
 * collection. Flags and stops (creates nothing) if a required component schema is missing —
 * missing renderers/components are built as explicit follow-up work, never guessed.
 */
export async function generatePageStructure(
  pageId: number,
  credentials: StoryblokCredentials,
): Promise<StructurePhaseResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);

  const scrapedRaw = await getScrapedData(pageId);
  if (!scrapedRaw) {
    throw new CourseMigrationError('Run Preview Scrape for this page before generating structure.', 400);
  }

  const template = page.template;
  const blueprint = getMigrationTemplateBlueprint(template);
  const templateReference = templateReferenceSummary(template);

  const config = storyblokConfigFromCredentials(credentials);
  await verifyStoryblokAccess(config);

  if (isBlogPageTemplate(template)) {
    const blogScraped = scrapedRaw as ScrapedBlogPost;
    const missingBlogComponents = await detectMissingBlogComponents(config);
    if (missingBlogComponents.length) {
      return {
        page,
        templateReference,
        missingComponents: missingBlogComponents,
        unmatchedSections: [],
        warnings: [
          `Generate Structure stopped: ${missingBlogComponents.length} blog component(s) are missing in Storyblok. Push blog schemas (blog_post, takeaways, FAQ), then try again.`,
        ],
      };
    }

    const destinationSlug = resolveDestinationSlug(page);
    const fullSlug = storyFullSlug(template, destinationSlug, { useBlogFolder: true });
    const blogFolder = await ensureBlogFolder(config);
    const content = buildBlogPostStructureContent(blogScraped);
    const upsert = await upsertStory(config, {
      name: blogScraped.title || page.title || destinationSlug,
      slug: destinationSlug,
      parentId: blogFolder.id,
      fullSlug,
      content,
      publish: false,
    });

    const warnings = [
      ...collectBlogScrapeWarnings(blogScraped),
      ...(upsert.created ? [] : ['An existing Storyblok story at this destination was updated with the generated blog structure.']),
      'Blog structure draft created. Migrate Content will upload all images to Storyblok and fill the full article body.',
    ];

    await saveStructureResult(pageId, {
      structure: { templateReference, componentLibrary: null },
      draftStoryId: upsert.story.id,
    });
    const updatedPage = await getMigrationPageById(pageId);
    return {
      page: updatedPage ?? page,
      templateReference,
      missingComponents: [],
      unmatchedSections: [],
      draftStory: {
        storyId: upsert.story.id,
        fullSlug: upsert.story.full_slug,
        previewUrl: upsert.previewUrl,
        created: upsert.created,
      },
      warnings,
    };
  }

  if (!isCoursePageTemplate(template) && !isLevelPageTemplate(template) && page.customComponentName) {
    return generateCustomComponentStructure(page, pageId, config, template, templateReference, scrapedRaw as ScrapedGenericPage);
  }

  const missingComponents = isLevelPageTemplate(template)
    ? await detectMissingLevelPageComponents(config)
    : await detectMissingComponents(config, template, blueprint);
  if (missingComponents.length) {
    return {
      page,
      templateReference,
      missingComponents,
      unmatchedSections: [],
      warnings: [
        `Generate Structure stopped: ${missingComponents.length} component(s) are missing (or not whitelisted) in Storyblok. Create these components/renderers, then try again.`,
      ],
    };
  }

  let unmatchedSections: string[] = [];
  const scraped = scrapedRaw as ScrapedGenericPage;
  const pageBuilderLegal = template === 'legal' && isPageBuilderLegalHtml(scraped.rawHtml ?? '');

  if (!isCoursePageTemplate(template) && !isLevelPageTemplate(template) && !isBlogPageTemplate(template)) {
    const eligibleSections = blueprint.sections.filter(section => section.component !== 'enquiry_form');
    unmatchedSections = pageBuilderLegal ? [] : detectUnmatchedSections(blueprint, scraped);
    if (
      !usesTemplateFallback(template)
      && !pageBuilderLegal
      && eligibleSections.length > 0
      && unmatchedSections.length === eligibleSections.length
    ) {
      return {
        page,
        templateReference,
        missingComponents: [],
        unmatchedSections,
        warnings: [
          `Generate Structure stopped: none of the "${template}" template's ${eligibleSections.length} section(s) match anything found on the live page. ` +
            'This page\'s real layout does not fit this template — build a matching component (e.g. for its actual sections/layout) before migrating, ' +
            'rather than filling the page with the template reference file\'s placeholder copy.',
        ],
      };
    }
  }

  const warnings: string[] = [];
  const librarySync = await syncLibrarySafely(config, template, warnings);
  const presetBloksBySection = librarySync?.presetBloksBySection ?? null;

  const destinationSlug = resolveDestinationSlug(page);

  let body: Record<string, unknown>[] = pageBuilderLegal
    ? buildMinimalLegalStructureBody(blueprint, presetBloksBySection)
    : isLevelPageTemplate(template)
      ? buildLevelPageStructureBody()
      : template === 'revision_course'
        ? buildRevisionCourseStructureBody()
        : blueprint.sections.map(section => (
          presetBloksBySection?.[section.key] ?? buildPresetBlokFromSection(blueprint, section)
        ));

  let zenlerCourseId = '';
  if (isCoursePageTemplate(template)) {
    const courseScraped = scrapedRaw as ScrapedCoursePage;
    zenlerCourseId = await resolveZenlerCourseId(courseScraped);
    body = enrichCourseStructureBody(body as Record<string, unknown>[], courseScraped, zenlerCourseId, destinationSlug);
    body = applySessionPricingHeroRight(body as Record<string, unknown>[], template);
    if (!zenlerCourseId) {
      warnings.push(
        'Zenler course ID was not found in the scrape or CMS course list. Structure was generated with blank zenler_course_id — set it in Storyblok before migrating pricing/curriculum.',
      );
    }
  }

  const fullSlug = storyFullSlug(template, destinationSlug, {
    useCoursesFolder: migrationUsesCoursesFolder(page, template),
    useBlogFolder: migrationUsesBlogFolder(page, template),
  });
  const rootComponent = rootComponentForTemplate(template);

  const content: Record<string, unknown> = isCoursePageTemplate(template)
    ? { component: rootComponent, title: page.title || destinationSlug, zenler_course_id: zenlerCourseId, seo: [], body }
    : { component: rootComponent, seo: [], body };

  let parentId: number | undefined;
  if (migrationUsesCoursesFolder(page, template)) {
    const coursesFolder = await findCoursesFolder(config);
    if (!coursesFolder) {
      throw new CourseMigrationError(
        'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
        404,
      );
    }
    parentId = coursesFolder.id;
  } else if (migrationUsesBlogFolder(page, template)) {
    parentId = (await ensureBlogFolder(config)).id;
  }

  const upsert = await upsertStory(config, {
    name: page.title || destinationSlug,
    slug: destinationSlug,
    parentId,
    fullSlug,
    content,
    publish: false,
  });

  if (!upsert.created) {
    warnings.push('An existing Storyblok story at this destination was updated with the generated structure.');
  }

  if (pageBuilderLegal) {
    warnings.push(
      'Live page uses a page-builder legal layout — draft structure is hero + article only; nested sections are created dynamically during Migrate Content.',
    );
  } else if (unmatchedSections.length) {
    if (usesTemplateFallback(template)) {
      warnings.push(
        `${unmatchedSections.length} section(s) had no live-page match and will use the HTML template reference defaults: ${unmatchedSections.join(', ')}.`,
      );
    } else {
      warnings.push(
        `${unmatchedSections.length} section(s) have no matching content on the live page and will be skipped in Migrate Content: ${unmatchedSections.join(', ')}.`,
      );
    }
  }

  await saveStructureResult(pageId, {
    structure: { templateReference, componentLibrary: librarySync?.summary ?? null },
    draftStoryId: upsert.story.id,
  });

  const updatedPage = await getMigrationPageById(pageId);

  return {
    page: updatedPage ?? page,
    templateReference,
    componentLibrary: librarySync?.summary,
    missingComponents: [],
    unmatchedSections,
    draftStory: {
      storyId: upsert.story.id,
      fullSlug: upsert.story.full_slug,
      previewUrl: upsert.previewUrl,
      created: upsert.created,
    },
    warnings,
  };
}

/** Phase 3: fill the draft story created in Phase 2 with the full scraped content. */
export async function migratePageContent(
  pageId: number,
  input: StoryblokCredentials & { publish?: boolean },
): Promise<ContentPhaseResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);
  if (!page.draftStoryId) {
    throw new CourseMigrationError('Run Generate Structure for this page before migrating content.', 400);
  }

  const scrapedRaw = await getScrapedData(pageId);
  if (!scrapedRaw) {
    throw new CourseMigrationError('Run Preview Scrape for this page before migrating content.', 400);
  }

  const template = page.template;
  const config = storyblokConfigFromCredentials(input);
  await verifyStoryblokAccess(config);

  const warnings: string[] = [];
  const librarySync = await syncLibrarySafely(config, template, warnings);
  const presetBloksBySection = librarySync?.presetBloksBySection ?? null;

  const destinationSlug = resolveDestinationSlug(page);
  const fullSlug = storyFullSlug(template, destinationSlug, {
    useCoursesFolder: migrationUsesCoursesFolder(page, template),
    useBlogFolder: migrationUsesBlogFolder(page, template),
  });

  let content: Record<string, unknown>;
  let parentId: number | undefined;

  if (isBlogPageTemplate(template)) {
    const scraped = scrapedRaw as ScrapedBlogPost;
    warnings.push(...collectBlogScrapeWarnings(scraped));
    const built = await buildBlogPostStoryblokContent(scraped, config);
    content = built.content;
    warnings.push(...built.warnings);
    parentId = built.parentFolderId;
  } else if (isCoursePageTemplate(template)) {
    const scraped = scrapedRaw as ScrapedCoursePage;
    const zenlerCourseId = await resolveZenlerCourseId(scraped);
    warnings.push(...collectCourseWarnings(scraped, zenlerCourseId));
    const built = await buildCourseStoryblokContentAsync(scraped, zenlerCourseId, template, presetBloksBySection, config);
    content = built.content;
    warnings.push(...built.warnings);

    if (migrationUsesCoursesFolder(page, template)) {
      const coursesFolder = await findCoursesFolder(config);
      if (!coursesFolder) {
        throw new CourseMigrationError(
          'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
          404,
        );
      }
      parentId = coursesFolder.id;
    }
  } else if (isLevelPageTemplate(template)) {
    const scraped = scrapedRaw as ScrapedLevelPage;
    warnings.push(...collectLevelPageWarnings(scraped));
    const built = await buildLevelPageStoryblokContentAsync(scraped, config);
    content = built.content;
    warnings.push(...built.warnings);
  } else {
    const scraped = scrapedRaw as ScrapedGenericPage;
    warnings.push(...collectGenericWarnings(scraped));
    content = await buildGenericStoryblokContentAsync(scraped, template, presetBloksBySection, config);

    if (migrationUsesCoursesFolder(page, template)) {
      const coursesFolder = await findCoursesFolder(config);
      if (!coursesFolder) {
        throw new CourseMigrationError(
          'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
          404,
        );
      }
      parentId = coursesFolder.id;
    }
  }

  const upsert = await upsertStory(config, {
    name: page.title || destinationSlug,
    slug: destinationSlug,
    parentId,
    fullSlug,
    content,
    publish: Boolean(input.publish),
  });

  await markMigrationPageMigrated(pageId, upsert.story.id);
  const updatedPage = await getMigrationPageById(pageId);

  return {
    page: updatedPage ?? page,
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
