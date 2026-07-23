import type { ScrapedLevelPage } from '../../shared/levelPageTypes';
import { readPageContentFile } from './pageContentFileLoader';
import { collectLevelPageScrapeWarnings, parseLevelPageHtml } from './levelPageParser';

export function scrapeLevelPageFile(filename: string): ScrapedLevelPage {
  const { html, summary } = readPageContentFile(filename);
  const scraped = parseLevelPageHtml(
    html,
    summary.canonicalUrl,
    summary.slug,
    summary.title,
  );
  const warnings = collectLevelPageScrapeWarnings(scraped);
  return { ...scraped, extractionWarnings: warnings };
}

export { collectLevelPageScrapeWarnings };
