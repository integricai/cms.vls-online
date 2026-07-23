import fs from 'fs';
import path from 'path';
import type { MigrationTemplate } from '../../shared/migrationTypes';
import { isCoursePageTemplate } from '../../shared/migrationDestination';
import { buildHeroRightBlokFromTemplate } from './buildCourseTemplateContent';
import { loadCourseTemplateFile } from './courseTemplateParser';
import type {
  MigrationTemplateBlueprint,
  TemplateDesignTokens,
  TemplateSectionBlueprint,
} from '../../shared/migrationTemplateTypes';
import { DEFAULT_TRUSTPILOT_CAROUSEL_EMBED } from '../../shared/trustpilotDefaults';
import { coerceBlokRichtextFields } from './storyblokRichtext';
export class MigrationTemplateError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const TEMPLATE_FILES: Record<MigrationTemplate, string> = {
  home: 'home.html',
  course: 'course.html',
  legal: 'legal.html',
  form: 'about-us.html',
  about_us: 'about-us.html',
  landing: 'landing.html',
  team_vls: 'team vls.html',
  schedules: 'schedule.html',
  course_articles: 'course-articles.html',
  live_sessions: 'acca-live.html',
  book_meeting: 'book-meeting.html',
  contact_us: 'contact-us.html',
  study_notes: 'notes.html',
  course_listing: 'course-listing.html',
  course_dual_price: 'course-dual-price.html',
};

const DEFAULT_TOKENS: TemplateDesignTokens = {
  navy: '#0E2A57',
  ink: '#15233D',
  slate: '#3D4A63',
  blue: '#1E50C8',
  blueStrong: '#1A45B0',
  blueBright: '#3B73F0',
  blue50: '#F2F6FF',
  blue100: '#E7EEFD',
  blue200: '#D6E2FB',
  white: '#FFFFFF',
  green: '#1E9E6A',
  amber: '#F5A623',
};

const SECTION_COMPONENT: Record<string, string> = {
  hero: 'page_hero',
  'legal-hero': 'page_hero',
  section: 'content_section',
  band: 'icon_card_grid',
  'cta-band': 'promotion_section',
  faq: 'faq_section',
  testimonials: 'testimonials',
  reviews: 'testimonials',
  courses: 'feature_cards_v2',
  stats: 'stats_band',
  toolkit: 'icon_card_grid',
  schedule: 'live_schedule',
  team: 'team_profiles',
  form: 'enquiry_form',
};

const templateCache = new Map<MigrationTemplate, MigrationTemplateBlueprint>();

function templatesRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), '..', 'templates'),
    path.resolve(__dirname, '../../../templates'),
    path.resolve(__dirname, '../../../../templates'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new MigrationTemplateError(
    'HTML templates folder not found. Expected cms.vls-online/templates with home.html, course.html, etc.',
    500,
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseCssTokens(css: string): Partial<TemplateDesignTokens> {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/i);
  if (!rootMatch) return {};

  const map: Record<string, keyof TemplateDesignTokens> = {
    navy: 'navy',
    ink: 'ink',
    slate: 'slate',
    blue: 'blue',
    'blue-strong': 'blueStrong',
    'blue-bright': 'blueBright',
    'blue-50': 'blue50',
    'blue-100': 'blue100',
    'blue-200': 'blue200',
    white: 'white',
    green: 'green',
    amber: 'amber',
  };

  const tokens: Partial<TemplateDesignTokens> = {};
  for (const decl of rootMatch[1].split(';')) {
    const match = decl.match(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|[^/\n]+)/i);
    if (!match) continue;
    const key = map[match[1].toLowerCase()];
    if (key) tokens[key] = match[2].trim();
  }
  return tokens;
}

function sectionKeyFromComment(comment: string): string {
  return comment
    .toLowerCase()
    .replace(/=+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'section';
}

const PAGE_BODY_COMPONENTS = new Set([
  'home_hero_section',
  'home_hero',
  'enquiry_form',
  'contact_form',
  'feature_cards_v2',
  'content_cta_block',
  'two_column_platform',
  'testimonials',
  'trustpilot_section',
  'promotion_section',
  'course_finder_banner',
  'faq_section',
  'page_hero',
  'stats_band',
  'content_section',
  'icon_card_grid',
  'global_reach_section',
  'team_profiles',
  'quote_block',
  'qualification_structure',
  'live_schedule',
  'contact_cards',
  'book_meeting_hero',
  'step_cards',
  'article_library',
  'live_sessions_hero',
  'live_sessions_table',
  'contact_page_section',
  'legal_hero',
  'legal_article',
  'legal_section',
  'hero_with_video',
  'course_hero_layout',
]);

function componentForSection(key: string, classes: string[], template: MigrationTemplate): string {
  let component = 'content_section';

  if (template === 'book_meeting' && key.includes('hero')) component = 'book_meeting_hero';
  else if (template === 'book_meeting' && key.includes('how-it-works')) component = 'step_cards';
  else if (template === 'book_meeting' && key.includes('alternatives')) component = 'contact_cards';
  else if (template === 'course_articles' && key.includes('library')) component = 'article_library';
  else if (template === 'live_sessions' && key.includes('hero')) component = 'live_sessions_hero';
  else if (template === 'live_sessions' && (key.includes('schedule') || key.includes('timetable'))) component = 'live_sessions_table';
  else if (template === 'contact_us' && key.includes('contact')) component = 'contact_page_section';
  else if (template === 'study_notes' && key.includes('hero')) component = 'course_hero_layout';
  else if (template === 'study_notes' && key.includes('covered')) component = 'icon_card_grid';
  else if (template === 'study_notes' && key.includes('contents')) component = 'feature_cards_v2';
  else if (template === 'study_notes' && (key.includes('why-notes') || key.includes('how-to-use'))) component = 'content_section';
  else if (template === 'study_notes' && key.includes('related')) component = 'feature_cards_v2';
  else if (template === 'study_notes' && (key.includes('acca-notes-table') || key.includes('notes-table'))) component = 'article_library';
  else if (template === 'course_listing' && key.includes('hero')) component = 'hero_with_video';
  else if (template === 'course_listing' && key.includes('catalogue')) component = 'article_library';
  else if (template === 'course_listing' && key.includes('lms')) component = 'two_column_platform';
  else if (template === 'legal' && (key.includes('legal-hero') || classes.includes('legal-hero'))) component = 'legal_hero';
  else if (template === 'legal' && classes.includes('sec')) component = 'legal_section';
  else if (template === 'home' && key.includes('hero')) component = 'home_hero_section';
  else if (isCoursePageTemplate(template) && key.includes('hero')) component = 'course_hero_layout';
  else if (isCoursePageTemplate(template) && (key.includes('course-description') || key === 'course-description')) {
    component = 'course_introduction';
  }
  else if (isCoursePageTemplate(template) && (key.includes('what-you') || key.includes('learn'))) component = 'course_learn_section';
  else if (isCoursePageTemplate(template) && key.includes('course-content')) component = 'course_curriculum';
  else if (isCoursePageTemplate(template) && key.includes('tutor')) component = 'course_tutor_section';
  else if (key.includes('hero')) component = 'page_hero';
  else if ((template === 'form' || template === 'about_us') && (key.includes('get-in-touch') || key.includes('touch') || /(^|-)form($|-)/.test(key))) {
    component = 'contact_cards';
  } else if (key.includes('stats')) component = 'stats_band';
  else if (key.includes('tutor') || key.includes('profile') || key.includes('team-profile')) component = 'team_profiles';
  else if (key.includes('quote') || key.includes('why-join')) component = 'quote_block';
  else if (
    key.includes('global-team')
    || key.includes('values')
    || key.includes('culture')
    || key.includes('platform')
    || key.includes('career')
    || key.includes('industr')
    || key.includes('how-it-works')
    || key.includes('how-long')
    || key.includes('entry')
  ) {
    component = 'icon_card_grid';
  } else if (key.includes('qualification') || key.includes('structure')) component = 'qualification_structure';
  else if (key.includes('schedule') || key.includes('timetable') || key.includes('live-session')) component = 'live_schedule';
  else if (key.includes('reach')) component = 'global_reach_section';
  else if (key.includes('story') || key.includes('mission')) component = 'content_section';
  else if (classes.includes('faq') || key.includes('faq')) component = 'faq_section';
  else if (key.includes('review') || key.includes('testimonial')) component = 'testimonials';
  else if (key.includes('cta')) component = 'promotion_section';
  else if (key.includes('course') && template === 'home') component = 'feature_cards_v2';
  else if (key.includes('toolkit') || key.includes('feature')) component = 'icon_card_grid';
  else if (classes.includes('band')) component = 'icon_card_grid';
  else component = SECTION_COMPONENT[key.split('-')[0]] ?? 'content_section';

  if (!isCoursePageTemplate(template) && !PAGE_BODY_COMPONENTS.has(component)) {
    return 'content_section';
  }
  return component;
}

function cleanSectionLabel(comment: string): string {
  return comment.replace(/=+/g, '').replace(/\s+/g, ' ').trim() || comment.trim();
}

function stylesForSection(
  classes: string[],
  tokens: TemplateDesignTokens,
  component: string,
): Record<string, string | number> {
  const isBand = classes.includes('band');
  const isHero = classes.includes('hero') || classes.includes('legal-hero');
  const isCta = classes.includes('cta-band') || classes.includes('cta-panel') || component === 'promotion_section';

  if (component === 'legal_hero') {
    return {
      background_color: '#F2F6FF',
      padding_top: 34,
      padding_bottom: 0,
    };
  }

  if (component === 'legal_article') {
    return {
      background_color: '#FFFFFF',
      padding_top: 64,
      padding_bottom: 84,
    };
  }

  if (component === 'promotion_section' || isCta) {
    return {
      background_color: tokens.white,
      button_background: tokens.blue,
      padding_top: 36,
      padding_bottom: 90,
    };
  }

  if (isHero) {
    return {
      background_color: tokens.white,
      padding_top: 36,
      padding_bottom: 76,
      heading_accent_color: tokens.blue,
      eyebrow_color: tokens.blue,
      cta_background: tokens.blue,
      cta_text_color: tokens.white,
    };
  }

  if (component === 'stats_band') {
    return {
      background_color: tokens.white,
      padding_top: 0,
      padding_bottom: 34,
    };
  }

  return {
    background_color: isBand ? tokens.blue50 : tokens.white,
    padding_top: 92,
    padding_bottom: 92,
    heading_accent_color: tokens.blue,
    eyebrow_color: tokens.blue,
    cta_background: tokens.blue,
    cta_text_color: tokens.white,
  };
}

function parseSections(html: string, tokens: TemplateDesignTokens, template: MigrationTemplate): TemplateSectionBlueprint[] {
  const sections: TemplateSectionBlueprint[] = [];
  const commentPattern = /<!--\s*([\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;

  const commentMatches = [...html.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      label: cleanSectionLabel(match[1]),
      key: sectionKeyFromComment(match[1]),
      raw: match[1].trim(),
    }))
    .filter(item => {
      if (!item.raw || item.raw.length > 80) return false;
      if (/header|footer|profile:|duplicate this/i.test(item.raw)) return false;
      return true;
    });

  for (const match of html.matchAll(sectionPattern)) {
    const attrs = match[1];
    const inner = match[2];
    const classMatch = attrs.match(/class="([^"]*)"/i);
    const classes = (classMatch?.[1] ?? '').split(/\s+/).filter(Boolean);
    const index = match.index ?? 0;

    const nearestComment = [...commentMatches]
      .filter(item => item.index <= index)
      .sort((a, b) => b.index - a.index)[0];

    const key = nearestComment?.key ?? classes[0] ?? `section-${sections.length + 1}`;
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const sectionKey = classes.includes('sec') && idMatch?.[1] ? idMatch[1] : key;
    const heading = stripTags(inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
      ?? '');
    const commentLabel = nearestComment?.label ?? (classes.includes('sec') && idMatch?.[1] ? idMatch[1] : key);
    const label = (commentLabel === 'ARTICLE' && classes.includes('sec') && (heading || idMatch?.[1]))
      ? (heading || idMatch?.[1] || commentLabel)
      : commentLabel;
    const component = componentForSection(sectionKey, classes, template);
    const description = stripTags(
      inner.match(/<p[^>]*class="[^"]*(?:hero-lead|lead|hero-sub)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? '',
    );

    sections.push({
      key: sectionKey,
      label,
      component,
      classes,
      isBand: classes.includes('band'),
      styles: stylesForSection(classes, tokens, component),
      sampleHeading: heading,
      sampleDescription: description,
    });
  }

  if (!sections.length) {
    sections.push({
      key: 'content',
      label: 'Content',
      component: 'content_cta_block',
      classes: ['section'],
      isBand: false,
      styles: stylesForSection(['section'], tokens, 'content_cta_block'),
      sampleHeading: '',
      sampleDescription: '',
    });
  }

  if (template === 'legal') {
    const layoutMatch = html.match(/<div class="wrap layout">([\s\S]*?)<\/div>\s*<!--\s*FOOTER/i);
    const intro = layoutMatch
      ? stripTags(layoutMatch[1].match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')
      : '';
    const heroIndex = sections.findIndex(section => section.component === 'legal_hero');
    const insertAt = heroIndex >= 0 ? heroIndex + 1 : 0;
    sections.splice(insertAt, 0, {
      key: 'legal-article',
      label: 'Legal article',
      component: 'legal_article',
      classes: ['layout'],
      isBand: false,
      styles: stylesForSection(['section'], tokens, 'legal_article'),
      sampleHeading: 'On this page',
      sampleDescription: intro,
    });
  }

  return sections;
}

/** Live course pages include tabbed overview content after the intro — not a separate HTML section. */
function augmentCourseSections(sections: TemplateSectionBlueprint[]): TemplateSectionBlueprint[] {
  const output: TemplateSectionBlueprint[] = [];

  for (const section of sections) {
    output.push(section);
    if (section.component === 'course_introduction') {
      output.push({
        key: 'course-tabs',
        label: 'Course overview tabs',
        component: 'course_tabs',
        classes: [],
        isBand: false,
        sampleHeading: '',
        sampleDescription: '',
        styles: {
          background_color: '#FFFFFF',
          padding_top: 0,
          padding_bottom: 0,
        },
      });
    }
  }

  return output;
}

function parseTemplateFile(template: MigrationTemplate, filePath: string): MigrationTemplateBlueprint {
  const html = fs.readFileSync(filePath, 'utf8');
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const css = styleMatch?.[1] ?? '';
  const tokens = { ...DEFAULT_TOKENS, ...parseCssTokens(css) };

  return {
    template,
    fileName: path.basename(filePath),
    filePath,
    tokens,
    sections: isCoursePageTemplate(template)
      ? augmentCourseSections(parseSections(html, tokens, template))
      : parseSections(html, tokens, template),
  };
}

export function getMigrationTemplateBlueprint(template: MigrationTemplate): MigrationTemplateBlueprint {
  const cached = templateCache.get(template);
  if (cached) return cached;

  const fileName = TEMPLATE_FILES[template];
  const filePath = path.join(templatesRoot(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new MigrationTemplateError(`Template file not found: ${fileName}`, 404);
  }

  const blueprint = parseTemplateFile(template, filePath);
  templateCache.set(template, blueprint);
  return blueprint;
}

export function listMigrationTemplateBlueprints(): MigrationTemplateBlueprint[] {
  return (Object.keys(TEMPLATE_FILES) as MigrationTemplate[]).map(getMigrationTemplateBlueprint);
}

const BLOK_FIELD_ALLOWLIST: Record<string, string[]> = {
  content_cta_block: [
    'eyebrow', 'show_eyebrow_dot', 'heading_prefix', 'heading_accent', 'description',
    'checks', 'cta_text', 'cta_link', 'footer_note',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right',
    'max_width', 'eyebrow_color', 'heading_accent_color', 'check_color',
    'cta_background', 'cta_text_color', 'footer_note_color', 'font_size',
  ],
  promotion_section: [
    'name', 'eyebrow', 'title', 'title_accent', 'subtitle', 'cta_text', 'cta_link',
    'secondary_cta_text', 'secondary_cta_link',
    'background_color', 'button_background',
    'padding_left', 'padding_right', 'padding_top', 'padding_bottom', 'font_size',
  ],
  home_hero_section: ['hero', 'form', 'background_color', 'padding_top', 'padding_bottom'],
  enquiry_form: ['title', 'subtitle', 'background_color', 'padding_top', 'padding_bottom'],
  faq_section: [
    'title', 'icon', 'eyebrow', 'heading_prefix', 'heading_accent',
    'items', 'schema_id', 'zenler_course_id', 'background_color', 'padding_top', 'padding_bottom',
  ],
  testimonials: [
    'layout', 'score', 'reviews_label', 'rating_bars',
    'eyebrow', 'title_prefix', 'title_accent', 'subtitle',
    'trustpilot_url', 'trustpilot_embed', 'cards',
    'background_color', 'padding_top', 'padding_bottom',
  ],
  feature_cards_v2: ['title', 'subtitle', 'section_title', 'section_description', 'cards', 'background_color', 'padding_top', 'padding_bottom'],
  page_hero: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'lead', 'sublead', 'free_pill',
    'primary_cta_text', 'primary_cta_link', 'secondary_cta_text', 'secondary_cta_link',
    'items', 'side_card', 'badges',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  stats_band: ['items', 'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size'],
  content_section: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'body', 'timeline',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  icon_card_grid: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'columns', 'card_variant', 'show_device_pills', 'cards',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  global_reach_section: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'lead', 'reach_figs', 'cta_text', 'cta_link', 'regions',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  team_profiles: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'profiles',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  team_profile: [
    'name', 'role', 'initials', 'photo', 'icon_key', 'bio', 'tags', 'logos_note', 'stats',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  team_profile_stat: ['value', 'label'],
  quote_block: [
    'eyebrow', 'quote', 'quote_accent', 'author_name', 'author_role', 'author_initials',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  qualification_structure: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'levels',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  live_schedule: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'sessions',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  contact_cards: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'cards',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  stat_item: ['value', 'label'],
  icon_card: ['title', 'designation', 'description', 'photo', 'icon_key', 'figure_value', 'figure_label', 'is_tip'],
  timeline_item: ['year', 'title', 'text'],
  contact_card: ['title', 'detail', 'link_text', 'link', 'icon_key'],
  page_hero_item: ['text', 'variant'],
  page_hero_side_card: ['tag', 'title', 'quote', 'author_name', 'author_role', 'author_initials', 'footer_label', 'footer_value', 'rows'],
  page_hero_badge: ['title', 'subtitle', 'tone'],
  book_meeting_hero: [
    'free_pill', 'heading_prefix', 'heading_accent', 'lead', 'benefits', 'meta_items',
    'scheduler_tag', 'scheduler_title', 'scheduler_subtitle', 'scheduler_embed_url',
    'scheduler_placeholder_heading', 'scheduler_placeholder_text', 'scheduler_cta_text', 'scheduler_cta_link',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  step_cards: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'steps',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  article_library: [
    'sidebar_label', 'sidebar_value', 'topics', 'note_text',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  live_sessions_hero: [
    'free_pill', 'eyebrow', 'heading_prefix', 'heading_accent', 'lead', 'ticks',
    'primary_cta_text', 'primary_cta_link', 'secondary_cta_text', 'secondary_cta_link',
    'card_tag', 'card_live_label', 'card_title', 'card_meta', 'card_rows',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  live_sessions_table: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'description', 'sessions', 'note_heading', 'note_text',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  contact_page_section: [
    'form', 'sidebar',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  contact_form: [
    'form_title', 'submit_text', 'thank_you_title', 'thank_you_description', 'recipients',
    'enquiry_options', 'show_phone_field', 'show_country_code', 'enable_turnstile',
    'message_rows', 'message_min_height',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  legal_hero: [
    'eyebrow', 'heading', 'lead', 'meta_items', 'tabs',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  legal_article: [
    'toc_title', 'toc_download_label', 'toc_download_link', 'intro', 'intro_html', 'intro_callout_heading',
    'intro_callout_items', 'toc_items', 'sections',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  legal_section: [
    'anchor_id', 'number', 'heading', 'body', 'bullets', 'checklist_heading', 'checklist_items', 'table_rows',
    'contact_cta_eyebrow', 'contact_cta_heading', 'contact_cta_body', 'contact_cta_email',
    'contact_cta_primary_text', 'contact_cta_secondary_text', 'contact_cta_secondary_link',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  labeled_icon_item: ['icon_key', 'title', 'subtitle'],
  step_card: ['number', 'title', 'description'],
  article_link_item: ['code', 'title', 'description', 'url'],
  article_topic_group: ['topic_key', 'label', 'color_tone', 'articles'],
  live_session_row: [
    'paper_code', 'paper_name', 'tutors', 'track', 'format_label',
    'start_date', 'live_day', 'live_time', 'end_date', 'mock_label', 'course_link',
  ],
  support_hours_row: ['day', 'hours'],
  contact_info_sidebar: [
    'info_heading', 'info_items', 'hours_heading', 'hours_rows', 'hours_note', 'socials_heading', 'socials',
  ],
  legal_tab: ['label', 'link', 'active'],
  legal_table_row: ['col_a', 'col_b'],
  legal_toc_item: ['label', 'anchor_id', 'number'],
  hero_with_video: [
    'eyebrow', 'heading_prefix', 'heading_accent', 'lead', 'sublead',
    'primary_cta_text', 'primary_cta_link', 'secondary_cta_text', 'secondary_cta_link',
    'video_url', 'video_title', 'video_poster',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  two_column_platform: [
    'left_eyebrow', 'left_title', 'left_description', 'features',
    'right_eyebrow', 'right_title', 'right_description', 'device_tags',
    'cta_text', 'cta_link', 'cta_color',
    'padding_top', 'padding_bottom', 'left_padding_horizontal', 'right_padding_horizontal',
    'left_width_percent', 'left_background', 'right_background', 'check_color',
    'feature_background', 'feature_columns', 'background_color', 'padding_left', 'padding_right', 'font_size',
  ],
  platform_feature: ['title', 'description'],
  platform_device_tag: ['label'],
  course_hero_layout: ['left', 'right', 'layout_ratio', 'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size'],
  course_hero: [
    'breadcrumb', 'zenler_course_id', 'eyebrow', 'meta_items', 'language_label', 'tutor_name', 'tutor_role',
    'tutor_initials', 'stage_mode', 'stage_image', 'stage_caption_title', 'stage_caption_subtitle',
    'video_title', 'video_subtitle', 'video_duration', 'video_url', 'heading', 'description',
    'qualification_tags', 'pills', 'learn_section_label', 'learn_items',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  course_hero_right: [
    'pricing_layout', 'session_selector_label', 'cta_text_prefix', 'session_options',
    'section_label', 'price_now', 'price_was', 'price_save', 'price_access', 'price_note',
    'cta_text', 'cta_link', 'secondary_cta_text', 'secondary_cta_link', 'items',
    'show_best_value', 'best_value_tag', 'best_value_text', 'best_value_link_text', 'best_value_link',
    'show_reviews_summary', 'reviews_stars', 'reviews_label',
    'background_color', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'font_size',
  ],
  course_session_option: ['title', 'subtitle', 'price', 'badge', 'cta_suffix', 'cta_link', 'is_default'],
  course_hero_right_item: ['title'],
  feature_card_v2: ['title', 'description', 'cta_text', 'cta_link'],
  faq_item: ['question', 'answer_type', 'answer_paragraph'],
};

/** Storyblok MAPI expects many schema "number" fields as numeric strings, not JSON numbers. */
const STORYBLOK_NUMERIC_STRING_FIELDS = new Set([
  'padding_top',
  'padding_bottom',
  'padding_left',
  'padding_right',
  'font_size',
  'columns',
  'max_width',
  'percent',
  'rating',
]);

function coerceStoryblokNumericFields(blok: Record<string, unknown>): Record<string, unknown> {
  const next = { ...blok };
  for (const key of STORYBLOK_NUMERIC_STRING_FIELDS) {
    const value = next[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = String(value);
    }
  }
  return next;
}

const NESTED_BLOK_ARRAY_KEYS = [
  'hero', 'form', 'checks', 'items', 'cards', 'left', 'right', 'profiles', 'timeline', 'levels',
  'sessions', 'side_card', 'badges', 'papers', 'stats', 'rows',
  'benefits', 'meta_items', 'steps', 'topics', 'articles', 'ticks', 'card_rows', 'sidebar',
  'info_items', 'hours_rows', 'socials', 'tabs', 'blocks', 'checklist_items', 'table_rows',
  'toc_items', 'reach_figs', 'regions', 'submeta_items', 'rating_bars', 'left', 'right',
  'features', 'device_tags',
] as const;

function sanitizeNestedBlokArrays(blok: Record<string, unknown>): Record<string, unknown> {
  const next = { ...blok };
  for (const key of NESTED_BLOK_ARRAY_KEYS) {
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

export function sanitizeBlokForStoryblok(blok: Record<string, unknown>): Record<string, unknown> {
  const component = String(blok.component ?? '');
  const allow = BLOK_FIELD_ALLOWLIST[component];
  const next: Record<string, unknown> = {
    _uid: blok._uid,
    component,
  };

  if (!allow) {
    for (const [key, value] of Object.entries(blok)) {
      if (key.startsWith('migration_')) continue;
      next[key] = value;
    }
  } else {
    for (const key of allow) {
      if (blok[key] !== undefined) next[key] = blok[key];
    }
  }

  let sanitized = sanitizeNestedBlokArrays(next);

  if (component === 'promotion_section') {
    const title = String(sanitized.title ?? '').trim();
    sanitized = { ...sanitized, title: title || 'Get started' };
    if (sanitized.eyebrow === undefined) sanitized.eyebrow = '';
  }

  sanitized = coerceBlokRichtextFields(component, sanitized);
  return coerceStoryblokNumericFields(sanitized);
}

export function applyTemplateStyles(
  blueprint: MigrationTemplateBlueprint,
  sectionKey: string,
  blok: Record<string, unknown>,
): Record<string, unknown> {
  const section = blueprint.sections.find(item => item.key === sectionKey)
    ?? blueprint.sections.find(item => sectionKey.includes(item.key))
    ?? blueprint.sections[0];

  if (!section) return sanitizeBlokForStoryblok(blok);

  return sanitizeBlokForStoryblok({
    ...section.styles,
    ...blok,
    component: String(blok.component ?? section.component),
  });
}

export function buildPresetBlokFromSection(
  blueprint: MigrationTemplateBlueprint,
  section: TemplateSectionBlueprint,
): Record<string, unknown> {
  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const base: Record<string, unknown> = {
    _uid: uid,
    component: section.component,
    ...section.styles,
  };

  if (section.component === 'home_hero_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      hero: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'home_hero',
        heading: section.sampleHeading || 'Hero heading',
        description: section.sampleDescription || 'Hero description from template reference.',
      }],
    });
  }

  if (section.component === 'course_hero_layout') {
    const dualPriceTemplate = blueprint.template === 'course_dual_price'
      ? loadCourseTemplateFile('course_dual_price')
      : null;
    const right = dualPriceTemplate?.pricingLayout === 'session_selector'
      ? [buildHeroRightBlokFromTemplate(dualPriceTemplate)]
      : [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'course_hero_right',
        pricing_layout: 'standard',
        section_label: 'THIS COURSE INCLUDES',
        show_reviews_summary: true,
        reviews_stars: '★★★★★',
        reviews_label: 'Based on 308 reviews',
        items: [],
      }];

    return sanitizeBlokForStoryblok({
      ...base,
      left: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'course_hero',
        heading: section.sampleHeading || 'Course heading',
        description: section.sampleDescription || 'Course hero description from template reference.',
      }],
      right,
    });
  }

  if (section.component === 'course_introduction') {
    return sanitizeBlokForStoryblok({
      ...base,
      title: section.sampleHeading || section.label || 'Exam Paper Overview',
      paragraph_1: section.sampleDescription || '',
      read_more_label: 'Read more',
      read_less_label: 'Read less',
    });
  }

  if (section.component === 'course_tabs') {
    return sanitizeBlokForStoryblok({
      ...base,
      tabs: [],
    });
  }

  if (section.component === 'course_learn_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: "What you'll learn",
      heading_prefix: section.sampleHeading || section.label,
      heading_accent: '',
      items: [],
    });
  }

  if (section.component === 'course_curriculum') {
    return sanitizeBlokForStoryblok({
      ...base,
      course_id: 'COURSE',
      eyebrow: 'Course content',
      heading_prefix: section.sampleHeading || section.label,
      heading_accent: '',
    });
  }

  if (section.component === 'course_tutor_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: 'Your tutor',
      heading_prefix: section.sampleHeading || section.label,
      heading_accent: '',
      stats: [],
    });
  }

  if (section.component === 'promotion_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      name: `${blueprint.template}/${section.key}`,
      title: section.sampleHeading || section.label || 'Ready to get started?',
      subtitle: section.sampleDescription || 'Use this preset across pages and update styling once in the component library.',
      cta_text: 'Enrol Now',
    });
  }

  if (section.component === 'faq_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      title: section.sampleHeading || 'Frequently Asked Questions',
      icon: '❔',
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      items: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'faq_item',
        answer_type: 'paragraph',
        question: 'Add your first question here',
        answer_paragraph: section.sampleDescription || 'Content managers can update FAQ answers after migration.',
      }],
    });
  }

  if (section.component === 'testimonials') {
    const isCourseTemplate = isCoursePageTemplate(blueprint.template);
    return sanitizeBlokForStoryblok({
      ...base,
      layout: isCourseTemplate ? 'trustpilot' : 'course_reviews',
      trustpilot_embed: isCourseTemplate ? DEFAULT_TRUSTPILOT_CAROUSEL_EMBED : undefined,
      eyebrow: section.label,
      title_prefix: section.sampleHeading || 'What students say',
      subtitle: section.sampleDescription || '',
      cards: isCourseTemplate ? undefined : [],
    });
  }

  if (section.component === 'feature_cards_v2') {
    return sanitizeBlokForStoryblok({
      ...base,
      section_title: section.sampleHeading || section.label,
      section_description: section.sampleDescription || '',
      cards: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'feature_card_v2',
        title: section.sampleHeading || section.label,
        description: section.sampleDescription || 'Content managers can update this card after migration.',
        cta_text: 'Learn more',
      }],
    });
  }

  if (section.component === 'enquiry_form') {
    return sanitizeBlokForStoryblok(base);
  }

  if (section.component === 'page_hero') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: 'Who we are',
      heading_prefix: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      primary_cta_text: 'Meet the team',
      secondary_cta_text: 'Browse all courses',
      items: [],
      side_card: [],
      badges: [],
    });
  }

  if (section.component === 'stats_band') {
    return sanitizeBlokForStoryblok({
      ...base,
      background_color: '#FFFFFF',
      padding_top: 0,
      padding_bottom: 34,
      items: [
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'stat_item', value: '7,500+', label: 'Active students worldwide' },
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'stat_item', value: '20+', label: 'Years of teaching expertise' },
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'stat_item', value: '40+', label: 'Courses across ACCA, CIMA, CMA & CIA' },
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'stat_item', value: '98%', label: 'Student satisfaction rate' },
      ],
    });
  }

  if (section.component === 'content_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      body: section.sampleDescription || '',
      timeline: [],
    });
  }

  if (section.component === 'global_reach_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      reach_figs: [],
      cta_text: 'Browse all courses',
      regions: [],
    });
  }

  if (section.component === 'icon_card_grid') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      columns: 3,
      cards: [],
    });
  }

  if (section.component === 'team_profiles') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      profiles: [],
    });
  }

  if (section.component === 'quote_block') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      quote: section.sampleDescription || section.sampleHeading || 'Great potential for people committed to building with us.',
      author_name: 'Vertex Learning Solutions',
      author_role: 'Leadership',
      author_initials: 'V',
    });
  }

  if (section.component === 'qualification_structure') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      levels: [],
    });
  }

  if (section.component === 'live_schedule') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      sessions: [],
    });
  }

  if (section.component === 'contact_cards') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      cards: [],
    });
  }

  if (section.component === 'book_meeting_hero') {
    return sanitizeBlokForStoryblok({
      ...base,
      free_pill: 'Free 15-minute call',
      heading_prefix: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      benefits: [],
      meta_items: [],
      scheduler_title: 'Book your session',
      scheduler_subtitle: 'Choose a time that works for you.',
      scheduler_placeholder_heading: 'Scheduler coming soon',
      scheduler_placeholder_text: 'Embed your booking calendar link here.',
      scheduler_cta_text: 'Book now',
    });
  }

  if (section.component === 'step_cards') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      steps: [],
    });
  }

  if (section.component === 'article_library') {
    return sanitizeBlokForStoryblok({
      ...base,
      sidebar_label: 'Currently viewing',
      sidebar_value: section.label,
      topics: [],
      note_text: section.sampleDescription || '',
    });
  }

  if (section.component === 'hero_with_video') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      primary_cta_text: 'Browse all courses',
      secondary_cta_text: 'Book a free meeting',
      video_url: 'https://vimeo.com/1174159520',
      video_title: 'Course introduction',
    });
  }

  if (section.component === 'two_column_platform') {
    return sanitizeBlokForStoryblok({
      ...base,
      left_eyebrow: section.label,
      left_title: section.sampleHeading || section.label,
      left_description: section.sampleDescription || '',
      right_title: 'Everything included in your course',
      features: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'platform_feature',
        title: 'HD lecture videos',
        description: 'Optimised streaming, always available',
      }],
      device_tags: [
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'platform_device_tag', label: 'Desktop' },
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'platform_device_tag', label: 'Mobile' },
        { _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12), component: 'platform_device_tag', label: 'Tablet' },
      ],
      cta_text: 'Browse all courses',
    });
  }

  if (section.component === 'live_sessions_hero') {
    return sanitizeBlokForStoryblok({
      ...base,
      free_pill: 'Free live sessions',
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      ticks: [],
      primary_cta_text: 'View schedule',
      card_tag: 'Live now',
      card_title: 'Upcoming session',
      card_rows: [],
    });
  }

  if (section.component === 'live_sessions_table') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: section.label,
      heading_prefix: section.sampleHeading || section.label,
      description: section.sampleDescription || '',
      sessions: [],
    });
  }

  if (section.component === 'contact_page_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      form: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'contact_form',
        form_title: section.sampleHeading || 'Send us a message',
        submit_text: 'Send message',
        thank_you_title: 'Message sent!',
        thank_you_description: 'Thank you for reaching out. We will be in touch within 1 working day.',
      }],
      sidebar: [],
    });
  }

  if (section.component === 'legal_hero') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: 'Legal',
      heading: section.sampleHeading || section.label,
      lead: section.sampleDescription || '',
      meta_items: [],
      tabs: [],
    });
  }

  if (section.component === 'legal_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      anchor_id: section.sampleHeading
        ? section.sampleHeading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : section.key,
      heading: section.sampleHeading || section.label,
      body: section.sampleDescription || '',
      checklist_items: [],
      table_rows: [],
    });
  }

  if (section.component === 'legal_article') {
    return sanitizeBlokForStoryblok({
      ...base,
      toc_title: 'On this page',
      intro: section.sampleDescription || '',
      intro_callout_heading: 'The short version',
      intro_callout_items: [],
      toc_items: [],
    });
  }

  return sanitizeBlokForStoryblok({
    ...base,
    eyebrow: section.label,
    heading_prefix: section.sampleHeading || section.label,
    body: section.sampleDescription || 'Content section preset from HTML template reference.',
  });
}

export { TEMPLATE_FILES };
