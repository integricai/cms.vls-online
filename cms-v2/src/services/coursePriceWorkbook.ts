import ExcelJS from 'exceljs';
import { evenDealsProductLabel } from '../../shared/evenDealsProducts';
import type { QualificationOfferRule } from '../../shared/types';
import { listCoursePriceWorkbookRows, type CoursePriceWorkbookRow } from '../models/courseGeoPrice';
import { listQualificationOfferRules } from '../models/qualificationOfferRule';

export const PRICE_SHEET_NAME = 'Prices';

const COLUMNS = [
  { header: 'Zenler course id', field: 'zenler_course_id', width: 22 },
  { header: 'Pricing code', field: 'pricing_code', width: 16 },
  { header: 'Course slug', field: 'course_slug', width: 24 },
  { header: 'Course title', field: 'course_title', width: 40 },
  { header: 'Offer', field: 'offer', width: 16 },
  { header: 'Price name', field: 'price_name', width: 28 },
  { header: 'Price subtitle', field: 'price_subtitle', width: 42 },
  { header: 'Amount', field: 'amount', width: 12 },
  { header: 'Discount percent', field: 'discount_percent', width: 18 },
  { header: 'Duration days', field: 'duration_days', width: 16 },
  { header: 'Default', field: 'is_default', width: 12 },
  { header: 'Active', field: 'is_active', width: 12 },
  { header: 'Evendeals', field: 'evendeals', width: 42 },
] as const;

const HEADER_TO_FIELD = new Map<string, string>(
  COLUMNS.flatMap(column => {
    const aliases = [headerKey(column.header), headerKey(column.field)];
    return aliases.map(alias => [alias, column.field] as const);
  }),
);

const REQUIRED_FIELDS = ['zenler_course_id', 'price_name', 'amount', 'duration_days'];

export class CoursePriceWorkbookError extends Error {}

export type CourseOfferLabel = 'session' | 'subscription';

type OfferRule = Pick<QualificationOfferRule, 'qualification' | 'offerType' | 'courseIds' | 'isActive'>;

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return '';
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text).join('').trim();
    }
    if ('text' in value && value.text != null) {
      const text = cellText(value.text as ExcelJS.CellValue);
      if (text) return text;
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink.trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function cellValue(value: ExcelJS.CellValue): string | number | boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return cellText(value);
}

/** Session when exam sittings apply to this course. Subscription for open qualifications and courses outside the exam-session list. */
export function courseOfferLabel(
  rules: OfferRule[],
  qualification: string | null | undefined,
  courseId: number,
): CourseOfferLabel {
  const key = String(qualification ?? '').trim().toLowerCase();
  const rule = key
    ? rules.find(item => item.qualification.trim().toLowerCase() === key) ?? null
    : null;
  if (!rule || !rule.isActive || rule.offerType !== 'exam_sessions') {
    return rule?.isActive && rule.offerType === 'open' ? 'subscription' : 'session';
  }
  const allowlist = rule.courseIds ?? [];
  if (allowlist.length === 0 || allowlist.includes(courseId)) return 'session';
  return 'subscription';
}

function evenDealsCell(value: string | null): string {
  if (!value) return '';
  return evenDealsProductLabel(value) ?? value;
}

export async function buildCoursePriceWorkbook(
  rows: CoursePriceWorkbookRow[],
  rules: OfferRule[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VLS CMS';
  const sheet = workbook.addWorksheet(PRICE_SHEET_NAME);
  sheet.columns = COLUMNS.map(column => ({
    header: column.header,
    key: column.field,
    width: column.width,
  }));
  sheet.autoFilter = { from: 'A1', to: 'M1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getCell('A1').note = 'Matches the course. Leave this value as exported.';
  sheet.getCell('B1').note = 'Matches an existing price when it is filled in.';
  sheet.getCell('E1').note = 'Session or subscription for this course. Import leaves this unchanged.';

  for (const row of rows) {
    const added = sheet.addRow({
      zenler_course_id: row.zenlerCourseId,
      pricing_code: row.pricingCode ?? '',
      course_slug: row.courseSlug ?? '',
      course_title: row.courseTitle,
      offer: courseOfferLabel(rules, row.qualification, row.courseId),
      price_name: row.priceName,
      price_subtitle: row.priceSubtitle ?? '',
      amount: row.amount,
      discount_percent: row.discountPercent ?? '',
      duration_days: row.durationDays ?? '',
      is_default: row.isDefault ? 'true' : 'false',
      is_active: row.isActive ? 'true' : 'false',
      evendeals: evenDealsCell(row.evenDeals),
    });
    added.getCell('zenler_course_id').numFmt = '@';
    added.getCell('pricing_code').numFmt = '@';
    added.getCell('amount').numFmt = '0.00';
  }

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, bold: row.number === 1 };
    });
  });

  const notes = workbook.addWorksheet('Instructions');
  notes.getColumn(1).width = 120;
  const lines = [
    'Edit prices in this file, then use Import data on the Prices screen. Preview the changes before you confirm.',
    'Leave Zenler course id as exported. That column matches each row to the course.',
    'Pricing code matches an existing price. A new price name and duration, with no matching pricing code, creates a price.',
    'Offer shows session or subscription for the course. Import does not change it.',
    'You can edit price name, price subtitle, amount, discount percent, duration days, default, active, and Evendeals.',
    'Amount is the list price in USD. A blank discount percent clears the discount.',
    'A blank default or active cell keeps the current value. A blank price subtitle clears the custom subtitle.',
    'A blank Evendeals cell keeps the current Evendeals product. Choose a product name to replace it.',
    'Stripe price ids are left out of this file and stay as they are.',
  ];
  lines.forEach((line, index) => {
    const cell = notes.getCell(index + 1, 1);
    cell.value = line;
    cell.font = { name: 'Arial', size: 11 };
  });

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export async function readCoursePriceWorkbook(buffer: Buffer): Promise<Array<Record<string, unknown>>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new CoursePriceWorkbookError('Could not read that Excel file. Export a fresh workbook and edit that.');
  }

  const sheet = workbook.getWorksheet(PRICE_SHEET_NAME) ?? workbook.worksheets.find(item => item.name !== 'Instructions') ?? workbook.worksheets[0];
  if (!sheet) throw new CoursePriceWorkbookError('The workbook has no sheets.');

  const headerRow = sheet.getRow(1);
  const columns = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, column) => {
    const field = HEADER_TO_FIELD.get(headerKey(cellText(cell.value)));
    if (field) columns.set(column, field);
  });

  const present = new Set(columns.values());
  const missing = REQUIRED_FIELDS.filter(field => !present.has(field));
  if (missing.length > 0) {
    throw new CoursePriceWorkbookError(
      'The sheet needs columns Zenler course id, Price name, Amount, and Duration days.',
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = { row_number: rowNumber };
    let hasValue = false;
    for (const [column, field] of columns) {
      const value = cellValue(row.getCell(column).value);
      record[field] = value;
      if (String(value).trim() !== '') hasValue = true;
    }
    if (hasValue) rows.push(record);
  });
  return rows;
}

export async function buildCoursePriceWorkbookExport(): Promise<Buffer> {
  const [rows, rules] = await Promise.all([
    listCoursePriceWorkbookRows(),
    listQualificationOfferRules(),
  ]);
  return buildCoursePriceWorkbook(rows, rules);
}
