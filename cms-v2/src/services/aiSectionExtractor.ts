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
  groups: Array<{ label: string; items: Array<{ code: string; title: string; description: string; url: string }> }>;
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

/**
 * The caller already decides what scope of HTML to hand in (main-content region for the fast path,
 * full <body> for the AI path) — this just resolves cheerio's parsed root without narrowing further,
 * since narrowing to <main> here would silently cut out content the caller deliberately included
 * (e.g. hero/banner markup that legacy pages place before <main>).
 */
function findContentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
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

  function visit(el: any, depth: number, rawDepth: number): void {
    if (blocks.length >= MAX_BLOCKS || rawDepth > 30) return;
    if (el.type !== 'tag') return;
    const $el = $(el);
    const tag = String(el.tagName ?? '').toLowerCase();

    const text = textOf($el);
    if (!text || text.length < 40) return;

    const childElements = $el.children().toArray().filter((child: any) => child.type === 'tag');

    // A wrapper with exactly one child that actually carries any text is just a transparent layout
    // div (page builders nest many of these, often alongside empty decorative siblings like
    // `<div class="overly">`) — pass through it without spending the branching-depth budget, so
    // real content isn't missed just because it sits several wrapper-divs deep.
    const nonEmptyChildren = childElements.filter(child => textOf($(child)).length > 0);
    if (nonEmptyChildren.length === 1) {
      visit(nonEmptyChildren[0], depth, rawDepth + 1);
      return;
    }

    const childTextTotal = childElements.reduce((sum, child) => sum + textOf($(child)).length, 0);
    const ownText = text.length;
    // A node only "contains" multiple distinct sub-blocks worth splitting into if more than one
    // of its children independently carries enough text to be its own block; legacy page-builder
    // markup wraps a single card/row in several small tags (span/strong/em/a) that must NOT each
    // become their own fragment.
    const substantialChildren = childElements.filter(child => textOf($(child)).length >= 40);
    const looksLikeSingleBlock =
      depth >= 4 || childElements.length === 0 || substantialChildren.length <= 1 || ownText - childTextTotal > 80;

    if (!looksLikeSingleBlock && depth < 4) {
      for (const child of substantialChildren) visit(child, depth + 1, rawDepth + 1);
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
    visit(child, 0, 0);
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
    groups: [],
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
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                code: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['code', 'title', 'description', 'url'],
            },
          },
        },
        required: ['label', 'items'],
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
    'stats', 'cards', 'groups', 'timeline', 'contactCards', 'heroItems', 'sideCard', 'badges',
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
  if (!apiKey) {
    warnings.push('AI section matching skipped: OPENAI_API_KEY is not configured on the server.');
    console.warn('[aiSectionExtractor] OPENAI_API_KEY not configured — skipping AI section matching.');
    return { matches, warnings };
  }
  if (!missingSections.length || !candidateBlocks.length) {
    return { matches, warnings };
  }

  const model = process.env.OPENAI_SECTION_MODEL || 'gpt-4.1-mini';
  console.log(
    `[aiSectionExtractor] Matching ${missingSections.length} missing section(s) [${missingSections.map(s => s.key).join(', ')}] ` +
      `against ${candidateBlocks.length} candidate block(s) using model "${model}".`,
  );

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
                  'For each target section key, find the candidate block(s) that best match it by meaning.',
                  'Some pages repeat several sibling blocks that together form one logical section',
                  '(e.g. multiple topic-group blocks that collectively are the page\'s article/card list) —',
                  'when that happens, combine real content from ALL of the relevant sibling blocks into the',
                  'extracted fields, not just the first one. Extract real field values from the blocks\'',
                  'actual text — never invent content.',
                  '',
                  'Use `cards` for a flat, ungrouped list of items (e.g. feature cards, testimonials).',
                  'Use `groups` instead when the content is organized into named categories/topics that',
                  'each contain their own list of items (e.g. a library of articles grouped by syllabus',
                  'area, or a course list grouped by level) — one entry per category, with `label` set to',
                  'the category/topic name and `items` set to every item in that category (each item\'s',
                  '`code` is a short badge/tag/prefix shown next to its title if the page has one, e.g. an',
                  'article code, otherwise leave `code` empty; `url` is that item\'s own link if it has one,',
                  'otherwise leave it empty). Do not put the same content into both `cards` and `groups`.',
                  '',
                  'Set matchedBlockIndex to the index of the single most representative',
                  'matched block (for reference) and confidence to how sure you are (0-1).',
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
          groups: result.groups,
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
