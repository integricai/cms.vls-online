/** Zenler school portal URLs for student course access. */

export const VLS_SCHOOL_BASE_URL = (
  process.env.VLS_SCHOOL_BASE_URL ?? 'https://school.vls-online.com'
).replace(/\/+$/, '');

export const VLS_SCHOOL_LOGIN_URL = `${VLS_SCHOOL_BASE_URL}/login`;
export const VLS_SCHOOL_REGISTER_URL = `${VLS_SCHOOL_BASE_URL}/register`;

export function courseAccessUrlForEnrollment(input: {
  zenlerEnrollmentStatus?: string | null;
  isNewZenlerUser?: boolean;
}): string {
  const status = String(input.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (status.startsWith('enrolled')) {
    return VLS_SCHOOL_LOGIN_URL;
  }
  return input.isNewZenlerUser ? VLS_SCHOOL_REGISTER_URL : VLS_SCHOOL_LOGIN_URL;
}
