import {
  claimDueUrls,
  countUrlHealthRows,
  deleteUrlsNotSeenSince,
  getUrlHealthState,
  listBrokenUnalerted,
  markAlerted,
  saveUrlHealthState,
  saveUrlPing,
  upsertSitemapUrls,
} from '../models/urlHealthCheck';
import type { UrlHealthRow, UrlHealthRunResult } from '../../shared/urlHealth';
import { sendEmail } from './paymentEmails';
import { applyPing, isSitemapIndex, parseSitemapLocs } from './urlHealthRules';

const SITEMAP_REFRESH_MS = 30 * 60 * 1000;
const RUN_BUDGET_MS = 40_000;
const BATCH_LIMIT = 80;
const CONCURRENCY = 6;
const PING_TIMEOUT_MS = 15_000;
const USER_AGENT = 'VLS-HealthCheck/1.0 (+https://vls-online.com)';

export const ALERT_SUBJECT = 'Attention! One or few urls are broken on the live site';

function siteOrigin(): string {
  return (process.env.HEALTH_CHECK_SITE_URL?.trim() || 'https://vls-online.com').replace(/\/+$/, '');
}

/** Comma-separated list of addresses, set in the Vercel environment. */
function alertRecipients(): string[] {
  return (process.env.HEALTH_CHECK_ALERT_EMAIL ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(PING_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

/** Every page URL in the live sitemap, following one level of sitemap index. */
export async function readSitemapUrls(): Promise<string[]> {
  const root = await fetchText(`${siteOrigin()}/sitemap.xml`);
  const urls = new Set<string>();
  if (isSitemapIndex(root)) {
    for (const child of parseSitemapLocs(root)) {
      for (const loc of parseSitemapLocs(await fetchText(child))) urls.add(loc);
    }
  } else {
    for (const loc of parseSitemapLocs(root)) urls.add(loc);
  }
  return [...urls];
}

/** HTTP status of a URL after redirects, or 0 if it did not answer in time. */
export async function pingUrl(url: string): Promise<{ code: number; error: string | null }> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.status;
  };
  try {
    let code = await attempt('HEAD');
    if (code === 405 || code === 501) code = await attempt('GET');
    return { code, error: null };
  } catch (err) {
    return { code: 0, error: err instanceof Error ? err.message.slice(0, 300) : 'No response' };
  }
}

async function syncSitemapIfStale(result: UrlHealthRunResult, force: boolean): Promise<void> {
  const state = await getUrlHealthState();
  const stale = !state.sitemapSyncedAt
    || Date.now() - new Date(state.sitemapSyncedAt).getTime() > SITEMAP_REFRESH_MS;
  if (!stale && !force) return;

  const seenAt = new Date();
  const urls = await readSitemapUrls();
  if (!urls.length) throw new Error('The sitemap returned no URLs');

  const existing = await countUrlHealthRows();
  await upsertSitemapUrls(urls, seenAt);
  // A half-empty sitemap is more likely a sitemap problem than real removals.
  if (urls.length >= existing * 0.5) {
    result.removed = await deleteUrlsNotSeenSince(seenAt);
  } else {
    result.errors.push(`Sitemap shrank from ${existing} to ${urls.length} URLs; kept the old rows`);
  }
  result.sitemapSynced = true;
  result.sitemapUrls = urls.length;
  await saveUrlHealthState({ sitemapSyncedAt: seenAt, sitemapUrlCount: urls.length, lastError: null });
}

async function checkDueUrls(result: UrlHealthRunResult, deadline: number): Promise<void> {
  const due = await claimDueUrls(BATCH_LIMIT);
  let index = 0;

  const worker = async () => {
    while (index < due.length && Date.now() < deadline) {
      const row = due[index++];
      const { code, error } = await pingUrl(row.url);
      const now = new Date();
      const update = applyPing(row, code, now);
      await saveUrlPing(row.url, now, code, error, update);
      result.checked += 1;
      if (update.status === 'broken' && row.status !== 'broken') result.newlyBroken += 1;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Rows claimed but not reached before the deadline come due again in 5 minutes.
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function brokenUrlsEmail(rows: UrlHealthRow[]): { subject: string; text: string; html: string } {
  const lines = rows.map(row => {
    const codes = row.pings.map(p => (p ? (p.code || 'no answer') : '—')).join(', ');
    return { url: row.url, codes: String(codes), since: formatWhen(row.firstBrokenAt) };
  });
  const intro = `${rows.length} URL${rows.length === 1 ? '' : 's'} on the live site failed three pings in a row:`;
  const text = [
    intro,
    '',
    ...lines.map(l => `${l.url}\n  pings: ${l.codes} · broken since ${l.since} (UK time)`),
    '',
    'See Health check in the Vault for the full list.',
  ].join('\n');
  const html = `<p style="font-family:Arial,sans-serif;font-size:15px;">${intro}</p>
<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
<tr style="background:#f4f7fb;text-align:left;"><th>URL</th><th>Pings</th><th>Broken since (UK)</th></tr>
${lines.map(l => `<tr style="border-top:1px solid #e2e8f0;"><td><a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></td><td>${escapeHtml(l.codes)}</td><td>${escapeHtml(l.since)}</td></tr>`).join('\n')}
</table>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#64748b;">See Health check in the Vault for the full list.</p>`;
  return { subject: ALERT_SUBJECT, text, html };
}

async function sendAlerts(result: UrlHealthRunResult): Promise<void> {
  const rows = await listBrokenUnalerted();
  if (!rows.length) return;
  const recipients = alertRecipients();
  if (!recipients.length) {
    // Leave alerted_at empty so the email goes out once the address is set.
    throw new Error('HEALTH_CHECK_ALERT_EMAIL is not set, so no alert email was sent');
  }
  const message = brokenUrlsEmail(rows);
  for (const to of recipients) {
    await sendEmail({ to, fromName: 'VLS Health Check', ...message });
  }
  await markAlerted(rows.map(row => row.url));
  result.alertsSent = rows.length;
}

export async function runUrlHealthCheck(options?: { forceSitemap?: boolean }): Promise<UrlHealthRunResult> {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const result: UrlHealthRunResult = {
    sitemapSynced: false, sitemapUrls: 0, removed: 0, checked: 0, newlyBroken: 0, alertsSent: 0, errors: [],
  };

  const step = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      const message = `${label}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[health-check]', message);
      result.errors.push(message);
    }
  };

  await step('Sitemap', () => syncSitemapIfStale(result, options?.forceSitemap ?? false));
  await step('Ping', () => checkDueUrls(result, deadline));
  await step('Alert email', () => sendAlerts(result));
  await saveUrlHealthState({ lastError: result.errors.length ? result.errors.join(' · ') : null })
    .catch(err => console.error('[health-check] state', err));
  return result;
}
