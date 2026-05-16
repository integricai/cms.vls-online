import { sql } from '../db/client';

export interface BlogAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  data: Buffer;
}

let ensureTablePromise: Promise<void> | null = null;

function ensureBlogAssetsTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cms_blog_assets (
          id           TEXT        PRIMARY KEY,
          filename     TEXT        NOT NULL,
          source_url   TEXT        NOT NULL,
          content_type TEXT        NOT NULL,
          size_bytes   INTEGER     NOT NULL,
          data         BYTEA       NOT NULL,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cms_blog_assets_source_url_idx
        ON cms_blog_assets (source_url)
      `;
    })();
  }
  return ensureTablePromise;
}

export async function saveBlogAsset(args: {
  id: string;
  filename: string;
  sourceUrl: string;
  contentType: string;
  data: Buffer;
}): Promise<void> {
  await ensureBlogAssetsTable();
  const base64Data = args.data.toString('base64');
  await sql`
    INSERT INTO cms_blog_assets (id, filename, source_url, content_type, size_bytes, data, created_at)
    VALUES (${args.id}, ${args.filename}, ${args.sourceUrl}, ${args.contentType}, ${args.data.length}, decode(${base64Data}, 'base64'), NOW())
    ON CONFLICT (id) DO UPDATE
      SET filename = EXCLUDED.filename,
          source_url = EXCLUDED.source_url,
          content_type = EXCLUDED.content_type,
          size_bytes = EXCLUDED.size_bytes,
          data = EXCLUDED.data
  `;
}

export async function getBlogAsset(id: string): Promise<BlogAsset | null> {
  await ensureBlogAssetsTable();
  const rows = await sql`
    SELECT
      id,
      filename,
      content_type AS "contentType",
      size_bytes AS "sizeBytes",
      encode(data, 'base64') AS "dataBase64"
    FROM cms_blog_assets
    WHERE id = ${id}
  `;
  const row = rows[0] as (Omit<BlogAsset, 'data'> & { dataBase64: string }) | undefined;
  if (!row) return null;
  const data = Buffer.from(row.dataBase64, 'base64');
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    data,
  };
}

export async function deleteBlogAssets(ids: string[]): Promise<void> {
  await ensureBlogAssetsTable();
  for (const id of ids) {
    await sql`DELETE FROM cms_blog_assets WHERE id = ${id}`;
  }
}
