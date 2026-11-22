/** Pure shaping of Zenler's course-progress report. No network. */

export interface CourseProgressRow {
  courseId: string;
  email: string;
  studentName: string;
  courseName: string;
  percent: number;
  lastAttended: string | null;
}

export interface DashboardCourse {
  id: string;
  name: string;
  percent: number | null;
  lastAttended: string | null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function percent(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function attended(value: unknown): string | null {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  return raw;
}

function rowFrom(value: unknown): CourseProgressRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const courseId = text(row.courseId ?? row.course_id);
  if (!/^\d+$/.test(courseId)) return null;
  return {
    courseId,
    email: text(row.email ?? row.studentEmail).toLowerCase(),
    studentName: text(row.name ?? row.studentName),
    courseName: text(row.courseName ?? row.course_name),
    percent: percent(row.completion_percentage ?? row.completionPercentage),
    lastAttended: attended(row.last_attended ?? row.lastActivity),
  };
}

export function parseCourseProgressItems(data: unknown): CourseProgressRow[] {
  const root = data && typeof data === 'object' ? data as { items?: unknown } : null;
  const items = root?.items ?? data;
  const rows = Array.isArray(items)
    ? items
    : items && typeof items === 'object'
      ? Object.values(items as Record<string, unknown>)
      : [];
  return rows.map(rowFrom).filter((row): row is CourseProgressRow => row !== null);
}

export function firstNameFrom(fullName: string, explicitFirst: string): string {
  const first = explicitFirst.trim();
  if (first) return first;
  const token = fullName.trim().split(/\s+/)[0] ?? '';
  return token;
}

export function initialsFor(firstName: string): string {
  const parts = firstName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Latest study first. Courses with no visit stay after those that have one. */
export function orderDashboardCourses(courses: DashboardCourse[]): DashboardCourse[] {
  return [...courses].sort((a, b) => {
    const aTime = a.lastAttended ? Date.parse(a.lastAttended) : 0;
    const bTime = b.lastAttended ? Date.parse(b.lastAttended) : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.name.localeCompare(b.name);
  });
}
