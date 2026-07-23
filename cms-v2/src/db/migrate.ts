import dotenv from 'dotenv';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// Use the unpooled connection for DDL — pooled connections don't support
// multi-statement transactions reliably on Neon.
const sql = neon(connectionString);

async function ensureMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const rows = await sql`SELECT filename FROM schema_migrations`;
  return new Set((rows as Array<{ filename: string }>).map(row => row.filename));
}

async function markMigrationApplied(filename: string): Promise<void> {
  await sql`
    INSERT INTO schema_migrations (filename)
    VALUES (${filename})
    ON CONFLICT (filename) DO NOTHING
  `;
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${name}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function bootstrapExistingSchema(allFiles: string[]): Promise<void> {
  const applied = await getAppliedMigrations();
  if (applied.size > 0) return;

  if (!(await tableExists('courses'))) return;

  const hasGeoPrices = await tableExists('course_geo_prices');
  if (!hasGeoPrices) return;

  const hasCustomers = await tableExists('customers');

  for (const file of allFiles) {
    if (file === '029_customers_and_sales.sql' && !hasCustomers) continue;
    await markMigrationApplied(file);
  }

  console.log('Bootstrapped schema_migrations for an existing database (skipping historical migrations).');
}

async function runMigration(file: string): Promise<void> {
  const filePath = path.resolve(__dirname, 'migrations', file);
  const ddl = fs.readFileSync(filePath, 'utf8');

  console.log(`Running migration: ${file}`);
  // Split on semicolons. Strip single-line comments before checking whether
  // a chunk has real SQL content (avoids filtering chunks that START with a
  // comment block but contain actual DDL on subsequent lines).
  const statements = ddl
    .split(';')
    .map(s => s.trim())
    .filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0);

  for (const statement of statements) {
    try {
      await sql(statement);
    } catch (err) {
      if (
        typeof err === 'object'
        && err !== null
        && 'code' in err
        && (err as { code?: string }).code === '42710'
        && statement.toUpperCase().startsWith('CREATE TYPE USER_ROLE AS ENUM')
      ) {
        console.log('Skipping existing user_role enum.');
        continue;
      }
      throw err;
    }
  }
  await markMigrationApplied(file);
  console.log(`Done: ${file}`);
}

async function main() {
  await ensureMigrationsTable();

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  await bootstrapExistingSchema(files);

  const applied = await getAppliedMigrations();
  const pending = files.filter(file => !applied.has(file));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const file of pending) {
    await runMigration(file);
  }

  console.log('All migrations complete.');
}

main().catch(err => {
  console.error('[migrate]', err);
  process.exit(1);
});
