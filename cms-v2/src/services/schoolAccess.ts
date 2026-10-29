/** Zenler school portal URLs for student course access. */

export const VLS_SCHOOL_BASE_URL = (
  process.env.VLS_SCHOOL_BASE_URL ?? 'https://school.vls-online.com'
).replace(/\/+$/, '');

export const VLS_SCHOOL_LOGIN_URL = `${VLS_SCHOOL_BASE_URL}/login`;
export const VLS_SCHOOL_REGISTER_URL = `${VLS_SCHOOL_BASE_URL}/register`;
export const VLS_SCHOOL_PASSWORD_RESET_URL = `${VLS_SCHOOL_BASE_URL}/password/reset`;

export function courseAccessUrlForEnrollment(input: {
  zenlerEnrollmentStatus?: string | null;
  isNewZenlerUser?: boolean;
}): string {
  // A new buyer is created in Zenler before they leave checkout, so enrolment
  // success still sends them to register. Returning buyers sign in.
  return input.isNewZenlerUser ? VLS_SCHOOL_REGISTER_URL : VLS_SCHOOL_LOGIN_URL;
}

export type SchoolAccessState = 'ready' | 'pending' | 'unavailable';

export function orderHasSchoolCourse(input: {
  zenlerCourseId?: string | null;
  accessZenlerCourseIds?: readonly string[] | null;
}): boolean {
  if ((input.accessZenlerCourseIds ?? []).some((id) => /^\d+$/.test(String(id).trim()))) return true;
  return /^\d+$/.test(String(input.zenlerCourseId ?? '').trim());
}

/** What the thank-you page may tell the buyer about school access. */
export function schoolAccessState(input: {
  zenlerEnrollmentStatus?: string | null;
  zenlerCourseId?: string | null;
  accessZenlerCourseIds?: readonly string[] | null;
}): SchoolAccessState {
  const status = String(input.zenlerEnrollmentStatus ?? '').trim().toLowerCase();
  if (status.startsWith('enrolled') || status === 'expire_deferred') return 'ready';
  if (
    status === 'failed'
    || status === 'skipped'
    || status === 'expired'
    || status === 'expire_skipped'
    || status === 'unenroll_failed'
    || status === 'unenroll_gave_up'
  ) return 'unavailable';
  if (!orderHasSchoolCourse(input)) return 'ready';
  return 'pending';
}

/**
 * Hold the course-access email only while enrolment has not been attempted.
 * A failed or skipped enrolment must still send access instructions.
 */
export function enrollmentStatusBlocksAccessEmail(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized.startsWith('enrolled')) return false;
  return normalized === '' || normalized === 'pending';
}
