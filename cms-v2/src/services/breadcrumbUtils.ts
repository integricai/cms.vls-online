import type { ScrapedBreadcrumbItem } from '../../shared/migrationTypes';
import { PUBLIC_SITE_ORIGIN, toPublicOriginUrl } from './migrationUrlUtils';

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

function canonicalPageUrl(raw: string, pageUrl: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return pageUrl;
  if (trimmed.startsWith('/')) return `${PUBLIC_SITE_ORIGIN}${trimmed.replace(/\/$/, '')}`;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'vls.newzenler.com') {
      return `${PUBLIC_SITE_ORIGIN}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    }
    if (parsed.hostname === 'vls-online.com' || parsed.hostname === 'www.vls-online.com') {
      return `${PUBLIC_SITE_ORIGIN}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    }
    return trimmed;
  } catch {
    return pageUrl;
  }
}

function breadcrumbUrlForLabel(label: string, index: number, lastIndex: number, pageUrl: string): string {
  const normalizedLabel = label.toLowerCase();
  if (index === 0 && normalizedLabel === 'home') return `${PUBLIC_SITE_ORIGIN}/`;
  if (index === lastIndex) return pageUrl;
  if (normalizedLabel.includes('acca')) return `${PUBLIC_SITE_ORIGIN}/accacourses`;
  if (normalizedLabel.includes('cima')) return `${PUBLIC_SITE_ORIGIN}/cimacourses`;
  if (normalizedLabel.includes('cma')) return `${PUBLIC_SITE_ORIGIN}/cma`;
  if (normalizedLabel.includes('cia')) return `${PUBLIC_SITE_ORIGIN}/cia`;
  if (normalizedLabel.includes('knowledge')) return `${PUBLIC_SITE_ORIGIN}/accacourses`;
  if (normalizedLabel.includes('skills')) return `${PUBLIC_SITE_ORIGIN}/accacourses`;
  if (normalizedLabel.includes('professional')) return `${PUBLIC_SITE_ORIGIN}/accacourses`;
  return pageUrl;
}

export function splitBreadcrumbTrail(value: string): string[] {
  return value
    .split(/\s*(?:>|›|»|\/)\s*/g)
    .map(stripTags)
    .filter(Boolean);
}

/** Parse breadcrumb paragraph HTML — extract linked items when anchors are present. */
export function parseBreadcrumbFromHtml(html: string, pageUrl: string): ScrapedBreadcrumbItem[] {
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const inner = paragraphMatch?.[1] ?? html;
  if (!inner.trim()) return [];

  const linked: ScrapedBreadcrumbItem[] = [];
  const anchorPattern = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of inner.matchAll(anchorPattern)) {
    const label = stripTags(match[2]);
    const href = canonicalPageUrl(match[1], pageUrl);
    if (label) linked.push({ label, url: href });
  }
  if (linked.length) return linked;

  const plainText = stripTags(inner.replace(/<[^>]+>/g, ' > '));
  const names = splitBreadcrumbTrail(plainText);
  const lastIndex = names.length - 1;
  return names.map((name, index) => ({
    label: name,
    url: breadcrumbUrlForLabel(name, index, lastIndex, pageUrl),
  }));
}

export function breadcrumbTrailText(items: ScrapedBreadcrumbItem[]): string {
  return items.map(item => item.label).join(' > ');
}

export function buildSchemaBreadcrumbBloks(
  items: ScrapedBreadcrumbItem[],
): Array<{ _uid: string; component: 'course_hero_breadcrumb'; name: string; url: string }> {
  return items.map(item => ({
    _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    component: 'course_hero_breadcrumb' as const,
    name: item.label,
    url: item.url,
  }));
}

export function normalizeOriginUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  return toPublicOriginUrl(parsed);
}
