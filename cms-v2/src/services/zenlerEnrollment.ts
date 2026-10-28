/**
 * Zenler user create/find + course enrollment after successful payment,
 * and course unenrollment after refund.
 */

import { randomBytes } from 'crypto';
import { splitStudentName } from '../models/customer';
import { sendErrorAlert } from '../utils/errorAlert';
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
  /** Set only for a buyer who does not already have a school account. */
  password?: string | null;
}

export interface ZenlerEnrollmentResult {
  zenlerUserId: string | null;
  status: 'enrolled' | 'enrolled_new' | 'pending' | 'failed' | 'skipped';
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  studentChosePassword: boolean;
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

/** A chosen password is used as-is. Otherwise Zenler still requires one, so we generate it. */
export function passwordForNewZenlerAccount(chosen: string | null | undefined): {
  password: string;
  studentChosePassword: boolean;
  temporaryPassword: string | null;
} {
  if (chosen) {
    return { password: chosen, studentChosePassword: true, temporaryPassword: null };
  }
  const password = generateTemporaryPassword();
  return { password, studentChosePassword: false, temporaryPassword: password };
}

function enrollmentStatusFromExisting(isNewUser: boolean): 'enrolled' | 'enrolled_new' {
  return isNewUser ? 'enrolled_new' : 'enrolled';
}

const reportedEnrollmentFailures = new Set<string>();

function reportEnrollmentFailure(key: string, error: unknown, extra: Record<string, unknown>): void {
  if (reportedEnrollmentFailures.has(key)) return;
  reportedEnrollmentFailures.add(key);
  void sendErrorAlert({
    area: 'School enrolment failed',
    explanation: 'A paid checkout could not open school access. The buyer sees a short message on the payment page. This log is the real error.',
    error,
    extra,
  }).catch((alertErr) => {
    console.error('[alert] failed to record school enrolment failure', alertErr);
  });
}

/** Zenler rejects a new account when the last name is blank. */
export function zenlerStudentNames(
  name: string | null | undefined,
  email: string,
): { firstName: string; lastName: string } {
  const split = splitStudentName(name);
  const localPart = email.split('@')[0]?.trim() || 'Student';
  return {
    firstName: split.firstName?.trim() || localPart || 'Student',
    lastName: split.lastName?.trim() || 'Student',
  };
}

export async function enrollStudentInZenlerCourse(
  input: ZenlerEnrollmentInput,
): Promise<ZenlerEnrollmentResult> {
  if (!zenlerCredentialsConfigured()) {
    const message = 'Zenler API credentials are not configured';
    reportEnrollmentFailure('zenler-credentials-missing', new Error(message), {
      zenlerCourseId: input.zenlerCourseId,
    });
    return {
      zenlerUserId: null,
      status: 'skipped',
      isNewZenlerUser: false,
      temporaryPassword: null,
      studentChosePassword: false,
      message,
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    const message = 'Student email is required for Zenler enrollment';
    reportEnrollmentFailure(`missing-email:${input.zenlerCourseId}`, new Error(message), {
      zenlerCourseId: input.zenlerCourseId,
    });
    return {
      zenlerUserId: null,
      status: 'failed',
      isNewZenlerUser: false,
      temporaryPassword: null,
      studentChosePassword: false,
      message,
    };
  }

  const planId = input.zenlerPlanId != null && input.zenlerPlanId > 0
    ? input.zenlerPlanId
    : undefined;

  let zenlerUserId: string | null = null;
  let isNewZenlerUser = false;
  let temporaryPassword: string | null = null;
  let studentChosePassword = false;

  try {
    let existingUser = await findZenlerUserByEmail(email);

    if (!existingUser) {
      const names = zenlerStudentNames(input.name, email);
      const chosen = passwordForNewZenlerAccount(input.password);
      temporaryPassword = chosen.temporaryPassword;
      studentChosePassword = chosen.studentChosePassword;
      try {
        existingUser = await createZenlerStudent({
          email,
          firstName: names.firstName,
          lastName: names.lastName,
          password: chosen.password,
        });
        isNewZenlerUser = true;
      } catch (createError) {
        const recovered = await findZenlerUserByEmail(email).catch(() => null);
        if (!recovered?.id) throw createError;
        existingUser = recovered;
        temporaryPassword = null;
        studentChosePassword = false;
      }
    }

    zenlerUserId = existingUser.id;
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
      studentChosePassword,
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
    reportEnrollmentFailure(`${email}:${input.zenlerCourseId}:${message}`, err, {
      email,
      zenlerCourseId: input.zenlerCourseId,
    });
    return {
      zenlerUserId,
      status: 'failed',
      isNewZenlerUser,
      temporaryPassword: isNewZenlerUser ? temporaryPassword : null,
      studentChosePassword: isNewZenlerUser ? studentChosePassword : false,
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
