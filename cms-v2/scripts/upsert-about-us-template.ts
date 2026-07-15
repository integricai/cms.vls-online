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

  const scraped = await scrapeGenericPage('https://vls-online.com/about-us', 'about_us');
  const content = await buildGenericStoryblokContentAsync(scraped, 'about_us', null, config);

  const body = Array.isArray(content.body) ? content.body as Array<Record<string, unknown>> : [];
  console.log('Sections:', body.map((blok) => {
    const nested = Array.isArray(blok.items) ? blok.items.length
      : Array.isArray(blok.cards) ? blok.cards.length
      : Array.isArray(blok.timeline) ? blok.timeline.length
      : Array.isArray(blok.reach_figs) ? blok.reach_figs.length
      : Array.isArray(blok.regions) ? blok.regions.length
      : 0;
    return `${blok.component} nested=${nested} eyebrow=${String(blok.eyebrow ?? '').slice(0, 20)}`;
  }).join('\n'));

  const slug = 'about-us';
  const result = await upsertStory(config, {
    name: 'About Us | Vertex Learning Solutions',
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
