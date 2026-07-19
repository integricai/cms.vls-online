import type { ScrapedTemplateSection } from '../../shared/migrationTypes';
import { emptyTemplateSectionFields, stripTemplateTags } from './templateSectionParsers';

function indexSections(sections: ScrapedTemplateSection[]): Map<string, ScrapedTemplateSection> {
  const map = new Map<string, ScrapedTemplateSection>();
  for (const section of sections) {
    if (!map.has(section.key)) map.set(section.key, section);
  }
  return map;
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTemplateTags(match[1]) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

function extractCommentBlock(html: string, startComment: string, endComment: string): string {
  const start = html.indexOf(startComment);
  if (start < 0) return '';
  const end = html.indexOf(endComment, start);
  if (end < 0) return html.slice(start);
  return html.slice(start, end + endComment.length);
}

function splitHeadingFromH1(html: string): { prefix: string; accent: string } {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return { prefix: '', accent: '' };
  const inner = match[1];
  const accentMatch = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
  const accent = accentMatch ? stripTemplateTags(accentMatch[1]) : '';
  const prefix = stripTemplateTags(inner.replace(/<span[\s\S]*?<\/span>/gi, ''));
  return { prefix, accent };
}

function parseVideoFields(html: string): Pick<ScrapedTemplateSection, 'videoUrl' | 'videoTitle' | 'videoSubtitle'> {
  const videoUrl = html.match(/src=["'](https?:\/\/player\.vimeo\.com\/video\/[^"']+)["']/i)?.[1]
    ?? html.match(/href=["'](https?:\/\/(?:player\.)?vimeo\.com\/[^"']+)["']/i)?.[1]
    ?? '';
  return {
    videoUrl,
    videoTitle: firstMatch(html, /<div class="vs-label"[^>]*>[\s\S]*?<div class="t"[^>]*>([\s\S]*?)<\/div>/i)
      || firstMatch(html, /video[^>]*title=["']([^"']+)["']/i),
    videoSubtitle: firstMatch(html, /<div class="vs-label"[^>]*>[\s\S]*?<div class="s"[^>]*>([\s\S]*?)<\/div>/i),
  };
}

function parseZenlerPricing(html: string): Partial<ScrapedTemplateSection> {
  const priceBlock = html.match(/<div class="pricing-item[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] ?? html;
  const priceNowRaw = priceBlock.match(/class="pricing-price"[^>]*>[\s\S]*?<span class="currency">[\s\S]*?<\/span>\s*([\d.,]+)/i)?.[1]
    ?? priceBlock.match(/class="pricing-price"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  return {
    priceTag: firstMatch(html, /<h3 class="pricing-title">([\s\S]*?)<\/h3>/i),
    priceNow: priceNowRaw ? stripTemplateTags(priceNowRaw) : '',
    priceAccess: firstMatch(priceBlock, /class="pricing-payment"[^>]*>([\s\S]*?)<\//i)
      || firstMatch(priceBlock, /class="pricing-period"[^>]*>([\s\S]*?)<\//i)
      || firstMatch(priceBlock, /class="pricing-text"[^>]*>([\s\S]*?)<\//i),
    ctaText: firstMatch(html, /<a class="pricebutton"[^>]*>([\s\S]*?)<\/a>/i),
    primaryCtaLink: html.match(/<a class="pricebutton"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
  };
}

function parseZenlerPhv2Hero(block: string): Partial<ScrapedTemplateSection> {
  const { prefix, accent } = splitHeadingFromH1(block);
  const eyebrow = firstMatch(block, /text-transform:uppercase[^>]*>[\s\S]*?(?:●|<\/span>)\s*([^<]+)/i)
    || firstMatch(block, /letter-spacing:0\.08em;text-transform:uppercase[^>]*>([\s\S]*?)<\/div>/i);
  const lead = firstMatch(block, /<div class="[^"]*-desc"[^>]*>([\s\S]*?)<\/div>/i);
  const bullets = allMatches(block, /<span style="[^"]*font-size:13px;color:#94a3b8[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(text => text && !text.includes('·'));
  const stats = allMatches(block, /font-size:28px;font-weight:700[^>]*>([\s\S]*?)<\/div>[\s\S]*?font-size:11px;font-weight:600[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ value: stripTemplateTags(match[1]), label: stripTemplateTags(match[2]) }))
    .filter(item => item.value);

  return {
    eyebrow: stripTemplateTags(eyebrow),
    headingPrefix: prefix,
    headingAccent: accent,
    lead,
    body: lead,
    bullets,
    stats,
  };
}

function parseZenlerPlhHero(block: string): Partial<ScrapedTemplateSection> {
  const { prefix, accent } = splitHeadingFromH1(block);
  const eyebrowLabels = allMatches(block, /letter-spacing:\.1em;text-transform:uppercase;">([^<]+)</gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(Boolean);
  const descParagraphs = allMatches(block, /<p style="[^"]*font-size:1[45]px[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(text => text && !/^Home\s>/i.test(text));
  const lead = descParagraphs.join('\n\n');
  const stats = allMatches(block, /class="plh-stat"[\s\S]*?font-size:26px[^>]*>([\s\S]*?)<\/div>[\s\S]*?font-size:10px[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ value: stripTemplateTags(match[1]), label: stripTemplateTags(match[2]) }))
    .filter(item => item.value);
  const bullets = allMatches(block, /class="plh-stats"[\s\S]*?<\/div>\s*<\/div>[\s\S]*?<span style="[^"]*font-size:12px[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(Boolean);

  return {
    eyebrow: eyebrowLabels.join(' · '),
    headingPrefix: prefix,
    headingAccent: accent,
    lead,
    body: lead,
    stats,
    bullets,
  };
}

function extractPaperCode(title: string): string {
  const match = title.match(/\b((?:ACCA|CIMA|CMA)\s+[A-Z]{1,3}\d?[A-Z]?)\b/i)
    ?? title.match(/\b([A-Z]{2,3}\d?[A-Z]?)\b/);
  return match?.[1]?.toUpperCase() ?? '';
}

function parseZenlerNotesCatalog(html: string, sourceUrl = ''): {
  groups: ScrapedTemplateSection['groups'];
  headingPrefix: string;
  lead: string;
} {
  const headerMatch = html.match(/<p[^>]*font-weight:\s*bold[^>]*>([\s\S]*?Study Notes[\s\S]*?)<\/p>/i)
    ?? html.match(/<p[^>]*>([^<]*Study Notes[^<]*)<\/p>/i);
  const catalogHeading = headerMatch ? stripTemplateTags(headerMatch[1]) : '';

  const items = allMatches(
    html,
    /<div class="row v-center margin-top-10 margin-bottom-10"[^>]*>[\s\S]*?<div class="col-md-5"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<div class="col-md-4"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<div class="col-md-3"[\s\S]*?<a href="([^"]+)"/gi,
  )
    .map(match => {
      const title = stripTemplateTags(match[1]);
      const description = stripTemplateTags(match[2]);
      const url = match[3] ?? '';
      if (!title || /study notes/i.test(title) && title.length < 24) return null;
      if (!/visit page|notes|pages/i.test(description) && !url.includes('notes')) return null;
      return {
        code: extractPaperCode(title),
        title,
        description,
        url,
      };
    })
    .filter((item): item is { code: string; title: string; description: string; url: string } => Boolean(item));

  if (!items.length) {
    return { groups: [], headingPrefix: '', lead: '' };
  }

  let label = catalogHeading || 'Study Notes';
  if (!catalogHeading) {
    if (/cima/i.test(sourceUrl) || items.some(item => /cima/i.test(item.title))) label = 'CIMA Study Notes';
    else if (/acca/i.test(sourceUrl) || items.some(item => /acca/i.test(item.title))) label = 'ACCA Study Notes';
  }

  return {
    groups: [{ label, items }],
    headingPrefix: label,
    lead: `Browse ${items.length} complete study note sets with page counts and links to each paper.`,
  };
}

function buildSection(key: string, html: string, partial: Partial<ScrapedTemplateSection>): ScrapedTemplateSection {
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
    ...partial,
  };
}

function sectionRichness(section: ScrapedTemplateSection): number {
  return [
    section.headingPrefix,
    section.lead,
    section.body,
    section.videoUrl,
    section.priceNow,
  ].filter(value => value?.trim()).length
    + section.groups.reduce((sum, group) => sum + group.items.length, 0)
    + section.stats.length
    + section.bullets.length;
}

/** Parse Zenler page-builder markup on live notes pages into blueprint section keys. */
export function extractZenlerStudyNotesSections(html: string, sourceUrl = ''): ScrapedTemplateSection[] {
  const sections: ScrapedTemplateSection[] = [];

  const phv2Block = extractCommentBlock(html, '<!-- Hero Banner V2 Section starting here -->', '<!-- Hero Banner V2 Section ends here -->')
    || (html.includes('vlsd9exx-wrap') ? html.match(/<div class="vlsd9exx-wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] : '')
    || '';
  const plhBlock = extractCommentBlock(html, '<!-- Left Hero Section starting here -->', '<!-- Left Hero Section ends here -->')
    || html.match(/<div id="plhm[^"]+"[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*<\/div>)/i)?.[0]
    || '';

  const heroBlock = plhBlock || phv2Block;
  if (heroBlock) {
    const heroPartial = plhBlock ? parseZenlerPlhHero(plhBlock) : parseZenlerPhv2Hero(phv2Block);
    const pricing = parseZenlerPricing(html);
    const video = parseVideoFields(html);
    sections.push(buildSection('hero', heroBlock, {
      ...heroPartial,
      ...pricing,
      ...video,
    }));
  }

  const catalog = parseZenlerNotesCatalog(html, sourceUrl);
  if (catalog.groups.length) {
    sections.push(buildSection('all-acca-notes-table', html, {
      eyebrow: 'Complete notes library',
      headingPrefix: catalog.headingPrefix,
      headingAccent: '',
      lead: catalog.lead,
      body: catalog.lead,
      groups: catalog.groups,
    }));
  }

  return sections;
}

/** Merge Zenler-extracted sections into regex-parsed sections, preferring richer Zenler content. */
export function augmentStudyNotesZenlerSections(
  html: string,
  existing: ScrapedTemplateSection[],
  sourceUrl = '',
): ScrapedTemplateSection[] {
  const map = indexSections(existing);
  for (const section of extractZenlerStudyNotesSections(html, sourceUrl)) {
    const current = map.get(section.key);
    if (!current || sectionRichness(section) >= sectionRichness(current)) {
      map.set(section.key, section);
    }
  }
  return [...map.values()];
}
