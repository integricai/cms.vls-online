import crypto from 'crypto';
import { sql } from '../db/client';

export interface SaleTutorInvite {
  id: number;
  saleId: number;
  tutorId: number;
  token: string;
  emailedAt: Date | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

interface DbRow {
  id: number;
  sale_id: number;
  tutor_id: number;
  token: string;
  emailed_at: Date | null;
  accepted_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

function rowToInvite(row: DbRow): SaleTutorInvite {
  return {
    id: row.id,
    saleId: row.sale_id,
    tutorId: row.tutor_id,
    token: row.token,
    emailedAt: row.emailed_at,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function createInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function defaultInviteExpiry(from = new Date()): Date {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + 7);
  return expires;
}

export async function createSaleTutorInvite(params: {
  saleId: number;
  tutorId: number;
  token?: string;
  expiresAt?: Date;
}): Promise<SaleTutorInvite> {
  const token = params.token ?? createInviteToken();
  const expiresAt = params.expiresAt ?? defaultInviteExpiry();
  const rows = await sql`
    INSERT INTO sale_tutor_invites (sale_id, tutor_id, token, expires_at)
    VALUES (${params.saleId}, ${params.tutorId}, ${token}, ${expiresAt})
    ON CONFLICT (sale_id, tutor_id) DO UPDATE
      SET token = EXCLUDED.token,
          expires_at = EXCLUDED.expires_at,
          emailed_at = NULL,
          accepted_at = NULL
    RETURNING *
  `;
  return rowToInvite(rows[0] as DbRow);
}

export async function markInviteEmailed(id: number): Promise<void> {
  await sql`
    UPDATE sale_tutor_invites
    SET emailed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markInviteAccepted(id: number): Promise<void> {
  await sql`
    UPDATE sale_tutor_invites
    SET accepted_at = NOW()
    WHERE id = ${id} AND accepted_at IS NULL
  `;
}

export async function getInviteByToken(token: string): Promise<(SaleTutorInvite & {
  tutorName: string | null;
  tutorEmail: string | null;
  tutorCommissionPercent: number;
}) | null> {
  const rows = await sql`
    SELECT
      i.*,
      t.name AS tutor_name,
      t.email AS tutor_email,
      COALESCE(t.commission_percent, 0) AS tutor_commission_percent
    FROM sale_tutor_invites i
    JOIN tutors t ON t.id = i.tutor_id
    WHERE i.token = ${token}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as DbRow & {
    tutor_name: string | null;
    tutor_email: string | null;
    tutor_commission_percent: string;
  };
  return {
    ...rowToInvite(row),
    tutorName: row.tutor_name,
    tutorEmail: row.tutor_email,
    tutorCommissionPercent: Number(row.tutor_commission_percent),
  };
}

export async function listInvitesForSale(saleId: number): Promise<SaleTutorInvite[]> {
  const rows = await sql`
    SELECT * FROM sale_tutor_invites
    WHERE sale_id = ${saleId}
    ORDER BY id ASC
  `;
  return (rows as DbRow[]).map(rowToInvite);
}
