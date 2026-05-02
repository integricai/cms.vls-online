import { sql } from '../db/client';

export interface CmsContentRow {
  key: string;
  data: unknown;
  updated_by: number | null;
  updated_at: string;
}

export async function getContent(key: string): Promise<CmsContentRow | null> {
  const rows = await sql`
    SELECT key, data, updated_by, updated_at
    FROM cms_content
    WHERE key = ${key}
  `;
  return (rows[0] as CmsContentRow) ?? null;
}

export async function upsertContent(
  key: string,
  data: unknown,
  updatedBy?: number,
): Promise<CmsContentRow> {
  const rows = await sql`
    INSERT INTO cms_content (key, data, updated_by, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}, ${updatedBy ?? null}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET data       = EXCLUDED.data,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
    RETURNING key, data, updated_by, updated_at
  `;
  return rows[0] as CmsContentRow;
}

export async function listContentKeys(): Promise<string[]> {
  const rows = await sql`SELECT key FROM cms_content ORDER BY key`;
  return rows.map((r: Record<string, unknown>) => r['key'] as string);
}
