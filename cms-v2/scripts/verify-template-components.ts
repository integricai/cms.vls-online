/**
 * Verify template blueprints, extractors, and Storyblok component coverage.
 *
 * Usage:
 *   npx tsx scripts/verify-template-components.ts
 */
import fs from 'fs';
import path from 'path';
import type { MigrationTemplate } from '../shared/migrationTypes';
import { isCoursePageTemplate } from '../shared/migrationDestination';
import { listMigrationTemplateBlueprints } from '../src/services/migrationTemplateRegistry';
import { getTemplateFileSections } from '../src/services/pageSectionExtractor';
import { buildBlokFromTemplateSection } from '../src/services/pageContentBuilder';

const TEMPLATES: MigrationTemplate[] = [
  'home',
  'course',
  'legal',
  'about_us',
  'landing',
  'team_vls',
  'schedules',
  'course_articles',
  'live_sessions', 'book_meeting', 'contact_us', 'study_notes', 'course_listing', 'course_dual_price', 'qualification_level_page', 'revision_course',
];

const RENDERERS = new Set(
  [...fs.readFileSync(
    path.resolve(process.cwd(), '../../vls-online-v2/vls-web/components/storyblok/StoryblokBloks.tsx'),
    'utf8',
  ).matchAll(/case "([^"]+)"/g)].map(match => match[1]),
);

const SCHEMAS = new Set(
  fs.readdirSync(path.resolve(process.cwd(), '../../vls-online-v2/storyblok/components'))
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace('.json', '')),
);

const PAGE_WHITELIST = new Set(
  JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), '../../vls-online-v2/storyblok/components/page.json'),
    'utf8',
  )).schema.body.component_whitelist as string[],
);

const COURSE_PAGE_WHITELIST = new Set(
  JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), '../../vls-online-v2/storyblok/components/course_page.json'),
    'utf8',
  )).schema.body.component_whitelist as string[],
);

function assert(condition: boolean, message: string, errors: string[]): void {
  if (!condition) errors.push(message);
}

async function main() {
  const errors: string[] = [];
  const blueprints = listMigrationTemplateBlueprints().filter(bp => TEMPLATES.includes(bp.template));

  for (const blueprint of blueprints) {
    const sections = getTemplateFileSections(blueprint.template);
    const sectionMap = new Map(sections.map(section => [section.key, section]));

    for (const section of blueprint.sections) {
      const whitelist = isCoursePageTemplate(blueprint.template) ? COURSE_PAGE_WHITELIST : PAGE_WHITELIST;
      assert(SCHEMAS.has(section.component), `${blueprint.template}/${section.key}: missing schema ${section.component}`, errors);
      assert(RENDERERS.has(section.component), `${blueprint.template}/${section.key}: missing renderer ${section.component}`, errors);
      assert(whitelist.has(section.component), `${blueprint.template}/${section.key}: not in ${isCoursePageTemplate(blueprint.template) ? 'course_page' : 'page'}.body whitelist ${section.component}`, errors);

      const extracted = sectionMap.get(section.key)
        ?? sections.find(item => item.key === section.key)
        ?? sections.find(item => section.key.includes(item.key));
      const blok = buildBlokFromTemplateSection(section, extracted, {
        sourceUrl: 'https://vls-online.com/',
        title: 'Test page',
        metaDescription: 'Test description',
        templateSections: sections,
        faq: null,
      }, { allowTemplateFallback: ['study_notes', 'course_listing'].includes(blueprint.template) });

      if (section.component !== 'faq_section' && section.key !== 'course-tabs') {
        assert(Boolean(blok), `${blueprint.template}/${section.key}: buildBlokFromTemplateSection returned null`, errors);
      }
    }

    if (blueprint.template === 'legal') {
      assert(
        blueprint.sections.some(section => section.component === 'legal_article'),
        'legal template missing legal_article blueprint section',
        errors,
      );
      const legalSectionKeys = blueprint.sections.filter(section => section.component === 'legal_section').map(section => section.key);
      assert(
        new Set(legalSectionKeys).size === legalSectionKeys.length,
        `legal template has duplicate legal_section keys: ${legalSectionKeys.join(', ')}`,
        errors,
      );
    }
  }

  if (errors.length) {
    console.error('Verification failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Verified ${blueprints.length} templates, ${blueprints.reduce((sum, bp) => sum + bp.sections.length, 0)} sections.`);
  console.log(`Schemas: ${SCHEMAS.size}, renderers: ${RENDERERS.size}, page whitelist: ${PAGE_WHITELIST.size}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
