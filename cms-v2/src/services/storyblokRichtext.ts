/** Storyblok richtext fields expect a ProseMirror document, not plain strings. */

export type StoryblokRichtextDoc = {
  type: 'doc';
  content: Array<{
    type: string;
    content?: Array<{ type: string; text?: string; marks?: unknown[] }>;
    text?: string;
    attrs?: Record<string, unknown>;
  }>;
};

/** Fields converted from textarea → richtext in Storyblok space 293626385802926. */
export const STORYBLOK_RICHTEXT_FIELDS_BY_COMPONENT: Record<string, string[]> = {
  article_library: ['note_text'],
  article_link_item: ['description'],
  book_meeting_hero: ['lead', 'scheduler_subtitle'],
  contact_card: ['detail'],
  contact_cards: ['description'],
  contact_form: ['thank_you_description'],
  contact_info_sidebar: ['hours_note'],
  content_cta_block: ['description'],
  content_section: ['body'],
  course_finder_banner: ['subtitle'],
  course_hero: ['description'],
  course_hero_right_item: ['description'],
  course_introduction: ['paragraph_1', 'paragraph_2'],
  course_pricing: ['included_description', 'guarantee_text'],
  course_tab_block: ['heading_richtext', 'description', 'paragraph'],
  course_tab_card: ['description'],
  course_tab_step: ['description'],
  course_tutor_section: ['bio'],
  faq_item: ['answer_paragraph'],
  feature_card_v2: ['description'],
  feature_cards_v2: ['section_description'],
  global_reach_section: ['lead'],
  hero_with_video: ['lead', 'sublead'],
  home_hero: ['subheading', 'description'],
  icon_card: ['description'],
  icon_card_grid: ['description'],
  legal_article: ['intro'],
  legal_hero: ['lead'],
  legal_section: ['body', 'contact_cta_body'],
  legal_table_row: ['col_b'],
  live_schedule: ['description'],
  live_sessions_hero: ['lead', 'card_meta'],
  live_sessions_table: ['description', 'note_text'],
  page_hero: ['lead', 'sublead'],
  page_hero_side_card: ['quote'],
  platform_feature: ['description'],
  promotion_section: ['subtitle'],
  qualification_structure: ['description'],
  quote_block: ['quote'],
  step_card: ['description'],
  step_cards: ['description'],
  team_profile: ['bio', 'logos_note'],
  team_profiles: ['description'],
  testimonial_card: ['quote'],
  testimonials: ['subtitle'],
  timeline_item: ['text'],
  trustpilot_section: ['subtitle'],
  two_column_platform: ['left_description', 'right_description'],
};

export function isStoryblokRichtextDoc(value: unknown): value is StoryblokRichtextDoc {
  return typeof value === 'object' && value !== null && (value as StoryblokRichtextDoc).type === 'doc';
}

export function plainTextToStoryblokRichtext(text: string): StoryblokRichtextDoc {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const paragraphs = text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const parts = paragraphs.length ? paragraphs : [trimmed];

  return {
    type: 'doc',
    content: parts.map(part => ({
      type: 'paragraph',
      content: [{ type: 'text', text: part.replace(/\n/g, ' ') }],
    })),
  };
}

export function toStoryblokRichtext(value: unknown): unknown {
  if (value == null) return value;
  if (isStoryblokRichtextDoc(value)) return value;
  if (typeof value === 'string') return plainTextToStoryblokRichtext(value);
  return value;
}

export function coerceBlokRichtextFields(
  component: string,
  blok: Record<string, unknown>,
): Record<string, unknown> {
  const fields = STORYBLOK_RICHTEXT_FIELDS_BY_COMPONENT[component];
  if (!fields?.length) return blok;

  const next = { ...blok };
  for (const field of fields) {
    if (next[field] !== undefined) {
      next[field] = toStoryblokRichtext(next[field]);
    }
  }
  return next;
}
