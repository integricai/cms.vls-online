import { getCourseById as getCmsCourseById, getCourseByZenlerCourseId } from '../models/course';
import { getGeoPriceById } from '../models/courseGeoPrice';
import {
  parseAccessZenlerCourseIds,
  parseComboStorySlug,
  validateMultiCourseAccessSelection,
} from './multiCourseAccess';
import {
  findZenlerUserByEmail,
  isStudentEnrolledInCourse,
  zenlerCredentialsConfigured,
} from './zenlerApi';
import {
  summarizeSchoolCourseAccess,
  type SchoolCourseAccess,
} from './schoolCourseAccess';

const LOOKUP_TTL_MS = 2 * 60 * 1000;
const recentLookups = new Map<string, { at: number; value: SchoolCourseAccess }>();

function positiveInt(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function remember(key: string, value: SchoolCourseAccess): SchoolCourseAccess {
  if (value.lookup !== 'ok') return value;
  recentLookups.set(key, { at: Date.now(), value });
  if (recentLookups.size > 200) {
    const oldest = recentLookups.keys().next().value;
    if (oldest) recentLookups.delete(oldest);
  }
  return value;
}

/**
 * Course ids this checkout would enrol. Combo ids are accepted only when they
 * match the combo page. A single course uses that course's Zenler id.
 */
export async function resolveAccountStatusCourseIds(body: Record<string, unknown>): Promise<string[]> {
  const requested = parseAccessZenlerCourseIds(body);
  const explicitPriceId = positiveInt(body.coursePriceId);
  let courseId = positiveInt(body.courseId);
  if (!courseId && explicitPriceId) {
    const price = await getGeoPriceById(explicitPriceId);
    if (price?.isActive) courseId = price.courseId;
  }

  if (requested.length) {
    const slug = parseComboStorySlug(body);
    if (!courseId || !slug) return [];
    return validateMultiCourseAccessSelection({
      bundleCourseId: courseId,
      accessZenlerCourseIds: requested,
      comboStorySlug: slug,
    });
  }

  if (!courseId) return [];
  const course = await getCmsCourseById(courseId);
  const primary = String(course?.zenlerCourseId ?? '').trim();
  return /^\d+$/.test(primary) ? [primary] : [];
}

async function lookupUncached(email: string, courseIds: string[]): Promise<SchoolCourseAccess> {
  const ids = courseIds.filter((id) => /^\d+$/.test(id));
  if (!zenlerCredentialsConfigured()) {
    return summarizeSchoolCourseAccess({
      registered: null,
      courseIds: ids,
      enrolledIds: [],
      failedIds: [],
      namesById: {},
    });
  }

  let registered: boolean | null = null;
  let userId = '';
  try {
    const user = await findZenlerUserByEmail(email);
    registered = Boolean(user);
    userId = user?.id ? String(user.id) : '';
  } catch (err) {
    console.error('[checkout] school account lookup failed', err instanceof Error ? err.message : err);
    registered = null;
  }

  if (registered !== true || !userId || ids.length === 0) {
    return summarizeSchoolCourseAccess({
      registered,
      courseIds: ids,
      enrolledIds: [],
      failedIds: [],
      namesById: {},
    });
  }

  const namesById: Record<string, string | undefined> = {};
  const enrolledIds: string[] = [];
  const failedIds: string[] = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const course = await getCourseByZenlerCourseId(id);
      if (course?.name) namesById[id] = course.name;
    } catch (err) {
      console.error('[checkout] course name lookup failed', id, err instanceof Error ? err.message : err);
    }
    try {
      const enrolled = await isStudentEnrolledInCourse({
        zenlerUserId: userId,
        email,
        zenlerCourseId: id,
      });
      if (enrolled) enrolledIds.push(id);
    } catch (err) {
      failedIds.push(id);
      console.error('[checkout] enrollment lookup failed', id, err instanceof Error ? err.message : err);
    }
  }));

  return summarizeSchoolCourseAccess({
    registered: true,
    courseIds: ids,
    enrolledIds,
    failedIds,
    namesById,
  });
}

export async function lookupSchoolCourseAccess(
  email: string,
  courseIds: string[],
): Promise<SchoolCourseAccess> {
  const ids = courseIds.filter((id) => /^\d+$/.test(id));
  const key = `${email.trim().toLowerCase()}\n${ids.join(',')}`;
  const hit = recentLookups.get(key);
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.value;
  return remember(key, await lookupUncached(email, ids));
}
