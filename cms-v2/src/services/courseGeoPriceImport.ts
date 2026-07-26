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

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(text)) return true;
  if (['0', 'false', 'no', 'n'].includes(text)) return false;
  return undefined;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
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

export function defaultPriorityScore(row: Pick<CoursePriceImportRow, 'pricingMode' | 'durationDays' | 'examSessionMonth' | 'examSessionYear'>): number {
  const duration = row.durationDays ?? 0;
  const year = row.examSessionYear ?? 0;
  const month = row.examSessionMonth ?? 0;
  return duration * 1_000_000 + year * 100 + month;
}

export function parseImportRow(raw: Record<string, unknown>, rowNumber: number): CoursePriceImportRow {
  const pricingModeRaw = String(cell(raw, 'pricing_mode', 'pricingMode') ?? '').trim().toLowerCase();
  const pricingMode = pricingModeRaw === 'session' ? 'session' : 'duration';
  const isDefault = parseOptionalBoolean(cell(raw, 'is_default', 'isDefault'));
  const isActive = parseOptionalBoolean(cell(raw, 'is_active', 'isActive'));

  return {
    rowNumber,
    zenlerCourseId: String(cell(raw, 'zenler_course_id', 'zenlerCourseId') ?? '').trim() || undefined,
    pricingCode: String(cell(raw, 'pricing_code', 'pricingCode', 'zenler_pricing_code') ?? '').trim() || undefined,
    courseSlug: String(cell(raw, 'course_slug', 'courseSlug') ?? '').trim() || undefined,
    courseTitle: String(cell(raw, 'course_title', 'courseTitle') ?? '').trim() || undefined,
    priceName: String(cell(raw, 'price_name', 'priceName', 'name') ?? '').trim(),
    currency: String(cell(raw, 'currency') ?? 'USD').trim().toUpperCase(),
    amount: parseNumber(cell(raw, 'amount')) ?? NaN,
    compareAtAmount: parseNumber(cell(raw, 'compare_at_amount', 'compareAtAmount')),
    discountPercent: parseNumber(cell(raw, 'discount_percent', 'discountPercent')),
    isDefault,
    isActive,
    pricingMode,
    examSessionMonth: parseNumber(cell(raw, 'exam_session_month', 'examSessionMonth')),
    examSessionYear: parseNumber(cell(raw, 'exam_session_year', 'examSessionYear')),
    durationDays: parseNumber(cell(raw, 'duration_days', 'durationDays')),
    evenDeals: (() => {
      const rawValue = cell(raw, 'evendeals', 'evenDeals', 'even_deals');
      if (rawValue == null || rawValue === '') return undefined;
      return String(rawValue).trim() || null;
    })(),
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

function resolveEffectiveFlags(
  parsed: CoursePriceImportRow,
  existing: { isDefault: boolean; isActive: boolean } | null,
  action: 'create' | 'update',
): { isDefault: boolean; isActive: boolean } {
  const isActive = parsed.isActive !== undefined
    ? parsed.isActive
    : (action === 'update' && existing ? existing.isActive : true);
  const isDefault = parsed.isDefault !== undefined
    ? parsed.isDefault
    : (action === 'update' && existing ? existing.isDefault : false);
  return { isDefault, isActive };
}

function applyAutoDefaults(validRows: CoursePriceImportPreviewRow[], warnings: CoursePriceImportRowError[]): number {
  const byCourse = new Map<number, CoursePriceImportPreviewRow[]>();
  for (const row of validRows) {
    const list = byCourse.get(row.courseId) ?? [];
    list.push(row);
    byCourse.set(row.courseId, list);
  }

  let autoDefaultedCourses = 0;

  for (const [courseId, rows] of byCourse.entries()) {
    const hasExplicitDefault = rows.some(row => row.defaultSpecified);
    const hasActiveDefault = rows.some(row => row.price.isDefault === true && row.price.isActive !== false);

    if (hasActiveDefault) continue;
    if (hasExplicitDefault) continue;

    const activeRows = rows.filter(row => row.price.isActive !== false);
    if (activeRows.length === 0) continue;

    const best = activeRows.reduce((winner, row) =>
      defaultPriorityScore(row.price) >= defaultPriorityScore(winner.price) ? row : winner,
    );

    for (const row of rows) {
      row.price.isDefault = row.rowNumber === best.rowNumber;
    }

    autoDefaultedCourses += 1;
    warnings.push({
      rowNumber: best.rowNumber,
      field: 'is_default',
      message: `Course ${courseId} had no is_default set; auto-selected "${best.price.priceName}" as default`,
    });
  }

  return autoDefaultedCourses;
}

export async function previewCoursePriceImport(
  rows: Array<Record<string, unknown>>,
): Promise<CoursePriceImportPreview> {
  const errors: CoursePriceImportRowError[] = [];
  const warnings: CoursePriceImportRowError[] = [];
  const validRows: CoursePriceImportPreviewRow[] = [];
  const defaultTracker = new Map<number, number[]>();
  let duplicatesToDeactivate = 0;

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

    const existingPrice = await findGeoPriceByUpsertKey({
      courseId: course.courseId,
      pricingCode: parsed.pricingCode,
      name: parsed.priceName,
      pricingMode: parsed.pricingMode ?? 'duration',
      durationDays: parsed.durationDays,
      examSessionMonth: parsed.examSessionMonth,
      examSessionYear: parsed.examSessionYear,
    });

    const action = existingPrice ? 'update' : 'create';
    const effectiveFlags = resolveEffectiveFlags(
      parsed,
      existingPrice ? { isDefault: existingPrice.isDefault, isActive: existingPrice.isActive } : null,
      action,
    );

    const input: CourseGeoPriceInput = normalizeGeoPriceInput({
      courseId: course.courseId,
      name: parsed.priceName,
      amount: parsed.amount,
      compareAtAmount: parsed.compareAtAmount,
      discountPercent: parsed.discountPercent,
      isDefault: effectiveFlags.isDefault,
      isActive: effectiveFlags.isActive,
      zenlerPricingCode: parsed.pricingCode ?? null,
      ...(parsed.evenDeals !== undefined ? { evenDeals: parsed.evenDeals } : {}),
      pricingMode: parsed.pricingMode,
      examSessionMonth: parsed.examSessionMonth,
      examSessionYear: parsed.examSessionYear,
      durationDays: parsed.durationDays,
    });

    const issues = validateGeoPriceInput(input);
    if (issues.length > 0) {
      for (const issue of issues) {
        errors.push({ rowNumber, field: issue.field, message: issue.message });
      }
      continue;
    }

    if (existingPrice && existingPrice.name !== parsed.priceName) {
      warnings.push({
        rowNumber,
        field: 'price_name',
        message: `Will update existing ${existingPrice.durationDays ?? ''} day price (was "${existingPrice.name}")`,
      });
      duplicatesToDeactivate += 1;
    }

    if (input.isDefault && input.isActive) {
      const existing = defaultTracker.get(course.courseId) ?? [];
      existing.push(rowNumber);
      defaultTracker.set(course.courseId, existing);
    }

    validRows.push({
      rowNumber,
      action,
      courseId: course.courseId,
      courseTitle: course.courseTitle,
      zenlerCourseId: course.zenlerCourseId,
      existingPriceId: existingPrice?.id,
      defaultSpecified: parsed.isDefault !== undefined,
      price: {
        ...parsed,
        amount: input.amount,
        currency: 'USD',
        compareAtAmount: input.compareAtAmount,
        discountPercent: input.discountPercent,
        isDefault: effectiveFlags.isDefault,
        isActive: effectiveFlags.isActive,
        evenDeals: parsed.evenDeals !== undefined ? (input.evenDeals ?? null) : parsed.evenDeals,
        pricingMode: input.pricingMode,
        examSessionMonth: input.examSessionMonth,
        examSessionYear: input.examSessionYear,
        durationDays: input.durationDays,
      },
    });
  }

  const autoDefaultedCourses = applyAutoDefaults(validRows, warnings);

  for (const [courseId, rowNumbers] of defaultTracker.entries()) {
    if (rowNumbers.length > 1) {
      warnings.push({
        rowNumber: rowNumbers[rowNumbers.length - 1]!,
        field: 'is_default',
        message: `Multiple active default prices for course ${courseId} in this file; last row wins`,
      });
    }
  }

  const coursesWithDefault = new Set(
    validRows.filter(row => row.price.isDefault === true && row.price.isActive !== false).map(row => row.courseId),
  );
  const allCourses = new Set(validRows.map(row => row.courseId));
  const coursesWithoutDefault = [...allCourses].filter(courseId => !coursesWithDefault.has(courseId)).length;

  if (coursesWithoutDefault > 0) {
    warnings.push({
      rowNumber: 0,
      field: 'is_default',
      message: `${coursesWithoutDefault} course(s) will still have no active default price after import`,
    });
  }

  return {
    validRows,
    errors,
    warnings,
    stats: {
      coursesWithoutDefault,
      duplicatesToDeactivate,
      autoDefaultedCourses,
    },
  };
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
      deactivated: 0,
      errors: preview.errors,
    };
  }

  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const errors: CoursePriceImportRowError[] = [...preview.errors];

  for (const row of preview.validRows) {
    try {
      const input = normalizeGeoPriceInput({
        courseId: row.courseId,
        name: row.price.priceName,
        amount: row.price.amount,
        compareAtAmount: row.price.compareAtAmount,
        discountPercent: row.price.discountPercent,
        isDefault: row.price.isDefault ?? false,
        isActive: row.price.isActive ?? true,
        zenlerPricingCode: row.price.pricingCode ?? null,
        ...(row.price.evenDeals !== undefined ? { evenDeals: row.price.evenDeals } : {}),
        pricingMode: row.price.pricingMode,
        examSessionMonth: row.price.examSessionMonth,
        examSessionYear: row.price.examSessionYear,
        durationDays: row.price.durationDays,
      });
      const result = await upsertGeoPriceByKey(input);
      deactivated += result.deactivated;
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
    deactivated,
    errors,
  };
}

export const PRICING_TEMPLATE_HEADERS = [
  'zenler_course_id',
  'pricing_code',
  'course_slug',
  'course_title',
  'price_name',
  'amount',
  'discount_percent',
  'compare_at_amount',
  'pricing_mode',
  'duration_days',
  'exam_session_month',
  'exam_session_year',
  'is_default',
  'is_active',
  'stripe_price_id',
  'evendeals',
] as const;

export const PRICING_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ['71086', '78691', 'fa1', 'ACCA FA1', 'Six Months Access', '150.00', '10', '175.00', 'duration', '180', '', '', 'true', 'true', '', '73e50a3e-152a-4d61-b0eb-4229f831bf39'],
  ['71086', '191934', 'fa1', 'ACCA FA1', 'Four Months Access', '130.00', '', '150.00', 'duration', '120', '', '', 'false', 'true', '', '73e50a3e-152a-4d61-b0eb-4229f831bf39'],
  ['12918', '', 'f1', 'ACCA F1', 'November 2026 Session', '349.00', '15', '399.00', 'session', '', '11', '2026', 'true', 'true', '', '81318eab-7b83-4b9b-babc-808fc0bc2433'],
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
      const key = header || `column_${index + 1}`;
      record[key] = values[index] ?? '';
    });
    return record;
  });
}
