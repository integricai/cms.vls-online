import { scrapeGenericPage } from '../src/services/pageScraper';
import { getMigrationTemplateBlueprint } from '../src/services/migrationTemplateRegistry';

async function main() {
  const scraped = await scrapeGenericPage('https://vls-online.com/teamvls');
  const blueprint = getMigrationTemplateBlueprint('team_vls');
  console.log('scraped sections:', scraped.sections.length);
  console.log('blueprint sections:', blueprint.sections.length);
  for (let i = 0; i < blueprint.sections.length; i += 1) {
    const s = blueprint.sections[i];
    const scrapedSection = scraped.sections[i];
    console.log(`${i}: ${s.key} -> ${s.component} | scraped: ${scrapedSection?.heading?.slice(0, 50) ?? '(none)'}`);
  }
}

main().catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});
