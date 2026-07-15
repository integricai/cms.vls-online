import type { ScrapedTemplateSection } from '../../shared/migrationTypes';
import { emptyTemplateSectionFields } from './templateSectionParsers';

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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTags(match[1]) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

/** Detect Zenler page-builder legal widgets (hash-prefixed class names like polmoh0ry2z-header). */
export function detectPageBuilderLegalPrefix(html: string): string | null {
  const fromRootId = html.match(/<div id="([a-z0-9]{5,})"[^>]*style="[^"]*Poppins/i)?.[1];
  if (fromRootId && html.includes(`${fromRootId}-header`) && html.includes(`${fromRootId}-section`)) {
    return fromRootId;
  }

  const prefixes = new Set(
    [...html.matchAll(/\.([a-z0-9]{5,})-(?:header|layout|section|nav|content)\{/gi)].map(match => match[1]),
  );
  for (const prefix of prefixes) {
    if (
      html.includes(`${prefix}-header`)
      && html.includes(`${prefix}-layout`)
      && html.includes(`${prefix}-section`)
      && html.includes(`${prefix}-navlist`)
    ) {
      return prefix;
    }
  }

  return null;
}

export function isPageBuilderLegalHtml(html: string): boolean {
  return detectPageBuilderLegalPrefix(html) !== null;
}

function emptySection(key: string, html = ''): ScrapedTemplateSection {
  return {
    key,
    html,
    eyebrow: '',
    headingPrefix: '',
    headingAccent: '',
    lead: '',
    sublead: '',
    body: '',
    bodyHtml: html,
    stats: [],
    cards: [],
    groups: [],
    timeline: [],
    contactCards: [],
    heroItems: [],
    sideCard: null,
    badges: [],
    ctaTitle: '',
    ctaSubtitle: '',
    ctaText: '',
    ...emptyTemplateSectionFields(),
    anchorId: key,
  };
}

function extractParagraphs(sectionHtml: string): string[] {
  const cleaned = sectionHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
  return allMatches(cleaned, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => stripTags(match[1]))
    .filter(text => text.length > 20 && !/^Read →$/i.test(text));
}

function extractCardItems(sectionHtml: string): Array<{ title: string; subtitle: string }> {
  const items: Array<{ title: string; subtitle: string }> = [];
  const titlePattern = /<p[^>]*font-weight:\s*700[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of sectionHtml.matchAll(titlePattern)) {
    const title = stripTags(match[1]);
    if (!title || title.length > 160) continue;
    const after = sectionHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 600);
    const subtitle = firstMatch(after, /<p[^>]*>([\s\S]*?)<\/p>/i);
    items.push({ title, subtitle: subtitle && subtitle !== title ? subtitle : '' });
  }
  return items;
}

function extractTagPills(sectionHtml: string): string[] {
  return allMatches(sectionHtml, /<span[^>]*border-radius:6px[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function extractCalloutText(sectionHtml: string): string {
  const callout = sectionHtml.match(/<div[^>]*background:#eaf1fb[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    ?? sectionHtml.match(/<div[^>]*background:#ebf7ff[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    ?? '';
  if (!callout) return '';
  return firstMatch(callout, /<p[^>]*>([\s\S]*?)<\/p>/i);
}

function extractBrowserCards(sectionHtml: string): Array<{ title: string; subtitle: string }> {
  const items: Array<{ title: string; subtitle: string }> = [];
  const titlePattern = /<p[^>]*font-weight:\s*700[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of sectionHtml.matchAll(titlePattern)) {
    const title = stripTags(match[1]);
    const blockStart = Math.max(0, (match.index ?? 0) - 200);
    const block = sectionHtml.slice(blockStart, (match.index ?? 0) + 400);
    const link = block.match(/href=["']([^"']+)["']/i)?.[1] ?? '';
    if (title && /chrome|firefox|safari|explorer|opera|andriod/i.test(title)) {
      items.push({ title, subtitle: link ? `Guide: ${link}` : '' });
    }
  }
  return items;
}

function extractPolicyCards(sectionHtml: string): Array<{ title: string; subtitle: string }> {
  const items: Array<{ title: string; subtitle: string }> = [];
  for (const match of sectionHtml.matchAll(/<p[^>]*font-weight:\s*700[^>]*>([\s\S]*?)<\/p>/gi)) {
    const title = stripTags(match[1]);
    if (!title || !/policy|terms/i.test(title)) continue;
    const after = sectionHtml.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 400);
    const desc = firstMatch(after, /<p[^>]*>([\s\S]*?)<\/p>/i);
    items.push({ title, subtitle: desc && desc !== title ? desc : '' });
  }
  return items;
}

/**
 * Parse Zenler page-builder legal pages (cookie-policy, etc.) into legal template section keys.
 * Returns legal-hero, legal-article, and one scraped section per page-builder content block.
 */
export function parsePageBuilderLegalSections(html: string): ScrapedTemplateSection[] {
  const prefix = detectPageBuilderLegalPrefix(html);
  if (!prefix) return [];

  const sections: ScrapedTemplateSection[] = [];

  const headerMatch = html.match(new RegExp(`<div class="${prefix}-header"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
  if (headerMatch) {
    const headerHtml = headerMatch[0];
    const eyebrow = firstMatch(headerHtml, /<p[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/p>/i);
    const heading = firstMatch(headerHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const metaSpans = allMatches(headerHtml, /<span[^>]*>([\s\S]*?)<\/span>/gi)
      .map(match => stripTags(match[1]))
      .filter(text => text.startsWith('•') || /last updated|©/i.test(text));

    sections.push({
      ...emptySection('legal-hero', headerHtml),
      eyebrow: eyebrow || 'Legal',
      headingPrefix: heading,
      lead: metaSpans.join(' '),
      legalMetaItems: metaSpans.map(text => ({
        title: text.replace(/^•\s*/, '').trim(),
        subtitle: '',
      })),
    });
  }

  const tocItems: ScrapedTemplateSection['legalTocItems'] = [];
  const navPattern = new RegExp(`<a[^>]*class="${prefix}-navlink"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
  for (const match of html.matchAll(navPattern)) {
    const linkHtml = match[0];
    const href = linkHtml.match(/href=["']#([^"']+)["']/i)?.[1] ?? '';
    const anchorId = slugify(href.replace(new RegExp(`^${prefix}-`, 'i'), ''));
    const number = firstMatch(linkHtml, /<span[^>]*class="[^"]*navnum[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const label = stripTags(linkHtml.replace(/<span[^>]*class="[^"]*navnum[^"]*"[^>]*>[\s\S]*?<\/span>/i, ''));
    if (label) {
      tocItems.push({
        label,
        anchorId: anchorId || slugify(label),
        number: number.padStart(2, '0'),
      });
    }
  }

  const openPattern = new RegExp(`<div[^>]+id="(${prefix}-s\\d+)"[^>]*class="${prefix}-section"`, 'gi');
  const opens = [...html.matchAll(openPattern)];

  const contentSections: ScrapedTemplateSection[] = [];
  let intro = '';
  let introCallout = '';
  let introCalloutHeading = '';

  for (let index = 0; index < opens.length; index += 1) {
    const sectionId = opens[index][1];
    const start = opens[index].index ?? 0;
    let end = index + 1 < opens.length ? (opens[index + 1].index ?? html.length) : html.length;
    if (index + 1 >= opens.length) {
      const footerMarker = html.indexOf('GET IN TOUCH', start);
      if (footerMarker > start) end = footerMarker;
      else end = Math.min(html.length, start + 12000);
    }
    const sectionHtml = html.slice(start, end);
    const inner = sectionHtml.replace(new RegExp(`^<div[^>]+id="${sectionId}"[^>]*>`), '').replace(/<\/div>\s*$/, '');
    const number = firstMatch(inner, /<span[^>]*>(\d+)<\/span>/i)
      || firstMatch(inner, />(\d+)<\/span>/i);
    const heading = firstMatch(inner, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const anchorId = slugify(heading) || slugify(sectionId.replace(`${prefix}-`, ''));
    const key = anchorId;

    const paragraphs = extractParagraphs(inner);
    const cards = extractCardItems(inner);
    const pills = extractTagPills(inner);
    const callout = extractCalloutText(inner);
    const browserCards = extractBrowserCards(inner);
    const policyCards = extractPolicyCards(inner);

    const checklistItems = [...cards, ...browserCards, ...policyCards].map(item => ({
      title: item.title,
    }));

    let body = paragraphs.join('\n\n');
    if (pills.length) {
      body = [body, pills.join('\n')].filter(Boolean).join('\n\n');
    }

    if (number === '1' || heading.toLowerCase() === 'overview') {
      intro = paragraphs[paragraphs.length - 1] || paragraphs[0] || '';
      if (callout) {
        introCallout = callout;
        introCalloutHeading = 'Overview';
      }
    }

    contentSections.push({
      ...emptySection(key, sectionHtml),
      anchorId,
      legalSectionNumber: number.padStart(2, '0'),
      legalSectionHeading: heading,
      headingPrefix: heading,
      body,
      labeledItems: cards,
      checklistItems,
      legalCalloutHeading: callout ? heading : '',
    });
  }

  sections.push({
    ...emptySection('legal-article'),
    legalTocTitle: firstMatch(html, new RegExp(`class="${prefix}-navtitle"[^>]*>([\\s\\S]*?)<\\/p>`, 'i')) || 'On this page',
    legalTocItems: tocItems,
    lead: intro,
    body: intro,
    introHtml: intro,
    legalCalloutHeading: introCalloutHeading || (introCallout ? 'Overview' : ''),
    labeledItems: introCallout ? [{ title: introCallout, subtitle: '' }] : [],
  });

  sections.push(...contentSections);
  return sections;
}
