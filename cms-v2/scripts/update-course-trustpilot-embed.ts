import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { DEFAULT_TRUSTPILOT_CAROUSEL_EMBED, patchCourseTrustpilotEmbed } from '../shared/trustpilotDefaults';
import {
  getStoryById,
  listStories,
  type StoryblokConfig,
  updateStoryById,
} from '../src/services/storyblokClient';

async function main() {
  const token = process.env.STORYBLOK_PERSONAL_TOKEN?.trim();
  const spaceId = process.env.STORYBLOK_SPACE_ID?.trim() || '293626385802926';
  const publish = process.argv.includes('--publish');
  const dryRun = process.argv.includes('--dry-run');

  if (!token) {
    throw new Error('STORYBLOK_PERSONAL_TOKEN missing in vls-web/.env.local');
  }

  const config: StoryblokConfig = {
    spaceId,
    accessToken: token,
    region: process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu',
  };

  const stories = await listStories(config, {
    starts_with: 'courses/',
    per_page: 100,
  });

  const courseStories = stories.filter(story => !story.is_folder && story.full_slug !== 'courses');
  console.log(`Found ${courseStories.length} course stories under courses/`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const ref of courseStories) {
    const story = await getStoryById(config, ref.id);
    if (!story?.content || story.content.component !== 'course_page') {
      skippedCount += 1;
      console.log(`- skip ${ref.full_slug} (not a course_page story)`);
      continue;
    }

    const content = structuredClone(story.content) as Record<string, unknown>;
    const changed = patchCourseTrustpilotEmbed(content, DEFAULT_TRUSTPILOT_CAROUSEL_EMBED);
    if (!changed) {
      skippedCount += 1;
      console.log(`- skip ${ref.full_slug} (already carousel)`);
      continue;
    }

    if (dryRun) {
      updatedCount += 1;
      console.log(`~ dry-run ${ref.full_slug}`);
      continue;
    }

    try {
      await updateStoryById(config, story.id, {
        name: story.name,
        slug: story.slug,
        parentId: undefined,
        content,
        publish,
      });
      updatedCount += 1;
      console.log(`✓ updated ${ref.full_slug}${publish ? ' (published)' : ''}`);
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ failed ${ref.full_slug}: ${message.split('\n')[0]}`);
    }
  }

  console.log('');
  console.log(`Done. Updated: ${updatedCount}, skipped: ${skippedCount}, failed: ${failedCount}, publish: ${publish}, dry-run: ${dryRun}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
