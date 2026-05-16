import { sql } from '../db/client';

export interface BlogAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  data: Buffer;
}

export async function saveBlogAsset(args: {
  id: string;
  filename: string;
  sourceUrl: string;
  contentType: string;
  data: Buffer;
}): Promise<void> {
  await sql`
    INSERT INTO cms_blog_assets (id, filename, source_url, content_type, size_bytes, data, created_at)
    VALUES (${args.id}, ${args.filename}, ${args.sourceUrl}, ${args.contentType}, ${args.data.length}, ${args.data}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET filename = EXCLUDED.filename,
          source_url = EXCLUDED.source_url,
          content_type = EXCLUDED.content_type,
          size_bytes = EXCLUDED.size_bytes,
          data = EXCLUDED.data
  `;
}

export async function getBlogAsset(id: string): Promise<BlogAsset | null> {
  const rows = await sql`
    SELECT id, filename, content_type, size_bytes, data
    FROM cms_blog_assets
    WHERE id = ${id}
  `;
  const row = rows[0] as BlogAsset | undefined;
  return row ?? null;
}

export async function deleteBlogAssets(ids: string[]): Promise<void> {
  for (const id of ids) {
    await sql`DELETE FROM cms_blog_assets WHERE id = ${id}`;
  }
}
