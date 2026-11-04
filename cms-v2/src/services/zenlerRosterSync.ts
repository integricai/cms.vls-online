import ExcelJS from 'exceljs';
import type { Course, ZenlerRosterSyncResult } from '../../shared/types';
import { listCourses } from '../models/course';
import {
  enrollmentOnOrAfterCutoff,
  isManualAccessDuration,
  listZenlerRoster,
  markRosterRemoved,
  saveRosterDuration,
  upsertZenlerRosterEnrollment,
} from '../models/zenlerRoster';
import {
  listZenlerEnrollmentsPage,
  zenlerCredentialsConfigured,
} from './zenlerApi';
import { unenrollActiveCourse } from './activeEnrollment';
import { unenrollStudentFromZenlerCourse } from './zenlerEnrollment';
import type { ActiveEnrollment } from '../../shared/types';

function coursesToSync(courses: Course[]): Course[] {
  return courses.filter((course) => {
    const name = String(course.name ?? '').toLowerCase();
    if (/\btest\b/.test(name) || /\bdraft\b/.test(name)) return false;
    return course.isActive && String(course.zenlerCourseId ?? '').trim().length > 0;
  });
}

/** Pull one course's Zenler enrolments from 1 Nov 2025. The caller advances the index. */
export async function syncZenlerRosterCourse(courseIndex: number): Promise<ZenlerRosterSyncResult> {
  if (!zenlerCredentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const courses = coursesToSync(await listCourses());
  const index = Math.max(0, Number(courseIndex) || 0);
  if (index >= courses.length) {
    return {
      courseIndex: index,
      nextCourseIndex: null,
      totalCourses: courses.length,
      courseName: null,
      kept: 0,
      skipped: 0,
      done: true,
      error: null,
    };
  }

  const course = courses[index]!;
  let kept = 0;
  let skipped = 0;
  let error: string | null = null;

  try {
    const batch = await listZenlerEnrollmentsPage({ zenlerCourseId: course.zenlerCourseId });
    for (const item of batch.items) {
      const email = String(item.email ?? '').trim().toLowerCase();
      const zenlerUserId = String(item.user_id ?? '').trim();
      const enrolledOn = String(item.enrollment_date ?? '').trim();
      if (!email || !zenlerUserId || !enrollmentOnOrAfterCutoff(enrolledOn)) {
        skipped += 1;
        continue;
      }
      await upsertZenlerRosterEnrollment({
        zenlerCourseId: String(course.zenlerCourseId).trim(),
        zenlerUserId,
        email,
        firstName: String(item.first_name ?? '').trim() || null,
        lastName: String(item.last_name ?? '').trim() || null,
        courseName: course.name,
        enrollmentDate: enrolledOn.replace(' ', 'T'),
      });
      kept += 1;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    skipped += 1;
  }

  const next = index + 1;
  const done = next >= courses.length;
  return {
    courseIndex: index,
    nextCourseIndex: done ? null : next,
    totalCourses: courses.length,
    courseName: course.name,
    kept,
    skipped,
    done,
    error,
  };
}

function validityLabel(expiry: Date | null): string {
  if (!expiry) return 'Not set';
  const date = expiry instanceof Date ? expiry : new Date(expiry);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.getTime() <= Date.now() ? 'Ended' : 'Active';
}

/** Every stored enrolment, including rows past the current page. */
export async function buildActiveStudentsWorkbook(search?: string): Promise<Buffer> {
  const page = await listZenlerRoster({ search, unbounded: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Active students');
  sheet.columns = [
    { header: 'First name', key: 'firstName', width: 22 },
    { header: 'Last name', key: 'lastName', width: 22 },
    { header: 'Email', key: 'email', width: 36 },
    { header: 'Course', key: 'course', width: 42 },
    { header: 'Enrolled', key: 'enrolled', width: 16 },
    { header: 'Duration days', key: 'duration', width: 16 },
    { header: 'Validity', key: 'validity', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of page.items) {
    const enrolled = row.enrollmentDate ? new Date(row.enrollmentDate) : null;
    const validity = row.expiryDate ? new Date(row.expiryDate) : null;
    const added = sheet.addRow({
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      email: row.email,
      course: row.courseName,
      enrolled: enrolled && !Number.isNaN(enrolled.getTime()) ? enrolled : '',
      duration: row.durationDays ?? '',
      validity: validity && !Number.isNaN(validity.getTime()) ? validity : '',
      status: validityLabel(validity),
    });
    added.getCell('enrolled').numFmt = 'dd mmm yyyy';
    added.getCell('validity').numFmt = 'dd mmm yyyy';
  }

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export async function saveManualAccessDuration(input: {
  zenlerCourseId: string;
  zenlerUserId: string;
  durationDays: number;
}): Promise<ActiveEnrollment> {
  if (!isManualAccessDuration(input.durationDays)) {
    throw new Error('Choose a duration of 60, 90, 180, or 365 days');
  }
  return saveRosterDuration(input);
}

export async function unenrollRosterCourse(input: {
  zenlerCourseId: string;
  zenlerUserId: string;
  email: string;
  saleId: number | null;
}): Promise<{ message: string }> {
  const zenlerCourseId = String(input.zenlerCourseId ?? '').trim();
  const zenlerUserId = String(input.zenlerUserId ?? '').trim();
  if (!/^\d+$/.test(zenlerCourseId) || !zenlerUserId) {
    throw new Error('That enrolment cannot be updated');
  }

  const result = await unenrollStudentFromZenlerCourse({
    email: input.email,
    zenlerUserId,
    zenlerCourseId,
  });
  if (result.status !== 'unenrolled') {
    throw new Error(result.message || 'Could not unenrol this course');
  }

  if (input.saleId) {
    try {
      await unenrollActiveCourse({ saleId: input.saleId, zenlerCourseId });
    } catch (err) {
      console.error('[active-students] sale access was already closed', input.saleId, err);
    }
  }

  await markRosterRemoved(zenlerCourseId, zenlerUserId);
  return { message: result.message || 'Student unenrolled from this course' };
}
