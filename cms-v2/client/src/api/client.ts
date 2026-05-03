const BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('cms_token');
}

export function setToken(token: string): void {
  localStorage.setItem('cms_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('cms_token');
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

  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json!.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
};
