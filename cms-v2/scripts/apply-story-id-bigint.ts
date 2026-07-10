import dotenv from 'dotenv';
import path from 'path';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  await sql`
    ALTER TABLE content_migration_pages
    ALTER COLUMN storyblok_story_id TYPE BIGINT
    USING storyblok_story_id::bigint
  `;

  const cols = await sql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name = 'content_migration_pages'
      AND column_name = 'storyblok_story_id'
  `;

  console.log('OK storyblok_story_id type:', cols[0]?.data_type);
}

main().catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});
