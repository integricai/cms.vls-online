import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import type { CoursePriceWorkbookRow } from '../models/courseGeoPrice';
import { parseImportRow } from './courseGeoPriceImport';
import { normalizeGeoPriceInput } from './courseGeoPriceValidation';
import {
  PRICE_SHEET_NAME,
  buildCoursePriceWorkbook,
  courseOfferLabel,
  readCoursePriceWorkbook,
} from './coursePriceWorkbook';

const accaSessions = {
  qualification: 'ACCA',
  offerType: 'exam_sessions' as const,
  courseIds: [] as number[],
  isActive: true,
};
const cimaOpen = {
  qualification: 'CIMA',
  offerType: 'open' as const,
  courseIds: [] as number[],
  isActive: true,
};
const accaAllowlist = {
  qualification: 'ACCA',
  offerType: 'exam_sessions' as const,
  courseIds: [10],
  isActive: true,
};

assert.equal(courseOfferLabel([accaSessions], 'ACCA', 10), 'session');
assert.equal(courseOfferLabel([accaSessions], 'acca', 99), 'session');
assert.equal(courseOfferLabel([cimaOpen], 'CIMA', 4), 'subscription');
assert.equal(courseOfferLabel([accaAllowlist], 'ACCA', 10), 'session');
assert.equal(courseOfferLabel([accaAllowlist], 'ACCA', 11), 'subscription');
assert.equal(courseOfferLabel([{ ...cimaOpen, isActive: false }], 'CIMA', 4), 'session');
assert.equal(courseOfferLabel([], null, 1), 'session');

const preserved = normalizeGeoPriceInput({
  courseId: 1,
  name: 'Six months',
  amount: 150,
  durationDays: 180,
});
assert.equal(preserved.stripePriceId, undefined);
assert.equal(preserved.priceSubtitle, undefined);

const cleared = normalizeGeoPriceInput({
  courseId: 1,
  name: 'Six months',
  amount: 150,
  durationDays: 180,
  priceSubtitle: '  ',
  stripePriceId: 'price_123',
});
assert.equal(cleared.priceSubtitle, null);
assert.equal(cleared.stripePriceId, 'price_123');

function price(partial: Partial<CoursePriceWorkbookRow> & Pick<CoursePriceWorkbookRow, 'courseId' | 'priceName'>): CoursePriceWorkbookRow {
  return {
    zenlerCourseId: '0129',
    courseSlug: 'fa1',
    courseTitle: 'ACCA FA1',
    qualification: 'ACCA',
    pricingCode: '78691',
    priceSubtitle: 'Complete course with tutor support',
    amount: 150,
    discountPercent: 10,
    durationDays: 180,
    isDefault: true,
    isActive: true,
    evenDeals: '73e50a3e-152a-4d61-b0eb-4229f831bf39',
    ...partial,
  };
}

async function roundTrip() {
  const buffer = await buildCoursePriceWorkbook([
    price({ courseId: 10, priceName: 'Six Months Access' }),
    price({
      courseId: 11,
      zenlerCourseId: '42',
      courseTitle: 'CIMA BA1',
      courseSlug: 'ba1',
      qualification: 'CIMA',
      pricingCode: null,
      priceName: 'Four Months Access',
      priceSubtitle: null,
      amount: 99.5,
      discountPercent: null,
      durationDays: 120,
      isDefault: false,
      isActive: false,
      evenDeals: null,
    }),
  ], [accaAllowlist, cimaOpen]);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet(PRICE_SHEET_NAME);
  assert.ok(sheet);
  const headers = (sheet?.getRow(1).values as ExcelJS.CellValue[]).filter(value => value != null).map(String);
  assert.deepEqual(headers, [
    'Zenler course id',
    'Pricing code',
    'Course slug',
    'Course title',
    'Offer',
    'Price name',
    'Price subtitle',
    'Amount',
    'Discount percent',
    'Duration days',
    'Default',
    'Active',
    'Evendeals',
  ]);
  assert.equal(headers.some(header => header.toLowerCase().includes('stripe')), false);
  assert.equal(sheet?.getRow(2).getCell(5).value, 'session');
  assert.equal(sheet?.getRow(3).getCell(5).value, 'subscription');
  assert.equal(sheet?.getRow(2).getCell(1).value, '0129');

  const rows = await readCoursePriceWorkbook(buffer);
  const first = parseImportRow(rows[0]!, Number(rows[0]!.row_number));
  assert.equal(first.rowNumber, 2);
  assert.equal(first.zenlerCourseId, '0129');
  assert.equal(first.pricingCode, '78691');
  assert.equal(first.priceName, 'Six Months Access');
  assert.equal(first.priceSubtitle, 'Complete course with tutor support');
  assert.equal(first.amount, 150);
  assert.equal(first.discountPercent, 10);
  assert.equal(first.durationDays, 180);
  assert.equal(first.isDefault, true);
  assert.equal(first.isActive, true);
  assert.equal(first.evenDeals, '73e50a3e-152a-4d61-b0eb-4229f831bf39');
  assert.equal('offer' in first, false);
  assert.equal('stripePriceId' in first, false);

  const second = parseImportRow(rows[1]!, Number(rows[1]!.row_number));
  assert.equal(second.priceSubtitle, null);
  assert.equal(second.discountPercent, null);
  assert.equal(second.evenDeals, undefined);
  assert.equal(second.isDefault, false);
  assert.equal(second.isActive, false);
  assert.equal(second.amount, 99.5);
}

roundTrip().then(() => {
  console.log('coursePriceWorkbook.test.ts passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
