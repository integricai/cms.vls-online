// ── Auth ──────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number;
  email: string;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  deployId?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  username: string;
  newPassword: string;
  captchaToken: string;
  captchaAnswer: string;
}

// ── Users ─────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: 'admin' | 'editor' | 'viewer';
  isBlocked: boolean;
  resetToken: string | null;
  resetTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Pick<User, 'id' | 'email' | 'username' | 'firstName' | 'lastName' | 'role' | 'isBlocked' | 'createdAt'>;

export type AccessLevel = 'admin' | 'editor' | 'viewer';

// ── Snippets ──────────────────────────────────────────────────────

export interface Snippet {
  id: number;
  key: string;
  title: string;
  html: string;
  meta: Record<string, unknown>;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SnippetInput = Pick<Snippet, 'key' | 'title' | 'html' | 'meta'>;

// ── API responses ─────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
