/** Exam-session access ends on the 15th of the sitting month, London time. */

const LONDON = 'Europe/London';

/** Sales table names. March stays written out; the other months stay short. */
const SALE_MONTHS = [
  '', 'Jan', 'Feb', 'March', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type ExamSession = { month: number; year: number };

export function sessionSaleLabel(month: number, year: number): string {
  const name = SALE_MONTHS[month];
  if (!name || !Number.isInteger(year)) return '';
  return `${name} ${year}`;
}

export function normalizeExamSession(
  month: number | null | undefined,
  year: number | null | undefined,
): ExamSession | null {
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month == null || year == null) return null;
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { month, year };
}

export function londonCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isoDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** UTC instant of a London wall-clock time. */
function londonWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc));
    const pick = (type: string) => Number(parts.find(part => part.type === type)?.value);
    let seenHour = pick('hour');
    let seenDay = pick('day');
    let seenMonth = pick('month');
    let seenYear = pick('year');
    if (seenHour === 24) {
      seenHour = 0;
      const next = new Date(Date.UTC(seenYear, seenMonth - 1, seenDay));
      next.setUTCDate(next.getUTCDate() + 1);
      seenYear = next.getUTCFullYear();
      seenMonth = next.getUTCMonth() + 1;
      seenDay = next.getUTCDate();
    }
    const seen = Date.UTC(seenYear, seenMonth - 1, seenDay, seenHour, pick('minute'));
    const delta = seen - desired;
    if (delta === 0) return new Date(utc);
    utc -= delta;
  }
  return new Date(utc);
}

/** Last instant of the 15th in London. Access includes that whole day. */
export function sessionAccessEndsAt(month: number, year: number): Date {
  const startOfNextDay = londonWallTimeToUtc(year, month, 16, 0, 0);
  return new Date(startOfNextDay.getTime() - 1);
}

/**
 * London calendar days from the purchase date through the 15th.
 * 30 October 2026 → 15 December 2026 is 46.
 */
export function sessionAccessDayCount(soldAt: Date, month: number, year: number): number {
  const sold = londonCalendarDate(soldAt);
  const end = `${year}-${String(month).padStart(2, '0')}-15`;
  return isoDayNumber(end) - isoDayNumber(sold);
}
