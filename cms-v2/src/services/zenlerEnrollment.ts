/**
 * Zenler user create/find + course enrollment after successful payment.
 *
 * Wired into the Stripe webhook path. Requires ZENLER_API_KEY + ZENLER_ACCOUNT_NAME.
 * Until Zenler enrollment endpoints are confirmed, this records a pending status
 * and logs clearly so ops can complete enrollment manually if needed.
 */

export interface ZenlerEnrollmentInput {
  email: string;
  name: string | null;
  zenlerCourseId: string;
}

export interface ZenlerEnrollmentResult {
  zenlerUserId: string | null;
  status: 'enrolled' | 'pending' | 'failed' | 'skipped';
  message: string;
}

export async function enrollStudentInZenlerCourse(
  input: ZenlerEnrollmentInput,
): Promise<ZenlerEnrollmentResult> {
  const apiKey = process.env.ZENLER_API_KEY;
  const account = process.env.ZENLER_ACCOUNT_NAME;

  if (!apiKey || !account) {
    return {
      zenlerUserId: null,
      status: 'skipped',
      message: 'Zenler API credentials are not configured',
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return {
      zenlerUserId: null,
      status: 'failed',
      message: 'Student email is required for Zenler enrollment',
    };
  }

  // Placeholder for the live Zenler user/enrollment API calls.
  // The payment flow stores course_price_id + zenler_course_id so enrollment
  // can be completed/retried once the Zenler endpoints are finalized.
  console.info('[zenler-enrollment] queued', {
    email,
    name: input.name,
    zenlerCourseId: input.zenlerCourseId,
  });

  return {
    zenlerUserId: null,
    status: 'pending',
    message: 'Enrollment queued — Zenler user/enroll API integration pending',
  };
}
