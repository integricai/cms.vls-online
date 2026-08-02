const MAILERLITE_BASE = 'https://connect.mailerlite.com/api';

export type MailerLiteSubscriber = {
  id: string;
  email: string;
  status: string;
};

function apiKey(): string {
  return process.env.MAILERLITE_API_KEY?.trim() ?? '';
}

export function mailerliteConfigured(): boolean {
  return Boolean(apiKey());
}

function newsletterGroupIds(): string[] {
  const raw = process.env.MAILERLITE_NEWSLETTER_GROUP_ID?.trim() ?? '';
  if (!raw) return [];
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

async function mailerliteFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('MAILERLITE_API_KEY is not configured');

  const response = await fetch(`${MAILERLITE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message ?? '')
        : '';
    throw new Error(message || `MailerLite ${response.status}: ${raw || response.statusText}`);
  }

  return payload as T;
}

function formatMailerLiteDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export async function upsertMailerLiteSubscriber(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  resubscribe?: boolean;
}): Promise<MailerLiteSubscriber> {
  const email = input.email.trim().toLowerCase();
  const groups = newsletterGroupIds();
  const fields: Record<string, string> = {};
  if (input.firstName?.trim()) fields.name = input.firstName.trim();
  if (input.lastName?.trim()) fields.last_name = input.lastName.trim();

  const body: Record<string, unknown> = {
    email,
    status: 'active',
    resubscribe: input.resubscribe ?? true,
    subscribed_at: formatMailerLiteDate(),
  };
  if (Object.keys(fields).length) body.fields = fields;
  if (groups.length) body.groups = groups;

  const payload = await mailerliteFetch<{ data: MailerLiteSubscriber }>('/subscribers', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    id: String(payload.data.id),
    email: payload.data.email,
    status: payload.data.status,
  };
}

export async function unsubscribeMailerLiteSubscriber(input: {
  email: string;
  subscriberId?: string | null;
}): Promise<MailerLiteSubscriber | null> {
  const email = input.email.trim().toLowerCase();
  const idOrEmail = input.subscriberId?.trim() || email;

  try {
    const payload = await mailerliteFetch<{ data: MailerLiteSubscriber }>(
      `/subscribers/${encodeURIComponent(idOrEmail)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'unsubscribed',
          unsubscribed_at: formatMailerLiteDate(),
        }),
      },
    );
    return {
      id: String(payload.data.id),
      email: payload.data.email,
      status: payload.data.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404|not found/i.test(message)) return null;
    throw err;
  }
}
