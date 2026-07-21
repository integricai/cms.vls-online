import { getMigrationTemplateBlueprint } from '../src/services/migrationTemplateRegistry';
import { getTemplateFileSections, resolveTemplateSections } from '../src/services/pageSectionExtractor';
import { buildBlokFromTemplateSection } from '../src/services/pageContentBuilder';
import type { MigrationTemplate } from '../shared/migrationTypes';

const TEMPLATES: MigrationTemplate[] = [
  'home', 'course', 'legal', 'about_us', 'landing', 'team_vls',
  'schedules', 'course_articles', 'live_sessions', 'book_meeting', 'contact_us',
  'study_notes', 'course_listing', 'course_dual_price',
];

function nestedCount(blok: Record<string, unknown> | null): string {
  if (!blok) return 'NULL';
  const keys = [
    'items', 'cards', 'timeline', 'profiles', 'steps', 'sessions', 'levels',
    'topics', 'reach_figs', 'regions', 'side_card', 'badges', 'tabs',
    'toc_items', 'intro_callout_items', 'checklist_items', 'table_rows',
    'benefits', 'meta_items', 'form', 'sidebar',
  ];
  const parts: string[] = [];
  for (const key of keys) {
    const value = blok[key];
    if (Array.isArray(value) && value.length) parts.push(`${key}=${value.length}`);
  }
  return parts.length ? parts.join(', ') : '—';
}

async function main() {
  for (const template of TEMPLATES) {
    const blueprint = getMigrationTemplateBlueprint(template);
    const sections = getTemplateFileSections(template);
    const byKey = resolveTemplateSections(template, []);

    console.log(`\n=== ${template} (${blueprint.fileName}) — ${blueprint.sections.length} blueprint sections ===`);

    for (const section of blueprint.sections) {
      const extracted = byKey.get(section.key);
      const blok = buildBlokFromTemplateSection(section, extracted, {
        sourceUrl: 'https://vls-online.com/',
        title: 'Test',
        metaDescription: 'Test',
        breadcrumbItems: [],
        sections: [],
        templateSections: sections,
        faq: null,
      }, { allowTemplateFallback: ['study_notes', 'course_listing'].includes(template) }) as Record<string, unknown> | null;

      const eyebrow = String(blok?.eyebrow ?? extracted?.eyebrow ?? '').slice(0, 28);
      const heading = String(blok?.heading_prefix ?? blok?.title ?? blok?.heading ?? extracted?.headingPrefix ?? '').slice(0, 40);
      console.log(
        `  ${section.key.padEnd(22)} ${section.component.padEnd(24)} nested: ${nestedCount(blok).padEnd(28)} eyebrow: ${eyebrow || '—'}  heading: ${heading || '—'}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
