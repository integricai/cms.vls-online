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
          storyblok_story_id      BIGINT,
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
      await sql`
        ALTER TABLE content_migration_pages
        ALTER COLUMN storyblok_story_id TYPE BIGINT
        USING storyblok_story_id::bigint
      `;
      await sql`
        ALTER TABLE content_migration_pages
          ADD COLUMN IF NOT EXISTS scraped_data JSONB,
          ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS scrape_warnings JSONB,
          ADD COLUMN IF NOT EXISTS structure_data JSONB,
          ADD COLUMN IF NOT EXISTS structure_generated_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS draft_story_id BIGINT
      `;
      await sql`
        ALTER TABLE content_migration_pages
          ADD COLUMN IF NOT EXISTS custom_component_name TEXT
      `;
      await sql`
        ALTER TABLE content_migration_pages
          ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'live',
          ADD COLUMN IF NOT EXISTS page_content_filename TEXT
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
  scraped_data: unknown;
  scraped_at: Date | null;
  scrape_warnings: string[] | null;
  structure_data: unknown;
  structure_generated_at: Date | null;
  draft_story_id: number | null;
  custom_component_name: string | null;
  source_type: string;
  page_content_filename: string | null;
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
    scrapedAt: row.scraped_at?.toISOString() ?? null,
    scrapeWarnings: row.scrape_warnings ?? [],
    structureGeneratedAt: row.structure_generated_at?.toISOString() ?? null,
    draftStoryId: row.draft_story_id,
    customComponentName: row.custom_component_name,
    sourceType: row.source_type === 'file' ? 'file' : 'live',
    pageContentFilename: row.page_content_filename,
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

export async function saveScrapeResult(
  id: number,
  input: { scraped: unknown; warnings: string[] },
): Promise<void> {
  await ensureMigrationPagesTable();
  await sql`
    UPDATE content_migration_pages
    SET
      scraped_data = ${JSON.stringify(input.scraped)}::jsonb,
      scraped_at = NOW(),
      scrape_warnings = ${JSON.stringify(input.warnings)}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function saveStructureResult(
  id: number,
  input: { structure: unknown; draftStoryId: number | null },
): Promise<void> {
  await ensureMigrationPagesTable();
  await sql`
    UPDATE content_migration_pages
    SET
      structure_data = ${JSON.stringify(input.structure)}::jsonb,
      structure_generated_at = NOW(),
      draft_story_id = ${input.draftStoryId},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getScrapedData(id: number): Promise<unknown | null> {
  await ensureMigrationPagesTable();
  const rows = await sql`
    SELECT scraped_data
    FROM content_migration_pages
    WHERE id = ${id}
    LIMIT 1
  `;
  return (rows as Array<{ scraped_data: unknown }>)[0]?.scraped_data ?? null;
}

export async function updateMigrationPageSource(
  id: number,
  patch: Partial<{ sourceType: 'live' | 'file'; pageContentFilename: string | null }>,
): Promise<void> {
  await ensureMigrationPagesTable();
  const existing = await getMigrationPageById(id);
  if (!existing) return;

  const sourceType = patch.sourceType ?? existing.sourceType;
  const pageContentFilename = patch.pageContentFilename !== undefined
    ? patch.pageContentFilename
    : existing.pageContentFilename;

  await sql`
    UPDATE content_migration_pages
    SET
      source_type = ${sourceType},
      page_content_filename = ${pageContentFilename},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function upsertPageContentMigrationPage(input: {
  filename: string;
  canonicalUrl: string;
  title: string;
  slug: string;
}): Promise<MigrationPageRecord> {
  await ensureMigrationPagesTable();

  let path = `/${input.slug}`;
  try {
    path = new URL(input.canonicalUrl).pathname || path;
  } catch {
    // keep derived path
  }

  await upsertMigrationPage({
    originUrl: input.canonicalUrl,
    zenlerUrl: input.canonicalUrl,
    title: input.title,
    path,
    template: 'qualification_level_page',
    suggestedDestination: input.slug,
    destinationSlug: input.slug,
  });

  const page = await getMigrationPageByOriginUrl(input.canonicalUrl);
  if (!page) {
    throw new Error('Failed to upsert page-content migration page');
  }

  await updateMigrationPageSource(page.id, {
    sourceType: 'file',
    pageContentFilename: input.filename,
  });

  const updated = await getMigrationPageById(page.id);
  if (!updated) {
    throw new Error('Failed to load page-content migration page');
  }
  return updated;
}

export async function saveCustomComponentName(id: number, componentName: string): Promise<void> {
  await ensureMigrationPagesTable();
  await sql`
    UPDATE content_migration_pages
    SET
      custom_component_name = ${componentName},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getStructureData(id: number): Promise<unknown | null> {
  await ensureMigrationPagesTable();
  const rows = await sql`
    SELECT structure_data
    FROM content_migration_pages
    WHERE id = ${id}
    LIMIT 1
  `;
  return (rows as Array<{ structure_data: unknown }>)[0]?.structure_data ?? null;
}
