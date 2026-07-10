import fs from 'fs';
import type { MigrationTemplate, ScrapedTemplateSection } from '../../shared/migrationTypes';
import { getMigrationTemplateBlueprint } from './migrationTemplateRegistry';

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function pickText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function sectionKeyFromComment(comment: string): string {
  return comment
    .toLowerCase()
    .replace(/=+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'section';
}

function splitHeading(html: string): { prefix: string; accent: string } {
  const match = html.match(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/i);
  if (!match) return { prefix: '', accent: '' };
  const inner = match[2];
  const accentMatch = inner.match(/<span[^>]*class="[^"]*accent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const accent = accentMatch ? stripTags(accentMatch[1]) : '';
  const prefix = stripTags(inner.replace(/<span[^>]*class="[^"]*accent[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ''));
  return { prefix, accent };
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTags(match[1]) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

function parseStats(sectionHtml: string): ScrapedTemplateSection['stats'] {
  return allMatches(sectionHtml, /<div class="stat"[^>]*>[\s\S]*?<div class="num"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="lab"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ value: stripTags(match[1]), label: stripTags(match[2]) }))
    .filter(item => item.value || item.label);
}

function parseFeatureCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="(?:feature|plat)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => ({ title: stripTags(match[1]), description: stripTags(match[2]) }))
    .filter(item => item.title || item.description);
}

function parseTimeline(sectionHtml: string): ScrapedTemplateSection['timeline'] {
  return allMatches(sectionHtml, /<div class="ms"[^>]*>[\s\S]*?<div class="yr"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="tt"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="tx"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({
      year: stripTags(match[1]),
      title: stripTags(match[2]),
      text: stripTags(match[3]),
    }))
    .filter(item => item.title || item.text);
}

function parseContactCards(sectionHtml: string): ScrapedTemplateSection['contactCards'] {
  return allMatches(sectionHtml, /<div class="contact-card"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="contact-card"|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const title = firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const detail = stripTags(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
      const linkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      return {
        title,
        detail,
        linkText: linkMatch ? stripTags(linkMatch[2]) : '',
        linkUrl: linkMatch?.[1] ?? '',
      };
    })
    .filter(item => item.title || item.detail);
}

function parseHeroItems(sectionHtml: string): ScrapedTemplateSection['heroItems'] {
  return allMatches(sectionHtml, /<div class="vt"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ text: stripTags(match[1].replace(/<span class="chk"[\s\S]*?<\/span>/i, '')) }))
    .filter(item => item.text);
}

function parseBadges(sectionHtml: string): ScrapedTemplateSection['badges'] {
  return allMatches(sectionHtml, /<div class="float-badge[^"]*"[^>]*>[\s\S]*?<span class="fb-title"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="fb-sub"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({ title: stripTags(match[1]), subtitle: stripTags(match[2]) }))
    .filter(item => item.title || item.subtitle);
}

function parseSideCard(sectionHtml: string): ScrapedTemplateSection['sideCard'] {
  const card = sectionHtml.match(/<div class="mission-card"[^>]*>([\s\S]*?)<\/div>/i);
  if (!card) return null;
  const block = card[1];
  return {
    tag: firstMatch(block, /<span class="mc-tag"[^>]*>([\s\S]*?)<\/span>/i),
    quote: stripTags(block.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1] ?? ''),
    authorName: firstMatch(block, /<div class="mc-name"[^>]*>([\s\S]*?)<\/div>/i),
    authorRole: firstMatch(block, /<div class="mc-role"[^>]*>([\s\S]*?)<\/div>/i),
  };
}

function parseSectionHtml(key: string, sectionHtml: string): ScrapedTemplateSection {
  const { prefix, accent } = splitHeading(sectionHtml);
  const eyebrow = firstMatch(sectionHtml, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i);
  const lead = firstMatch(sectionHtml, /<p[^>]*class="[^"]*hero-lead[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || firstMatch(sectionHtml, /<div class="sec-head"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const paragraphs = allMatches(sectionHtml, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => stripTags(match[1]))
    .filter(text => text && text !== lead);
  const body = paragraphs.join('\n\n');
  const ctaTitle = firstMatch(sectionHtml, /<div class="cta-panel"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i) || prefix;
  const ctaSubtitle = firstMatch(sectionHtml, /<div class="cta-panel"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || lead || body;
  const ctaText = firstMatch(sectionHtml, /<div class="cta-panel"[^>]*>[\s\S]*?<a[^>]*class="[^"]*btn-primary[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
    || firstMatch(sectionHtml, /<a[^>]*class="[^"]*btn-primary[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
    || 'Learn more';

  return {
    key,
    html: sectionHtml,
    eyebrow,
    headingPrefix: prefix,
    headingAccent: accent,
    lead,
    body,
    bodyHtml: sectionHtml,
    stats: parseStats(sectionHtml),
    cards: parseFeatureCards(sectionHtml),
    timeline: parseTimeline(sectionHtml),
    contactCards: parseContactCards(sectionHtml),
    heroItems: parseHeroItems(sectionHtml),
    sideCard: parseSideCard(sectionHtml),
    badges: parseBadges(sectionHtml),
    ctaTitle: stripTags(ctaTitle),
    ctaSubtitle,
    ctaText: stripTags(ctaText),
  };
}

/** Parse `<section>` blocks from page HTML, keyed by nearest preceding HTML comment. */
export function parseTemplateSectionsFromHtml(contentHtml: string): ScrapedTemplateSection[] {
  const commentPattern = /<!--\s*([\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;

  const comments = [...contentHtml.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      key: sectionKeyFromComment(match[1]),
    }))
    .filter(item => item.key !== 'header' && item.key !== 'footer' && item.key !== 'breadcrumb');

  const sections: ScrapedTemplateSection[] = [];
  let fallbackIndex = 0;

  for (const match of contentHtml.matchAll(sectionPattern)) {
    const attrs = match[1];
    const inner = match[2];
    const index = match.index ?? 0;
    const classMatch = attrs.match(/class="([^"]*)"/i);
    const classes = (classMatch?.[1] ?? '').split(/\s+/).filter(Boolean);

    const nearestComment = [...comments]
      .filter(item => item.index <= index)
      .sort((a, b) => b.index - a.index)[0];

    let key = nearestComment?.key ?? '';
    if (!key) {
      if (classes.includes('hero')) key = 'hero';
      else if (classes.includes('stats-band')) key = 'stats';
      else if (classes.includes('cta-band')) key = 'cta';
      else key = `section-${fallbackIndex + 1}`;
    }

    fallbackIndex += 1;
    sections.push(parseSectionHtml(key, inner));
  }

  return sections;
}

export function indexTemplateSections(sections: ScrapedTemplateSection[]): Map<string, ScrapedTemplateSection> {
  const map = new Map<string, ScrapedTemplateSection>();
  for (const section of sections) {
    if (!map.has(section.key)) map.set(section.key, section);
  }
  return map;
}

export function getTemplateFileSections(template: MigrationTemplate): ScrapedTemplateSection[] {
  const blueprint = getMigrationTemplateBlueprint(template);
  const html = fs.readFileSync(blueprint.filePath, 'utf8');
  return parseTemplateSectionsFromHtml(html);
}

/** Prefer live scraped section text; fall back to template HTML for structure and nested items. */
export function mergeTemplateSectionSources(
  live: ScrapedTemplateSection | undefined,
  fromTemplate: ScrapedTemplateSection | undefined,
): ScrapedTemplateSection | undefined {
  if (!live && !fromTemplate) return undefined;
  if (!live) return fromTemplate;
  if (!fromTemplate) return live;

  return {
    key: live.key || fromTemplate.key,
    html: live.html || fromTemplate.html,
    eyebrow: pickText(live.eyebrow, fromTemplate.eyebrow),
    headingPrefix: pickText(live.headingPrefix, fromTemplate.headingPrefix),
    headingAccent: pickText(live.headingAccent, fromTemplate.headingAccent),
    lead: pickText(live.lead, fromTemplate.lead),
    body: pickText(live.body, fromTemplate.body),
    bodyHtml: live.bodyHtml || fromTemplate.bodyHtml,
    stats: live.stats.length ? live.stats : fromTemplate.stats,
    cards: live.cards.length ? live.cards : fromTemplate.cards,
    timeline: live.timeline.length ? live.timeline : fromTemplate.timeline,
    contactCards: live.contactCards.length ? live.contactCards : fromTemplate.contactCards,
    heroItems: live.heroItems.length ? live.heroItems : fromTemplate.heroItems,
    sideCard: live.sideCard ?? fromTemplate.sideCard,
    badges: live.badges.length ? live.badges : fromTemplate.badges,
    ctaTitle: pickText(live.ctaTitle, fromTemplate.ctaTitle),
    ctaSubtitle: pickText(live.ctaSubtitle, fromTemplate.ctaSubtitle),
    ctaText: pickText(live.ctaText, fromTemplate.ctaText),
  };
}

export function resolveTemplateSections(
  template: MigrationTemplate,
  liveSections: ScrapedTemplateSection[],
): Map<string, ScrapedTemplateSection> {
  const liveByKey = indexTemplateSections(liveSections);
  const templateByKey = indexTemplateSections(getTemplateFileSections(template));
  const keys = new Set([...liveByKey.keys(), ...templateByKey.keys()]);
  const merged = new Map<string, ScrapedTemplateSection>();

  for (const key of keys) {
    const section = mergeTemplateSectionSources(liveByKey.get(key), templateByKey.get(key));
    if (section) merged.set(key, section);
  }

  return merged;
}
