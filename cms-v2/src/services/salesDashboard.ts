import type { SalesDashboard, SalesDashboardCard } from '../../shared/types';
import {
  addIsoDays,
  dashboardRangeBounds,
  eachIsoDay,
  londonToday,
  monthStart,
  foldTotalsToUsd,
  percentChange,
  pickDashboardCurrency,
  shiftMonth,
  type DashboardRange,
} from '../../shared/salesFormat';
import { getUsdRates } from './fxRates';
import { listRecentSalesActivity, listSalesDayTotals, type SalesDayTotal } from '../models/salesDashboard';
import { countSiteVisitors, listSiteLeadEmails } from '../models/siteAnalytics';
import { listZenlerFunnelLeadEmails } from './zenlerApi';

const leadCache = new Map<string, { at: number; emails: string[] }>();
const LEAD_CACHE_MS = 10 * 60 * 1000;

function sumWindow(rows: SalesDayTotal[], currency: string, start: string, end: string) {
  let gross = 0;
  let earnings = 0;
  let count = 0;
  for (const row of rows) {
    if (row.currency !== currency || row.date < start || row.date > end) continue;
    gross += row.gross;
    earnings += row.earnings;
    count += row.count;
  }
  return { gross, earnings, count };
}

function card(
  id: SalesDashboardCard['id'],
  label: string,
  rows: SalesDayTotal[],
  currency: string,
  start: string,
  end: string,
  comparisonStart: string,
  comparisonEnd: string,
  comparisonLabel: string,
): SalesDashboardCard {
  const current = sumWindow(rows, currency, start, end);
  const previous = sumWindow(rows, currency, comparisonStart, comparisonEnd);
  return {
    id,
    label,
    amount: roundMoney(current.gross),
    earnings: roundMoney(current.earnings),
    currency,
    comparisonAmount: roundMoney(previous.gross),
    comparisonLabel,
    changePercent: percentChange(current.gross, previous.gross),
  };
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function personName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || 'A student';
}

async function zenlerLeadEmails(start: string, end: string): Promise<string[]> {
  const key = `${start}:${end}`;
  const cached = leadCache.get(key);
  if (cached && Date.now() - cached.at < LEAD_CACHE_MS) return cached.emails;
  const emails = await listZenlerFunnelLeadEmails(start, end);
  leadCache.set(key, { at: Date.now(), emails });
  return emails;
}

function conversion(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function buildSalesDashboard(range: DashboardRange, now = new Date()): Promise<SalesDashboard> {
  const today = londonToday(now);
  const bounds = dashboardRangeBounds(range, today);
  const previousMonthStart = monthStart(shiftMonth(monthStart(today), -1));
  const queryStart = [previousMonthStart, addIsoDays(today, -29), bounds.start].sort()[0];

  const [dayTotals, activity, orders, visitors, siteLeadEmails] = await Promise.all([
    listSalesDayTotals(queryStart, today),
    listRecentSalesActivity(8, false),
    listRecentSalesActivity(6, true),
    countSiteVisitors(bounds.start, bounds.end),
    listSiteLeadEmails(bounds.start, bounds.end),
  ]);
  const rows = foldTotalsToUsd(dayTotals, await getUsdRates());

  let zenlerEmails: string[] = [];
  try {
    zenlerEmails = await zenlerLeadEmails(bounds.start, bounds.end);
  } catch (err) {
    console.error('[sales] zenler lead count failed', err instanceof Error ? err.message : err);
  }

  const leadEmails = new Set(zenlerEmails);
  for (const email of siteLeadEmails) leadEmails.add(email);

  const currency = pickDashboardCurrency(rows, monthStart(today), today);
  const overview = sumWindow(rows, currency, bounds.start, bounds.end);
  const otherCurrencies = [...new Set(
    rows
      .filter(row => row.date >= bounds.start && row.date <= bounds.end && row.currency !== currency && (row.gross > 0 || row.earnings > 0))
      .map(row => row.currency),
  )];

  const sameDayLastWeek = addIsoDays(today, -7);
  const yesterday = addIsoDays(today, -1);
  const monthSameEnd = shiftMonth(today, -1);
  const monthSameStart = monthStart(monthSameEnd);

  const cards: SalesDashboardCard[] = [
    card('today', 'Today so far', rows, currency, today, today, sameDayLastWeek, sameDayLastWeek, 'Same day last week'),
    card('yesterday', 'Yesterday', rows, currency, yesterday, yesterday, addIsoDays(yesterday, -7), addIsoDays(yesterday, -7), 'Same day last week'),
    card('last7', 'Last 7 days', rows, currency, addIsoDays(today, -6), today, addIsoDays(today, -13), addIsoDays(today, -7), 'Previous 7 days'),
    card('month', 'This month', rows, currency, monthStart(today), today, monthSameStart, monthSameEnd, 'Same period last month'),
  ];

  const enrollments = rows
    .filter(row => row.date >= bounds.start && row.date <= bounds.end)
    .reduce((total, row) => total + row.count, 0);

  return {
    currency,
    otherCurrencies,
    cards,
    range,
    visitors,
    leads: leadEmails.size,
    enrollments,
    leadConversionPercent: conversion(leadEmails.size, visitors),
    enrollmentConversionPercent: conversion(enrollments, visitors),
    series: eachIsoDay(bounds.start, bounds.end).map(date => ({
      date,
      amount: roundMoney(sumWindow(rows, currency, date, date).gross),
    })),
    totalSales: roundMoney(overview.gross),
    oneTime: roundMoney(overview.gross),
    subscriptions: 0,
    others: 0,
    activity: activity.map(row => ({
      id: row.id,
      name: personName(row.firstName, row.lastName),
      courseName: row.courseName || 'a course',
      soldAt: new Date(row.soldAt).toISOString(),
      sessionMonth: row.sessionMonth,
      sessionYear: row.sessionYear,
    })),
    recentOrders: orders.map(row => ({
      id: row.id,
      courseName: row.courseName || 'Course',
      customerName: personName(row.firstName, row.lastName),
      soldAt: new Date(row.soldAt).toISOString(),
      amount: roundMoney(row.amount),
      currency: row.currency,
      presentmentAmount: row.presentmentAmount,
      presentmentCurrency: row.presentmentCurrency,
      type: row.refunded ? 'Refunded' as const : 'One-time' as const,
      sessionMonth: row.sessionMonth,
      sessionYear: row.sessionYear,
    })),
  };
}
