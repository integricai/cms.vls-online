import { listCourses, updateCoursePageUrlByZenlerId } from '../models/course';
import type { Course, CoursePageUrlImportResult } from '../../shared/types';
import { parseCsvText } from './courseGeoPriceImport';

const CSV_HEADERS = ['zenler_course_id', 'name', 'slug', 'course_page_url'] as const;

function csvEscape(value: string | null | undefined): string {
  const text = value ?? '';
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function normalizeCoursePageUrl(raw: unknown): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'vls-online.com' || host.endsWith('.vls-online.com') || host === 'localhost') {
        const path = `${url.pathname}${url.search}` || '/';
        return path;
      }
      return trimmed;
    }
  } catch {
    // Fall through and treat as a relative path.
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const match = Object.keys(row).find(candidate => candidate.toLowerCase() === key.toLowerCase());
    if (match) return row[match];
  }
  return undefined;
}

export function buildCoursePageUrlCsv(courses: Course[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...courses.map(course => [
      csvEscape(course.zenlerCourseId),
      csvEscape(course.name),
      csvEscape(course.slug),
      csvEscape(course.coursePageUrl),
    ].join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export async function importCoursePageUrlsFromCsv(csv: string): Promise<CoursePageUrlImportResult> {
  const rows = parseCsvText(csv);
  const courses = await listCourses();
  const byZenlerId = new Map(courses.map(course => [course.zenlerCourseId, course]));

  const result: CoursePageUrlImportResult = {
    updated: 0,
    cleared: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const zenlerCourseId = String(cell(row, 'zenler_course_id', 'zenlerCourseId') ?? '').trim();
    if (!zenlerCourseId) {
      result.errors.push({ rowNumber, zenlerCourseId: '', message: 'zenler_course_id is required' });
      continue;
    }

    const existing = byZenlerId.get(zenlerCourseId);
    if (!existing) {
      result.errors.push({
        rowNumber,
        zenlerCourseId,
        message: 'Course not found for zenler_course_id',
      });
      continue;
    }

    const nextUrl = normalizeCoursePageUrl(cell(row, 'course_page_url', 'coursePageUrl'));
    const current = existing.coursePageUrl ?? null;
    if (current === nextUrl) {
      result.skipped += 1;
      continue;
    }

    const saved = await updateCoursePageUrlByZenlerId(zenlerCourseId, nextUrl);
    if (!saved) {
      result.errors.push({ rowNumber, zenlerCourseId, message: 'Could not update course_page_url' });
      continue;
    }
    existing.coursePageUrl = saved.coursePageUrl;
    if (nextUrl) result.updated += 1;
    else result.cleared += 1;
  }

  return result;
}
