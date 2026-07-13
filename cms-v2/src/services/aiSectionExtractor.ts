import * as cheerio from 'cheerio';
import type { MigrationTemplate, ScrapedTemplateSection } from '../../shared/migrationTypes';
import type { TemplateSectionBlueprint } from '../../shared/migrationTemplateTypes';

const MAX_BLOCKS = 40;
const MAX_BLOCK_TEXT = 500;
const MAX_BLOCK_HTML = 2000;

export interface CandidateBlock {
  index: number;
  tag: string;
  classes: string[];
  nearestComment: string;
  headingText: string;
  textPreview: string;
  html: string;
}

interface ExtractedSectionPayload {
  matchedBlockIndex: number | null;
  confidence: number;
  eyebrow: string;
  headingPrefix: string;
  headingAccent: string;
  lead: string;
  body: string;
  stats: Array<{ value: string; label: string }>;
  cards: Array<{ title: string; description: string }>;
  timeline: Array<{ year: string; title: string; text: string }>;
  contactCards: Array<{ title: string; detail: string; linkText: string; linkUrl: string }>;
  heroItems: Array<{ text: string }>;
  sideCard: { tag: string; quote: string; authorName: string; authorRole: string } | null;
  badges: Array<{ title: string; subtitle: string }>;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaText: string;
}

export interface AiSectionMatch {
  section: ScrapedTemplateSection;
  confidence: number;
}

const CONTENT_TAGS = new Set(['section', 'article', 'header', 'footer', 'div', 'main']);

function textOf($el: cheerio.Cheerio<any>): string {
  return $el.text().replace(/\s+/g, ' ').trim();
}

function nearestPrecedingComment($: cheerio.CheerioAPI, node: any): string {
  let sibling = node.prev;
  while (sibling) {
    if (sibling.type === 'comment') {
      return String((sibling as any).data ?? '').trim();
    }
    if (sibling.type === 'tag') return '';
    sibling = sibling.prev;
  }
  return '';
}

/** Finds the main content root the same way pageScraper.ts's extractMainContent() does. */
function findContentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  const main = $('main').first();
  if (main.length) return main;
  const pageContent = $('[class*="page-content"]').first();
  if (pageContent.length) return pageContent;
  const body = $('body').first();
  return body.length ? body : $.root();
}

/**
 * Best-effort DOM segmentation: splits the main content area into content-bearing blocks
 * regardless of whether they're wrapped in `<section>` or `<div>` tags, since legacy
 * page-builder markup (Elementor/GrapesJS-style) rarely uses `<section>` at all.
 */
export function buildCandidateBlocks(html: string): CandidateBlock[] {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();

  const root = findContentRoot($);
  const blocks: CandidateBlock[] = [];

  function visit(el: any, depth: number): void {
    if (blocks.length >= MAX_BLOCKS) return;
    const $el = $(el);
    const tag = String(el.tagName ?? '').toLowerCase();
    if (!CONTENT_TAGS.has(tag)) return;

    const text = textOf($el);
    if (!text || text.length < 40) return;

    const childElements = $el.children().toArray();
    const childTextTotal = childElements.reduce((sum, child) => sum + textOf($(child)).length, 0);
    const ownText = text.length;
    const looksLikeSingleBlock = depth >= 4 || childElements.length === 0 || ownText - childTextTotal > 80;

    if (!looksLikeSingleBlock && depth < 4) {
      for (const child of childElements) visit(child, depth + 1);
      return;
    }

    const headingEl = $el.find('h1, h2, h3').first();
    const classAttr = String($el.attr('class') ?? '');
    blocks.push({
      index: blocks.length,
      tag,
      classes: classAttr.split(/\s+/).filter(Boolean),
      nearestComment: nearestPrecedingComment($, el),
      headingText: headingEl.length ? textOf(headingEl) : '',
      textPreview: text.slice(0, MAX_BLOCK_TEXT),
      html: ($.html(el) ?? '').slice(0, MAX_BLOCK_HTML),
    });
  }

  for (const child of root.children().toArray()) {
    visit(child, 0);
  }

  return blocks;
}

function emptySectionFor(key: string): ScrapedTemplateSection {
  return {
    key,
    html: '',
    eyebrow: '',
    headingPrefix: '',
    headingAccent: '',
    lead: '',
    body: '',
    bodyHtml: '',
    stats: [],
    cards: [],
    timeline: [],
    contactCards: [],
    heroItems: [],
    sideCard: null,
    badges: [],
    ctaTitle: '',
    ctaSubtitle: '',
    ctaText: '',
  };
}

const SECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matchedBlockIndex: { type: ['integer', 'null'] },
    confidence: { type: 'number' },
    eyebrow: { type: 'string' },
    headingPrefix: { type: 'string' },
    headingAccent: { type: 'string' },
    lead: { type: 'string' },
    body: { type: 'string' },
    stats: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string' }, label: { type: 'string' } },
        required: ['value', 'label'],
      },
    },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, description: { type: 'string' } },
        required: ['title', 'description'],
      },
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { year: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' } },
        required: ['year', 'title', 'text'],
      },
    },
    contactCards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          linkText: { type: 'string' },
          linkUrl: { type: 'string' },
        },
        required: ['title', 'detail', 'linkText', 'linkUrl'],
      },
    },
    heroItems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    sideCard: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        tag: { type: 'string' },
        quote: { type: 'string' },
        authorName: { type: 'string' },
        authorRole: { type: 'string' },
      },
      required: ['tag', 'quote', 'authorName', 'authorRole'],
    },
    badges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, subtitle: { type: 'string' } },
        required: ['title', 'subtitle'],
      },
    },
    ctaTitle: { type: 'string' },
    ctaSubtitle: { type: 'string' },
    ctaText: { type: 'string' },
  },
  required: [
    'matchedBlockIndex', 'confidence', 'eyebrow', 'headingPrefix', 'headingAccent', 'lead', 'body',
    'stats', 'cards', 'timeline', 'contactCards', 'heroItems', 'sideCard', 'badges',
    'ctaTitle', 'ctaSubtitle', 'ctaText',
  ],
};

function parseResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

/**
 * Best-effort: asks an LLM to match live-page candidate blocks to the requested blueprint
 * section keys by meaning (not by class name/comment, which won't line up on legacy
 * page-builder markup) and extract real field content from the matched block. Never throws —
 * on any failure it returns an empty map so callers fall back to blueprint placeholder copy.
 */
export async function classifyAndExtractSections(
  template: MigrationTemplate,
  missingSections: TemplateSectionBlueprint[],
  candidateBlocks: CandidateBlock[],
): Promise<{ matches: Map<string, AiSectionMatch>; warnings: string[] }> {
  const matches = new Map<string, AiSectionMatch>();
  const warnings: string[] = [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !missingSections.length || !candidateBlocks.length) {
    return { matches, warnings };
  }

  const model = process.env.OPENAI_SECTION_MODEL || 'gpt-4.1-mini';

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(missingSections.map(section => [section.key, SECTION_SCHEMA])),
    required: missingSections.map(section => section.key),
  };

  const sectionDescriptions = missingSections
    .map(section => `- "${section.key}": ${section.label || section.key}${section.sampleHeading ? ` (e.g. "${section.sampleHeading}")` : ''}${section.sampleDescription ? ` — ${section.sampleDescription}` : ''}`)
    .join('\n');

  const blocksDescription = candidateBlocks
    .map(block => `[${block.index}] <${block.tag} class="${block.classes.join(' ')}">${block.nearestComment ? ` (nearest comment: "${block.nearestComment}")` : ''}${block.headingText ? ` heading: "${block.headingText}"` : ''}\n${block.textPreview}`)
    .join('\n\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  `A legacy web page is being migrated into a CMS template called "${template}".`,
                  'The page was built with a different tool than our target templates, so its markup',
                  'does not use the same tag/comment conventions — do NOT rely on class names or HTML',
                  'comments to decide a match. Read the actual text content of each candidate block and',
                  'match it to the target section it means the same thing as.',
                  '',
                  'Target sections to fill in:',
                  sectionDescriptions,
                  '',
                  'Candidate content blocks scraped from the live page (index, tag/class, nearby comment if any, heading, text preview):',
                  blocksDescription,
                  '',
                  'For each target section key, pick the single best-matching candidate block by meaning.',
                  'Extract real field values from that block\'s actual text — never invent content.',
                  'Set matchedBlockIndex to that block\'s index and confidence to how sure you are (0-1).',
                  'If truly nothing on the page matches a target section, set matchedBlockIndex to null,',
                  'confidence to 0, and leave text fields empty / arrays empty.',
                ].join('\n'),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'cms_section_match',
            strict: true,
            schema,
          },
        },
        max_output_tokens: 8000,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      warnings.push(`AI section matching failed: ${payload?.error?.message || `OpenAI request failed (${response.status})`}`);
      return { matches, warnings };
    }

    const outputText = parseResponseText(payload);
    const parsed = JSON.parse(outputText) as Record<string, ExtractedSectionPayload>;

    for (const section of missingSections) {
      const result = parsed[section.key];
      if (!result || result.matchedBlockIndex === null || !result.confidence) continue;

      matches.set(section.key, {
        confidence: result.confidence,
        section: {
          ...emptySectionFor(section.key),
          eyebrow: result.eyebrow,
          headingPrefix: result.headingPrefix,
          headingAccent: result.headingAccent,
          lead: result.lead,
          body: result.body,
          bodyHtml: result.body,
          stats: result.stats,
          cards: result.cards,
          timeline: result.timeline,
          contactCards: result.contactCards,
          heroItems: result.heroItems,
          sideCard: result.sideCard,
          badges: result.badges,
          ctaTitle: result.ctaTitle,
          ctaSubtitle: result.ctaSubtitle,
          ctaText: result.ctaText,
          html: candidateBlocks[result.matchedBlockIndex]?.html ?? '',
        },
      });
    }
  } catch (err) {
    warnings.push(`AI section matching failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { matches, warnings };
}
