import type { PublishedCoursePricing } from './courseDisplayPricing';
import { buildCourseDisplayPricing } from './courseDisplayPricing';
import { getCourseById, listActiveGeoPricesByZenlerCourseId } from '../models/courseGeoPrice';
import {
  findStoryBySlug,
  getStoryById,
  type StoryblokConfig,
  updateStoryById,
} from './storyblokClient';
import type { StoryblokRegion } from '../../shared/migrationTypes';

export interface StoryblokPricingSyncOptions {
  publish?: boolean;
  dryRun?: boolean;
}

export interface StoryblokPricingSyncResult {
  courseId: number;
  courseSlug: string | null;
  zenlerCourseId: string;
  storyId: number | null;
  storySlug: string | null;
  status: 'updated' | 'skipped' | 'failed' | 'no_story' | 'no_pricing';
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBlokArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value);
}

function walkBloks(
  node: unknown,
  visit: (blok: Record<string, unknown>) => void,
): void {
  if (!isRecord(node)) return;
  if (typeof node.component === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (isBlokArray(value)) {
      for (const item of value) walkBloks(item, visit);
    }
  }
}

function formatAccessNote(durationDays: number | null | undefined): string {
  if (durationDays != null && durationDays > 0) {
    return `One-time payment · ${durationDays} days full access`;
  }
  return 'One-time payment · full course access';
}

function formatSaveLine(plan: PublishedCoursePricing['plans'][number]): string | null {
  if (plan.compareAt == null || plan.compareAt <= plan.effectiveAmount) return null;
  const saved = Math.round((plan.compareAt - plan.effectiveAmount) * 100) / 100;
  if (saved <= 0) return null;
  const pct = plan.discountPercent != null && plan.discountPercent > 0
    ? `${plan.discountPercent}%`
    : `${Math.round((saved / plan.compareAt) * 100)}%`;
  return `Save ${pct}`;
}

function patchHeroRightBlok(
  blok: Record<string, unknown>,
  pricing: PublishedCoursePricing,
): boolean {
  let changed = false;
  const plans = pricing.plans;

  if (plans.length > 1) {
    if (blok.pricing_layout !== 'session_selector') {
      blok.pricing_layout = 'session_selector';
      changed = true;
    }

    const existingOptions = isBlokArray(blok.session_options) ? blok.session_options : [];
    const nextOptions = plans.map((plan, index) => {
      const existing = existingOptions[index];
      const base = isRecord(existing) ? { ...existing } : { _uid: cryptoRandomUid(), component: 'course_session_option' };
      const next = {
        ...base,
        component: 'course_session_option',
        title: plan.sessionTitle,
        subtitle: plan.subtitle,
        price: plan.formatted,
        badge: plan.badge ?? '',
        is_default: plan.isDefault,
      };
      if (JSON.stringify(base) !== JSON.stringify(next)) changed = true;
      return next;
    });

    if (JSON.stringify(existingOptions) !== JSON.stringify(nextOptions)) {
      blok.session_options = nextOptions;
      changed = true;
    }

    const defaultPlan = plans.find(plan => plan.isDefault) ?? plans[0]!;
    if (blok.price_now !== defaultPlan.formatted) {
      blok.price_now = defaultPlan.formatted;
      changed = true;
    }
  } else {
    const plan = plans[0]!;
    if (blok.pricing_layout !== 'standard') {
      blok.pricing_layout = 'standard';
      changed = true;
    }
    if (blok.price_now !== plan.formatted) {
      blok.price_now = plan.formatted;
      changed = true;
    }
    const compareAt = plan.formattedCompareAt ?? '';
    if ((blok.price_was ?? '') !== compareAt) {
      blok.price_was = compareAt;
      changed = true;
    }
    const saveLine = formatSaveLine(plan) ?? '';
    if ((blok.price_save ?? '') !== saveLine) {
      blok.price_save = saveLine;
      changed = true;
    }
  }

  const defaultPlan = plans.find(plan => plan.isDefault) ?? plans[0]!;
  const access = defaultPlan.subtitle
    ? `One-time payment · ${defaultPlan.subtitle}`
    : formatAccessNote(undefined);
  if ((blok.price_access ?? '') !== access) {
    blok.price_access = access;
    changed = true;
  }

  return changed;
}

function cryptoRandomUid(): string {
  return `sync-${Math.random().toString(36).slice(2, 10)}`;
}

export function patchCourseStoryPricingContent(
  content: Record<string, unknown>,
  input: {
    zenlerCourseId: string;
    pricing: PublishedCoursePricing;
  },
): boolean {
  let changed = false;
  const cloned = content;

  if (cloned.zenler_course_id !== input.zenlerCourseId) {
    cloned.zenler_course_id = input.zenlerCourseId;
    changed = true;
  }

  walkBloks(cloned, blok => {
    const component = String(blok.component ?? '');

    if (component === 'course_hero' || component === 'course_pricing') {
      if (blok.zenler_course_id !== input.zenlerCourseId) {
        blok.zenler_course_id = input.zenlerCourseId;
        changed = true;
      }
    }

    if (component === 'course_hero_right') {
      if (patchHeroRightBlok(blok, input.pricing)) changed = true;
    }
  });

  return changed;
}

export function resolveStoryblokConfigFromEnv(): StoryblokConfig | null {
  const accessToken = process.env.STORYBLOK_PERSONAL_TOKEN?.trim();
  if (!accessToken) return null;
  return {
    spaceId: process.env.STORYBLOK_SPACE_ID?.trim() || '293626385802926',
    accessToken,
    region: process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu',
  };
}

export function resolveStoryblokConfig(input?: {
  storyblokSpaceId?: string;
  storyblokAccessToken?: string;
  storyblokRegion?: StoryblokRegion;
}): StoryblokConfig | null {
  const accessToken = input?.storyblokAccessToken?.trim()
    || process.env.STORYBLOK_PERSONAL_TOKEN?.trim();
  if (!accessToken) return null;

  return {
    spaceId: input?.storyblokSpaceId?.trim()
      || process.env.STORYBLOK_SPACE_ID?.trim()
      || '293626385802926',
    accessToken,
    region: input?.storyblokRegion === 'us' ? 'us' : 'eu',
  };
}

async function findCourseStory(
  config: StoryblokConfig,
  courseSlug: string | null,
): Promise<{ id: number; slug: string; fullSlug: string } | null> {
  if (courseSlug) {
    const fullSlug = `courses/${courseSlug}`;
    const ref = await findStoryBySlug(config, fullSlug);
    if (ref) return { id: ref.id, slug: ref.slug, fullSlug: ref.full_slug };
  }

  return null;
}

export async function syncCoursePricingToStoryblok(
  courseId: number,
  config: StoryblokConfig,
  options: StoryblokPricingSyncOptions = {},
): Promise<StoryblokPricingSyncResult> {
  const course = await getCourseById(courseId);
  if (!course) {
    return {
      courseId,
      courseSlug: null,
      zenlerCourseId: '',
      storyId: null,
      storySlug: null,
      status: 'failed',
      message: 'Course not found',
    };
  }

  const geo = await listActiveGeoPricesByZenlerCourseId(course.zenlerCourseId);
  const pricing = geo
    ? await buildCourseDisplayPricing({
      zenlerCourseId: geo.zenlerCourseId,
      courseSlug: geo.courseSlug,
      courseName: geo.courseName,
      qualification: geo.qualification,
      prices: geo.prices,
    })
    : null;

  if (!pricing) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: null,
      storySlug: null,
      status: 'no_pricing',
      message: 'No active prices found for course',
    };
  }

  const storyRef = await findCourseStory(config, course.slug);
  if (!storyRef) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: null,
      storySlug: null,
      status: 'no_story',
      message: course.slug ? `Story not found at courses/${course.slug}` : 'Course has no slug',
    };
  }

  const story = await getStoryById(config, storyRef.id);
  if (!story?.content || story.content.component !== 'course_page') {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: storyRef.id,
      storySlug: storyRef.fullSlug,
      status: 'skipped',
      message: 'Story is not a course_page',
    };
  }

  const content = structuredClone(story.content) as Record<string, unknown>;
  const changed = patchCourseStoryPricingContent(content, {
    zenlerCourseId: course.zenlerCourseId,
    pricing,
  });

  if (!changed) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: storyRef.id,
      storySlug: storyRef.fullSlug,
      status: 'skipped',
      message: 'Story already up to date',
    };
  }

  if (options.dryRun) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: storyRef.id,
      storySlug: storyRef.fullSlug,
      status: 'updated',
      message: 'Dry run — no Storyblok write performed',
    };
  }

  try {
    await updateStoryById(config, storyRef.id, {
      name: story.name ?? storyRef.slug,
      slug: story.slug ?? storyRef.slug,
      content,
      publish: options.publish === true,
    });
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: storyRef.id,
      storySlug: storyRef.fullSlug,
      status: 'updated',
    };
  } catch (err) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      zenlerCourseId: course.zenlerCourseId,
      storyId: storyRef.id,
      storySlug: storyRef.fullSlug,
      status: 'failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncAllCoursePricingToStoryblok(
  config: StoryblokConfig,
  options: StoryblokPricingSyncOptions = {},
): Promise<StoryblokPricingSyncResult[]> {
  const { listCoursePricingSummaries } = await import('../models/courseGeoPrice');
  const summaries = await listCoursePricingSummaries();
  const results: StoryblokPricingSyncResult[] = [];

  for (const summary of summaries) {
    results.push(await syncCoursePricingToStoryblok(summary.courseId, config, options));
  }

  return results;
}
