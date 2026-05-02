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
    await sql(statement);
  }
  console.log(`Done: ${file}`);
}

async function main() {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await runMigration(file);
  }

  console.log('All migrations complete.');
}

main().catch(err => {
  console.error('[migrate]', err);
  process.exit(1);
});
