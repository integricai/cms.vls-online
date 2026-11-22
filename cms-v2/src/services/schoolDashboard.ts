/**
 * Signed-in school dashboard: the student's first name and every enrolled
 * course with Zenler's completion percentage. The API key stays on the server.
 */

import { getCourseByZenlerCourseId } from '../models/course';
import { listActiveRosterCoursesForEmail } from '../models/zenlerRoster';
import { normalizeStudentEmail } from './studentPasswordCrypto';
import {
  fetchZenlerCourseProgressPage,
  findZenlerUserByEmail,
  zenlerCredentialsConfigured,
} from './zenlerApi';
import {
  firstNameFrom,
  orderDashboardCourses,
  parseCourseProgressItems,
  type CourseProgressRow,
  type DashboardCourse,
} from './schoolDashboardProgress';

export interface SchoolDashboardView {
  found: boolean;
  firstName: string;
  courses: DashboardCourse[];
}

const EMPTY: SchoolDashboardView = { found: false, firstName: '', courses: [] };
const MAX_PAGES = 5;

async function progressForEmail(email: string, courseIds: string[]): Promise<CourseProgressRow[]> {
  const rows: CourseProgressRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchZenlerCourseProgressPage({
      email,
      page,
      courseIds: courseIds.length > 0 ? courseIds : undefined,
    });
    const batch = parseCourseProgressItems(data).filter(row => row.email === email);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

async function courseName(courseId: string, reported: string, rosterName: string | null): Promise<string> {
  if (reported) return reported;
  const course = await getCourseByZenlerCourseId(courseId).catch(() => null);
  const stored = course?.name?.trim();
  if (stored) return stored;
  const roster = rosterName?.trim();
  if (roster) return roster;
  return `Course ${courseId}`;
}

export async function loadSchoolDashboard(rawEmail: unknown): Promise<SchoolDashboardView> {
  const email = normalizeStudentEmail(rawEmail);
  if (!email || !zenlerCredentialsConfigured()) return EMPTY;

  const user = await findZenlerUserByEmail(email);
  const roster = await listActiveRosterCoursesForEmail(email).catch(() => []);
  if (!user && roster.length === 0) return EMPTY;

  let progress: CourseProgressRow[] = [];
  try {
    progress = await progressForEmail(email, roster.map(row => row.zenlerCourseId));
  } catch (err) {
    console.error('[school-dashboard] progress lookup failed', err instanceof Error ? err.message : err);
  }

  const rosterByCourse = new Map(roster.map(row => [row.zenlerCourseId, row]));
  const courseIds = new Set<string>([
    ...roster.map(row => row.zenlerCourseId),
    ...progress.map(row => row.courseId),
  ]);

  const courses: DashboardCourse[] = [];
  for (const courseId of courseIds) {
    if (!/^\d+$/.test(courseId)) continue;
    const reported = progress.find(row => row.courseId === courseId);
    const enrolled = rosterByCourse.get(courseId);
    courses.push({
      id: courseId,
      name: await courseName(courseId, reported?.courseName ?? '', enrolled?.courseName ?? null),
      percent: reported ? reported.percent : null,
      lastAttended: reported?.lastAttended ?? null,
    });
  }

  const explicitFirst = user?.first_name?.trim()
    || roster.find(row => row.firstName?.trim())?.firstName?.trim()
    || '';
  const reportedName = progress.find(row => row.studentName)?.studentName ?? '';

  return {
    found: true,
    firstName: firstNameFrom(reportedName, explicitFirst),
    courses: orderDashboardCourses(courses),
  };
}
