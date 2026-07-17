import { sanitizeBlokForStoryblok } from './migrationTemplateRegistry';

const NESTED_BLOK_KEYS = ['body', 'seo', 'hero'] as const;

/** Recursively sanitize every Storyblok blok before MAPI upsert. */
export function sanitizeStoryContentForStoryblok(
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof content.component === 'string' && !Array.isArray(content.body)) {
    return sanitizeBlokForStoryblok(content);
  }

  const next: Record<string, unknown> = { ...content };

  for (const key of NESTED_BLOK_KEYS) {
    const value = next[key];
    if (!Array.isArray(value)) continue;
    next[key] = value.map(item => (
      item && typeof item === 'object'
        ? sanitizeBlokForStoryblok(item as Record<string, unknown>)
        : item
    ));
  }

  return next;
}
