/**
 * Browser Purchase events are deduped with this call by event_id `po-{orderId}`.
 *
 * Required env on the CMS production deploy:
 *   META_CAPI_ACCESS_TOKEN
 * Optional:
 *   META_PIXEL_ID   (defaults to Ali Bukhari's pixel)
 */
import { createHash } from 'crypto';
import type { PaymentOrder } from '../models/paymentOrder';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { hashEmailForAds, normalizePhoneE164 } from './attribution';

export const DEFAULT_META_PIXEL_ID = '1187799681576907';
const GRAPH_VERSION = 'v21.0';

export type MetaPurchaseRequest = {
  data: Array<Record<string, unknown>>;
};

export function hashPhoneForMeta(
  phone: string | null | undefined,
  countryCode?: string | null,
): string | null {
  const e164 = normalizePhoneE164(phone, countryCode);
  if (!e164) return null;
  return createHash('sha256').update(e164.slice(1)).digest('hex');
}

function browserId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^fb\.[\w.-]+$/.test(trimmed) || trimmed.length > 200) return null;
  return trimmed;
}

function clientIp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || /[\s<>]/.test(trimmed)) return null;
  return trimmed;
}

export function readMetaCapiConfig(): { pixelId: string; accessToken: string } | null {
  const accessToken = String(process.env.META_CAPI_ACCESS_TOKEN ?? '').trim();
  const pixelId = String(process.env.META_PIXEL_ID ?? DEFAULT_META_PIXEL_ID).trim();
  if (!accessToken || !/^\d{10,20}$/.test(pixelId)) return null;
  return { pixelId, accessToken };
}

/** Null when this order must not be sent (staging, unpaid, or no value). */
export function buildMetaPurchaseRequest(order: PaymentOrder): MetaPurchaseRequest | null {
  if (order.checkoutEnvironment !== 'production') return null;
  if (order.status !== 'Paid') return null;
  if (typeof order.amount !== 'number' || !Number.isFinite(order.amount) || order.amount <= 0) return null;
  const currency = (order.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;

  const userData: Record<string, unknown> = {};
  const email = hashEmailForAds(order.studentEmail ?? order.stripeCustomerEmail);
  const phone = hashPhoneForMeta(order.studentPhone, order.countryCode);
  if (email) userData.em = [email];
  if (phone) userData.ph = [phone];
  const ip = clientIp(order.attrClientIp);
  if (ip) userData.client_ip_address = ip;
  const userAgent = order.attrUserAgent?.trim() ?? '';
  if (userAgent) userData.client_user_agent = userAgent.slice(0, 512);
  const fbp = browserId(order.fbp);
  const fbc = browserId(order.fbc);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const contentName = order.courseTitle?.trim() ?? '';
  return {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor((order.paidAt ?? order.createdAt).getTime() / 1000),
      event_id: `po-${order.id}`,
      action_source: 'website',
      event_source_url: 'https://vls-online.com/payment-success',
      user_data: userData,
      custom_data: {
        value: order.amount,
        currency,
        ...(contentName ? { content_name: contentName.slice(0, 200) } : {}),
        content_type: 'product',
      },
    }],
  };
}

export async function sendMetaPurchaseConversion(order: PaymentOrder): Promise<{ sent: boolean; reason?: string }> {
  const body = buildMetaPurchaseRequest(order);
  if (!body) return { sent: false, reason: 'order is not a production purchase' };

  const config = readMetaCapiConfig();
  if (!config) return { sent: false, reason: 'Meta Conversions API is not configured' };

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/${config.pixelId}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: config.accessToken }),
      timeoutMs: 10_000,
    },
  );
  const payload = await response.json() as {
    events_received?: number;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Meta CAPI failed (${response.status})`);
  }
  if (!payload.events_received) {
    throw new Error('Meta CAPI accepted the request but received no events');
  }
  return { sent: true };
}
