import type {
  ContentPhaseResult,
  CourseMigrationRequest,
  MigrationPageRecord,
  MigrationTemplate,
  PageMigrationRequest,
  PageMigrationResult,
  ScrapedCoursePage,
  ScrapedGenericPage,
  ScrapePhaseResult,
  ScrapedTabPanel,
  StoryblokCredentials,
  StructurePhaseResult,
} from '../../shared/migrationTypes';
import {
  getMigrationPageById,
  getMigrationPageByOriginUrl,
  getScrapedData,
  markMigrationPageMigrated,
  saveScrapeResult,
  saveStructureResult,
} from '../models/migrationPage';
import { listCourses } from '../models/course';
import { buildSchemaBreadcrumbBloks } from './breadcrumbUtils';
import { CoursePageScrapeError, parseTabPanelBlocks, scrapeCoursePage } from './coursePageScraper';
import { genericBreadcrumbText, scrapeGenericPage } from './pageScraper';
import { slugifySegment, storyFullSlug, suggestDestinationSlug } from '../../shared/migrationDestination';
import {
  findCoursesFolder,
  StoryblokApiError,
  upsertStory,
  validateStoryblokRootBloks,
  verifyStoryblokAccess,
  type StoryblokConfig,
} from './storyblokClient';
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
import { buildBlokFromTemplateSection } from './pageContentBuilder';
import { indexTemplateSections, resolveTemplateSections } from './pageSectionExtractor';
import type { TemplateReferenceSummary, ComponentLibrarySummary } from '../../shared/migrationTypes';
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
  const parsedBlocks = parseTabPanelBlocks(tab.contentHtml);
  return parsedBlocks.map(block => {
    const base: Record<string, unknown> = {
      _uid: blokUid(),
      component: 'course_tab_block',
      block_type: block.blockType,
    };

    if (block.blockType === 'panel-intro') {
      return {
        ...base,
        eyebrow: block.fields.eyebrow,
        heading: block.fields.heading,
        description: block.fields.description,
      };
    }

    if (block.blockType === 'bullets') {
      return { ...base, bullet_items: block.fields.bullet_items };
    }

    if (block.blockType === 'inc-cards' && block.fields.cards) {
      const cards = block.fields.cards.split('\n').map(line => {
        const [icon, title, description] = line.split('|');
        return {
          _uid: blokUid(),
          component: 'course_tab_card',
          icon: icon || '✅',
          title: title || '',
          description: description || '',
        };
      });
      return { ...base, cards };
    }

    if (block.blockType === 'steps' && block.fields.steps) {
      const steps = block.fields.steps.split('\n').map(line => {
        const [icon, title, description] = line.split('|');
        return {
          _uid: blokUid(),
          component: 'course_tab_step',
          icon: icon || '📅',
          title: title || '',
          description: description || '',
        };
      });
      return { ...base, steps };
    }

    return {
      ...base,
      heading: block.fields.heading || tab.label,
      paragraph: block.fields.paragraph || tab.contentText || tab.label,
    };
  });
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
    paragraph_2: desc.introP2 || desc.bodyHtml || undefined,
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
  return {
    _uid: blokUid(),
    component: 'course_curriculum',
    course_code: courseCode,
    zenler_course_id: zenlerCourseId,
  };
}

function buildTestimonialsBlok(scraped: ScrapedCoursePage): Record<string, unknown> | null {
  if (!scraped.testimonials?.cards.length) return null;

  return {
    _uid: blokUid(),
    component: 'testimonials',
    eyebrow: scraped.testimonials.eyebrow,
    title_prefix: scraped.testimonials.titlePrefix,
    title_accent: scraped.testimonials.titleAccent,
    subtitle: scraped.testimonials.subtitle,
    cards: scraped.testimonials.cards.map(card => ({
      _uid: blokUid(),
      component: 'testimonial_card',
      quote: card.quote,
      author: card.author,
      role: card.role,
    })),
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
): Promise<Record<string, unknown>> {
  const base = buildCourseStoryblokContent(scraped, zenlerCourseId);
  const body = Array.isArray(base.body) ? base.body as Record<string, unknown>[] : [];

  const mapped: Array<Record<string, unknown> | null> = [];
  for (const blok of body) {
    const component = String(blok.component ?? '');
    let sectionKey = 'section';
    if (component === 'course_hero_layout') sectionKey = 'hero';
    else if (component === 'course_introduction') sectionKey = 'what-you-ll-learn';
    else if (component === 'course_tabs') sectionKey = 'course-content';
    else if (component === 'testimonials') sectionKey = 'student-reviews';
    else if (component === 'faq_section') sectionKey = 'faq';
    else if (component === 'promotion_section') sectionKey = 'cta';
    mapped.push(await stylizeBlok(blok, template, sectionKey, presetBloksBySection, config));
  }

  return {
    ...base,
    body: mapped.filter(Boolean),
  };
}

async function buildGenericStoryblokContentAsync(
  scraped: ScrapedGenericPage,
  template: MigrationTemplate,
  presetBloksBySection: Record<string, Record<string, unknown>> | null,
  config: StoryblokConfig | null,
): Promise<Record<string, unknown>> {
  const blueprint = getMigrationTemplateBlueprint(template);
  const sourceUrl = scraped.sourceUrl;
  const extractedByKey = resolveTemplateSections(template, scraped.templateSections ?? []);
  const body: Record<string, unknown>[] = [];

  for (const section of blueprint.sections) {
    const extracted = extractedByKey.get(section.key);
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
    } else if (section.component === 'faq_section' && scraped.faq?.items.length) {
      blok = buildGenericFaqBlok(scraped, sourceUrl);
    } else {
      blok = buildBlokFromTemplateSection(section, extracted, scraped);
    }

    const styled = await stylizeBlok(blok, template, section.key, presetBloksBySection, config);
    if (styled) body.push(styled);
  }

  if (!body.length) {
    return buildGenericStoryblokContent(scraped, template);
  }

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

  if (template === 'course') {
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

    const content = await buildCourseStoryblokContentAsync(
      scraped,
      zenlerCourseId,
      template,
      librarySync?.presetBloksBySection ?? null,
      config,
    );
    const upsert = await upsertStory(config, {
      name: scraped.title || scraped.slug.toUpperCase(),
      slug: destinationSlug,
      parentId: coursesFolder.id,
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

function resolveDestinationSlug(page: MigrationPageRecord): string {
  return normalizeDestinationSlug(
    page.destinationSlug?.trim() || suggestDestinationSlug(page.originUrl, page.template),
  );
}

function rootComponentForTemplate(template: MigrationTemplate): string {
  return template === 'course' ? 'course_page' : 'page';
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
export async function previewScrapePage(pageId: number): Promise<ScrapePhaseResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);

  if (page.template === 'course') {
    const scraped = await scrapeCoursePage(page.originUrl);
    const zenlerCourseId = await resolveZenlerCourseId(scraped);
    const warnings = collectCourseWarnings(scraped, zenlerCourseId);
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

  if (template !== 'course' && page.customComponentName) {
    return generateCustomComponentStructure(page, pageId, config, template, templateReference, scrapedRaw as ScrapedGenericPage);
  }

  const missingComponents = await detectMissingComponents(config, template, blueprint);
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
  if (template !== 'course') {
    const scraped = scrapedRaw as ScrapedGenericPage;
    const eligibleSections = blueprint.sections.filter(section => section.component !== 'enquiry_form');
    unmatchedSections = detectUnmatchedSections(blueprint, scraped);
    if (eligibleSections.length > 0 && unmatchedSections.length === eligibleSections.length) {
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

  const body = blueprint.sections.map(section => (
    presetBloksBySection?.[section.key] ?? buildPresetBlokFromSection(blueprint, section)
  ));

  const destinationSlug = resolveDestinationSlug(page);
  const fullSlug = storyFullSlug(template, destinationSlug);
  const rootComponent = rootComponentForTemplate(template);

  const content: Record<string, unknown> = template === 'course'
    ? { component: rootComponent, title: page.title || destinationSlug, zenler_course_id: '', seo: [], body }
    : { component: rootComponent, seo: [], body };

  let parentId: number | undefined;
  if (template === 'course') {
    const coursesFolder = await findCoursesFolder(config);
    if (!coursesFolder) {
      throw new CourseMigrationError(
        'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
        404,
      );
    }
    parentId = coursesFolder.id;
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

  if (unmatchedSections.length) {
    warnings.push(
      `${unmatchedSections.length} section(s) have no matching content on the live page and will be skipped in Migrate Content: ${unmatchedSections.join(', ')}.`,
    );
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
  const fullSlug = storyFullSlug(template, destinationSlug);

  let content: Record<string, unknown>;
  let parentId: number | undefined;

  if (template === 'course') {
    const scraped = scrapedRaw as ScrapedCoursePage;
    const zenlerCourseId = await resolveZenlerCourseId(scraped);
    warnings.push(...collectCourseWarnings(scraped, zenlerCourseId));
    content = await buildCourseStoryblokContentAsync(scraped, zenlerCourseId, template, presetBloksBySection, config);

    const coursesFolder = await findCoursesFolder(config);
    if (!coursesFolder) {
      throw new CourseMigrationError(
        'Could not find a Storyblok folder with slug "courses". Create the courses folder first.',
        404,
      );
    }
    parentId = coursesFolder.id;
  } else {
    const scraped = scrapedRaw as ScrapedGenericPage;
    warnings.push(...collectGenericWarnings(scraped));
    content = await buildGenericStoryblokContentAsync(scraped, template, presetBloksBySection, config);
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
