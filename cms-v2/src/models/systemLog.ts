import { sql } from '../db/client';

export type SystemLogLevel = 'error' | 'warn' | 'info';

export interface SystemLog {
  id: number;
  level: SystemLogLevel;
  area: string;
  explanation: string;
  errorName: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  requestMethod: string | null;
  requestUrl: string | null;
  requestIp: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
}

interface DbRow {
  id: string;
  level: string;
  area: string;
  explanation: string;
  error_name: string | null;
  error_message: string | null;
  error_stack: string | null;
  request_method: string | null;
  request_url: string | null;
  request_ip: string | null;
  extra: unknown;
  created_at: string;
}

function asLevel(value: string): SystemLogLevel {
  if (value === 'warn' || value === 'info') return value;
  return 'error';
}

function asExtra(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function rowToLog(row: DbRow): SystemLog {
  return {
    id: Number(row.id),
    level: asLevel(row.level),
    area: row.area,
    explanation: row.explanation,
    errorName: row.error_name,
    errorMessage: row.error_message,
    errorStack: row.error_stack,
    requestMethod: row.request_method,
    requestUrl: row.request_url,
    requestIp: row.request_ip,
    extra: asExtra(row.extra),
    createdAt: row.created_at,
  };
}

function isMissingTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === '42P01'
    || (/cms_system_logs/i.test(err?.message ?? '') && /does not exist|relation/i.test(err?.message ?? ''));
}

let ensurePromise: Promise<void> | null = null;

async function ensureSystemLogTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cms_system_logs (
          id              BIGSERIAL   PRIMARY KEY,
          level           TEXT        NOT NULL DEFAULT 'error',
          area            TEXT        NOT NULL,
          explanation     TEXT        NOT NULL DEFAULT '',
          error_name      TEXT,
          error_message   TEXT,
          error_stack     TEXT,
          request_method  TEXT,
          request_url     TEXT,
          request_ip      TEXT,
          extra           JSONB       NOT NULL DEFAULT '{}'::jsonb,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS cms_system_logs_created_at_idx ON cms_system_logs (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS cms_system_logs_area_idx ON cms_system_logs (area)`;
      await sql`CREATE INDEX IF NOT EXISTS cms_system_logs_level_idx ON cms_system_logs (level)`;
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export async function createSystemLog(data: {
  level?: SystemLogLevel;
  area: string;
  explanation: string;
  errorName?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  requestMethod?: string | null;
  requestUrl?: string | null;
  requestIp?: string | null;
  extra?: Record<string, unknown>;
}): Promise<SystemLog | null> {
  try {
    const rows = await sql`
      INSERT INTO cms_system_logs
        (level, area, explanation, error_name, error_message, error_stack,
         request_method, request_url, request_ip, extra)
      VALUES
        (${data.level ?? 'error'}, ${data.area}, ${data.explanation},
         ${data.errorName ?? null}, ${data.errorMessage ?? null}, ${data.errorStack ?? null},
         ${data.requestMethod ?? null}, ${data.requestUrl ?? null}, ${data.requestIp ?? null},
         ${JSON.stringify(data.extra ?? {})})
      RETURNING *
    `;
    return rowToLog(rows[0] as DbRow);
  } catch (error) {
    if (isMissingTable(error)) {
      await ensureSystemLogTable();
      return createSystemLog(data);
    }
    console.error('[system-log] failed to persist', error);
    return null;
  }
}

export async function listSystemLogs(options: {
  level?: SystemLogLevel | null;
  area?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<SystemLog[]> {
  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  const level = options.level ?? null;
  const area = options.area?.trim() || null;
  const q = options.q?.trim() || null;
  const like = q ? `%${q}%` : null;

  try {
    await ensureSystemLogTable();
    const rows = await sql`
      SELECT * FROM cms_system_logs
      WHERE (${level}::text IS NULL OR level = ${level})
        AND (${area}::text IS NULL OR area = ${area})
        AND (
          ${like}::text IS NULL
          OR area ILIKE ${like}
          OR explanation ILIKE ${like}
          OR COALESCE(error_message, '') ILIKE ${like}
          OR COALESCE(request_url, '') ILIKE ${like}
        )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return (rows as DbRow[]).map(rowToLog);
  } catch (error) {
    if (isMissingTable(error)) {
      await ensureSystemLogTable();
      return listSystemLogs(options);
    }
    throw error;
  }
}
