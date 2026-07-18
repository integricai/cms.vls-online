import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { getStoryById, listStories, type StoryblokConfig } from '../src/services/storyblokClient';

async function main() {
  const config: StoryblokConfig = {
    spaceId: process.env.STORYBLOK_SPACE_ID?.trim() || '293626385802926',
    accessToken: process.env.STORYBLOK_PERSONAL_TOKEN?.trim() || '',
    region: process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu',
  };

  const stories = await listStories(config, { starts_with: 'courses/', per_page: 100 });
  for (const ref of stories.filter(story => !story.is_folder && story.full_slug !== 'courses')) {
    const story = await getStoryById(config, ref.id);
    const body = Array.isArray(story?.content?.body) ? story.content.body : [];
    const testimonials = body.find(
      (blok): blok is Record<string, unknown> =>
        Boolean(blok) && typeof blok === 'object' && (blok as Record<string, unknown>).component === 'testimonials',
    );
    if (!testimonials) {
      console.log(`${ref.full_slug} => NO TESTIMONIALS`);
      continue;
    }
    const embed = String(testimonials.trustpilot_embed ?? '');
    const templateMatch = embed.match(/data-template-id="([^"]+)"/);
    console.log(`${ref.full_slug} => layout=${String(testimonials.layout ?? '')} template=${templateMatch?.[1] ?? 'none'} embedLen=${embed.length}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
