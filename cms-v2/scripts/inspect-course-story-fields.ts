import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { getStoryById, listStories, type StoryblokConfig } from '../src/services/storyblokClient';

async function main() {
  const slug = process.argv[2] || 'courses/afm';
  const config: StoryblokConfig = {
    spaceId: process.env.STORYBLOK_SPACE_ID?.trim() || '293626385802926',
    accessToken: process.env.STORYBLOK_PERSONAL_TOKEN?.trim() || '',
    region: process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu',
  };

  const stories = await listStories(config, { with_slug: slug });
  const story = stories[0] ? await getStoryById(config, stories[0].id) : null;
  if (!story?.content) {
    console.log('Story not found');
    return;
  }

  console.log('zenler_course_id:', story.content.zenler_course_id);
  const body = Array.isArray(story.content.body) ? story.content.body : [];
  for (const blok of body) {
    if (!blok || typeof blok !== 'object') continue;
    const record = blok as Record<string, unknown>;
    if (record.component === 'course_curriculum') {
      console.log('curriculum course_id:', record.course_id);
    }
    if (record.component === 'course_tutor_section') {
      console.log('tutor name:', record.name);
    }
  }
}

main().catch(console.error);
