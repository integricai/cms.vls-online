import type { ScrapedFaqItem } from '../../shared/migrationTypes';

export interface ParsedFaq {
  title: string;
  icon: string;
  items: ScrapedFaqItem[];
}

export interface FaqParseResult {
  faq: ParsedFaq | null;
  warnings: string[];
}

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

function extractFirstMatch(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

/** Scans forward from just inside an opening `<div>` tag and returns the balanced inner content. */
function scanBalancedDiv(html: string, openTagEnd: number): string {
  let depth = 1;
  let i = openTagEnd;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(openTagEnd, nextClose);
      i = nextClose + 6;
    }
  }
  return '';
}

/** Returns an HTML attribute's raw value from within a single opening tag, e.g. `getAttr('<div class="a b">', 'class')` -> `"a b"`. */
function getAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}=(["'])((?:(?!\\1)[\\s\\S])*)\\1`, 'i'));
  return match?.[2] ?? '';
}

/** True when `tag`'s `class` attribute contains `token` as a whole space-separated class, not a substring match. */
function hasClassToken(tag: string, token: string): boolean {
  return getAttr(tag, 'class').split(/\s+/).includes(token);
}

/** Finds every opening `<div ...>` tag in `html`, in document order. */
function findDivOpenTags(html: string): Array<{ tag: string; start: number; end: number }> {
  const results: Array<{ tag: string; start: number; end: number }> = [];
  const pattern = /<div\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    results.push({ tag: match[0], start: match.index, end: match.index + match[0].length });
  }
  return results;
}

export function parseFaqFromJsonLd(html: string): ParsedFaq | null {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)
    ?? html.match(/<script[^>]*>[\s\S]*?<\/script>/gi)
    ?? [];

  for (const script of scripts) {
    const jsonText = script.replace(/<\/?script[^>]*>/gi, '').trim();
    if (!jsonText.includes('FAQPage') || !jsonText.includes('mainEntity')) continue;
    try {
      const data = JSON.parse(jsonText) as {
        '@type'?: string;
        '@graph'?: Array<{
          '@type'?: string;
          mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
        }>;
        mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
      };

      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const faqNode = nodes.find(node => node['@type'] === 'FAQPage');
      const mainEntity = faqNode?.mainEntity ?? (data['@type'] === 'FAQPage' ? data.mainEntity : undefined);
      if (!Array.isArray(mainEntity)) continue;

      const items: ScrapedFaqItem[] = mainEntity
        .map(entity => {
          const answerText = String(entity.acceptedAnswer?.text ?? '').trim();
          return {
            question: String(entity.name ?? '').trim(),
            answerHtml: `<p>${answerText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
            answerText,
          };
        })
        .filter(item => item.question);
      if (!items.length) continue;
      return { title: 'Frequently Asked Questions', icon: '❔', items };
    } catch {
      // ignore malformed FAQ JSON and keep scanning other scripts
    }
  }
  return null;
}

/**
 * Regex-based fallback for pages where the FAQPage JSON-LD is absent or unparsable.
 * Tolerant of attribute order/quote style on the wrapper div and of extra modifier
 * classes (e.g. "is-open") on item divs, since the live page builder isn't guaranteed
 * to emit either the same attribute order or an isolated class value every time.
 */
export function parseFaqFromMarkup(html: string): ParsedFaq | null {
  const wrapperMatch = html.match(/<div[^>]*\bclass=(["'])(vlsfaq[a-z0-9]+)\1(?=[\s>])/i);
  if (!wrapperMatch) return null;

  const uid = wrapperMatch[2];
  const wrapperStart = wrapperMatch.index ?? 0;
  const faqHtml = html.slice(wrapperStart, wrapperStart + 250000);

  const title = stripTags(extractFirstMatch(faqHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i)) || 'Frequently Asked Questions';
  const icon = stripTags(extractFirstMatch(faqHtml, /<span class="[^"]*-head-ico"[^>]*>([\s\S]*?)<\/span>/i));

  const itemOpenPattern = new RegExp(
    `<div[^>]*\\bclass=(["'])(?:(?!\\1)[\\s\\S])*?\\b${uid}-item\\b(?:(?!\\1)[\\s\\S])*?\\1[^>]*>`,
    'gi',
  );
  const questionPattern = new RegExp(
    `<span[^>]*\\bclass=(["'])(?:(?!\\1)[\\s\\S])*?\\b${uid}-q\\b(?:(?!\\1)[\\s\\S])*?\\1[^>]*>([\\s\\S]*?)<\\/span>`,
    'i',
  );
  const answerOpenPattern = /<div[^>]*itemprop=["']text["'][^>]*>/i;

  const items: ScrapedFaqItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemOpenPattern.exec(faqHtml))) {
    const itemStart = match.index + match[0].length;
    const itemHtml = scanBalancedDiv(faqHtml, itemStart);
    if (!itemHtml) break;

    const question = stripTags(itemHtml.match(questionPattern)?.[2] ?? '');

    let answerHtml = '';
    const answerOpenMatch = itemHtml.match(answerOpenPattern);
    if (answerOpenMatch) {
      const answerStart = (answerOpenMatch.index ?? 0) + answerOpenMatch[0].length;
      answerHtml = scanBalancedDiv(itemHtml, answerStart).trim();
    }
    const answerText = stripTags(answerHtml);

    if (question) items.push({ question, answerHtml, answerText });

    // Resume scanning after this item's full (balanced) content, not just its opening tag,
    // so nested markup inside the answer can never be mistaken for the next item.
    itemOpenPattern.lastIndex = itemStart + itemHtml.length;
  }

  if (!items.length) return null;
  return { title, icon, items };
}

/**
 * Second regex fallback for the legacy page-builder's Bootstrap-style FAQ accordion
 * (`.panel-group` > `.panel` items, each with a `.panel-title` heading and `.panel-body`
 * answer) — used by generic/legacy pages that never emit the `vlsfaq[uid]` widget markup
 * `parseFaqFromMarkup` looks for at all. Only treats a `.panel-group` as an FAQ block when
 * it (or the text just before it) is actually FAQ-labeled, so unrelated accordions on the
 * same page aren't misread as FAQs.
 */
export function parseFaqFromAccordion(html: string): ParsedFaq | null {
  const groupCandidates = findDivOpenTags(html).filter(div => hasClassToken(div.tag, 'panel-group'));

  for (const group of groupCandidates) {
    const groupHtml = scanBalancedDiv(html, group.end);
    if (!groupHtml) continue;

    const nearbyContext = html.slice(Math.max(0, group.start - 3000), group.start);
    const isFaqSignaled = /faq/i.test(group.tag) || /frequently asked questions/i.test(nearbyContext);
    if (!isFaqSignaled) continue;

    const items: ScrapedFaqItem[] = [];
    const panelDivs = findDivOpenTags(groupHtml).filter(div => hasClassToken(div.tag, 'panel'));

    for (const panel of panelDivs) {
      const panelHtml = scanBalancedDiv(groupHtml, panel.end);
      if (!panelHtml) continue;

      const titleOpenTag = panelHtml.match(/<h[1-6][^>]*>/i)?.[0] ?? '';
      if (!hasClassToken(titleOpenTag, 'panel-title')) continue;

      const titleMatch = panelHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      const question = stripTags(titleMatch?.[1] ?? '');
      if (!question) continue;

      const bodyDiv = findDivOpenTags(panelHtml).find(div => hasClassToken(div.tag, 'panel-body'));
      const answerHtml = bodyDiv ? scanBalancedDiv(panelHtml, bodyDiv.end).trim() : '';
      const answerText = stripTags(answerHtml);

      items.push({ question, answerHtml, answerText });
    }

    if (items.length) return { title: 'Frequently Asked Questions', icon: '❔', items };
  }

  return null;
}

/**
 * Combines the JSON-LD and markup extraction paths. JSON-LD is preferred when present
 * (structured, less brittle), but if both paths find the FAQ block with differing item
 * counts, that discrepancy is surfaced as a warning instead of silently trusting JSON-LD.
 */
export function parseFaq(html: string): FaqParseResult {
  const warnings: string[] = [];
  const fromJson = parseFaqFromJsonLd(html);
  const fromMarkup = parseFaqFromMarkup(html) ?? parseFaqFromAccordion(html);

  if (fromJson && fromMarkup && fromJson.items.length !== fromMarkup.items.length) {
    warnings.push(
      `FAQ item count mismatch: JSON-LD found ${fromJson.items.length} item(s), HTML markup found ${fromMarkup.items.length} item(s). Using the JSON-LD result — review the source page if this looks wrong.`,
    );
  }

  return { faq: fromJson ?? fromMarkup, warnings };
}
