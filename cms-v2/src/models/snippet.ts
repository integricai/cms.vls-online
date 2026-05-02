import { sql } from '../db/client';
import type { Snippet, SnippetInput } from '../../shared/types';

export async function getAllSnippets(): Promise<Snippet[]> {
  const rows = await sql`
    SELECT * FROM snippets ORDER BY updated_at DESC
  `;
  return rows as Snippet[];
}

export async function getSnippetById(id: number): Promise<Snippet | null> {
  const rows = await sql`
    SELECT * FROM snippets WHERE id = ${id} LIMIT 1
  `;
  return (rows[0] as Snippet) ?? null;
}

export async function getSnippetByKey(key: string): Promise<Snippet | null> {
  const rows = await sql`
    SELECT * FROM snippets WHERE key = ${key} LIMIT 1
  `;
  return (rows[0] as Snippet) ?? null;
}

export async function createSnippet(
  input: SnippetInput,
  createdBy: number,
): Promise<Snippet> {
  const rows = await sql`
    INSERT INTO snippets (key, title, html, meta, created_by, created_at, updated_at)
    VALUES (
      ${input.key},
      ${input.title},
      ${input.html},
      ${JSON.stringify(input.meta)},
      ${createdBy},
      NOW(),
      NOW()
    )
    RETURNING *
  `;
  return rows[0] as Snippet;
}

export async function updateSnippet(
  id: number,
  input: Partial<SnippetInput>,
): Promise<Snippet | null> {
  const rows = await sql`
    UPDATE snippets
    SET
      key        = COALESCE(${input.key ?? null}, key),
      title      = COALESCE(${input.title ?? null}, title),
      html       = COALESCE(${input.html ?? null}, html),
      meta       = COALESCE(${input.meta ? JSON.stringify(input.meta) : null}::jsonb, meta),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Snippet) ?? null;
}

export async function deleteSnippet(id: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM snippets WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}
