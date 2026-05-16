const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

export type AccessLevel = 'admin' | 'editor' | 'viewer';

export interface CurrentUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: AccessLevel;
  isBlocked: boolean;
  createdAt: string;
}

export function getToken(): string | null {
  return localStorage.getItem('cms_token');
}

export function setToken(token: string): void {
  localStorage.setItem('cms_token', token);
}

export function getCurrentUser(): CurrentUser | null {
  const raw = localStorage.getItem('cms_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: CurrentUser): void {
  localStorage.setItem('cms_user', JSON.stringify(user));
}

export function clearToken(): void {
  localStorage.removeItem('cms_token');
  localStorage.removeItem('cms_user');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('cms_token');
    window.location.href = '/login';
    throw new Error('Session expired — please log in again');
  }

  let json: { ok?: boolean; error?: string; data?: T } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (${res.status})`);
  }

  if (!res.ok) {
    const error = new Error(json?.error ?? `HTTP ${res.status}`) as Error & { data?: unknown; status?: number };
    error.data = json?.data;
    error.status = res.status;
    throw error;
  }
  return json!.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
