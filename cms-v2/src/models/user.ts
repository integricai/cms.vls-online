import { sql } from '../db/client';
import type { User, PublicUser } from '../../shared/types';

type DbRow = {
  id: number;
  email: string;
  password_hash: string;
  role: 'admin' | 'editor' | 'viewer';
  reset_token: string | null;
  reset_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToUser(row: DbRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
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

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
