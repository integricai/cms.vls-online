import ExcelJS from 'exceljs';
import { listCourses, updateCourseWorkbookFieldsByZenlerId } from '../models/course';
import type { Course, CoursePageUrlImportResult } from '../../shared/types';
import { normalizeCoursePageUrl } from './coursePageUrlImport';

const SHEET_NAME = 'Courses';
const ID_HEADER = 'Zenler course id';
const TITLE_HEADER = 'Course title';
const URL_HEADER = 'Course URL';

const ID_HEADERS = new Set(['zenlercourseid', 'zenlerid', 'courseid']);
const TITLE_HEADERS = new Set(['coursetitle', 'title', 'name', 'coursename']);
const URL_HEADERS = new Set(['courseurl', 'url', 'coursepageurl', 'storyblokurl', 'pageurl']);

export class CourseWorkbookError extends Error {}

export type WorkbookCourse = {
  zenlerCourseId: string;
  name: string;
  coursePageUrl: string | null;
};

export type WorkbookRow = {
  rowNumber: number;
  zenlerCourseId: string;
  name: string;
  courseUrl: string;
};

export type WorkbookPatch = {
  rowNumber: number;
  zenlerCourseId: string;
  name?: string;
  coursePageUrl?: string;
};

export type WorkbookPlan = {
  patches: WorkbookPatch[];
  namesUpdated: number;
  urlsUpdated: number;
  skipped: number;
  errors: CoursePageUrlImportResult['errors'];
};

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

export function planCourseWorkbookUpdates(courses: WorkbookCourse[], rows: WorkbookRow[]): WorkbookPlan {
  const byZenlerId = new Map(courses.map(course => [course.zenlerCourseId, course]));
  const seen = new Set<string>();
  const plan: WorkbookPlan = {
    patches: [],
    namesUpdated: 0,
    urlsUpdated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    if (!row.zenlerCourseId && !row.name && !row.courseUrl) continue;

    if (!row.zenlerCourseId) {
      plan.errors.push({
        rowNumber: row.rowNumber,
        zenlerCourseId: '',
        message: 'Zenler course id is required',
      });
      continue;
    }

    if (seen.has(row.zenlerCourseId)) {
      plan.errors.push({
        rowNumber: row.rowNumber,
        zenlerCourseId: row.zenlerCourseId,
        message: 'Zenler course id is listed more than once. The first row is kept.',
      });
      continue;
    }
    seen.add(row.zenlerCourseId);

    const existing = byZenlerId.get(row.zenlerCourseId);
    if (!existing) {
      plan.errors.push({
        rowNumber: row.rowNumber,
        zenlerCourseId: row.zenlerCourseId,
        message: 'Course not found for this Zenler course id',
      });
      continue;
    }

    const patch: WorkbookPatch = { rowNumber: row.rowNumber, zenlerCourseId: row.zenlerCourseId };
    const nextName = row.name.trim();
    if (nextName && nextName !== existing.name) {
      patch.name = nextName;
      plan.namesUpdated += 1;
    }

    const nextUrl = row.courseUrl.trim() ? normalizeCoursePageUrl(row.courseUrl) : null;
    if (nextUrl && nextUrl !== (existing.coursePageUrl ?? null)) {
      patch.coursePageUrl = nextUrl;
      plan.urlsUpdated += 1;
    }

    if (patch.name === undefined && patch.coursePageUrl === undefined) {
      plan.skipped += 1;
      continue;
    }
    plan.patches.push(patch);
  }

  return plan;
}

export async function buildCourseWorkbook(courses: Course[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vertex Vault';

  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.columns = [
    { header: ID_HEADER, key: 'zenlerCourseId', width: 24 },
    { header: TITLE_HEADER, key: 'name', width: 56 },
    { header: URL_HEADER, key: 'coursePageUrl', width: 64 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'C1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const course of courses) {
    const row = sheet.addRow({
      zenlerCourseId: course.zenlerCourseId,
      name: course.name,
      coursePageUrl: course.coursePageUrl ?? '',
    });
    row.getCell(1).numFmt = '@';
  }

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, bold: row.number === 1 };
    });
  });

  const notes = workbook.addWorksheet('Instructions');
  notes.getColumn(1).width = 110;
  const lines = [
    'Fill in missing course URLs or correct course titles, then import this file on the Courses tab.',
    'Do not change Zenler course id. That column matches each row to the course already in the vault.',
    'A blank Course title or Course URL keeps the current value. Type a new value to replace it.',
    'Course URL example: /courses/acca-business-and-technology-f1',
  ];
  lines.forEach((line, index) => {
    const cell = notes.getCell(index + 1, 1);
    cell.value = line;
    cell.font = { name: 'Arial', size: 11 };
  });

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export async function readCourseWorkbook(buffer: Buffer): Promise<WorkbookRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new CourseWorkbookError('Could not read that Excel file. Export a fresh workbook and edit that.');
  }
  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) throw new CourseWorkbookError('The workbook has no sheets.');

  const headerRow = sheet.getRow(1);
  let idColumn = 0;
  let titleColumn = 0;
  let urlColumn = 0;
  headerRow.eachCell({ includeEmpty: false }, (cell, column) => {
    const key = headerKey(cellText(cell.value));
    if (ID_HEADERS.has(key)) idColumn = column;
    else if (TITLE_HEADERS.has(key)) titleColumn = column;
    else if (URL_HEADERS.has(key)) urlColumn = column;
  });

  if (!idColumn || !titleColumn || !urlColumn) {
    throw new CourseWorkbookError(
      'The sheet needs columns Zenler course id, Course title, and Course URL.',
    );
  }

  const rows: WorkbookRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const zenlerCourseId = cellText(row.getCell(idColumn).value);
    const name = cellText(row.getCell(titleColumn).value);
    const courseUrl = cellText(row.getCell(urlColumn).value);
    if (!zenlerCourseId && !name && !courseUrl) return;
    rows.push({ rowNumber, zenlerCourseId, name, courseUrl });
  });
  return rows;
}

export async function importCourseWorkbook(buffer: Buffer): Promise<CoursePageUrlImportResult> {
  const rows = await readCourseWorkbook(buffer);
  const courses = await listCourses();
  const plan = planCourseWorkbookUpdates(courses, rows);

  for (const patch of plan.patches) {
    const saved = await updateCourseWorkbookFieldsByZenlerId(patch.zenlerCourseId, {
      name: patch.name,
      coursePageUrl: patch.coursePageUrl,
    });
    if (!saved) {
      plan.errors.push({
        rowNumber: patch.rowNumber,
        zenlerCourseId: patch.zenlerCourseId,
        message: 'Could not update the course',
      });
      if (patch.name) plan.namesUpdated = Math.max(0, plan.namesUpdated - 1);
      if (patch.coursePageUrl) plan.urlsUpdated = Math.max(0, plan.urlsUpdated - 1);
    }
  }

  return {
    updated: plan.urlsUpdated,
    namesUpdated: plan.namesUpdated,
    cleared: 0,
    skipped: plan.skipped,
    errors: plan.errors,
  };
}
