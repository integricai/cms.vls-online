import ExcelJS from 'exceljs';

const SHEET_NAME = 'Books';
const COURSE_SHEET = 'Courses';

const TITLE = 'Title';
const DESCRIPTION = 'Description';
const IMAGE_URL = 'Image URL';
const IMAGE_TEXT = 'Image text';
const CURRENCY = 'Currency';
const PRICE = 'Price';
const DISCOUNTED_PRICE = 'Discounted price';
const DISPLAY = 'Display on website';
const COURSE = 'Course';

export class BookWorkbookError extends Error {}

export type BookTemplateCourse = {
  id: number;
  name: string;
  isActive: boolean;
};

export type BookTemplateBook = {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAltText: string;
  currency: string;
  price: number;
  discountedPrice: number | null;
  isActive: boolean;
  courseId: number | null;
};

export type BookSheetRow = {
  rowNumber: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAltText: string;
  currency: string;
  price: string;
  discountedPrice: string;
  display: string;
  course: string;
};

export type PlannedBook = {
  rowNumber: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAltText: string;
  currency: string;
  price: number;
  discountedPrice: number | null;
  isActive: boolean;
  courseId: number | null;
};

export type BookImportPlan = {
  creates: PlannedBook[];
  updates: Array<PlannedBook & { id: number }>;
  errors: Array<{ rowNumber: number; message: string }>;
};

type ExistingBook = BookTemplateBook;

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
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

export function courseOptionLabel(course: { id: number; name: string }, courses: Array<{ id: number; name: string }>): string {
  const name = course.name.trim() || `Course ${course.id}`;
  const key = name.toLowerCase();
  const shared = courses.filter(item => (item.name.trim() || `Course ${item.id}`).toLowerCase() === key).length;
  return shared > 1 ? `${name} (#${course.id})` : name;
}

function labelMap(courses: BookTemplateCourse[]): Map<string, BookTemplateCourse> {
  const map = new Map<string, BookTemplateCourse>();
  for (const course of courses) {
    map.set(courseOptionLabel(course, courses).toLowerCase(), course);
  }
  return map;
}

function parseMoney(value: string): number | null | undefined {
  const cleaned = value.replace(/[£$€,\s]/g, '');
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return Math.round(amount * 100) / 100;
}

function parseDisplay(value: string): boolean | null | undefined {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  if (['yes', 'y', 'true', '1', 'display', 'active'].includes(key)) return true;
  if (['no', 'n', 'false', '0', 'archived', 'hidden'].includes(key)) return false;
  return undefined;
}

export function planBookImport(
  books: ExistingBook[],
  courses: BookTemplateCourse[],
  rows: BookSheetRow[],
): BookImportPlan {
  const plan: BookImportPlan = { creates: [], updates: [], errors: [] };
  const titles = new Map<string, ExistingBook[]>();
  for (const book of books) {
    const key = book.title.trim().toLowerCase();
    const list = titles.get(key) ?? [];
    list.push(book);
    titles.set(key, list);
  }

  const labels = labelMap(courses);
  const courseOwner = new Map<number, string>();
  for (const book of books) {
    if (book.courseId) courseOwner.set(book.courseId, `book:${book.id}`);
  }

  const seenTitles = new Set<string>();

  for (const row of rows) {
    const title = row.title.trim();
    const empty = !title
      && !row.description
      && !row.imageUrl
      && !row.imageAltText
      && !row.currency
      && !row.price
      && !row.discountedPrice
      && !row.display
      && !row.course;
    if (empty) continue;
    if (!title) {
      plan.errors.push({ rowNumber: row.rowNumber, message: 'Title is required.' });
      continue;
    }

    const titleKey = title.toLowerCase();
    if (seenTitles.has(titleKey)) {
      plan.errors.push({ rowNumber: row.rowNumber, message: 'This title is already used on an earlier row.' });
      continue;
    }
    seenTitles.add(titleKey);

    const matches = titles.get(titleKey) ?? [];
    if (matches.length > 1) {
      plan.errors.push({
        rowNumber: row.rowNumber,
        message: 'More than one saved book uses this title. Rename one of them before uploading.',
      });
      continue;
    }
    const existing = matches[0] ?? null;

    const price = parseMoney(row.price);
    if (price == null || price === undefined) {
      plan.errors.push({
        rowNumber: row.rowNumber,
        message: price === undefined ? 'Price must be a valid number.' : 'Price is required.',
      });
      continue;
    }

    const discounted = parseMoney(row.discountedPrice);
    if (discounted === undefined) {
      plan.errors.push({ rowNumber: row.rowNumber, message: 'Discounted price must be a valid number, or left blank.' });
      continue;
    }

    const display = parseDisplay(row.display);
    if (display === undefined) {
      plan.errors.push({ rowNumber: row.rowNumber, message: 'Display on website must be Yes or No.' });
      continue;
    }

    const currencyText = row.currency.trim().toUpperCase();
    if (currencyText && !/^[A-Z]{3}$/.test(currencyText)) {
      plan.errors.push({ rowNumber: row.rowNumber, message: 'Currency must be a 3-letter code such as GBP.' });
      continue;
    }

    let courseId: number | null = null;
    const courseText = row.course.trim();
    if (courseText) {
      const course = labels.get(courseText.toLowerCase());
      const keepsCurrent = existing?.courseId
        && course?.id === existing.courseId;
      if (!course || (!course.isActive && !keepsCurrent)) {
        plan.errors.push({
          rowNumber: row.rowNumber,
          message: 'Choose a course from the template list, or leave the cell blank.',
        });
        continue;
      }
      courseId = course.id;
      const owner = courseOwner.get(courseId);
      const mine = existing ? `book:${existing.id}` : '';
      if (owner && owner !== mine) {
        plan.errors.push({ rowNumber: row.rowNumber, message: 'That course is already linked to another book.' });
        continue;
      }
    }

    if (existing?.courseId) courseOwner.delete(existing.courseId);
    if (courseId) courseOwner.set(courseId, existing ? `book:${existing.id}` : `row:${row.rowNumber}`);

    const planned: PlannedBook = {
      rowNumber: row.rowNumber,
      title,
      description: row.description.trim(),
      imageUrl: row.imageUrl.trim(),
      imageAltText: row.imageAltText.trim(),
      currency: currencyText || existing?.currency || 'GBP',
      price,
      discountedPrice: discounted,
      isActive: display ?? existing?.isActive ?? true,
      courseId,
    };
    if (existing) plan.updates.push({ ...planned, id: existing.id });
    else plan.creates.push(planned);
  }

  return plan;
}

export async function buildBookTemplate(
  books: BookTemplateBook[],
  courses: BookTemplateCourse[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.columns = [
    { header: TITLE, key: 'title', width: 42 },
    { header: DESCRIPTION, key: 'description', width: 48 },
    { header: IMAGE_URL, key: 'imageUrl', width: 42 },
    { header: IMAGE_TEXT, key: 'imageAltText', width: 28 },
    { header: CURRENCY, key: 'currency', width: 14 },
    { header: PRICE, key: 'price', width: 12 },
    { header: DISCOUNTED_PRICE, key: 'discountedPrice', width: 18 },
    { header: DISPLAY, key: 'display', width: 22 },
    { header: COURSE, key: 'course', width: 36 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { name: 'Arial', size: 11, bold: true };
  sheet.getCell(1, 9).note = 'Optional. Pick one active course. Each course can belong to only one book.';

  const active = courses.filter(course => course.isActive);
  const courseSheet = workbook.addWorksheet(COURSE_SHEET);
  const labels = active.map(course => courseOptionLabel(course, courses));
  labels.forEach((label, index) => {
    courseSheet.getCell(index + 1, 1).value = label;
  });
  courseSheet.state = 'hidden';

  const known = new Map(courses.map(course => [course.id, courseOptionLabel(course, courses)]));
  for (const book of books) {
    sheet.addRow({
      title: book.title,
      description: book.description,
      imageUrl: book.imageUrl,
      imageAltText: book.imageAltText,
      currency: book.currency || 'GBP',
      price: book.price,
      discountedPrice: book.discountedPrice ?? '',
      display: book.isActive ? 'Yes' : 'No',
      course: book.courseId ? known.get(book.courseId) ?? '' : '',
    });
  }

  const lastDataRow = Math.max(sheet.rowCount + 30, 50);
  if (labels.length) {
    const formula = `${COURSE_SHEET}!$A$1:$A$${labels.length}`;
    for (let row = 2; row <= lastDataRow; row += 1) {
      sheet.getCell(row, 9).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: 'Course',
        error: 'Choose a course from the list, or leave the cell blank.',
      };
    }
  }

  const notes = workbook.addWorksheet('Instructions');
  notes.getColumn(1).width = 110;
  [
    'Each row is one book. A title that already exists updates that book. A new title adds a book.',
    'Leave Course blank when the book is not linked to a course. A course can be linked to only one book.',
    'The Course list is the active courses in the vault. Stripe links are not in this file. Checkout uses the price below.',
    'Discounted price is optional. When it is filled in, that is the amount charged. Display on website is Yes or No.',
    'Image URL is a link to the cover. Quantity is calculated in the vault and is not part of this file.',
  ].forEach((line, index) => {
    const cell = notes.getCell(index + 1, 1);
    cell.value = line;
    cell.font = { name: 'Arial', size: 11 };
  });

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export async function readBookWorkbook(buffer: Buffer): Promise<BookSheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BookWorkbookError('Could not read that Excel file. Download a fresh template and edit that.');
  }

  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets.find(item => item.state === 'visible') ?? workbook.worksheets[0];
  if (!sheet) throw new BookWorkbookError('The workbook has no sheets.');

  const columns = {
    title: 0,
    description: 0,
    imageUrl: 0,
    imageAltText: 0,
    currency: 0,
    price: 0,
    discountedPrice: 0,
    display: 0,
    course: 0,
  };
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const key = headerKey(cellText(cell.value));
    if (key === 'title') columns.title = column;
    else if (key === 'description') columns.description = column;
    else if (key === 'imageurl') columns.imageUrl = column;
    else if (key === 'imagetext' || key === 'imagealt' || key === 'imagealttext') columns.imageAltText = column;
    else if (key === 'currency') columns.currency = column;
    else if (key === 'price') columns.price = column;
    else if (key === 'discountedprice') columns.discountedPrice = column;
    else if (key === 'displayonwebsite' || key === 'display') columns.display = column;
    else if (key === 'course') columns.course = column;
  });

  if (!columns.title || !columns.price || !columns.course) {
    throw new BookWorkbookError('The sheet needs Title, Price, and Course columns. Download a fresh template.');
  }

  const rows: BookSheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const next: BookSheetRow = {
      rowNumber,
      title: cellText(row.getCell(columns.title).value),
      description: columns.description ? cellText(row.getCell(columns.description).value) : '',
      imageUrl: columns.imageUrl ? cellText(row.getCell(columns.imageUrl).value) : '',
      imageAltText: columns.imageAltText ? cellText(row.getCell(columns.imageAltText).value) : '',
      currency: columns.currency ? cellText(row.getCell(columns.currency).value) : '',
      price: cellText(row.getCell(columns.price).value),
      discountedPrice: columns.discountedPrice ? cellText(row.getCell(columns.discountedPrice).value) : '',
      display: columns.display ? cellText(row.getCell(columns.display).value) : '',
      course: cellText(row.getCell(columns.course).value),
    };
    rows.push(next);
  });
  return rows;
}
