import * as cheerio from 'cheerio';
import type { StoryblokRichtextDoc } from './storyblokRichtext';

type RichtextNode = {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: RichtextNode[];
};

type CheerioEl = any;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(value: string): string {
  return decodeEntities(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
}

function pushText(nodes: RichtextNode[], text: string, marks?: RichtextNode['marks']): void {
  const cleaned = cleanText(text);
  if (!cleaned) return;
  if (!cleaned.trim() && cleaned.includes(' ')) {
    nodes.push({ type: 'text', text: ' ', marks: marks?.length ? marks : undefined });
    return;
  }
  if (!cleaned.trim()) return;
  nodes.push({
    type: 'text',
    text: cleaned,
    marks: marks?.length ? marks : undefined,
  });
}

function mergeMarks(
  base: RichtextNode['marks'] | undefined,
  next: { type: string; attrs?: Record<string, unknown> },
): RichtextNode['marks'] {
  const marks = [...(base ?? [])];
  if (!marks.some(mark => mark.type === next.type && JSON.stringify(mark.attrs ?? {}) === JSON.stringify(next.attrs ?? {}))) {
    marks.push(next);
  }
  return marks;
}

function inlineNodes($: cheerio.CheerioAPI, el: any, marks?: RichtextNode['marks']): RichtextNode[] {
  const nodes: RichtextNode[] = [];

  if (el?.type === 'text') {
    pushText(nodes, String(el.data ?? ''), marks);
    return nodes;
  }

  if (el?.type !== 'tag') return nodes;
  const tag = String(el.name || '').toLowerCase();

  if (tag === 'br') {
    nodes.push({ type: 'hard_break' });
    return nodes;
  }

  if (tag === 'img') {
    const src = ($(el).attr('src') || '').trim();
    if (src) {
      nodes.push({
        type: 'image',
        attrs: {
          src,
          alt: ($(el).attr('alt') || '').trim(),
          title: ($(el).attr('title') || '').trim(),
        },
      });
    }
    return nodes;
  }

  let nextMarks = marks;
  if (tag === 'strong' || tag === 'b') nextMarks = mergeMarks(nextMarks, { type: 'bold' });
  if (tag === 'em' || tag === 'i') nextMarks = mergeMarks(nextMarks, { type: 'italic' });
  if (tag === 'u') nextMarks = mergeMarks(nextMarks, { type: 'underline' });
  if (tag === 'code') nextMarks = mergeMarks(nextMarks, { type: 'code' });
  if (tag === 'a') {
    const href = ($(el).attr('href') || '').trim();
    if (href) {
      nextMarks = mergeMarks(nextMarks, {
        type: 'link',
        attrs: {
          href,
          uuid: null,
          anchor: null,
          target: href.startsWith('http') ? '_blank' : null,
          linktype: href.startsWith('http') ? 'url' : 'story',
        },
      });
    }
  }

  for (const child of el.children ?? []) {
    nodes.push(...inlineNodes($, child, nextMarks));
  }
  return nodes;
}

function paragraphFrom($: cheerio.CheerioAPI, el: CheerioEl): RichtextNode | null {
  const content = inlineNodes($, el);
  if (!content.length) return null;
  if (content.length === 1 && content[0].type === 'image') return content[0];
  return { type: 'paragraph', content };
}

function listItemFrom($: cheerio.CheerioAPI, el: CheerioEl): RichtextNode {
  const inline = inlineNodes($, el).filter(node => node.type !== 'image');
  const content: RichtextNode[] = inline.length
    ? [{ type: 'paragraph', content: inline }]
    : [{ type: 'paragraph' }];
  return { type: 'list_item', content };
}

function headingLevel(tag: string): number {
  const match = tag.match(/^h([1-6])$/i);
  return match ? Number(match[1]) : 2;
}

function blockFromElement($: cheerio.CheerioAPI, el: CheerioEl): RichtextNode[] {
  const tag = String(el.name || '').toLowerCase();
  const blocks: RichtextNode[] = [];

  if (tag === 'p' || tag === 'div' || tag === 'span' || tag === 'section') {
    const blockChildren = (el.children ?? []).filter((child: any) => (
      child?.type === 'tag'
      && ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'figure', 'img', 'hr', 'table', 'pre'].includes(String(child.name || '').toLowerCase())
    )) as CheerioEl[];
    if (blockChildren.length && (tag === 'div' || tag === 'section' || tag === 'span')) {
      for (const child of blockChildren) blocks.push(...blockFromElement($, child));
      return blocks;
    }
    const paragraph = paragraphFrom($, el);
    if (paragraph) blocks.push(paragraph);
    return blocks;
  }

  if (/^h[1-6]$/.test(tag)) {
    const content = inlineNodes($, el);
    if (content.length) {
      blocks.push({
        type: 'heading',
        attrs: { level: Math.min(Math.max(headingLevel(tag), 2), 4) },
        content,
      });
    }
    return blocks;
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = $(el).children('li').toArray().map(item => listItemFrom($, item as CheerioEl));
    if (items.length) {
      blocks.push({ type: tag === 'ol' ? 'ordered_list' : 'bullet_list', content: items });
    }
    return blocks;
  }

  if (tag === 'blockquote') {
    const content = inlineNodes($, el);
    blocks.push({
      type: 'blockquote',
      content: content.length ? [{ type: 'paragraph', content }] : [{ type: 'paragraph' }],
    });
    return blocks;
  }

  if (tag === 'figure') {
    const img = $(el).find('img').first();
    const src = (img.attr('src') || '').trim();
    if (src) {
      blocks.push({
        type: 'image',
        attrs: {
          src,
          alt: (img.attr('alt') || $(el).find('figcaption').text() || '').trim(),
          title: ($(el).find('figcaption').text() || img.attr('title') || '').trim(),
        },
      });
    }
    return blocks;
  }

  if (tag === 'img') {
    const src = ($(el).attr('src') || '').trim();
    if (src) {
      blocks.push({
        type: 'image',
        attrs: {
          src,
          alt: ($(el).attr('alt') || '').trim(),
          title: ($(el).attr('title') || '').trim(),
        },
      });
    }
    return blocks;
  }

  if (tag === 'hr') {
    blocks.push({ type: 'horizontal_rule' });
    return blocks;
  }

  if (tag === 'pre') {
    blocks.push({
      type: 'code_block',
      content: [{ type: 'text', text: cleanText($(el).text()) }],
    });
    return blocks;
  }

  if (tag === 'table') {
    $(el).find('tr').each((_, row) => {
      const cells = $(row).find('th,td').toArray().map(cell => cleanText($(cell).text()).trim()).filter(Boolean);
      if (cells.length) {
        blocks.push({
          type: 'paragraph',
          content: [{ type: 'text', text: cells.join(' | ') }],
        });
      }
    });
    return blocks;
  }

  for (const child of el.children ?? []) {
    if ((child as any)?.type === 'tag') blocks.push(...blockFromElement($, child as CheerioEl));
    else if ((child as any)?.type === 'text' && cleanText(String((child as any).data ?? '')).trim()) {
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: cleanText(String((child as any).data ?? '')).trim() }],
      });
    }
  }
  return blocks;
}

/** Convert sanitized article HTML into a Storyblok ProseMirror richtext document. */
export function htmlToStoryblokRichtext(html: string): StoryblokRichtextDoc {
  const $ = cheerio.load(`<div id="__root">${html || ''}</div>`);
  const root = $('#__root').get(0) as CheerioEl | undefined;
  const content: RichtextNode[] = [];
  if (root) {
    for (const child of root.children ?? []) {
      if ((child as any)?.type === 'tag') content.push(...blockFromElement($, child as CheerioEl));
      else if ((child as any)?.type === 'text') {
        const text = cleanText(String((child as any).data ?? '')).trim();
        if (text) content.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      }
    }
  }

  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  };
}

/** Rewrite image `src` values inside a richtext document using a URL map. */
export function rewriteRichtextImageSources(
  doc: StoryblokRichtextDoc,
  replacements: Map<string, { src: string; id?: number; alt?: string }>,
): StoryblokRichtextDoc {
  const walk = (node: RichtextNode): RichtextNode => {
    if (node.type === 'image' && node.attrs?.src) {
      const key = String(node.attrs.src);
      const replacement = replacements.get(key);
      if (replacement) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            src: replacement.src,
            id: replacement.id ?? node.attrs.id ?? null,
            alt: replacement.alt || node.attrs.alt || '',
          },
        };
      }
    }
    if (!node.content?.length) return node;
    return { ...node, content: node.content.map(walk) };
  };

  return {
    type: 'doc',
    content: (doc.content as RichtextNode[]).map(walk),
  };
}

/** Collect every image src from a richtext document. */
export function collectRichtextImageSources(doc: StoryblokRichtextDoc): string[] {
  const urls: string[] = [];
  const walk = (node: RichtextNode): void => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src) {
      urls.push(node.attrs.src);
    }
    node.content?.forEach(walk);
  };
  (doc.content as RichtextNode[]).forEach(walk);
  return [...new Set(urls)];
}
