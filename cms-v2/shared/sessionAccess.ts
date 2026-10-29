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

const MONTH_NUMBERS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * The whole plan name is a sitting: "Dec 2026", "December 2026", or "December 2026 session".
 * A month mentioned inside a longer name, such as a launch offer, is not a sitting.
 */
export function parseSessionLabel(text: string | null | undefined): ExamSession | null {
  const match = String(text ?? '').trim().match(/^([A-Za-z]+)\s+(\d{4})(?:\s+session)?$/i);
  if (!match) return null;
  const month = MONTH_NUMBERS[match[1].toLowerCase()];
  const year = Number(match[2]);
  return normalizeExamSession(month, year);
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

/** The catalogue plan still has the student enrolled on the 15th if Zenler starts it now. */
export function cataloguePlanReachesSessionEnd(
  durationDays: number | null | undefined,
  now: Date,
  month: number,
  year: number,
): boolean {
  if (durationDays == null || durationDays <= 0) return false;
  return sessionAccessDayCount(now, month, year) <= durationDays;
}

const HOUR_MS = 60 * 60 * 1000;

/** First Zenler failure waits an hour, the second four hours, and each later one a day. */
export function sessionUnenrollDelayMs(attempt: number): number {
  if (attempt <= 1) return HOUR_MS;
  if (attempt === 2) return 4 * HOUR_MS;
  return 24 * HOUR_MS;
}
