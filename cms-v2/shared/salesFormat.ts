/** London calendar helpers and sale labels shared by the API and the vault. */

const LONDON = 'Europe/London';

export type DashboardRange = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export type SalesPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_year'
  | 'this_year'
  | 'all_time';

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

/**
 * Session cell for a sale row.
 * A payment order uses the reason the form was created. A course sale uses the access length.
 */
export function saleListSessionLabel(
  durationDays: number | null | undefined,
  expiry: Date | string | null | undefined,
  paymentReason?: string | null,
): string {
  const reason = paymentReason?.trim();
  if (reason) return reason;
  if (durationDays == null || !Number.isFinite(Number(durationDays))) return '—';
  return saleSessionLabel(durationDays, expiry);
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

/** True when the report box is empty, or any field contains that text. */
export function matchesSaleReportQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some(field => (field ?? '').toLowerCase().includes(needle));
}

/** Two-decimal amount with no currency symbol, for the sales spreadsheet. */
export function formatPlainAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return Number(amount).toFixed(2);
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
    || value === 'this_week'
    || value === 'last_week'
    || value === 'this_month'
    || value === 'last_month'
    || value === 'last_3_months'
    || value === 'last_6_months'
    || value === 'last_year'
    || value === 'this_year'
    || value === 'all_time';
}

/** Monday of the week that contains this calendar date. Weeks start on Monday. */
export function weekStartMonday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = utcDay === 0 ? 6 : utcDay - 1;
  return addIsoDays(isoDate, -daysSinceMonday);
}

/**
 * London dates for the sales page presets. Weeks start on Monday.
 * Last 3 and last 6 months include the current month: on 31 Oct 2026 that is
 * 1 Aug–31 Oct and 1 May–31 Oct. Last year is the previous calendar year.
 */
export function salesPresetBounds(
  preset: SalesPreset,
  today = londonToday(),
): { start: string; end: string } | null {
  if (preset === 'all_time') return null;
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'yesterday') {
    const day = addIsoDays(today, -1);
    return { start: day, end: day };
  }
  if (preset === 'this_week') return { start: weekStartMonday(today), end: today };
  if (preset === 'last_week') {
    const end = addIsoDays(weekStartMonday(today), -1);
    return { start: weekStartMonday(end), end };
  }
  if (preset === 'this_month') return { start: monthStart(today), end: today };
  if (preset === 'last_month') {
    const endLast = addIsoDays(monthStart(today), -1);
    return { start: monthStart(endLast), end: endLast };
  }
  if (preset === 'last_3_months') return { start: monthStart(shiftMonth(today, -2)), end: today };
  if (preset === 'last_6_months') return { start: monthStart(shiftMonth(today, -5)), end: today };
  if (preset === 'this_year') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  const year = Number(today.slice(0, 4)) - 1;
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/**
 * Turns a local amount into dollars.
 * `localPerUsd` is how many local units equal one dollar. Null when that currency has no rate.
 */
export function amountInUsd(
  amount: number,
  currency: string | null | undefined,
  localPerUsd: Record<string, number> | null | undefined,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const code = (currency || 'USD').trim().toUpperCase() || 'USD';
  if (code === 'USD') return Math.round(amount * 100) / 100;
  const rate = localPerUsd?.[code];
  if (rate == null || !(rate > 0)) return null;
  return Math.round((amount / rate) * 100) / 100;
}

/** One dollar total. Currencies with no rate are listed and left out of the figure. */
export function sumAmountsInUsd(
  entries: Array<{ amount: number | null | undefined; currency: string | null | undefined }>,
  localPerUsd: Record<string, number> | null | undefined,
): { usd: number; missingCurrencies: string[] } {
  let cents = 0;
  const missing = new Set<string>();
  for (const entry of entries) {
    if (entry.amount == null || !Number.isFinite(Number(entry.amount))) continue;
    const code = (entry.currency || 'USD').trim().toUpperCase() || 'USD';
    const usd = amountInUsd(Number(entry.amount), code, localPerUsd);
    if (usd == null) {
      missing.add(code);
      continue;
    }
    cents += Math.round(usd * 100);
  }
  return { usd: cents / 100, missingCurrencies: [...missing].sort() };
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
