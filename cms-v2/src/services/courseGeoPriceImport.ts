import type {
  CourseGeoPriceInput,
  CoursePriceImportPreview,
  CoursePriceImportPreviewRow,
  CoursePriceImportResult,
  CoursePriceImportRow,
  CoursePriceImportRowError,
} from '../../shared/types';
import { getCourseByZenlerCourseId } from '../models/course';
import {
  findGeoPriceByUpsertKey,
  getCourseBySlug,
  upsertGeoPriceByKey,
} from '../models/courseGeoPrice';
import { normalizeGeoPriceInput, validateGeoPriceInput } from './courseGeoPriceValidation';

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(text)) return true;
  if (['0', 'false', 'no', 'n'].includes(text)) return false;
  return fallback;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : null;
}

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const found = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
    if (found) return row[found];
  }
  return undefined;
}

export function parseImportRow(raw: Record<string, unknown>, rowNumber: number): CoursePriceImportRow {
  return {
    rowNumber,
    zenlerCourseId: String(cell(raw, 'zenler_course_id', 'zenlerCourseId') ?? '').trim() || undefined,
    courseSlug: String(cell(raw, 'course_slug', 'courseSlug') ?? '').trim() || undefined,
    courseTitle: String(cell(raw, 'course_title', 'courseTitle') ?? '').trim() || undefined,
    priceName: String(cell(raw, 'price_name', 'priceName', 'name') ?? '').trim(),
    currency: String(cell(raw, 'currency') ?? 'USD').trim().toUpperCase(),
    amount: parseNumber(cell(raw, 'amount')) ?? NaN,
    compareAtAmount: parseNumber(cell(raw, 'compare_at_amount', 'compareAtAmount')),
    discountPercent: parseNumber(cell(raw, 'discount_percent', 'discountPercent')),
    isDefault: parseBoolean(cell(raw, 'is_default', 'isDefault'), false),
    isActive: parseBoolean(cell(raw, 'is_active', 'isActive'), true),
    validFrom: String(cell(raw, 'valid_from', 'validFrom') ?? '').trim() || null,
    validUntil: String(cell(raw, 'valid_until', 'validUntil') ?? '').trim() || null,
    priority: parseNumber(cell(raw, 'priority')) ?? 0,
    durationMonths: parseNumber(cell(raw, 'duration_months', 'durationMonths')) ?? 6,
  };
}

async function resolveCourseForRow(row: CoursePriceImportRow): Promise<{
  courseId: number;
  courseTitle: string;
  zenlerCourseId: string;
} | null> {
  if (row.zenlerCourseId) {
    const byZenler = await getCourseByZenlerCourseId(row.zenlerCourseId);
    if (byZenler) {
      return {
        courseId: byZenler.id,
        courseTitle: byZenler.name,
        zenlerCourseId: byZenler.zenlerCourseId,
      };
    }
  }

  if (row.courseSlug) {
    const bySlug = await getCourseBySlug(row.courseSlug);
    if (bySlug) {
      return {
        courseId: bySlug.id,
        courseTitle: bySlug.name,
        zenlerCourseId: bySlug.zenlerCourseId,
      };
    }
  }

  return null;
}

export async function previewCoursePriceImport(
  rows: Array<Record<string, unknown>>,
): Promise<CoursePriceImportPreview> {
  const errors: CoursePriceImportRowError[] = [];
  const warnings: CoursePriceImportRowError[] = [];
  const validRows: CoursePriceImportPreviewRow[] = [];
  const defaultTracker = new Map<number, number[]>();

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2; // header is row 1
    const parsed = parseImportRow(rows[i] ?? {}, rowNumber);

    if (!parsed.zenlerCourseId && !parsed.courseSlug) {
      errors.push({
        rowNumber,
        field: 'zenler_course_id',
        message: 'zenler_course_id or course_slug is required',
      });
      continue;
    }

    const course = await resolveCourseForRow(parsed);
    if (!course) {
      errors.push({
        rowNumber,
        field: 'zenler_course_id',
        message: 'Course not found for zenler_course_id / course_slug',
      });
      continue;
    }

    const input: CourseGeoPriceInput = normalizeGeoPriceInput({
      courseId: course.courseId,
      name: parsed.priceName,
      amount: parsed.amount,
      compareAtAmount: parsed.compareAtAmount,
      discountPercent: parsed.discountPercent,
      isDefault: parsed.isDefault,
      isActive: parsed.isActive,
      validFrom: parsed.validFrom,
      validUntil: parsed.validUntil,
      priority: parsed.priority,
      durationMonths: parsed.durationMonths,
    });

    const issues = validateGeoPriceInput(input);
    if (issues.length > 0) {
      for (const issue of issues) {
        errors.push({ rowNumber, field: issue.field, message: issue.message });
      }
      continue;
    }

    if (input.isDefault && input.isActive) {
      const existing = defaultTracker.get(course.courseId) ?? [];
      existing.push(rowNumber);
      defaultTracker.set(course.courseId, existing);
    }

    const existingPrice = await findGeoPriceByUpsertKey({
      courseId: course.courseId,
      name: input.name,
      durationMonths: input.durationMonths ?? 6,
    });

    validRows.push({
      rowNumber,
      action: existingPrice ? 'update' : 'create',
      courseId: course.courseId,
      courseTitle: course.courseTitle,
      zenlerCourseId: course.zenlerCourseId,
      existingPriceId: existingPrice?.id,
      price: {
        ...parsed,
        amount: input.amount,
        currency: 'USD',
        compareAtAmount: input.compareAtAmount,
        discountPercent: input.discountPercent,
        isDefault: input.isDefault,
        isActive: input.isActive,
        priority: input.priority,
        durationMonths: input.durationMonths,
      },
    });
  }

  for (const [courseId, rowNumbers] of defaultTracker.entries()) {
    if (rowNumbers.length > 1) {
      warnings.push({
        rowNumber: rowNumbers[rowNumbers.length - 1]!,
        field: 'is_default',
        message: `Multiple active default prices for course ${courseId} in this file; last row wins`,
      });
    }
  }

  return { validRows, errors, warnings };
}

export async function commitCoursePriceImport(
  preview: CoursePriceImportPreview,
  options: { importValidRowsOnly?: boolean } = {},
): Promise<CoursePriceImportResult> {
  if (preview.errors.length > 0 && !options.importValidRowsOnly) {
    return {
      created: 0,
      updated: 0,
      skipped: preview.validRows.length,
      errors: preview.errors,
    };
  }

  let created = 0;
  let updated = 0;
  const errors: CoursePriceImportRowError[] = [...preview.errors];

  for (const row of preview.validRows) {
    try {
      const input = normalizeGeoPriceInput({
        courseId: row.courseId,
        name: row.price.priceName,
        amount: row.price.amount,
        compareAtAmount: row.price.compareAtAmount,
        discountPercent: row.price.discountPercent,
        isDefault: row.price.isDefault,
        isActive: row.price.isActive,
        validFrom: row.price.validFrom,
        validUntil: row.price.validUntil,
        priority: row.price.priority,
        durationMonths: row.price.durationMonths,
      });
      const result = await upsertGeoPriceByKey(input);
      if (result.created) created += 1;
      else updated += 1;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message: err instanceof Error ? err.message : 'Failed to import row',
      });
    }
  }

  return {
    created,
    updated,
    skipped: options.importValidRowsOnly ? preview.errors.length : 0,
    errors,
  };
}

export const PRICING_TEMPLATE_HEADERS = [
  'zenler_course_id',
  'course_slug',
  'course_title',
  'price_name',
  'amount',
  'discount_percent',
  'compare_at_amount',
  'duration_months',
  'is_default',
  'is_active',
  'valid_from',
  'valid_until',
  'priority',
  'stripe_price_id',
] as const;

export const PRICING_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ['71086', 'fa1', 'ACCA FA1', '6 Months Access', '150.00', '10', '175.00', '6', 'true', 'true', '', '', '100', ''],
  ['71086', 'fa1', 'ACCA FA1', '4 Months Access', '130.00', '', '150.00', '4', 'false', 'true', '', '', '90', ''],
  ['12918', 'f1', 'ACCA F1', '6 Months Access', '349.00', '15', '399.00', '6', 'true', 'true', '', '', '100', ''],
];

export function buildPricingTemplateCsv(): string {
  const lines = [
    PRICING_TEMPLATE_HEADERS.join(','),
    ...PRICING_TEMPLATE_EXAMPLE_ROWS.map(row =>
      row.map(value => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(','),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

/** Minimal CSV parser supporting quoted cells. */
export function parseCsvText(text: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0]!.map(h => h.trim());
  return rows.slice(1).map(values => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}
