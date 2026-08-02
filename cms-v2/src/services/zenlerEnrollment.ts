/**
 * Zenler user create/find + course enrollment after successful payment,
 * and course unenrollment after refund.
 */

import { randomBytes } from 'crypto';
import { splitStudentName } from '../models/customer';
import {
  createZenlerStudent,
  enrollZenlerUserInCourse,
  findZenlerUserByEmail,
  isStudentEnrolledInCourse,
  unenrollZenlerUserFromCourse,
  zenlerCredentialsConfigured,
} from './zenlerApi';

export interface ZenlerEnrollmentInput {
  email: string;
  name: string | null;
  zenlerCourseId: string;
  zenlerPlanId?: number | null;
}

export interface ZenlerEnrollmentResult {
  zenlerUserId: string | null;
  status: 'enrolled' | 'enrolled_new' | 'pending' | 'failed' | 'skipped';
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  message: string;
}

export interface ZenlerUnenrollmentInput {
  email?: string | null;
  zenlerUserId?: string | null;
  zenlerCourseId: string;
}

export interface ZenlerUnenrollmentResult {
  zenlerUserId: string | null;
  status: 'unenrolled' | 'unenroll_failed' | 'skipped';
  message: string;
}

function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

function enrollmentStatusFromExisting(isNewUser: boolean): 'enrolled' | 'enrolled_new' {
  return isNewUser ? 'enrolled_new' : 'enrolled';
}

export async function enrollStudentInZenlerCourse(
  input: ZenlerEnrollmentInput,
): Promise<ZenlerEnrollmentResult> {
  if (!zenlerCredentialsConfigured()) {
    return {
      zenlerUserId: null,
      status: 'skipped',
      isNewZenlerUser: false,
      temporaryPassword: null,
      message: 'Zenler API credentials are not configured',
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return {
      zenlerUserId: null,
      status: 'failed',
      isNewZenlerUser: false,
      temporaryPassword: null,
      message: 'Student email is required for Zenler enrollment',
    };
  }

  const planId = input.zenlerPlanId != null && input.zenlerPlanId > 0
    ? input.zenlerPlanId
    : undefined;

  try {
    let existingUser = await findZenlerUserByEmail(email);
    let isNewZenlerUser = false;
    let temporaryPassword: string | null = null;

    if (!existingUser) {
      const { firstName, lastName } = splitStudentName(input.name);
      temporaryPassword = generateTemporaryPassword();
      existingUser = await createZenlerStudent({
        email,
        firstName: firstName ?? email.split('@')[0] ?? 'Student',
        lastName,
        password: temporaryPassword,
      });
      isNewZenlerUser = true;
    }

    const zenlerUserId = existingUser.id;
    const alreadyEnrolled = await isStudentEnrolledInCourse({
      zenlerUserId,
      email,
      zenlerCourseId: input.zenlerCourseId,
    });

    if (!alreadyEnrolled) {
      await enrollZenlerUserInCourse({
        zenlerUserId,
        zenlerCourseId: input.zenlerCourseId,
        planId,
      });
    }

    return {
      zenlerUserId,
      status: enrollmentStatusFromExisting(isNewZenlerUser),
      isNewZenlerUser,
      temporaryPassword,
      message: alreadyEnrolled
        ? 'Student was already enrolled in this Zenler course'
        : 'Student enrolled in Zenler course',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[zenler-enrollment] failed', {
      email,
      zenlerCourseId: input.zenlerCourseId,
      message,
    });
    return {
      zenlerUserId: null,
      status: 'failed',
      isNewZenlerUser: false,
      temporaryPassword: null,
      message,
    };
  }
}

export async function unenrollStudentFromZenlerCourse(
  input: ZenlerUnenrollmentInput,
): Promise<ZenlerUnenrollmentResult> {
  if (!zenlerCredentialsConfigured()) {
    return {
      zenlerUserId: input.zenlerUserId ?? null,
      status: 'skipped',
      message: 'Zenler API credentials are not configured',
    };
  }

  const zenlerCourseId = String(input.zenlerCourseId ?? '').trim();
  if (!zenlerCourseId) {
    return {
      zenlerUserId: input.zenlerUserId ?? null,
      status: 'skipped',
      message: 'Zenler course id is required for unenrollment',
    };
  }

  try {
    let zenlerUserId = String(input.zenlerUserId ?? '').trim() || null;
    if (!zenlerUserId) {
      const email = String(input.email ?? '').trim().toLowerCase();
      if (!email) {
        return {
          zenlerUserId: null,
          status: 'unenroll_failed',
          message: 'Zenler user id or student email is required for unenrollment',
        };
      }
      const existingUser = await findZenlerUserByEmail(email);
      zenlerUserId = existingUser?.id ?? null;
      if (!zenlerUserId) {
        return {
          zenlerUserId: null,
          status: 'unenrolled',
          message: 'Student has no Zenler account — nothing to unenroll',
        };
      }
    }

    const outcome = await unenrollZenlerUserFromCourse({
      zenlerUserId,
      zenlerCourseId,
    });

    return {
      zenlerUserId,
      status: 'unenrolled',
      message: outcome === 'already_unenrolled'
        ? 'Student was already unenrolled from this Zenler course'
        : 'Student unenrolled from Zenler course',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[zenler-unenrollment] failed', {
      email: input.email,
      zenlerUserId: input.zenlerUserId,
      zenlerCourseId,
      message,
    });
    return {
      zenlerUserId: input.zenlerUserId ?? null,
      status: 'unenroll_failed',
      message,
    };
  }
}
