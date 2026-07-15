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

  const scraped = await scrapeGenericPage('https://vls-online.com/aboutacca', 'landing');
  const content = await buildGenericStoryblokContentAsync(scraped, 'landing', null, config);

  const body = Array.isArray(content.body) ? content.body as Array<Record<string, unknown>> : [];
  for (const blok of body) {
    const component = String(blok.component);
    if (component === 'page_hero') {
      console.log('hero items', Array.isArray(blok.items) ? blok.items.length : 0,
        'side_card rows', Array.isArray((blok.side_card as unknown[])?.[0] && (blok.side_card as Array<Record<string, unknown>>)[0]?.rows)
          ? ((blok.side_card as Array<Record<string, unknown>>)[0].rows as unknown[]).length
          : 0);
    }
    if (component === 'qualification_structure') {
      console.log('levels', Array.isArray(blok.levels) ? blok.levels.length : 0);
    }
    if (component === 'icon_card_grid') {
      console.log(String(blok.eyebrow).slice(0, 30), 'variant', blok.card_variant,
        'cards', Array.isArray(blok.cards) ? blok.cards.length : 0);
    }
  }

  const slug = 'aboutacca';
  const result = await upsertStory(config, {
    name: 'About ACCA | Vertex Learning Solutions',
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
