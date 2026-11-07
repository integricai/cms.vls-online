import type { TrackingRange } from './siteTracking';

export type Ga4Count = { label: string; value: number };

export type Ga4Traffic = {
  configured: boolean;
  error: string | null;
  sessions: number;
  engagedSessions: number;
  pageViews: number;
  checkoutViews: number;
  channels: Ga4Count[];
  landingPages: Ga4Count[];
  pages: Ga4Count[];
};

export type SalesMoney = { currency: string; orders: number; amount: number };
export type SalesProduct = { name: string; currency: string; orders: number; amount: number };
export type SalesChannel = { channel: string; currency: string; orders: number; amount: number };

export type TrackingSales = {
  orders: number;
  totals: SalesMoney[];
  products: SalesProduct[];
  channels: SalesChannel[];
};

export type AnalyticsReport = {
  range: TrackingRange;
  start: string;
  end: string;
  traffic: Ga4Traffic;
  sales: TrackingSales;
};

export type Ga4RawReport = {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

const CHANNEL_ORDER = ['Google Ads', 'Meta', 'Other campaign', 'Organic search', 'Referral', 'Direct'];
const GOOGLE_SOURCES = new Set(['google', 'googleads', 'adwords', 'youtube']);
const META_SOURCES = new Set(['facebook', 'fb', 'instagram', 'ig', 'meta', 'an']);
const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'paidsocial', 'paid_social', 'display', 'cpm']);
const SKIP_PAGE = /\/(checkout|payment-success|payment-cancelled|pay|sb-preview)(\/|$)/i;

export type PaidOrderFact = {
  courseTitle: string | null;
  currency: string | null;
  amount: number;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbc: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function emptyGa4Traffic(configured: boolean, error: string | null): Ga4Traffic {
  return {
    configured,
    error,
    sessions: 0,
    engagedSessions: 0,
    pageViews: 0,
    checkoutViews: 0,
    channels: [],
    landingPages: [],
    pages: [],
  };
}

export function ga4ErrorMessage(error: { message?: string; status?: string } | undefined): string {
  const status = error?.status ?? '';
  if (status === 'PERMISSION_DENIED') {
    return 'The service account cannot read this GA4 property. Give it Viewer access on the property.';
  }
  if (status === 'UNAUTHENTICATED') return 'Google rejected the service account key.';
  if (status === 'NOT_FOUND') return 'GA4 could not find that property. Check GA4_PROPERTY_ID.';
  const message = error?.message?.trim() ?? '';
  if (message && message.length < 240) return message;
  return 'Google Analytics did not return a report.';
}

/** Numeric property id only. The G- measurement id cannot be used for reports. */
export function ga4PropertyId(value: string): string | null {
  const digits = value.trim();
  if (!/^\d{6,12}$/.test(digits)) return null;
  return digits;
}

export function ga4BatchBody(start: string, end: string): { requests: unknown[] } {
  const dateRanges = [{ startDate: start, endDate: end }];
  const byMetric = (metricName: string) => [{ metric: { metricName }, desc: true }];
  return {
    requests: [
      {
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }],
      },
      {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: byMetric('sessions'),
        limit: 12,
      },
      {
        dateRanges,
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }],
        orderBys: byMetric('sessions'),
        limit: 12,
      },
      {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: byMetric('screenPageViews'),
        limit: 30,
      },
      {
        dateRanges,
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'CONTAINS', value: '/checkout' },
          },
        },
      },
    ],
  };
}

function metricAt(report: Ga4RawReport | undefined, name: string): number {
  const index = report?.metricHeaders?.findIndex(header => header.name === name) ?? -1;
  if (index < 0) return 0;
  return Number(report?.rows?.[0]?.metricValues?.[index]?.value) || 0;
}

function dimensionRows(report: Ga4RawReport | undefined, metricName: string): Ga4Count[] {
  const index = report?.metricHeaders?.findIndex(header => header.name === metricName) ?? -1;
  if (index < 0) return [];
  return (report?.rows ?? [])
    .map(row => ({
      label: row.dimensionValues?.[0]?.value?.trim() || '(not set)',
      value: Number(row.metricValues?.[index]?.value) || 0,
    }))
    .filter(row => row.value > 0);
}

export function contentPages(rows: Ga4Count[], limit = 12): Ga4Count[] {
  return rows
    .filter(row => row.label !== '/' && row.label !== '(not set)' && !SKIP_PAGE.test(row.label))
    .slice(0, limit);
}

export function assembleGa4Traffic(reports: Ga4RawReport[]): Ga4Traffic {
  const [summary, channels, landingPages, pages, checkout] = reports;
  return {
    configured: true,
    error: null,
    sessions: metricAt(summary, 'sessions'),
    engagedSessions: metricAt(summary, 'engagedSessions'),
    pageViews: metricAt(summary, 'screenPageViews'),
    checkoutViews: metricAt(checkout, 'screenPageViews'),
    channels: dimensionRows(channels, 'sessions'),
    landingPages: dimensionRows(landingPages, 'sessions'),
    pages: contentPages(dimensionRows(pages, 'screenPageViews')),
  };
}

export function paidOrderChannel(order: PaidOrderFact): string {
  const source = order.utmSource?.trim().toLowerCase() ?? '';
  const medium = order.utmMedium?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  const paid = PAID_MEDIUMS.has(medium);
  if (blank(order.gclid) || blank(order.gbraid) || blank(order.wbraid) || (GOOGLE_SOURCES.has(source) && paid)) {
    return 'Google Ads';
  }
  if (blank(order.fbclid) || blank(order.fbc) || META_SOURCES.has(source)) return 'Meta';
  if (medium === 'organic') return 'Organic search';
  if (source || medium || blank(order.utmCampaign)) return 'Other campaign';
  return 'Direct';
}

function addMoney(map: Map<string, { orders: number; amount: number }>, key: string, amount: number): void {
  const current = map.get(key) ?? { orders: 0, amount: 0 };
  current.orders += 1;
  current.amount += amount;
  map.set(key, current);
}

export function summarizePaidOrders(rows: PaidOrderFact[]): TrackingSales {
  const totals = new Map<string, { orders: number; amount: number }>();
  const products = new Map<string, { name: string; currency: string; orders: number; amount: number }>();
  const channels = new Map<string, { channel: string; currency: string; orders: number; amount: number }>();

  for (const row of rows) {
    const currency = (row.currency?.trim() || 'GBP').toUpperCase();
    const amount = Number.isFinite(row.amount) ? row.amount : 0;
    const name = row.courseTitle?.trim() || 'Custom payment';
    const channel = paidOrderChannel(row);
    addMoney(totals, currency, amount);
    const productKey = `${name}\0${currency}`;
    const product = products.get(productKey) ?? { name, currency, orders: 0, amount: 0 };
    product.orders += 1;
    product.amount += amount;
    products.set(productKey, product);
    const channelKey = `${channel}\0${currency}`;
    const channelRow = channels.get(channelKey) ?? { channel, currency, orders: 0, amount: 0 };
    channelRow.orders += 1;
    channelRow.amount += amount;
    channels.set(channelKey, channelRow);
  }

  const byOrders = (left: { orders: number; amount: number }, right: { orders: number; amount: number }) =>
    right.orders - left.orders || right.amount - left.amount;

  return {
    orders: rows.length,
    totals: [...totals.entries()]
      .map(([currency, value]) => ({ currency, orders: value.orders, amount: value.amount }))
      .sort(byOrders),
    products: [...products.values()].sort((left, right) => byOrders(left, right) || left.name.localeCompare(right.name)).slice(0, 15),
    channels: [...channels.values()].sort((left, right) => {
      const leftIndex = CHANNEL_ORDER.indexOf(left.channel);
      const rightIndex = CHANNEL_ORDER.indexOf(right.channel);
      return (leftIndex < 0 ? CHANNEL_ORDER.length : leftIndex) - (rightIndex < 0 ? CHANNEL_ORDER.length : rightIndex)
        || left.currency.localeCompare(right.currency);
    }),
  };
}
