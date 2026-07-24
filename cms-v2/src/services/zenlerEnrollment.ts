/**
 * Zenler user create/find + course enrollment after successful payment.
 */

import { randomBytes } from 'crypto';
import { splitStudentName } from '../models/customer';
import {
  createZenlerStudent,
  enrollZenlerUserInCourse,
  findZenlerUserByEmail,
  isStudentEnrolledInCourse,
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
