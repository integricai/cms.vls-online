import { sql } from '../db/client';
import type { AccessLevel, User, PublicUser } from '../../shared/types';

type DbRow = {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  password_hash: string;
  role: AccessLevel;
  is_blocked?: boolean;
  reset_token: string | null;
  reset_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function isMissingUserManagementColumn(err: unknown): boolean {
  return typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code?: string }).code === '42703';
}

function rowToUser(row: DbRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username ?? row.email,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    passwordHash: row.password_hash,
    role: row.role,
    isBlocked: row.is_blocked ?? false,
    resetToken: row.reset_token,
    resetTokenExpiresAt: row.reset_token_expires_at ? new Date(row.reset_token_expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0] as DbRow) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0] as DbRow) : null;
}

export async function findUserByLogin(login: string): Promise<User | null> {
  try {
    const rows = await sql`
      SELECT * FROM users
      WHERE username = ${login} OR email = ${login}
      LIMIT 1
    `;
    return rows[0] ? rowToUser(rows[0] as DbRow) : null;
  } catch (err) {
    if (!isMissingUserManagementColumn(err)) throw err;
    return findUserByEmail(login);
  }
}

export async function findUserById(id: number): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0] as DbRow) : null;
}

export async function findUserByResetToken(token: string): Promise<User | null> {
  const rows = await sql`
    SELECT * FROM users
    WHERE reset_token = ${token}
      AND reset_token_expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ? rowToUser(rows[0] as DbRow) : null;
}

export async function updatePasswordHash(userId: number, hash: string): Promise<void> {
  await sql`
    UPDATE users
    SET password_hash = ${hash},
        reset_token = NULL,
        reset_token_expires_at = NULL,
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function saveResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  await sql`
    UPDATE users
    SET reset_token = ${token},
        reset_token_expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await sql`
    SELECT * FROM users
    ORDER BY created_at DESC
  `;
  return rows.map(row => toPublicUser(rowToUser(row as DbRow)));
}

export async function createUser(input: {
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  accessLevel: AccessLevel;
}): Promise<PublicUser> {
  const rows = await sql`
    INSERT INTO users (email, username, first_name, last_name, password_hash, role)
    VALUES (
      ${input.username},
      ${input.username},
      ${input.firstName},
      ${input.lastName},
      ${input.passwordHash},
      ${input.accessLevel}
    )
    RETURNING *
  `;
  return toPublicUser(rowToUser(rows[0] as DbRow));
}

export async function updateUser(userId: number, input: {
  firstName?: string;
  lastName?: string;
  accessLevel?: AccessLevel;
  isBlocked?: boolean;
}): Promise<PublicUser | null> {
  const current = await findUserById(userId);
  if (!current) return null;

  const rows = await sql`
    UPDATE users
    SET first_name = ${input.firstName ?? current.firstName},
        last_name = ${input.lastName ?? current.lastName},
        role = ${input.accessLevel ?? current.role},
        is_blocked = ${input.isBlocked ?? current.isBlocked},
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  return rows[0] ? toPublicUser(rowToUser(rows[0] as DbRow)) : null;
}

export async function deleteUser(userId: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM users
    WHERE id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}
