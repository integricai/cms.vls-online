import { fetchZenlerCourses } from './zenlerCourseService';
import { deactivateCoursesNotIn, upsertCourse } from '../models/course';
import type { CourseSyncResult } from '../../shared/types';
import { syncCmsCoursesStoryblokDatasource } from './storyblokCmsCoursesDatasource';

/**
 * Fetches all courses from Zenler and upserts them into the local courses table.
 *
 * Rules:
 * - New ZenlerCourseId → INSERT
 * - Existing ZenlerCourseId → UPDATE (name, slug, category, level, status, url)
 * - Courses previously synced but absent from latest Zenler response → mark is_active = false (never deleted)
 * - Admin fields (flags, taxonomy, coursePageUrl) are never overwritten
 */
export async function syncCoursesFromZenler(): Promise<CourseSyncResult> {
  const zenlerCourses = await fetchZenlerCourses();

  let inserted = 0;
  let updated = 0;
  const activeIds: string[] = [];

  for (const course of zenlerCourses) {
    if (!course.zenlerCourseId) continue;
    activeIds.push(course.zenlerCourseId);

    const { wasInserted } = await upsertCourse(course);
    if (wasInserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  const deactivated = await deactivateCoursesNotIn(activeIds);

  let storyblokDatasource: CourseSyncResult['storyblokDatasource'];
  try {
    storyblokDatasource = await syncCmsCoursesStoryblokDatasource();
  } catch (err) {
    storyblokDatasource = {
      ok: false,
      created: 0,
      updated: 0,
      deleted: 0,
      error: err instanceof Error ? err.message : 'Storyblok datasource sync failed',
    };
  }

  return {
    fetched: zenlerCourses.length,
    inserted,
    updated,
    deactivated,
    syncedAt: new Date().toISOString(),
    storyblokDatasource,
  };
}
