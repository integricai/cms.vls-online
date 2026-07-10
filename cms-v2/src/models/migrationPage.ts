import { sql } from '../db/client';
import type { MigrationPageRecord, MigrationTemplate } from '../../shared/migrationTypes';

let ensureTablePromise: Promise<void> | null = null;

function ensureMigrationPagesTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS content_migration_pages (
          id                      SERIAL       PRIMARY KEY,
          origin_url              TEXT         NOT NULL UNIQUE,
          zenler_url              TEXT         NOT NULL,
          title                   TEXT,
          path                    TEXT         NOT NULL,
          template                TEXT         NOT NULL DEFAULT 'landing',
          suggested_destination   TEXT         NOT NULL,
          destination_slug        TEXT         NOT NULL,
          migrated_at             TIMESTAMPTZ,
          storyblok_story_id      INTEGER,
          scanned_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
          created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
          updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_migration_pages_template
        ON content_migration_pages (template)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_migration_pages_path
        ON content_migration_pages (path)
      `;
    })();
  }
  return ensureTablePromise;
}

interface DbRow {
  id: number;
  origin_url: string;
  zenler_url: string;
  title: string | null;
  path: string;
  template: string;
  suggested_destination: string;
  destination_slug: string;
  migrated_at: Date | null;
  storyblok_story_id: number | null;
  scanned_at: Date;
  created_at: Date;
  updated_at: Date;
}

function rowToRecord(row: DbRow): MigrationPageRecord {
  return {
    id: row.id,
    originUrl: row.origin_url,
    zenlerUrl: row.zenler_url,
    title: row.title,
    path: row.path,
    template: row.template as MigrationTemplate,
    suggestedDestination: row.suggested_destination,
    destinationSlug: row.destination_slug,
    migratedAt: row.migrated_at?.toISOString() ?? null,
    storyblokStoryId: row.storyblok_story_id,
    scannedAt: row.scanned_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listMigrationPages(): Promise<MigrationPageRecord[]> {
  await ensureMigrationPagesTable();
  const rows = await sql`
    SELECT *
    FROM content_migration_pages
    ORDER BY path ASC, origin_url ASC
  `;
  return (rows as DbRow[]).map(rowToRecord);
}

export async function getMigrationPageById(id: number): Promise<MigrationPageRecord | null> {
  await ensureMigrationPagesTable();
  const rows = await sql`
    SELECT *
    FROM content_migration_pages
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = (rows as DbRow[])[0];
  return row ? rowToRecord(row) : null;
}

export async function getMigrationPageByOriginUrl(originUrl: string): Promise<MigrationPageRecord | null> {
  await ensureMigrationPagesTable();
  const rows = await sql`
    SELECT *
    FROM content_migration_pages
    WHERE origin_url = ${originUrl}
    LIMIT 1
  `;
  const row = (rows as DbRow[])[0];
  return row ? rowToRecord(row) : null;
}

export interface UpsertMigrationPageInput {
  originUrl: string;
  zenlerUrl: string;
  title: string | null;
  path: string;
  template: MigrationTemplate;
  suggestedDestination: string;
  destinationSlug: string;
}

export async function upsertMigrationPage(input: UpsertMigrationPageInput): Promise<'inserted' | 'updated'> {
  await ensureMigrationPagesTable();
  const existing = await getMigrationPageByOriginUrl(input.originUrl);
  if (existing) {
    await sql`
      UPDATE content_migration_pages
      SET
        zenler_url = ${input.zenlerUrl},
        title = ${input.title},
        path = ${input.path},
        template = ${input.template},
        suggested_destination = ${input.suggestedDestination},
        destination_slug = COALESCE(NULLIF(${input.destinationSlug}, ''), destination_slug),
        scanned_at = NOW(),
        updated_at = NOW()
      WHERE origin_url = ${input.originUrl}
    `;
    return 'updated';
  }

  await sql`
    INSERT INTO content_migration_pages (
      origin_url,
      zenler_url,
      title,
      path,
      template,
      suggested_destination,
      destination_slug
    ) VALUES (
      ${input.originUrl},
      ${input.zenlerUrl},
      ${input.title},
      ${input.path},
      ${input.template},
      ${input.suggestedDestination},
      ${input.destinationSlug}
    )
  `;
  return 'inserted';
}

export async function updateMigrationPage(
  id: number,
  patch: Partial<Pick<MigrationPageRecord, 'template' | 'destinationSlug' | 'title'>>,
): Promise<MigrationPageRecord | null> {
  await ensureMigrationPagesTable();
  const existing = await getMigrationPageById(id);
  if (!existing) return null;

  const template = patch.template ?? existing.template;
  const destinationSlug = patch.destinationSlug ?? existing.destinationSlug;
  const title = patch.title ?? existing.title;

  await sql`
    UPDATE content_migration_pages
    SET
      template = ${template},
      destination_slug = ${destinationSlug},
      title = ${title},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return getMigrationPageById(id);
}

export async function markMigrationPageMigrated(
  id: number,
  storyId: number,
): Promise<void> {
  await ensureMigrationPagesTable();
  await sql`
    UPDATE content_migration_pages
    SET
      migrated_at = NOW(),
      storyblok_story_id = ${storyId},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}
