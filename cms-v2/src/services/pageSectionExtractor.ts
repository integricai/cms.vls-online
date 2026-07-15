import fs from 'fs';
import type { MigrationTemplate, ScrapedTemplateSection } from '../../shared/migrationTypes';
import { getMigrationTemplateBlueprint } from './migrationTemplateRegistry';
import {
  emptyTemplateSectionFields,
  parseBookMeetingHero,
  parseContactPageSection,
  parseLegalArticleBlock,
  parseLegalMetaItems,
  parseLegalSectionBlock,
  parseLegalTabs,
  parseLiveSessionRows,
  parseLiveSessions,
  parseLiveSessionsHero,
  parseQualificationLevels,
  parseStepCards,
  parseTeamProfiles,
  parseTutorCard,
  stripTemplateTags,
} from './templateSectionParsers';

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
  return allMatches(sectionHtml, /<div class="(?:feature|plat|ts-card|duo-card)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => ({ title: stripTags(match[1]), description: stripTags(match[2]) }))
    .filter(item => item.title || item.description);
}

function parseReachFigs(sectionHtml: string): ScrapedTemplateSection['stats'] {
  return allMatches(sectionHtml, /<div class="reach-fig"[^>]*>[\s\S]*?<div class="v"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="k"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ value: stripTags(match[1]), label: stripTags(match[2]) }))
    .filter(item => item.value || item.label);
}

function parseRegionCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="region"[^>]*>[\s\S]*?<span class="r-name"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="r-sub"[^>]*>([\s\S]*?)<\/span>/gi)
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

function enrichSection(key: string, sectionHtml: string, base: ScrapedTemplateSection): ScrapedTemplateSection {
  const enriched: ScrapedTemplateSection = { ...base };

  if (sectionHtml.includes('class="profile"') || key.includes('tutor') || key.includes('team')) {
    enriched.profiles = parseTeamProfiles(sectionHtml);
  }
  if (sectionHtml.includes('tutor-card')) {
    enriched.profiles = parseTutorCard(sectionHtml);
  }
  if (sectionHtml.includes('class="step"')) {
    enriched.steps = parseStepCards(sectionHtml);
  }
  if (sectionHtml.includes('class="sess"')) {
    enriched.sessions = parseLiveSessions(sectionHtml);
  }
  if (sectionHtml.includes('class="sched"') || sectionHtml.includes('live_session_row')) {
    enriched.liveSessionRows = parseLiveSessionRows(sectionHtml);
  }
  if (sectionHtml.includes('class="level"')) {
    enriched.levels = parseQualificationLevels(sectionHtml);
  }
  if (sectionHtml.includes('class="legal-hero"')) {
    enriched.legalMetaItems = parseLegalMetaItems(sectionHtml);
    enriched.legalTabs = parseLegalTabs(sectionHtml);
  }
  if (sectionHtml.includes('class="sec"')) {
    Object.assign(enriched, parseLegalSectionBlock(sectionHtml, enriched.anchorId));
  }
  if (key.includes('hero-booking') || sectionHtml.includes('book-card')) {
    Object.assign(enriched, parseBookMeetingHero(sectionHtml));
  }
  if (sectionHtml.includes('live-card') && sectionHtml.includes('hero-ticks')) {
    Object.assign(enriched, parseLiveSessionsHero(sectionHtml));
  }
  if (sectionHtml.includes('contact-grid') || sectionHtml.includes('contact-wrap')) {
    Object.assign(enriched, parseContactPageSection(sectionHtml));
  }
  if (sectionHtml.includes('note-box') || sectionHtml.includes('sched-note')) {
    enriched.noteHeading = firstMatch(sectionHtml, /<div class="note-box"[^>]*>[\s\S]*?<b>([\s\S]*?)<\/b>/i);
    enriched.noteText = firstMatch(sectionHtml, /<div class="note-box"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  }

  return enriched;
}

function parseSectionHtml(key: string, sectionHtml: string, anchorId = ''): ScrapedTemplateSection {
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

  const base: ScrapedTemplateSection = {
    key,
    html: sectionHtml,
    eyebrow,
    headingPrefix: prefix,
    headingAccent: accent,
    lead,
    body,
    bodyHtml: sectionHtml,
    stats: [...parseStats(sectionHtml), ...parseReachFigs(sectionHtml)],
    cards: [...parseFeatureCards(sectionHtml), ...parseRegionCards(sectionHtml)],
    groups: [],
    timeline: parseTimeline(sectionHtml),
    contactCards: parseContactCards(sectionHtml),
    heroItems: parseHeroItems(sectionHtml),
    sideCard: parseSideCard(sectionHtml),
    badges: parseBadges(sectionHtml),
    ctaTitle: stripTags(ctaTitle),
    ctaSubtitle,
    ctaText: stripTags(ctaText),
    ...emptyTemplateSectionFields(),
    anchorId,
  };

  return enrichSection(key, sectionHtml, base);
}

function parseLegalArticleSection(contentHtml: string): ScrapedTemplateSection | null {
  const layoutMatch = contentHtml.match(/<div class="wrap layout">([\s\S]*?)<\/div>\s*<!--\s*FOOTER/i);
  if (!layoutMatch) return null;

  const layoutHtml = layoutMatch[1];
  const article = parseLegalArticleBlock(layoutHtml);

  return {
    key: 'legal-article',
    html: layoutHtml,
    eyebrow: '',
    headingPrefix: '',
    headingAccent: '',
    lead: article.lead ?? '',
    body: article.body ?? '',
    bodyHtml: layoutHtml,
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
    anchorId: '',
    ...article,
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
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const anchorId = idMatch?.[1] ?? '';

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
    if (classes.includes('sec') && anchorId) key = anchorId;

    fallbackIndex += 1;
    sections.push(parseSectionHtml(key, inner, anchorId));
  }

  const legalArticle = parseLegalArticleSection(contentHtml);
  if (legalArticle) {
    const heroIndex = sections.findIndex(section => section.key.includes('legal-hero') || section.html.includes('legal-hero'));
    sections.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, legalArticle);
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

  const pickArray = <T,>(liveItems: T[], templateItems: T[]) => (
    liveItems.length ? liveItems : templateItems
  );

  return {
    key: live.key || fromTemplate.key,
    html: live.html || fromTemplate.html,
    eyebrow: pickText(live.eyebrow, fromTemplate.eyebrow),
    headingPrefix: pickText(live.headingPrefix, fromTemplate.headingPrefix),
    headingAccent: pickText(live.headingAccent, fromTemplate.headingAccent),
    lead: pickText(live.lead, fromTemplate.lead),
    body: pickText(live.body, fromTemplate.body),
    bodyHtml: live.bodyHtml || fromTemplate.bodyHtml,
    stats: pickArray(live.stats, fromTemplate.stats),
    cards: pickArray(live.cards, fromTemplate.cards),
    groups: pickArray(live.groups, fromTemplate.groups),
    timeline: pickArray(live.timeline, fromTemplate.timeline),
    contactCards: pickArray(live.contactCards, fromTemplate.contactCards),
    heroItems: pickArray(live.heroItems, fromTemplate.heroItems),
    sideCard: live.sideCard ?? fromTemplate.sideCard,
    badges: pickArray(live.badges, fromTemplate.badges),
    ctaTitle: pickText(live.ctaTitle, fromTemplate.ctaTitle),
    ctaSubtitle: pickText(live.ctaSubtitle, fromTemplate.ctaSubtitle),
    ctaText: pickText(live.ctaText, fromTemplate.ctaText),
    profiles: pickArray(live.profiles, fromTemplate.profiles),
    steps: pickArray(live.steps, fromTemplate.steps),
    sessions: pickArray(live.sessions, fromTemplate.sessions),
    liveSessionRows: pickArray(live.liveSessionRows, fromTemplate.liveSessionRows),
    levels: pickArray(live.levels, fromTemplate.levels),
    labeledItems: pickArray(live.labeledItems, fromTemplate.labeledItems),
    legalTabs: pickArray(live.legalTabs, fromTemplate.legalTabs),
    legalMetaItems: pickArray(live.legalMetaItems, fromTemplate.legalMetaItems),
    legalTocItems: pickArray(live.legalTocItems, fromTemplate.legalTocItems),
    legalCalloutHeading: pickText(live.legalCalloutHeading, fromTemplate.legalCalloutHeading),
    legalTocTitle: pickText(live.legalTocTitle, fromTemplate.legalTocTitle),
    legalTocDownloadLabel: pickText(live.legalTocDownloadLabel, fromTemplate.legalTocDownloadLabel),
    legalTocDownloadLink: pickText(live.legalTocDownloadLink, fromTemplate.legalTocDownloadLink),
    legalSectionNumber: pickText(live.legalSectionNumber, fromTemplate.legalSectionNumber),
    legalSectionHeading: pickText(live.legalSectionHeading, fromTemplate.legalSectionHeading),
    checklistHeading: pickText(live.checklistHeading, fromTemplate.checklistHeading),
    checklistItems: pickArray(live.checklistItems, fromTemplate.checklistItems),
    tableRows: pickArray(live.tableRows, fromTemplate.tableRows),
    schedulerTag: pickText(live.schedulerTag, fromTemplate.schedulerTag),
    schedulerTitle: pickText(live.schedulerTitle, fromTemplate.schedulerTitle),
    schedulerSubtitle: pickText(live.schedulerSubtitle, fromTemplate.schedulerSubtitle),
    schedulerPlaceholderHeading: pickText(live.schedulerPlaceholderHeading, fromTemplate.schedulerPlaceholderHeading),
    schedulerPlaceholderText: pickText(live.schedulerPlaceholderText, fromTemplate.schedulerPlaceholderText),
    schedulerCtaText: pickText(live.schedulerCtaText, fromTemplate.schedulerCtaText),
    schedulerCtaLink: pickText(live.schedulerCtaLink, fromTemplate.schedulerCtaLink),
    cardTag: pickText(live.cardTag, fromTemplate.cardTag),
    cardLiveLabel: pickText(live.cardLiveLabel, fromTemplate.cardLiveLabel),
    cardTitle: pickText(live.cardTitle, fromTemplate.cardTitle),
    cardMeta: pickText(live.cardMeta, fromTemplate.cardMeta),
    cardRows: pickArray(live.cardRows, fromTemplate.cardRows),
    noteHeading: pickText(live.noteHeading, fromTemplate.noteHeading),
    noteText: pickText(live.noteText, fromTemplate.noteText),
    freePill: pickText(live.freePill, fromTemplate.freePill),
    primaryCtaLink: pickText(live.primaryCtaLink, fromTemplate.primaryCtaLink),
    secondaryCtaText: pickText(live.secondaryCtaText, fromTemplate.secondaryCtaText),
    secondaryCtaLink: pickText(live.secondaryCtaLink, fromTemplate.secondaryCtaLink),
    contactInfoHeading: pickText(live.contactInfoHeading, fromTemplate.contactInfoHeading),
    contactInfoItems: pickArray(live.contactInfoItems, fromTemplate.contactInfoItems),
    supportHoursHeading: pickText(live.supportHoursHeading, fromTemplate.supportHoursHeading),
    supportHoursRows: pickArray(live.supportHoursRows, fromTemplate.supportHoursRows),
    supportHoursNote: pickText(live.supportHoursNote, fromTemplate.supportHoursNote),
    socialsHeading: pickText(live.socialsHeading, fromTemplate.socialsHeading),
    socials: pickArray(live.socials, fromTemplate.socials),
    anchorId: pickText(live.anchorId, fromTemplate.anchorId),
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
