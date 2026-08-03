import type { Course, EnrollmentSyncResult } from '../../shared/types';
import { sql } from '../db/client';
import { upsertCustomer } from '../models/customer';
import { ensureCustomerCourseStatus } from '../models/customerCourseStatus';
import { listCourses } from '../models/course';
import {
  getEnrollmentSyncState,
  markEnrollmentSyncFailed,
  markEnrollmentSyncProgress,
  markEnrollmentSyncRunning,
  markEnrollmentSyncStopped,
} from '../models/enrollmentSyncState';
import {
  listZenlerEnrollmentsPage,
  zenlerCredentialsConfigured,
} from './zenlerApi';

const DEFAULT_PAGE_SIZE = 100;

function coursesWithZenlerId(courses: Course[]): Course[] {
  return courses.filter((c) => String(c.zenlerCourseId ?? '').trim().length > 0);
}

export async function getZenlerEnrollmentSyncStatus() {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }
  return getEnrollmentSyncState();
}

export async function stopZenlerEnrollmentSync() {
  return markEnrollmentSyncStopped();
}

/**
 * Backfill one page of Zenler enrollments for the current CMS course.
 * Uses course enrollment reports (not per-student calls) to stay within safe API volume.
 */
export async function syncZenlerEnrollmentsBatch(input: {
  action?: 'continue' | 'restart';
  pageSize?: number;
} = {}): Promise<EnrollmentSyncResult> {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const action = input.action === 'restart' ? 'restart' : 'continue';
  const pageSize = Math.min(
    100,
    Math.max(1, Number(input.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );

  const allCourses = coursesWithZenlerId(await listCourses());
  if (allCourses.length === 0) {
    throw new Error('No CMS courses with a Zenler course id were found');
  }

  const prior = await getEnrollmentSyncState();
  if (action === 'continue' && prior.status === 'completed') {
    return {
      fetched: 0,
      linked: 0,
      createdCustomers: 0,
      skipped: 0,
      errors: [],
      courseIndex: prior.courseIndex,
      courseId: null,
      courseName: null,
      page: prior.lastCompletedPage,
      pageSize: prior.pageSize,
      totalCourses: allCourses.length,
      totalPagesInCourse: prior.totalPagesInCourse ?? 1,
      nextCourseIndex: null,
      nextPage: null,
      done: true,
      stopped: false,
      totals: {
        fetched: prior.fetched,
        linked: prior.linked,
        createdCustomers: prior.createdCustomers,
        skipped: prior.skipped,
      },
      syncState: prior,
    };
  }

  let state = action === 'restart'
    ? await markEnrollmentSyncRunning({ pageSize, totalCourses: allCourses.length, reset: true })
    : await markEnrollmentSyncRunning({ pageSize, totalCourses: allCourses.length, reset: false });

  const courseIndex = Math.max(0, state.courseIndex);
  const page = action === 'restart' ? 1 : Math.max(1, state.lastCompletedPage + 1);

  // Finished all courses (index advanced past the last course).
  if (courseIndex >= allCourses.length) {
    const completed = await markEnrollmentSyncProgress({
      status: 'completed',
      courseIndex: allCourses.length,
      courseId: null,
      lastCompletedPage: state.lastCompletedPage,
      pageSize,
      totalCourses: allCourses.length,
      totalPagesInCourse: state.totalPagesInCourse,
      fetched: state.fetched,
      linked: state.linked,
      createdCustomers: state.createdCustomers,
      skipped: state.skipped,
    });
    return {
      fetched: 0,
      linked: 0,
      createdCustomers: 0,
      skipped: 0,
      errors: [],
      courseIndex: completed.courseIndex,
      courseId: null,
      courseName: null,
      page: completed.lastCompletedPage,
      pageSize,
      totalCourses: allCourses.length,
      totalPagesInCourse: completed.totalPagesInCourse ?? 1,
      nextCourseIndex: null,
      nextPage: null,
      done: true,
      stopped: false,
      totals: {
        fetched: completed.fetched,
        linked: completed.linked,
        createdCustomers: completed.createdCustomers,
        skipped: completed.skipped,
      },
      syncState: completed,
    };
  }

  const course = allCourses[courseIndex]!;
  const pageResult = {
    fetched: 0,
    linked: 0,
    createdCustomers: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const latest = await getEnrollmentSyncState();
    if (latest.status === 'stopped') {
      return emptyStoppedResult(latest, pageSize, allCourses.length, course);
    }

    const batch = await listZenlerEnrollmentsPage({
      zenlerCourseId: course.zenlerCourseId,
      page,
      pageSize,
    });

    for (const item of batch.items) {
      if (pageResult.fetched > 0 && pageResult.fetched % 25 === 0) {
        const maybeStopped = await getEnrollmentSyncState();
        if (maybeStopped.status === 'stopped') {
          const syncState = await markEnrollmentSyncStopped();
          return {
            ...pageResult,
            courseIndex,
            courseId: course.id,
            courseName: course.name,
            page: syncState.lastCompletedPage,
            pageSize,
            totalCourses: allCourses.length,
            totalPagesInCourse: batch.totalPages,
            nextCourseIndex: syncState.courseIndex,
            nextPage: syncState.lastCompletedPage + 1,
            done: false,
            stopped: true,
            totals: {
              fetched: state.fetched + pageResult.fetched,
              linked: state.linked + pageResult.linked,
              createdCustomers: state.createdCustomers + pageResult.createdCustomers,
              skipped: state.skipped + pageResult.skipped,
            },
            syncState,
          };
        }
      }

      const email = String(item.email ?? '').trim().toLowerCase();
      if (!email) {
        pageResult.skipped += 1;
        continue;
      }

      try {
        const zenlerUserId = String(item.user_id ?? '').trim() || null;
        const existed = await customerExists(email, zenlerUserId);
        const customer = await upsertCustomer({
          email,
          firstName: String(item.first_name ?? '').trim() || null,
          lastName: String(item.last_name ?? '').trim() || null,
          zenlerUserId,
          source: 'zenler_sync',
          lastZenlerSyncedAt: new Date(),
        });
        if (!existed) pageResult.createdCustomers += 1;

        await ensureCustomerCourseStatus(customer.id, course.id);
        pageResult.linked += 1;
        pageResult.fetched += 1;
      } catch (err) {
        pageResult.skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (pageResult.errors.length < 25) {
          pageResult.errors.push(`${email}: ${message}`);
        }
      }
    }

    const totals = {
      fetched: state.fetched + pageResult.fetched,
      linked: state.linked + pageResult.linked,
      createdCustomers: state.createdCustomers + pageResult.createdCustomers,
      skipped: state.skipped + pageResult.skipped,
    };

    let nextCourseIndex: number | null = courseIndex;
    let nextPage: number | null = null;
    let done = false;
    let savedCourseIndex = courseIndex;
    let savedPage = page;

    if (batch.items.length === 0 || page >= batch.totalPages || batch.items.length < batch.pageSize) {
      // Finished this course — advance to next course.
      const upcoming = courseIndex + 1;
      if (upcoming >= allCourses.length) {
        nextCourseIndex = null;
        nextPage = null;
        done = true;
        savedCourseIndex = allCourses.length;
        savedPage = page;
      } else {
        nextCourseIndex = upcoming;
        nextPage = 1;
        savedCourseIndex = upcoming;
        savedPage = 0; // so continue uses page 1
      }
    } else {
      nextPage = page + 1;
      nextCourseIndex = courseIndex;
      savedPage = page;
    }

    const after = await getEnrollmentSyncState();
    const stopRequested = after.status === 'stopped';

    let syncState = await markEnrollmentSyncProgress({
      status: stopRequested ? 'stopped' : done ? 'completed' : 'running',
      courseIndex: savedCourseIndex,
      courseId: done ? null : (allCourses[savedCourseIndex]?.id ?? course.id),
      lastCompletedPage: savedPage,
      pageSize,
      totalCourses: allCourses.length,
      totalPagesInCourse: batch.totalPages,
      fetched: totals.fetched,
      linked: totals.linked,
      createdCustomers: totals.createdCustomers,
      skipped: totals.skipped,
    });

    if (stopRequested && !done) {
      syncState = await markEnrollmentSyncStopped();
    }

    return {
      ...pageResult,
      courseIndex,
      courseId: course.id,
      courseName: course.name,
      page,
      pageSize,
      totalCourses: allCourses.length,
      totalPagesInCourse: batch.totalPages,
      nextCourseIndex: syncState.status === 'stopped' ? syncState.courseIndex : nextCourseIndex,
      nextPage: syncState.status === 'stopped'
        ? (syncState.lastCompletedPage > 0 ? syncState.lastCompletedPage + 1 : 1)
        : nextPage,
      done: syncState.status === 'completed',
      stopped: syncState.status === 'stopped',
      totals,
      syncState,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markEnrollmentSyncFailed(message);
    throw err;
  }
}

async function customerExists(email: string, zenlerUserId: string | null): Promise<boolean> {
  if (zenlerUserId) {
    const byZenler = await sql`
      SELECT id FROM customers
      WHERE zenler_user_id = ${zenlerUserId}
         OR LOWER(email) = ${email}
      LIMIT 1
    `;
    return Boolean(byZenler[0]);
  }
  const rows = await sql`
    SELECT id FROM customers WHERE LOWER(email) = ${email} LIMIT 1
  `;
  return Boolean(rows[0]);
}

function emptyStoppedResult(
  state: Awaited<ReturnType<typeof getEnrollmentSyncState>>,
  pageSize: number,
  totalCourses: number,
  course: Course | null,
): EnrollmentSyncResult {
  return {
    fetched: 0,
    linked: 0,
    createdCustomers: 0,
    skipped: 0,
    errors: [],
    courseIndex: state.courseIndex,
    courseId: course?.id ?? state.courseId,
    courseName: course?.name ?? null,
    page: state.lastCompletedPage,
    pageSize,
    totalCourses,
    totalPagesInCourse: state.totalPagesInCourse ?? 1,
    nextCourseIndex: state.courseIndex,
    nextPage: state.lastCompletedPage + 1,
    done: false,
    stopped: true,
    totals: {
      fetched: state.fetched,
      linked: state.linked,
      createdCustomers: state.createdCustomers,
      skipped: state.skipped,
    },
    syncState: state,
  };
}
