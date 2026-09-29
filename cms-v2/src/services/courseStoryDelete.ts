import { zenlerIdFromStoryContent } from './courseSalesPageUrlSync';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';
import {
  deleteStoryById,
  getStoryById,
  listStories,
  type StoryblokConfig,
  type StoryblokStoryRecord,
} from './storyblokClient';

export type LinkedCourseStory = {
  id: number;
  fullSlug: string;
  isFolder?: boolean;
  component: string;
  zenlerCourseId: string;
};

/** Course pages whose Storyblok course field matches this CMS course. */
export function linkedCourseStories(
  stories: LinkedCourseStory[],
  zenlerCourseId: string,
): LinkedCourseStory[] {
  const target = zenlerCourseId.trim();
  if (!target) return [];

  return stories.filter(story => {
    if (story.isFolder) return false;
    if (story.component !== 'course_page') return false;
    return story.zenlerCourseId.trim() === target;
  });
}

async function storyContent(
  config: StoryblokConfig,
  story: StoryblokStoryRecord,
): Promise<Record<string, unknown> | null> {
  if (story.content && zenlerIdFromStoryContent(story.content)) return story.content;
  const full = await getStoryById(config, story.id);
  return full?.content ?? story.content ?? null;
}

export async function deleteLinkedCourseStories(
  zenlerCourseId: string,
): Promise<{ configured: boolean; deletedSlugs: string[]; error: string | null }> {
  const config = resolveStoryblokConfigFromEnv();
  if (!config) return { configured: false, deletedSlugs: [], error: null };

  const listed = await listStories(config, { starts_with: 'courses/', per_page: 100 });
  const refs: LinkedCourseStory[] = [];
  for (const story of listed) {
    if (story.is_folder) continue;
    const content = await storyContent(config, story);
    refs.push({
      id: story.id,
      fullSlug: story.full_slug,
      component: String(content?.component ?? ''),
      zenlerCourseId: zenlerIdFromStoryContent(content),
    });
  }

  const matches = linkedCourseStories(refs, zenlerCourseId);
  const deletedSlugs: string[] = [];
  const errors: string[] = [];
  for (const story of matches) {
    try {
      await deleteStoryById(config, story.id);
      deletedSlugs.push(story.fullSlug);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete the Storyblok course page';
      errors.push(`${story.fullSlug}: ${message}`);
    }
  }
  return {
    configured: true,
    deletedSlugs,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}
