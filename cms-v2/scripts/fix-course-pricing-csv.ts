/**
 * Fixes course pricing CSV exports for bulk import:
 * - Sets is_default / is_active in the correct columns
 * - Fills missing duration_days for lifetime rows
 *
 * Usage: npx ts-node scripts/fix-course-pricing-csv.ts [input.csv] [output.csv]
 */
import fs from 'fs';
import path from 'path';
import {
  defaultPriorityScore,
  parseCsvText,
  parseImportRow,
  PRICING_TEMPLATE_HEADERS,
} from '../src/services/courseGeoPriceImport';

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rawCell(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function setCell(row: Record<string, unknown>, key: string, value: string): void {
  row[key] = value;
}

function inferDurationDays(row: Record<string, unknown>, parsed: ReturnType<typeof parseImportRow>): number | null {
  if (parsed.durationDays != null) return parsed.durationDays;
  const name = parsed.priceName.toLowerCase();
  if (name.includes('lifetime')) return 1825;
  if (name.includes('one year') || name.includes('annual')) return 365;
  if (name.includes('nine months')) return 270;
  if (name.includes('six months')) return 180;
  if (name.includes('four months') || name.includes('fours months')) return 120;
  if (name.includes('three months')) return 90;
  return null;
}

function fixCsv(inputPath: string, outputPath: string): void {
  const text = fs.readFileSync(inputPath, 'utf8');
  const rows = parseCsvText(text);
  const headers = [...PRICING_TEMPLATE_HEADERS];
  const byCourse = new Map<string, Array<{ index: number; row: Record<string, unknown>; parsed: ReturnType<typeof parseImportRow> }>>();

  rows.forEach((row, index) => {
    const parsed = parseImportRow(row, index + 2);
    const courseKey = parsed.zenlerCourseId ?? parsed.courseSlug ?? `row-${index}`;
    const durationDays = inferDurationDays(row, parsed);
    if (durationDays != null) setCell(row, 'duration_days', String(durationDays));

    const list = byCourse.get(courseKey) ?? [];
    list.push({ index, row, parsed: { ...parsed, durationDays: durationDays ?? parsed.durationDays } });
    byCourse.set(courseKey, list);
  });

  for (const entries of byCourse.values()) {
    const hasExplicitDefault = entries.some(entry => rawCell(entry.row, 'is_default') !== '');

    for (const entry of entries) {
      setCell(entry.row, 'is_active', rawCell(entry.row, 'is_active') || 'TRUE');
    }

    if (hasExplicitDefault) {
      for (const entry of entries) {
        const explicit = rawCell(entry.row, 'is_default').toUpperCase();
        if (explicit === 'TRUE') setCell(entry.row, 'is_default', 'TRUE');
        else if (explicit === 'FALSE') setCell(entry.row, 'is_default', 'FALSE');
        else setCell(entry.row, 'is_default', 'FALSE');
      }
      continue;
    }

    const best = entries.reduce((winner, entry) =>
      defaultPriorityScore(entry.parsed) >= defaultPriorityScore(winner.parsed) ? entry : winner,
    );

    for (const entry of entries) {
      setCell(entry.row, 'is_default', entry.index === best.index ? 'TRUE' : 'FALSE');
    }
  }

  const normalizedRows = rows.map(row => {
    const record: Record<string, string> = {};
    for (const header of headers) {
      if (header === 'compare_at_amount') {
        record[header] = rawCell(row, header) || rawCell(row, 'column_8');
        continue;
      }
      record[header] = rawCell(row, header);
    }
    return record;
  });

  const lines = [
    headers.join(','),
    ...normalizedRows.map(row => headers.map(header => escapeCsv(row[header] ?? '')).join(',')),
  ];

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${normalizedRows.length} rows to ${outputPath}`);
}

const input = process.argv[2] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'course-pricing-final.csv');
const output = process.argv[3] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'course-pricing-final-corrected.csv');

fixCsv(input, output);
