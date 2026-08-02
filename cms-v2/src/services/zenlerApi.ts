/**
 * Low-level Zenler REST API client (server-side only).
 */

const ZENLER_BASE_URL = process.env.ZENLER_BASE_URL ?? 'https://api.newzenler.com/api/v1';
const ZENLER_ROLE_STUDENT = 4;

export interface ZenlerApiUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  roles?: number[];
}

interface ZenlerApiResponse<T> {
  response_code?: number;
  message?: string;
  data: T;
}

interface ZenlerUserListData {
  items: ZenlerApiUser[];
}

interface ZenlerEnrollmentListData {
  items: Array<{
    course_id: number;
    user_id: string;
    email: string;
  }>;
  pagination?: {
    total_pages?: number;
  };
}

function credentialsConfigured(): boolean {
  return Boolean(process.env.ZENLER_API_KEY?.trim() && process.env.ZENLER_ACCOUNT_NAME?.trim());
}

function zenlerHeaders(): Record<string, string> {
  const apiKey = process.env.ZENLER_API_KEY?.trim() ?? '';
  const account = process.env.ZENLER_ACCOUNT_NAME?.trim() ?? '';
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-Key': apiKey,
    'X-Account-Name': account,
  };
}

async function zenlerFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!credentialsConfigured()) {
    throw new Error('Zenler API credentials are not configured');
  }

  const response = await fetch(`${ZENLER_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...zenlerHeaders(),
      ...(options?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let payload: ZenlerApiResponse<T> | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as ZenlerApiResponse<T>) : null;
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) {
    throw new Error(`Zenler API ${response.status}: ${formatZenlerErrorMessage(payload, raw || response.statusText)}`);
  }

  if (!payload) {
    throw new Error('Zenler API returned an empty response');
  }

  if (payload.response_code != null && payload.response_code !== 200) {
    throw new Error(formatZenlerErrorMessage(payload, `Zenler API error (${payload.response_code})`));
  }

  return payload.data;
}

function formatZenlerErrorMessage(
  payload: ZenlerApiResponse<unknown> | null,
  fallback: string,
): string {
  const data = payload?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const nested = String((data as { message?: unknown }).message ?? '').trim();
    if (nested) return nested;
  }
  const top = String(payload?.message ?? '').trim();
  if (top && top.toLowerCase() !== 'failed') return top;
  if (top) return top;
  const raw = fallback.trim();
  return raw || 'Zenler API error';
}

export function parseZenlerPlanId(code: string | null | undefined): number | undefined {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return undefined;
  const id = Number(trimmed);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function parseZenlerCourseId(courseId: string): number {
  const id = Number(String(courseId).trim());
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid Zenler course id: ${courseId}`);
  }
  return id;
}

export async function findZenlerUserByEmail(email: string): Promise<ZenlerApiUser | null> {
  const normalized = email.trim().toLowerCase();
  const query = new URLSearchParams({
    limit: '15',
    page: '1',
    search: normalized,
  });
  query.append('role[]', String(ZENLER_ROLE_STUDENT));

  const data = await zenlerFetch<ZenlerUserListData>(`/users?${query.toString()}`);
  const match = data.items.find((item) => item.email.trim().toLowerCase() === normalized);
  return match ?? null;
}

export async function createZenlerStudent(input: {
  email: string;
  firstName: string;
  lastName?: string | null;
  password: string;
}): Promise<ZenlerApiUser> {
  const data = await zenlerFetch<ZenlerApiUser>('/users', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName ?? '',
      email: input.email.trim().toLowerCase(),
      password: input.password,
      roles: [ZENLER_ROLE_STUDENT],
    }),
  });
  return data;
}

export async function isStudentEnrolledInCourse(input: {
  zenlerUserId: string;
  email: string;
  zenlerCourseId: string;
}): Promise<boolean> {
  const courseId = parseZenlerCourseId(input.zenlerCourseId);
  const normalizedEmail = input.email.trim().toLowerCase();
  let page = 1;
  let totalPages = 1;

  do {
    const query = new URLSearchParams({
      limit: '100',
      page: String(page),
      course_id: String(courseId),
      start_date: '2000-01-01',
      end_date: new Date().toISOString().slice(0, 10),
    });
    const data = await zenlerFetch<ZenlerEnrollmentListData>(
      `/reports/enrollments/detailed?${query.toString()}`,
    );
    const enrolled = data.items.some((item) => {
      return item.user_id === input.zenlerUserId
        || item.email.trim().toLowerCase() === normalizedEmail;
    });
    if (enrolled) return true;

    totalPages = Number(data.pagination?.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages);

  return false;
}

export async function enrollZenlerUserInCourse(input: {
  zenlerUserId: string;
  zenlerCourseId: string;
  planId?: number;
}): Promise<void> {
  const body: Record<string, number> = {
    course_id: parseZenlerCourseId(input.zenlerCourseId),
  };
  if (input.planId != null) body.plan_id = input.planId;

  await zenlerFetch<unknown>(
    `/users/${encodeURIComponent(input.zenlerUserId)}/enroll`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function unenrollZenlerUserFromCourse(input: {
  zenlerUserId: string;
  zenlerCourseId: string;
}): Promise<'unenrolled' | 'already_unenrolled'> {
  try {
    await zenlerFetch<unknown>(
      `/users/${encodeURIComponent(input.zenlerUserId)}/unenroll`,
      {
        method: 'POST',
        body: JSON.stringify({
          course_id: parseZenlerCourseId(input.zenlerCourseId),
        }),
      },
    );
    return 'unenrolled';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not enrolled/i.test(message)) {
      return 'already_unenrolled';
    }
    throw err;
  }
}

export function zenlerCredentialsConfigured(): boolean {
  return credentialsConfigured();
}
