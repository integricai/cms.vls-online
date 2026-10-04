import { getCourseById as getCmsCourseById } from '../models/course';
import {
  normalizeComboStorySlug,
  resolveMultiCourseAllowlistFromStorySlug,
} from './multiCourseStoryblokAllowlist';

export class MultiCourseAccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeZenlerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? '').trim();
    if (!/^\d+$/.test(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function parseAccessZenlerCourseIds(body: Record<string, unknown>): string[] {
  const fromArray = normalizeZenlerIds(body.accessZenlerCourseIds);
  if (fromArray.length) return fromArray;
  const legacy = String(body.accessZenlerCourseId ?? '').trim();
  if (/^\d+$/.test(legacy)) return [legacy];
  return [];
}

export function parseComboStorySlug(body: Record<string, unknown>): string {
  const slug = normalizeComboStorySlug(
    body.comboStorySlug ?? body.comboPageSlug ?? body.storySlug,
  );
  return slug;
}

/** True when this CMS course is a combo price course, independent of the request slug. */
export function isComboPricingCourse(input: {
  zenlerCourseId?: string | null;
  configuredComboZenlerCourseIds?: Iterable<string> | null;
}): boolean {
  const id = String(input.zenlerCourseId ?? '').trim();
  if (!/^\d+$/.test(id)) return false;
  for (const configured of input.configuredComboZenlerCourseIds ?? []) {
    if (String(configured).trim() === id) return true;
  }
  return false;
}

/**
 * A combo checkout must name the papers to enrol. The combo page slug is one
 * signal; the course's Zenler ID matching a configured combo price course is
 * the other. Without a selection, fulfillment enrols the bundle's own Zenler course.
 */
export function assertBundleCheckoutHasSelection(input: {
  comboStorySlug?: string | null;
  accessZenlerCourseIds?: string[] | null;
  zenlerCourseId?: string | null;
  configuredComboZenlerCourseIds?: Iterable<string> | null;
}): void {
  const comboCheckout = Boolean(normalizeComboStorySlug(input.comboStorySlug))
    || isComboPricingCourse(input);
  if (!comboCheckout) return;
  if ((input.accessZenlerCourseIds?.length ?? 0) > 0) return;
  throw new MultiCourseAccessError(
    'Select the courses included in this combo pack before checkout.',
    400,
  );
}

/** Validate picker selection using Zenler IDs configured on the Storyblok multi-course page. */
export async function validateMultiCourseAccessSelection(input: {
  bundleCourseId: number;
  accessZenlerCourseIds: string[];
  comboStorySlug: string;
}): Promise<string[]> {
  const slug = normalizeComboStorySlug(input.comboStorySlug);
  if (!slug) {
    throw new MultiCourseAccessError('Combo page reference is required for this checkout.', 400);
  }

  const bundle = await getCmsCourseById(input.bundleCourseId);
  if (!bundle || !bundle.isActive) {
    throw new MultiCourseAccessError('Bundle course not found or inactive.', 404);
  }

  const story = await resolveMultiCourseAllowlistFromStorySlug(slug);
  if (!story) {
    throw new MultiCourseAccessError('Combo page could not be loaded. Try again later.', 404);
  }

  if (story.comboZenlerCourseId && story.comboZenlerCourseId !== bundle.zenlerCourseId) {
    throw new MultiCourseAccessError(
      'This checkout does not match the combo page pricing course.',
      400,
    );
  }

  if (story.allowlist.length === 0) {
    throw new MultiCourseAccessError(
      'Combo page has no paper options with Zenler courses configured.',
      400,
    );
  }

  const required = story.selectionCount;
  const ids = normalizeZenlerIds(input.accessZenlerCourseIds);
  if (ids.length !== required) {
    throw new MultiCourseAccessError(
      `Select exactly ${required} courses for this combo pack.`,
      400,
    );
  }

  const invalid = ids.filter((id) => !story.allowlist.includes(id));
  if (invalid.length) {
    throw new MultiCourseAccessError('One or more selected courses are not on this combo page.', 400);
  }

  return ids;
}
