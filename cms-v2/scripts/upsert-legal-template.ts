import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { scrapeGenericPage } from '../src/services/pageScraper';
import { buildGenericStoryblokContentAsync } from '../src/services/courseMigrationService';
import { upsertStory } from '../src/services/storyblokClient';

async function main() {
  const token = process.env.STORYBLOK_PERSONAL_TOKEN;
  const spaceId = process.env.STORYBLOK_SPACE_ID || '293626385802926';
  if (!token) {
    throw new Error('STORYBLOK_PERSONAL_TOKEN missing in vls-web/.env.local');
  }

  const config = {
    spaceId,
    accessToken: token,
    region: (process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu') as 'eu' | 'us',
  };

  const scraped = await scrapeGenericPage('https://vls-online.com/privacy-policy', 'legal');
  const content = await buildGenericStoryblokContentAsync(scraped, 'legal', null, config);

  const body = Array.isArray(content.body) ? content.body as Array<Record<string, unknown>> : [];
  for (const blok of body) {
    const component = String(blok.component);
    if (component === 'legal_hero') {
      console.log('legal_hero meta=', Array.isArray(blok.meta_items) ? blok.meta_items.length : 0,
        'tabs=', Array.isArray(blok.tabs) ? blok.tabs.length : 0);
    }
    if (component === 'legal_article') {
      const sections = Array.isArray(blok.sections) ? blok.sections : [];
      console.log('legal_article toc=', Array.isArray(blok.toc_items) ? blok.toc_items.length : 0,
        'callout=', Array.isArray(blok.intro_callout_items) ? blok.intro_callout_items.length : 0,
        'sections=', sections.length);
      const tableSection = sections.find((section) => Array.isArray((section as Record<string, unknown>).table_rows)
        && ((section as Record<string, unknown>).table_rows as unknown[]).length);
      const rightsSection = sections.find((section) => Array.isArray((section as Record<string, unknown>).checklist_items)
        && ((section as Record<string, unknown>).checklist_items as unknown[]).length);
      if (tableSection) {
        console.log('  table_rows=', ((tableSection as Record<string, unknown>).table_rows as unknown[]).length);
      }
      if (rightsSection) {
        console.log('  checklist_items=', ((rightsSection as Record<string, unknown>).checklist_items as unknown[]).length);
      }
    }
  }

  const slug = 'privacy-policy';
  const result = await upsertStory(config, {
    name: 'Privacy Policy | Vertex Learning Solutions',
    slug,
    fullSlug: slug,
    content,
    publish: true,
  });

  console.log('Upserted:', result.story.full_slug, 'id=', result.story.id, 'created=', result.created);
  console.log('Preview:', result.previewUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
