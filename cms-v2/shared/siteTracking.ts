import { eachIsoDay, isIsoDate, londonToday, salesPresetBounds } from './salesFormat';

export const TRACKING_PRESETS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'] as const;
export type TrackingPreset = (typeof TRACKING_PRESETS)[number];
export type TrackingRange = TrackingPreset | 'custom';
export const TRACKING_CUSTOM_MAX_DAYS = 366;

export function isTrackingPreset(value: string): value is TrackingPreset {
  return (TRACKING_PRESETS as readonly string[]).includes(value);
}

export function trackingPresetBounds(preset: TrackingPreset, today = londonToday()): { start: string; end: string } {
  return salesPresetBounds(preset, today) ?? { start: today, end: today };
}

function inclusiveDayCount(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}

/** Null when a date is missing, the end is before the start, or the span is longer than a year. */
export function trackingCustomBounds(start: string, end: string): { start: string; end: string } | null {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return null;
  if (inclusiveDayCount(start, end) > TRACKING_CUSTOM_MAX_DAYS) return null;
  return { start, end };
}

export type TrackingCount = {
  label: string;
  visitors: number;
  meta?: boolean;
  google?: boolean;
};
export type TrackingSourceRow = { source: string; medium: string; visitors: number };
export type TrackingDay = {
  date: string;
  visitors: number;
  channels: Record<string, number>;
};

export type TrackingChannelDay = { date: string; channel: string; visitors: number };

/** One row per calendar day, with a zero for every channel that had no visits that day. */
export function assembleTrackingDays(
  start: string,
  end: string,
  rows: TrackingChannelDay[],
  channelOrder: string[],
): TrackingDay[] {
  const byDate = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const channel = row.channel.trim() || 'Direct';
    const bucket = byDate.get(date) ?? new Map<string, number>();
    bucket.set(channel, (bucket.get(channel) ?? 0) + (Number(row.visitors) || 0));
    byDate.set(date, bucket);
  }
  return eachIsoDay(start, end).map(date => {
    const bucket = byDate.get(date) ?? new Map<string, number>();
    const channels: Record<string, number> = {};
    for (const channel of channelOrder) channels[channel] = bucket.get(channel) ?? 0;
    for (const [channel, count] of bucket) {
      if (!(channel in channels)) channels[channel] = count;
    }
    let visitors = 0;
    for (const count of bucket.values()) visitors += count;
    return { date, visitors, channels };
  });
}

/** Where a paid enrolment came from, in the words the marketing team uses. */
export type EnrolmentChannel = 'meta_tagged' | 'meta_untagged' | 'google' | 'other' | 'none';

export const ENROLMENT_CHANNELS: ReadonlyArray<{ id: EnrolmentChannel; label: string; help: string }> = [
  {
    id: 'meta_tagged',
    label: 'Meta ads (campaign tagged)',
    help: 'Clicked a Facebook or Instagram ad whose link carried our campaign tag, so we know which campaign.',
  },
  {
    id: 'meta_untagged',
    label: 'Meta click, no campaign tag',
    help: 'Clicked a Facebook or Instagram link with no campaign tag: an ad without URL parameters, a boosted post, or a normal unpaid post.',
  },
  {
    id: 'google',
    label: 'Google Ads',
    help: 'Clicked a Google Search or YouTube ad.',
  },
  {
    id: 'other',
    label: 'Other tagged links',
    help: 'Came from a link with a source or campaign tag that is not Meta or Google, such as an email or another site.',
  },
  {
    id: 'none',
    label: 'No ad click stored',
    help: 'Typed the address, found us on unpaid search, came back after the ad visit had expired, or was a UK visitor who declined cookies.',
  },
];

/** One paid order with the click facts stored at checkout. */
export type EnrolmentOrder = {
  campaign: string | null;
  source: string | null;
  medium: string | null;
  currency: string | null;
  amount: number;
  metaClick: boolean;
  googleClick: boolean;
  /** The campaign came from gad_campaign_id because utm_campaign was empty. */
  fromGoogleId: boolean;
};

export type TrackingEnrolmentChannel = {
  channel: EnrolmentChannel;
  currency: string;
  orders: number;
  amount: number;
};

export type TrackingEnrolment = {
  channel: EnrolmentChannel;
  /** Empty when the order had no campaign tag. */
  campaign: string;
  /** utm_source, shown for untagged links outside Meta and Google. */
  source: string;
  currency: string;
  orders: number;
  amount: number;
  /** A Meta click or Meta utm_source was stored on at least one order in the group. */
  meta?: boolean;
  /** A Google click, Google utm_source, or Google campaign id was stored on at least one order. */
  google?: boolean;
  /** The displayed id came from gad_campaign_id because utm_campaign was empty. */
  fromGoogleId?: boolean;
};

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/**
 * Same order as the Sales channel report: a Google click wins over a leftover Meta cookie,
 * except when the campaign itself is a Meta campaign id.
 */
export function enrolmentChannel(order: EnrolmentOrder): EnrolmentChannel {
  const campaign = cleanText(order.campaign);
  if (isMetaCampaignId(campaign)) return 'meta_tagged';
  if (order.googleClick) return 'google';
  if (order.metaClick) return campaign ? 'meta_tagged' : 'meta_untagged';
  if (campaign || cleanText(order.source) || cleanText(order.medium)) return 'other';
  return 'none';
}

const CHANNEL_RANK = new Map(ENROLMENT_CHANNELS.map((row, index) => [row.id, index]));

/** Totals per channel, and per campaign inside each channel. */
export function summarizeEnrolments(orders: EnrolmentOrder[]): {
  channels: TrackingEnrolmentChannel[];
  enrolments: TrackingEnrolment[];
} {
  const channels = new Map<string, TrackingEnrolmentChannel>();
  const campaigns = new Map<string, TrackingEnrolment>();

  for (const order of orders) {
    const channel = enrolmentChannel(order);
    const currency = cleanText(order.currency).toUpperCase() || 'GBP';
    const amount = Number.isFinite(order.amount) ? order.amount : 0;
    const campaign = cleanText(order.campaign);
    const source = campaign || channel !== 'other' ? '' : cleanText(order.source).toLowerCase();

    const channelKey = `${channel}|${currency}`;
    const channelRow = channels.get(channelKey) ?? { channel, currency, orders: 0, amount: 0 };
    channelRow.orders += 1;
    channelRow.amount += amount;
    channels.set(channelKey, channelRow);

    const campaignKey = `${channel}|${campaign}|${source}|${currency}`;
    const row = campaigns.get(campaignKey) ?? {
      channel, campaign, source, currency, orders: 0, amount: 0, meta: false, google: false, fromGoogleId: false,
    };
    row.orders += 1;
    row.amount += amount;
    row.meta = row.meta || order.metaClick;
    row.google = row.google || order.googleClick;
    row.fromGoogleId = row.fromGoogleId || order.fromGoogleId;
    campaigns.set(campaignKey, row);
  }

  const byChannelThenOrders = <T extends { channel: EnrolmentChannel; orders: number }>(a: T, b: T) =>
    (CHANNEL_RANK.get(a.channel) ?? 99) - (CHANNEL_RANK.get(b.channel) ?? 99) || b.orders - a.orders;

  return {
    channels: [...channels.values()].sort(byChannelThenOrders),
    enrolments: [...campaigns.values()].sort(byChannelThenOrders),
  };
}

/** Row label for the campaign table. */
export function enrolmentCampaignLabel(row: TrackingEnrolment): string {
  if (row.campaign) return campaignLabel(row.campaign, row);
  switch (row.channel) {
    case 'meta_untagged': return 'No campaign tag on the link';
    case 'meta_tagged': return 'Meta ad';
    case 'google': return 'Google ad, no campaign tag';
    case 'other': return row.source ? `${row.source}, no campaign tag` : 'Tagged link, no campaign';
    default: return 'Nothing stored';
  }
}

/** Plain names for the utm_source values our ads use. */
const SOURCE_NAMES: Record<string, string> = {
  an: 'Meta Audience Network (ads in other apps)',
  fb: 'Facebook',
  ig: 'Instagram',
  th: 'Threads',
  msg: 'Messenger',
};

export function trackingSourceName(source: string): string | null {
  const key = source.trim().toLowerCase();
  if (SOURCE_NAMES[key]) return SOURCE_NAMES[key];
  if (key.startsWith('fb-')) return 'Facebook';
  return null;
}

export type CampaignNetwork = {
  meta?: boolean;
  google?: boolean;
  fromGoogleId?: boolean;
};

/**
 * Current Meta ad ids are 15–24 digits and start with 120.
 * Google Ads campaign ids are shorter, so this does not claim those.
 */
export function isMetaCampaignId(value: string): boolean {
  return /^120\d{12,21}$/.test(value);
}

/** Name a stored campaign. Numeric ids are Meta or Google only when the click says so. */
export function campaignLabel(value: string, network: CampaignNetwork = {}): string {
  if (value === 'No campaign' || value === 'No campaign stored') return value;
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    text = value.trim();
  }
  text = text.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^\d{3,24}$/.test(text)) return text;
  // A long 120… id is Meta even when an older Google click is still stored on the order.
  if (isMetaCampaignId(text)) return `Meta campaign ${text}`;
  // Google wins over a leftover Meta click when the id itself is a Google campaign id.
  if (network.fromGoogleId || network.google) return `Google campaign ${text}`;
  if (network.meta) return `Meta campaign ${text}`;
  return text;
}

export type TrackingReport = {
  range: TrackingRange;
  start: string;
  end: string;
  visitors: number;
  uniqueVisits: number;
  returningVisits: number;
  days: TrackingDay[];
  channels: TrackingCount[];
  campaigns: TrackingCount[];
  landingPages: TrackingCount[];
  countries: TrackingCount[];
  devices: TrackingCount[];
  locales: TrackingCount[];
  sources: TrackingSourceRow[];
  enrolments: TrackingEnrolment[];
  enrolmentChannels: TrackingEnrolmentChannel[];
};
