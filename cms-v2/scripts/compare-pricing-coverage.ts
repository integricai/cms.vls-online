import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { parseCsvText } from '../src/services/courseGeoPriceImport';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function main(): Promise<void> {
  const csvPath = process.argv[2]
    ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'course-pricing-final-corrected.csv');
  const csv = parseCsvText(fs.readFileSync(csvPath, 'utf8'));
  const csvIds = new Set(csv.map(r => String(r.zenler_course_id ?? '').trim()).filter(Boolean));

  const missing = await sql`
    SELECT c.id, c.name, c.zenler_course_id, c.slug, c.is_active,
           COALESCE(stats.active_price_count, 0) AS active_prices,
           stats.updated_at
    FROM courses c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE is_active) AS active_price_count,
        MAX(updated_at) AS updated_at
      FROM course_geo_prices
      WHERE course_id = c.id
    ) stats ON true
    WHERE c.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM course_geo_prices p
        WHERE p.course_id = c.id
          AND p.is_default = true
          AND p.is_active = true
      )
    ORDER BY c.name ASC
  ` as Array<{
    id: number;
    name: string;
    zenler_course_id: string;
    slug: string | null;
    is_active: boolean;
    active_prices: string;
    updated_at: Date | null;
  }>;

  const notInCsv = missing.filter(row => !csvIds.has(String(row.zenler_course_id)));
  const inCsvNoDefault = missing.filter(row => csvIds.has(String(row.zenler_course_id)));
  const allActive = await sql`SELECT COUNT(*)::int AS n FROM courses WHERE is_active = true`;

  console.log(`CSV rows: ${csv.length}`);
  console.log(`CSV unique zenler course ids: ${csvIds.size}`);
  console.log(`Total active courses: ${allActive[0]?.n ?? 0}`);
  console.log(`Missing active default: ${missing.length}`);
  console.log(`Missing because NOT in CSV: ${notInCsv.length}`);
  console.log(`Missing but zenler id IS in CSV: ${inCsvNoDefault.length}`);

  console.log('\n=== Not in CSV ===');
  for (const row of notInCsv) {
    console.log(`${row.zenler_course_id}\t${row.slug ?? ''}\t${row.name}\tactive_prices=${row.active_prices}`);
  }

  if (inCsvNoDefault.length > 0) {
    console.log('\n=== In CSV but still missing default ===');
    for (const row of inCsvNoDefault) {
      console.log(`${row.zenler_course_id}\t${row.slug ?? ''}\t${row.name}\tactive_prices=${row.active_prices}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
