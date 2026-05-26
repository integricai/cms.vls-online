import { sql } from '../db/client';

export interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  username: string | null;
  userRole: string | null;
  action: string;
  componentKey: string;
  componentName: string | null;
  summary: string;
  changedPaths: string[];
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface DbRow {
  id: string;
  user_id: number | null;
  user_email: string | null;
  username: string | null;
  user_role: string | null;
  action: string;
  component_key: string;
  component_name: string | null;
  summary: string;
  changed_paths: string[] | string | null;
  before_json: unknown;
  after_json: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function rowToLog(row: DbRow): ActivityLog {
  const changedPaths = typeof row.changed_paths === 'string'
    ? JSON.parse(row.changed_paths) as string[]
    : row.changed_paths;
  return {
    id: Number(row.id),
    userId: row.user_id,
    userEmail: row.user_email,
    username: row.username,
    userRole: row.user_role,
    action: row.action,
    componentKey: row.component_key,
    componentName: row.component_name,
    summary: row.summary,
    changedPaths: Array.isArray(changedPaths) ? changedPaths : [],
    beforeJson: row.before_json,
    afterJson: row.after_json,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

function isMissingActivityLogTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === '42P01' || /cms_activity_logs/i.test(err?.message ?? '') && /does not exist|relation/i.test(err?.message ?? '');
}

let ensurePromise: Promise<void> | null = null;

async function ensureActivityLogTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cms_activity_logs (
          id             BIGSERIAL   PRIMARY KEY,
          user_id        INTEGER     REFERENCES users (id) ON DELETE SET NULL,
          user_email     TEXT,
          username       TEXT,
          user_role      TEXT,
          action         TEXT        NOT NULL,
          component_key  TEXT        NOT NULL,
          component_name TEXT,
          summary        TEXT        NOT NULL DEFAULT '',
          changed_paths  JSONB       NOT NULL DEFAULT '[]',
          before_json    JSONB,
          after_json     JSONB,
          ip_address     TEXT,
          user_agent     TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS cms_activity_logs_user_id_idx ON cms_activity_logs (user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS cms_activity_logs_component_key_idx ON cms_activity_logs (component_key)`;
      await sql`CREATE INDEX IF NOT EXISTS cms_activity_logs_created_at_idx ON cms_activity_logs (created_at DESC)`;
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export async function createActivityLog(data: {
  userId: number | null;
  userEmail: string | null;
  username: string | null;
  userRole: string | null;
  action: string;
  componentKey: string;
  componentName?: string | null;
  summary: string;
  changedPaths: string[];
  beforeJson?: unknown;
  afterJson?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ActivityLog | null> {
  try {
    const rows = await sql`
      INSERT INTO cms_activity_logs
        (user_id, user_email, username, user_role, action, component_key, component_name,
         summary, changed_paths, before_json, after_json, ip_address, user_agent)
      VALUES
        (${data.userId}, ${data.userEmail}, ${data.username}, ${data.userRole}, ${data.action},
         ${data.componentKey}, ${data.componentName ?? null}, ${data.summary},
         ${JSON.stringify(data.changedPaths)}, ${data.beforeJson == null ? null : JSON.stringify(data.beforeJson)},
         ${data.afterJson == null ? null : JSON.stringify(data.afterJson)}, ${data.ipAddress ?? null},
         ${data.userAgent ?? null})
      RETURNING *
    `;
    return rowToLog(rows[0] as DbRow);
  } catch (error) {
    if (isMissingActivityLogTable(error)) {
      await ensureActivityLogTable();
      return createActivityLog(data);
    }
    throw error;
  }
}

export async function listActivityLogs(options: {
  currentUserId: number;
  isAdmin: boolean;
  userId?: number | null;
  limit?: number;
}): Promise<ActivityLog[]> {
  const limit = Math.max(1, Math.min(100, options.limit ?? 25));
  const requestedUserId = options.userId ?? null;

  try {
    await ensureActivityLogTable();
    const rows = options.isAdmin
      ? requestedUserId
        ? await sql`
            SELECT * FROM cms_activity_logs
            WHERE user_id = ${requestedUserId}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT * FROM cms_activity_logs
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
      : await sql`
          SELECT * FROM cms_activity_logs
          WHERE user_id = ${options.currentUserId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    return (rows as DbRow[]).map(rowToLog);
  } catch (error) {
    if (isMissingActivityLogTable(error)) {
      await ensureActivityLogTable();
      return listActivityLogs(options);
    }
    throw error;
  }
}
