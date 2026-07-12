import type {
  ComponentDraftResult,
  ConfirmComponentRequest,
  ConfirmComponentResult,
  ScrapedGenericPage,
  StoryblokCredentials,
} from '../../shared/migrationTypes';
import { getMigrationPageById, getScrapedData, saveCustomComponentName } from '../models/migrationPage';
import { analyzeUnmatchedLayout, type LayoutAnalysis } from './genericLayoutAnalyzer';
import { buildComponentScaffold } from './componentScaffoldBuilder';
import { createStoryblokComponent, getStoryblokComponent, type StoryblokConfig } from './storyblokClient';
import { CourseMigrationError } from './courseMigrationService';

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokConfigFromCredentials(credentials: StoryblokCredentials): StoryblokConfig {
  return {
    spaceId: credentials.storyblokSpaceId.trim(),
    accessToken: credentials.storyblokAccessToken.trim(),
    region: credentials.storyblokRegion,
  };
}

function loadRawHtml(pageId: number, scrapedRaw: unknown): string {
  const scraped = scrapedRaw as ScrapedGenericPage;
  if (!scraped?.rawHtml) {
    throw new CourseMigrationError(
      `No raw HTML saved for page ${pageId} yet — run Preview Scrape again before Generate Component.`,
      400,
    );
  }
  return scraped.rawHtml;
}

/** Phase (post-Generate Structure block): best-effort analyze the live page and propose a component. */
export async function generateComponentDraft(
  pageId: number,
  _credentials: StoryblokCredentials,
): Promise<ComponentDraftResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);

  const scrapedRaw = await getScrapedData(pageId);
  if (!scrapedRaw) {
    throw new CourseMigrationError('Run Preview Scrape for this page before Generate Component.', 400);
  }

  const scraped = scrapedRaw as ScrapedGenericPage;
  const rawHtml = loadRawHtml(pageId, scrapedRaw);
  const analysis = analyzeUnmatchedLayout(rawHtml, scraped.title || page.title || page.path);
  const scaffold = buildComponentScaffold(analysis, analysis.componentNameSuggestion);

  return {
    componentName: scaffold.componentName,
    storyblokSchema: scaffold.storyblokSchema,
    tsxCode: scaffold.tsxCode,
    typeCode: scaffold.typeCode,
    warnings: analysis.warnings,
  };
}

/** Creates the (possibly user-edited) component schema in Storyblok — children first, then the parent. */
export async function confirmComponentCreation(
  pageId: number,
  request: ConfirmComponentRequest,
): Promise<ConfirmComponentResult> {
  const page = await getMigrationPageById(pageId);
  if (!page) throw new CourseMigrationError('Migration page not found', 404);

  const componentName = request.componentName.trim();
  if (!componentName) throw new CourseMigrationError('Component name is required', 400);

  const components = request.storyblokSchema?.components;
  if (!Array.isArray(components) || !components.length) {
    throw new CourseMigrationError('Component schema is empty — nothing to create.', 400);
  }

  const config = storyblokConfigFromCredentials(request);
  let created = false;

  for (const componentSchema of components) {
    const name = typeof componentSchema.name === 'string' ? componentSchema.name : '';
    if (!name) throw new CourseMigrationError('Every component in the schema needs a "name".', 400);

    const existing = await getStoryblokComponent(config, name);
    if (existing) continue;

    await createStoryblokComponent(config, componentSchema);
    if (name === componentName) created = true;
  }

  await saveCustomComponentName(pageId, componentName);
  const updatedPage = await getMigrationPageById(pageId);

  return {
    page: updatedPage ?? page,
    componentName,
    created,
  };
}

/** Builds the single-blok story body for a page whose Generate Component step has already run. */
export function buildCustomComponentBody(
  componentName: string,
  analysis: LayoutAnalysis,
): Record<string, unknown>[] {
  const navGroups = analysis.navGroups.map(group => ({
    _uid: blokUid(),
    component: `${componentName}_nav_group`,
    label: group.label,
    items: group.items.map(item => ({
      _uid: blokUid(),
      component: `${componentName}_nav_item`,
      text: item.text,
      link: item.url ? { linktype: 'url', url: item.url, cached_url: item.url } : undefined,
    })),
  }));

  const cardGroups = analysis.cardGroups.map(group => ({
    _uid: blokUid(),
    component: `${componentName}_card_group`,
    group_label: group.groupLabel,
    cards: group.cards.map(card => ({
      _uid: blokUid(),
      component: `${componentName}_card`,
      title: card.title,
      description: card.description,
      link: card.url ? { linktype: 'url', url: card.url, cached_url: card.url } : undefined,
    })),
  }));

  return [{
    _uid: blokUid(),
    component: componentName,
    nav_groups: navGroups,
    card_groups: cardGroups,
  }];
}
