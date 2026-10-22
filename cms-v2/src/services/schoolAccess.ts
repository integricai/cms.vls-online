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

/**
 * Hold the course-access email only while enrolment has not been attempted.
 * A failed or skipped enrolment must still send access instructions.
 */
export function enrollmentStatusBlocksAccessEmail(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized.startsWith('enrolled')) return false;
  return normalized === '' || normalized === 'pending';
}
