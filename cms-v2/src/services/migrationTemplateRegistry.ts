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

function componentForSection(key: string, classes: string[], template: MigrationTemplate): string {
  if (template === 'home' && key.includes('hero')) return 'home_hero_section';
  if (template === 'course' && key.includes('hero')) return 'course_hero_layout';
  if (template === 'form' && (key.includes('touch') || key.includes('form'))) return 'enquiry_form';
  if (classes.includes('faq') || key.includes('faq')) return 'faq_section';
  if (key.includes('review') || key.includes('testimonial')) return 'testimonials';
  if (key.includes('cta')) return 'promotion_section';
  if (key.includes('course') && template === 'home') return 'feature_cards_v2';
  if (key.includes('toolkit') || key.includes('feature')) return 'feature_cards_v2';
  if (classes.includes('band')) return 'content_cta_block';
  return SECTION_COMPONENT[key.split('-')[0]] ?? 'content_cta_block';
}

function stylesForSection(classes: string[], tokens: TemplateDesignTokens): Record<string, string | number> {
  const isBand = classes.includes('band');
  const isHero = classes.includes('hero') || classes.includes('legal-hero');
  const isCta = classes.includes('cta-band') || classes.includes('cta-panel');

  if (isCta) {
    return {
      background_color: tokens.blue50,
      button_background: tokens.blue,
      padding_top: 72,
      padding_bottom: 72,
      cta_background: tokens.blue,
      cta_text_color: tokens.white,
      heading_accent_color: tokens.blue,
      eyebrow_color: tokens.blue,
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
  const commentPattern = /<!--\s*([^=][^>-][\s\S]*?)\s*-->/gi;
  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;

  const commentMatches = [...html.matchAll(commentPattern)]
    .map(match => ({
      index: match.index ?? 0,
      label: match[1].trim(),
      key: sectionKeyFromComment(match[1]),
    }))
    .filter(item => !/header|footer/i.test(item.label));

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
      component: componentForSection(key, classes, template),
      classes,
      isBand: classes.includes('band'),
      styles: stylesForSection(classes, tokens),
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
      styles: stylesForSection(['section'], tokens),
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

export function applyTemplateStyles(
  blueprint: MigrationTemplateBlueprint,
  sectionKey: string,
  blok: Record<string, unknown>,
): Record<string, unknown> {
  const section = blueprint.sections.find(item => item.key === sectionKey)
    ?? blueprint.sections.find(item => sectionKey.includes(item.key))
    ?? blueprint.sections[0];

  if (!section) return blok;

  return {
    ...section.styles,
    ...blok,
    migration_template: blueprint.template,
    migration_section: section.key,
    migration_library_ref: `component-library/${blueprint.template}/${section.key}`,
  };
}

export function buildPresetBlokFromSection(
  blueprint: MigrationTemplateBlueprint,
  section: TemplateSectionBlueprint,
): Record<string, unknown> {
  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const base: Record<string, unknown> = {
    _uid: uid,
    component: section.component,
    migration_template: blueprint.template,
    migration_section: section.key,
    migration_library_ref: `component-library/${blueprint.template}/${section.key}`,
    ...section.styles,
  };

  if (section.component === 'home_hero_section') {
    return {
      ...base,
      hero: [{
        _uid: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        component: 'home_hero',
        heading: section.sampleHeading || 'Hero heading',
        description: section.sampleDescription || 'Hero description from template reference.',
      }],
    };
  }

  if (section.component === 'course_hero_layout') {
    return {
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
    };
  }

  if (section.component === 'promotion_section') {
    return {
      ...base,
      name: `${blueprint.template}/${section.key}`,
      title: section.sampleHeading || 'Ready to get started?',
      subtitle: section.sampleDescription || 'Use this preset across pages and update styling once in the component library.',
      cta_text: 'Enrol Now',
    };
  }

  if (section.component === 'faq_section') {
    return {
      ...base,
      title: section.sampleHeading || 'Frequently Asked Questions',
      icon: '❔',
      items: [],
    };
  }

  if (section.component === 'testimonials') {
    return {
      ...base,
      title_prefix: section.sampleHeading || 'What students say',
      subtitle: section.sampleDescription || '',
      cards: [],
    };
  }

  if (section.component === 'feature_cards_v2') {
    return {
      ...base,
      title: section.sampleHeading || section.label,
      cards: [],
    };
  }

  if (section.component === 'enquiry_form') {
    return base;
  }

  return {
    ...base,
    eyebrow: section.label,
    heading_prefix: section.sampleHeading || section.label,
    description: section.sampleDescription || 'Content section preset from HTML template reference.',
    cta_text: 'Learn more',
  };
}

export { TEMPLATE_FILES };
