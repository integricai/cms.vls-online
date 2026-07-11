import { scrapeGenericPage } from '../src/services/pageScraper';
import { getMigrationTemplateBlueprint } from '../src/services/migrationTemplateRegistry';
import { buildBlokFromTemplateSection } from '../src/services/pageContentBuilder';
import { resolveTemplateSections } from '../src/services/pageSectionExtractor';

async function main() {
  const scraped = await scrapeGenericPage('https://vls-online.com/about-us');
  const template = 'about_us' as const;
  const blueprint = getMigrationTemplateBlueprint(template);
  const byKey = resolveTemplateSections(template, scraped.templateSections);

  console.log('live templateSections:', scraped.templateSections.length);
  console.log('resolved sections:', byKey.size);

  for (const section of blueprint.sections) {
    const extracted = byKey.get(section.key);
    const blok = buildBlokFromTemplateSection(section, extracted, scraped) as Record<string, unknown> | null;
    if (!blok) continue;
    const nested = Array.isArray(blok.items) ? blok.items.length
      : Array.isArray(blok.cards) ? blok.cards.length
      : Array.isArray(blok.timeline) ? blok.timeline.length
      : 0;
    console.log(
      section.key,
      blok.component,
      'heading:', String(blok.heading_prefix ?? '').slice(0, 40),
      'lead/body:', String(blok.lead ?? blok.body ?? blok.description ?? '').slice(0, 40),
      'nested:', nested,
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
