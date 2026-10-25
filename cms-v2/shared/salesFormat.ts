/** London calendar helpers and sale labels shared by the API and the vault. */

const LONDON = 'Europe/London';

export type DashboardRange = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 8)}01`;
}

/** Same calendar day in an earlier month, clamped to that month's last day. */
export function shiftMonth(isoDate: string, deltaMonths: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const nextMonth = target.getUTCMonth() + 1;
  return `${target.getUTCFullYear()}-${String(nextMonth).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

export function dashboardRangeBounds(
  range: DashboardRange,
  today = londonToday(),
): { start: string; end: string } {
  if (range === 'last_7_days') return { start: addIsoDays(today, -6), end: today };
  if (range === 'last_30_days') return { start: addIsoDays(today, -29), end: today };
  if (range === 'last_month') {
    const endLast = addIsoDays(monthStart(today), -1);
    return { start: monthStart(endLast), end: endLast };
  }
  return { start: monthStart(today), end: today };
}

export function eachIsoDay(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 400) {
    days.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return days;
}

/** Null when there is no earlier amount to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatDisplayDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: LONDON,
  }).format(date);
}

/** Access length plus the date the session stays valid until. */
export function saleSessionLabel(
  durationDays: number,
  expiry: Date | string | null | undefined,
): string {
  const months = Math.max(1, Math.round(Number(durationDays) / 30));
  const length = months === 1 ? '1 month' : `${months} months`;
  const valid = formatDisplayDate(expiry);
  if (valid === '—') return length;
  return `${length} · valid to ${valid}`;
}

/** Currency with the most sales in the window. USD wins a tie. */
export function pickDashboardCurrency(
  rows: Array<{ currency: string; count: number; date: string }>,
  start: string,
  end: string,
): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.date < start || row.date > end || row.count <= 0) continue;
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.count);
  }
  let best = 'USD';
  let bestCount = -1;
  for (const [currency, count] of totals) {
    if (count > bestCount || (count === bestCount && currency === 'USD')) {
      best = currency;
      bestCount = count;
    }
  }
  return bestCount < 0 ? 'USD' : best;
}

export function isDashboardRange(value: string): value is DashboardRange {
  return value === 'this_month' || value === 'last_month' || value === 'last_7_days' || value === 'last_30_days';
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
