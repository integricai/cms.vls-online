const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

export const API_BASE = BASE;

export type AccessLevel = 'admin' | 'assistant' | 'analyst' | 'editor' | 'viewer';

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

try {
  localStorage.removeItem('cms_token');
} catch {
  /* Storage can be unavailable in private mode. The session cookie does not depend on it. */
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

/** Admins and assistants can edit Vault content. `editor` is a legacy content-manager role. */
export function canManageContent(role?: AccessLevel | null): boolean {
  return role === 'admin' || role === 'assistant' || role === 'editor';
}

export function canUsePayments(role?: AccessLevel | null): boolean {
  return canManageContent(role);
}

export function setCurrentUser(user: CurrentUser): void {
  localStorage.setItem('cms_user', JSON.stringify(user));
}

export function clearToken(): void {
  localStorage.removeItem('cms_token');
  localStorage.removeItem('cms_user');
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    /* The cookie clear is best-effort. The page still returns to the sign-in screen. */
  }
  clearToken();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: { ok?: boolean; error?: string; data?: T } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (${res.status})`);
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    clearToken();
    window.location.href = '/login';
    throw new Error(json?.error ?? 'Session expired — please log in again');
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
