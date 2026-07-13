import type { MigrationTemplate, ScrapedContentSection, ScrapedGenericPage } from '../../shared/migrationTypes';
import { breadcrumbTrailText, parseBreadcrumbFromHtml } from './breadcrumbUtils';
import { toPublicOriginUrl } from './migrationUrlUtils';
import { CoursePageScrapeError, fetchPageHtml } from './coursePageScraper';
import { indexTemplateSections, parseTemplateSectionsFromHtml } from './pageSectionExtractor';
import { getMigrationTemplateBlueprint } from './migrationTemplateRegistry';
import { buildCandidateBlocks, classifyAndExtractSections } from './aiSectionExtractor';
import { parseFaq } from './faqParser';

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function meta(html: string, selector: RegExp): string {
  const match = html.match(selector);
  if (!match) return '';
  const tag = match[0];
  const contentMatch = tag.match(/content=["']([^"']*)["']/i);
  if (contentMatch) return decodeEntities(contentMatch[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripTags(titleMatch[1]) : '';
}

function inferSlug(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1]?.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'page';
}

function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  const contentMatch = html.match(/<div[^>]*class="[^"]*page-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) return contentMatch[1];

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function parseSections(contentHtml: string): ScrapedContentSection[] {
  const cleaned = contentHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const sections: ScrapedContentSection[] = [];
  const headingPattern = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = [...cleaned.matchAll(headingPattern)];

  if (!matches.length) {
    const bodyText = stripTags(cleaned);
    if (bodyText) {
      sections.push({ heading: '', bodyHtml: cleaned.trim(), bodyText });
    }
    return sections;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = stripTags(match[2]);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? cleaned.length) : cleaned.length;
    const slice = cleaned.slice(start, end).trim();
    const bodyText = stripTags(slice);
    if (heading || bodyText) {
      sections.push({ heading, bodyHtml: slice, bodyText });
    }
  }

  return sections;
}

export async function scrapeGenericPage(sourceUrl: string, template?: MigrationTemplate): Promise<ScrapedGenericPage> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    throw new CoursePageScrapeError('Invalid URL');
  }

  const normalizedUrl = toPublicOriginUrl(parsed);
  const html = await fetchPageHtml(sourceUrl);
  const mainContent = extractMainContent(html);

  const breadcrumbHtml = mainContent.match(/<nav[^>]*aria-label=["']breadcrumb["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1]
    ?? mainContent.match(/<p[^>]*>([\s\S]*?(?:Home|home)[\s\S]*?(?:>|›)[\s\S]*?)<\/p>/i)?.[1]
    ?? '';
  const breadcrumbItems = parseBreadcrumbFromHtml(breadcrumbHtml, normalizedUrl);

  const title = meta(html, /<meta[^>]+property=["']og:title["'][^>]*>/i)
    || meta(html, /<title[^>]*>/i)
    || stripTags(mainContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const metaDescription = meta(html, /<meta[^>]+name=["']description["'][^>]*>/i)
    || meta(html, /<meta[^>]+property=["']og:description["'][^>]*>/i);
  const { faq, warnings: faqWarnings } = parseFaq(html);

  const templateSections = parseTemplateSectionsFromHtml(mainContent);
  const extractionWarnings = [...faqWarnings];
  const sectionMatchSource: Record<string, 'live' | 'ai'> = {};
  const sectionMatchConfidence: Record<string, number> = {};
  for (const section of templateSections) sectionMatchSource[section.key] = 'live';

  if (template) {
    const blueprint = getMigrationTemplateBlueprint(template);
    const liveByKey = indexTemplateSections(templateSections);
    const missingSections = blueprint.sections.filter(
      section => section.component !== 'enquiry_form' && !liveByKey.has(section.key),
    );

    if (missingSections.length) {
      const candidateBlocks = buildCandidateBlocks(mainContent);
      const { matches, warnings: aiWarnings } = await classifyAndExtractSections(template, missingSections, candidateBlocks);
      extractionWarnings.push(...aiWarnings);

      for (const [key, match] of matches) {
        templateSections.push(match.section);
        sectionMatchSource[key] = 'ai';
        sectionMatchConfidence[key] = match.confidence;
      }
    }
  }

  return {
    sourceUrl: normalizedUrl,
    slug: inferSlug(parsed.pathname),
    title,
    metaDescription,
    breadcrumbItems,
    sections: parseSections(mainContent),
    templateSections,
    faq,
    extractionWarnings,
    rawHtml: html,
    sectionMatchSource,
    sectionMatchConfidence,
  };
}

export function genericBreadcrumbText(page: ScrapedGenericPage): string {
  return breadcrumbTrailText(page.breadcrumbItems);
}
