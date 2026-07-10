import fs from 'fs';
import path from 'path';
import type { MigrationTemplate } from '../../shared/migrationTypes';
import type {
  MigrationTemplateBlueprint,
  TemplateDesignTokens,
  TemplateSectionBlueprint,
} from '../../shared/migrationTemplateTypes';
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
  hero: 'content_cta_block',
  'legal-hero': 'content_cta_block',
  section: 'content_cta_block',
  band: 'content_cta_block',
  'cta-band': 'promotion_section',
  faq: 'faq_section',
  testimonials: 'testimonials',
  reviews: 'testimonials',
  courses: 'feature_cards_v2',
  stats: 'content_cta_block',
  toolkit: 'feature_cards_v2',
  schedule: 'content_cta_block',
  team: 'content_cta_block',
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
]);

function componentForSection(key: string, classes: string[], template: MigrationTemplate): string {
  let component = 'content_cta_block';
  if (template === 'home' && key.includes('hero')) component = 'home_hero_section';
  else if (template === 'course' && key.includes('hero')) component = 'course_hero_layout';
  else if ((template === 'form' || template === 'about_us') && (key.includes('touch') || key.includes('form'))) {
    component = 'enquiry_form';
  } else if (classes.includes('faq') || key.includes('faq')) component = 'faq_section';
  else if (key.includes('review') || key.includes('testimonial')) component = 'testimonials';
  else if (key.includes('cta')) component = 'promotion_section';
  else if (key.includes('course') && template === 'home') component = 'feature_cards_v2';
  else if (key.includes('toolkit') || key.includes('feature')) component = 'feature_cards_v2';
  else if (classes.includes('band')) component = 'content_cta_block';
  else component = SECTION_COMPONENT[key.split('-')[0]] ?? 'content_cta_block';

  // Generic pages use the `page` root type whose body whitelist is stricter than course_page.
  if (template !== 'course' && !PAGE_BODY_COMPONENTS.has(component)) {
    return 'content_cta_block';
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

  if (component === 'promotion_section' || isCta) {
    return {
      background_color: tokens.blue50,
      button_background: tokens.blue,
      padding_top: 72,
      padding_bottom: 72,
    };
  }

  if (isHero) {
    return {
      background_color: tokens.blue50,
      padding_top: 48,
      padding_bottom: 56,
      heading_accent_color: tokens.blue,
      eyebrow_color: tokens.blue,
      cta_background: tokens.blue,
      cta_text_color: tokens.white,
    };
  }

  return {
    background_color: isBand ? tokens.blue50 : tokens.white,
    padding_top: 60,
    padding_bottom: 60,
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
    const label = nearestComment?.label ?? key;
    const component = componentForSection(key, classes, template);
    const heading = stripTags(inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
      ?? '');
    const description = stripTags(
      inner.match(/<p[^>]*class="[^"]*(?:hero-lead|lead|hero-sub)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? '',
    );

    sections.push({
      key,
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

  return sections;
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
    sections: parseSections(html, tokens, template),
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
    'name', 'title', 'subtitle', 'cta_text', 'cta_link',
    'background_color', 'button_background',
    'padding_left', 'padding_right', 'padding_top', 'padding_bottom', 'font_size',
  ],
  home_hero_section: ['hero', 'form', 'background_color', 'padding_top', 'padding_bottom'],
  enquiry_form: ['title', 'subtitle', 'background_color', 'padding_top', 'padding_bottom'],
  faq_section: ['title', 'icon', 'items', 'schema_id', 'background_color', 'padding_top', 'padding_bottom'],
  testimonials: [
    'eyebrow', 'title_prefix', 'title_accent', 'subtitle', 'cards',
    'background_color', 'padding_top', 'padding_bottom',
  ],
  feature_cards_v2: ['title', 'subtitle', 'cards', 'background_color', 'padding_top', 'padding_bottom'],
};

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
    return next;
  }

  for (const key of allow) {
    if (blok[key] !== undefined) next[key] = blok[key];
  }

  // Nested bloks
  for (const key of ['hero', 'form', 'checks', 'items', 'cards', 'left', 'right']) {
    const value = next[key];
    if (!Array.isArray(value)) continue;
    next[key] = value.map(item => (
      item && typeof item === 'object'
        ? sanitizeBlokForStoryblok(item as Record<string, unknown>)
        : item
    ));
  }

  if (component === 'promotion_section') {
    const title = String(next.title ?? '').trim();
    next.title = title || 'Get started';
  }

  return next;
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
    return sanitizeBlokForStoryblok({
      ...base,
      left: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'course_hero',
        heading: section.sampleHeading || 'Course heading',
        description: section.sampleDescription || 'Course hero description from template reference.',
      }],
      right: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'course_hero_right',
        section_label: 'THIS COURSE INCLUDES',
        items: [],
      }],
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
      items: [],
    });
  }

  if (section.component === 'testimonials') {
    return sanitizeBlokForStoryblok({
      ...base,
      title_prefix: section.sampleHeading || 'What students say',
      subtitle: section.sampleDescription || '',
      cards: [],
    });
  }

  if (section.component === 'feature_cards_v2') {
    return sanitizeBlokForStoryblok({
      ...base,
      title: section.sampleHeading || section.label,
      cards: [],
    });
  }

  if (section.component === 'enquiry_form') {
    return sanitizeBlokForStoryblok(base);
  }

  return sanitizeBlokForStoryblok({
    ...base,
    eyebrow: section.label,
    heading_prefix: section.sampleHeading || section.label,
    description: section.sampleDescription || 'Content section preset from HTML template reference.',
    cta_text: 'Learn more',
  });
}

export { TEMPLATE_FILES };
