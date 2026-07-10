import type {
  CourseMigrationRequest,
  MigrationTemplate,
  PageMigrationRequest,
  PageMigrationResult,
  ScrapedCoursePage,
  ScrapedGenericPage,
  ScrapedTabPanel,
} from '../../shared/migrationTypes';
import {
  getMigrationPageByOriginUrl,
  markMigrationPageMigrated,
} from '../models/migrationPage';
import { listCourses } from '../models/course';
import { buildSchemaBreadcrumbBloks } from './breadcrumbUtils';
import { CoursePageScrapeError, parseTabPanelBlocks, scrapeCoursePage } from './coursePageScraper';
import { genericBreadcrumbText, scrapeGenericPage } from './pageScraper';
import { slugifySegment, storyFullSlug, suggestDestinationSlug } from '../../shared/migrationDestination';
import {
  findCoursesFolder,
  isStoryblokApiError,
  StoryblokApiError,
  upsertStory,
  verifyStoryblokAccess,
  type StoryblokConfig,
} from './storyblokClient';
import {
  applyTemplateStyles,
  getMigrationTemplateBlueprint,
  sanitizeBlokForStoryblok,
} from './migrationTemplateRegistry';
import {
  getLibraryPresetBlok,
  mergePresetWithData,
  syncTemplateComponentLibrary,
} from './storyblokComponentLibrary';
import type { TemplateReferenceSummary, ComponentLibrarySummary } from '../../shared/migrationTypes';

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
  const warnings: string[] = [];
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
  const warnings: string[] = [];
  if (!scraped.sections.length) warnings.push('No content sections were detected on the source page.');
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  if (!scraped.breadcrumbItems.length) warnings.push('Breadcrumb trail was not detected.');
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
  const body: Record<string, unknown>[] = [];

  let sectionIndex = 0;
  for (const section of blueprint.sections) {
    const scrapedSection = scraped.sections[sectionIndex];
    sectionIndex += 1;

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
    } else if (section.component === 'promotion_section') {
      blok = {
        _uid: blokUid(),
        component: 'promotion_section',
        name: `${template}/${section.key}`,
        title: scrapedSection?.heading || scraped.title || section.label || 'Get started',
        subtitle: scrapedSection?.bodyText || scraped.metaDescription || '',
        cta_text: 'Learn more',
      };
    } else if (section.component === 'page_hero') {
      blok = {
        _uid: blokUid(),
        component: 'page_hero',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || scraped.title || section.label,
        lead: scrapedSection?.bodyText || scraped.metaDescription || '',
        primary_cta_text: 'Learn more',
      };
    } else if (section.component === 'stats_band') {
      blok = {
        _uid: blokUid(),
        component: 'stats_band',
        background_color: '#0E2A57',
        items: [],
      };
    } else if (section.component === 'team_profiles') {
      blok = {
        _uid: blokUid(),
        component: 'team_profiles',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        profiles: [],
      };
    } else if (section.component === 'quote_block') {
      blok = {
        _uid: blokUid(),
        component: 'quote_block',
        eyebrow: section.label,
        quote: scrapedSection?.bodyText || scrapedSection?.heading || scraped.title,
        author_name: 'Vertex Learning Solutions',
        author_initials: 'V',
      };
    } else if (section.component === 'qualification_structure') {
      blok = {
        _uid: blokUid(),
        component: 'qualification_structure',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        levels: [],
      };
    } else if (section.component === 'live_schedule') {
      blok = {
        _uid: blokUid(),
        component: 'live_schedule',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        sessions: [],
      };
    } else if (section.component === 'contact_cards') {
      blok = {
        _uid: blokUid(),
        component: 'contact_cards',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        cards: [],
      };
    } else if (section.component === 'icon_card_grid') {
      blok = {
        _uid: blokUid(),
        component: 'icon_card_grid',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        columns: 3,
        cards: [],
      };
    } else {
      blok = {
        _uid: blokUid(),
        component: section.component,
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || scraped.title || section.label,
        body: scrapedSection?.bodyText || scraped.metaDescription || '',
        description: scrapedSection?.bodyText || scraped.metaDescription || '',
      };
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

  const scraped = await scrapeGenericPage(input.pageUrl.trim());
  const warnings = collectGenericWarnings(scraped);

  if (input.dryRun) {
    return { template, destinationSlug, fullSlug, scraped, warnings, templateReference };
  }

  const config = storyblokConfig(input);
  await verifyStoryblokAccess(config);

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

export { CoursePageScrapeError, StoryblokApiError };
