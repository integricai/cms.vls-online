const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
export function getToken() {
    return localStorage.getItem('cms_token');
}
export function setToken(token) {
    localStorage.setItem('cms_token', token);
}
export function getCurrentUser() {
    const raw = localStorage.getItem('cms_user');
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function setCurrentUser(user) {
    localStorage.setItem('cms_user', JSON.stringify(user));
}
export function clearToken() {
    localStorage.removeItem('cms_token');
    localStorage.removeItem('cms_user');
}
async function request(method, path, body) {
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
    let json = null;
    try {
        json = await res.json();
    }
    catch {
        throw new Error(`Server error (${res.status})`);
    }
    if (!res.ok)
        throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json.data;
}
export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
};
