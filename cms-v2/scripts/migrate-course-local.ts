/**
 * Scrape a live course page and optionally push to Storyblok — runs locally,
 * bypassing Vercel server-side fetch issues (502 from Cloudflare/Zenler).
 *
 * Preview only:
 *   npx ts-node scripts/migrate-course-local.ts --url https://vls-online.com/courses/fa2 --dry-run
 *
 * Migrate to Storyblok (requires STORYBLOK_PERSONAL_TOKEN in .env.local):
 *   npx ts-node scripts/migrate-course-local.ts --url https://vls-online.com/courses/fa2 --publish
 */
import 'dotenv/config';
import { scrapeCoursePage } from '../src/services/coursePageScraper';
import { migrateCoursePage } from '../src/services/courseMigrationService';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const pageUrl = argValue('--url') ?? (process.argv[2]?.startsWith('http') ? process.argv[2] : undefined);
const dryRun = process.argv.includes('--dry-run');
const publish = process.argv.includes('--publish');

if (!pageUrl) {
  console.error('Usage: npx ts-node scripts/migrate-course-local.ts --url <course-page-url> [--dry-run] [--publish]');
  process.exit(1);
}

async function main() {
  const url = pageUrl!;

  if (dryRun) {
    const scraped = await scrapeCoursePage(url);
    console.log(JSON.stringify(scraped, null, 2));
    console.log('\nWarnings:');
    if (!scraped.hero) console.log('- Hero not detected');
    if (!scraped.tabs.length) console.log('- Tabs not detected');
    if (!scraped.faq?.items.length) console.log('- FAQ not detected');
    return;
  }

  const token = process.env.STORYBLOK_PERSONAL_TOKEN?.trim();
  const spaceId = process.env.STORYBLOK_SPACE_ID?.trim() ?? '293626385802926';
  if (!token) {
    console.error('STORYBLOK_PERSONAL_TOKEN is required in cms-v2/.env.local');
    process.exit(1);
  }

  const result = await migrateCoursePage({
    pageUrl: url,
    storyblokSpaceId: spaceId,
    storyblokAccessToken: token,
    storyblokRegion: 'eu',
    publish,
    dryRun: false,
  });

  console.log(`Done: courses/${result.scraped.slug}`);
  if (result.storyblok) {
    console.log(`Storyblok: ${result.storyblok.fullSlug} (id ${result.storyblok.storyId})`);
    console.log(`Preview: ${result.storyblok.previewUrl}`);
  }
  if (result.warnings.length) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
