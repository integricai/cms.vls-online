/** London calendar helpers and sale labels shared by the API and the vault. */

const LONDON = 'Europe/London';

export type DashboardRange = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export type SalesPreset = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'last_year';

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

export interface DayMoneyRow {
  date: string;
  currency: string;
  count: number;
  gross: number;
  earnings: number;
}

/**
 * Adds nets that settled in a different currency onto that currency's day.
 * A day with no sales in the settlement currency still keeps the earnings.
 */
export function addCrossCurrencyEarnings(
  rows: DayMoneyRow[],
  settled: Array<{ date: string; currency: string; earnings: number }>,
): DayMoneyRow[] {
  const next = rows.map(row => ({ ...row, currency: row.currency.toUpperCase() }));
  for (const extra of settled) {
    const currency = extra.currency.trim().toUpperCase();
    if (!currency || extra.earnings === 0) continue;
    const existing = next.find(row => row.date === extra.date && row.currency === currency);
    const earnings = Math.round(extra.earnings * 100) / 100;
    if (existing) {
      existing.earnings = Math.round((existing.earnings + earnings) * 100) / 100;
      continue;
    }
    next.push({ date: extra.date, currency, count: 0, gross: 0, earnings });
  }
  return next;
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

function formatMoneyAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const code = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/** Local price the student saw, with the dollar charge beside it when they differ. */
export function formatVaultPrice(input: {
  amount: number | null | undefined;
  currency: string | null | undefined;
  presentmentAmount?: number | null;
  presentmentCurrency?: string | null;
}): string {
  const charge = formatMoneyAmount(input.amount, input.currency);
  const localCode = input.presentmentCurrency?.trim().toUpperCase() ?? '';
  const chargeCode = (input.currency || 'USD').trim().toUpperCase();
  if (input.presentmentAmount == null || !localCode || localCode === chargeCode) return charge;
  return `${formatMoneyAmount(input.presentmentAmount, localCode)} (${charge})`;
}

export function isDashboardRange(value: string): value is DashboardRange {
  return value === 'this_month' || value === 'last_month' || value === 'last_7_days' || value === 'last_30_days';
}

export function isSalesPreset(value: string): value is SalesPreset {
  return value === 'today'
    || value === 'yesterday'
    || value === 'last_week'
    || value === 'last_month'
    || value === 'last_year';
}

/** London dates for the sales page presets. Last week is the last 7 days, including today. */
export function salesPresetBounds(
  preset: SalesPreset,
  today = londonToday(),
): { start: string; end: string } {
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'yesterday') {
    const day = addIsoDays(today, -1);
    return { start: day, end: day };
  }
  if (preset === 'last_week') return { start: addIsoDays(today, -6), end: today };
  if (preset === 'last_month') {
    const endLast = addIsoDays(monthStart(today), -1);
    return { start: monthStart(endLast), end: endLast };
  }
  const year = Number(today.slice(0, 4)) - 1;
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Adds local-currency days onto USD.
 * `localPerUsd` is how many local units equal one dollar. Rows with no rate stay as they are.
 */
export function foldTotalsToUsd(
  rows: DayMoneyRow[],
  localPerUsd: Record<string, number> | null,
): DayMoneyRow[] {
  const next: DayMoneyRow[] = [];
  for (const row of rows) {
    const currency = row.currency.trim().toUpperCase();
    const rate = currency === 'USD' ? 1 : localPerUsd?.[currency];
    const converted = rate != null && rate > 0
      ? {
        ...row,
        currency: 'USD',
        gross: roundMoney(row.gross / rate),
        earnings: roundMoney(row.earnings / rate),
      }
      : { ...row, currency };
    const existing = next.find(item => item.date === converted.date && item.currency === converted.currency);
    if (!existing) {
      next.push(converted);
      continue;
    }
    existing.gross = roundMoney(existing.gross + converted.gross);
    existing.earnings = roundMoney(existing.earnings + converted.earnings);
    existing.count += converted.count;
  }
  return next;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
