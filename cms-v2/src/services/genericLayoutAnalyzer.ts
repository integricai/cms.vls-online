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

function slugifyComponentName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || 'custom_page_layout';
}

export interface LayoutNavItem {
  text: string;
  url: string;
}

export interface LayoutNavGroup {
  label: string;
  items: LayoutNavItem[];
}

export interface LayoutCard {
  title: string;
  description: string;
  url: string;
}

export interface LayoutCardGroup {
  groupLabel: string;
  cards: LayoutCard[];
}

export interface LayoutAnalysis {
  componentNameSuggestion: string;
  navGroups: LayoutNavGroup[];
  cardGroups: LayoutCardGroup[];
  warnings: string[];
}

/** Scans forward from an opening tag's end to find its balanced closing tag (handles nested same-name tags). */
function balancedBlockAt(html: string, tagName: string, openTagEnd: number): string {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}>`;
  let depth = 1;
  let i = openTagEnd;
  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf(openNeedle, i);
    const nextClose = html.indexOf(closeNeedle, i);
    if (nextClose === -1) return html.slice(openTagEnd);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + openNeedle.length;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(openTagEnd, nextClose);
      i = nextClose + closeNeedle.length;
    }
  }
  return html.slice(openTagEnd, i);
}

function classListOf(attrs: string): string[] {
  const match = attrs.match(/\bclass=["']([^"']*)["']/i);
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
}

interface TagBlock {
  attrs: string;
  inner: string;
  start: number;
}

function findBlocksByTag(
  html: string,
  tagName: string,
  predicate?: (classes: string[], attrs: string) => boolean,
): TagBlock[] {
  const openTagPattern = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  const results: TagBlock[] = [];
  for (const match of html.matchAll(openTagPattern)) {
    const attrs = match[1] ?? '';
    if (predicate && !predicate(classListOf(attrs), attrs)) continue;
    const start = match.index ?? 0;
    const openTagEnd = start + match[0].length;
    results.push({ attrs, inner: balancedBlockAt(html, tagName, openTagEnd), start });
  }
  return results;
}

function extractLinks(html: string): LayoutNavItem[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({ url: match[1], text: stripTags(match[2]) }))
    .filter(item => item.text);
}

const SIDEBAR_CLASS_HINT = /sidebar|side-menu|categor|filter-menu|topic-menu/i;

/** Best-effort: look for a `<nav>`/`<aside>` or sidebar-ish `<div>` wrapping 3+ links. */
function findNavGroups(html: string): LayoutNavGroup[] {
  const groups: LayoutNavGroup[] = [];

  for (const tagName of ['nav', 'aside']) {
    for (const block of findBlocksByTag(html, tagName)) {
      const items = extractLinks(block.inner);
      if (items.length < 3) continue;
      const headingMatch = block.inner.match(/<(h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/i);
      groups.push({ label: headingMatch ? stripTags(headingMatch[2]) : 'Categories', items });
    }
  }

  if (groups.length) return groups;

  for (const block of findBlocksByTag(html, 'div', classes => classes.some(cls => SIDEBAR_CLASS_HINT.test(cls)))) {
    const items = extractLinks(block.inner);
    if (items.length < 3) continue;
    const headingMatch = block.inner.match(/<(h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/i);
    groups.push({ label: headingMatch ? stripTags(headingMatch[2]) : 'Categories', items });
    break;
  }

  return groups;
}

const CLASS_STOPWORDS = new Set([
  'container', 'wrapper', 'row', 'col', 'grid', 'flex', 'section', 'content',
  'inner', 'outer', 'main', 'page', 'list', 'group', 'active', 'is-active',
]);

/** Finds the div class name that repeats most often (3+ times) — the likely "card" class. */
function findRepeatedCardClass(html: string): string | null {
  const counts = new Map<string, number>();
  for (const match of html.matchAll(/<div\b[^>]*\bclass=["']([^"']+)["']/gi)) {
    for (const cls of match[1].split(/\s+/)) {
      if (!cls || CLASS_STOPWORDS.has(cls.toLowerCase())) continue;
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 2;
  for (const [cls, count] of counts) {
    if (count > bestCount) {
      best = cls;
      bestCount = count;
    }
  }
  return best;
}

function parseCard(inner: string): LayoutCard {
  const headingMatch = inner.match(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/i);
  const paraMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const linkMatch = inner.match(/<a\b[^>]*href=["']([^"']+)["']/i);
  return {
    title: headingMatch ? stripTags(headingMatch[2]) : '',
    description: paraMatch ? stripTags(paraMatch[1]) : '',
    url: linkMatch?.[1] ?? '',
  };
}

function nearestHeadingBefore(headings: Array<{ index: number; text: string }>, index: number): string {
  let label = '';
  for (const heading of headings) {
    if (heading.index >= index) break;
    label = heading.text;
  }
  return label;
}

/** Best-effort: find the most-repeated card-like div class, extract each instance, and group
 *  consecutive cards under the nearest preceding h2/h3 (the "grouped article list" shape). */
function findCardGroups(html: string): LayoutCardGroup[] {
  const cardClass = findRepeatedCardClass(html);
  if (!cardClass) return [];

  const blocks = findBlocksByTag(html, 'div', classes => classes.includes(cardClass));
  const headings = [...html.matchAll(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => ({ index: match.index ?? 0, text: stripTags(match[2]) }));

  const groups: LayoutCardGroup[] = [];
  for (const block of blocks) {
    const card = parseCard(block.inner);
    if (!card.title && !card.description) continue;
    const label = nearestHeadingBefore(headings, block.start) || 'Items';
    const last = groups[groups.length - 1];
    if (last && last.groupLabel === label) {
      last.cards.push(card);
    } else {
      groups.push({ groupLabel: label, cards: [card] });
    }
  }
  return groups;
}

/**
 * Best-effort structural analysis for a page whose layout matches no known template/component
 * (e.g. a sidebar of categories + grouped card lists). Never throws — degrades to empty groups
 * with a warning so the caller can still show a (mostly-empty) draft for manual editing.
 */
export function analyzeUnmatchedLayout(rawHtml: string, pageTitle: string): LayoutAnalysis {
  const warnings: string[] = [];

  const navGroups = findNavGroups(rawHtml);
  if (!navGroups.length) {
    warnings.push('Could not detect a sidebar/category nav list — add one manually below if this page has one.');
  }

  const cardGroups = findCardGroups(rawHtml);
  if (!cardGroups.length) {
    warnings.push('Could not detect a repeated card/list pattern — add fields manually below.');
  }

  warnings.push('This structure was auto-guessed from the live HTML and is very likely incomplete — review and correct every field before creating the component.');

  return {
    componentNameSuggestion: `${slugifyComponentName(pageTitle)}_layout`,
    navGroups,
    cardGroups,
    warnings,
  };
}
