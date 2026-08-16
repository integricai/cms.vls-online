/**
 * Offline Purchase upload via Google Data Manager API.
 *
 * Required env:
 *   GOOGLE_ADS_CUSTOMER_ID
 *   GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID
 *   GOOGLE_DATAMANAGER_CLIENT_ID
 *   GOOGLE_DATAMANAGER_CLIENT_SECRET
 *   GOOGLE_DATAMANAGER_REFRESH_TOKEN
 * Optional:
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID  (MCC)
 *   CRON_SECRET                   (Vercel cron bearer token)
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import {
  getPaymentOrderForConversion,
  listPurchaseConversionsDueForUpload,
  markConversionUploadResult,
  type PaymentOrder,
} from '../models/paymentOrder';
import { hashEmailForAds, hashPhoneForAds, resolveConversionUploadAction } from './attribution';

export const PURCHASE_UPLOAD_BATCH_SIZE = 40;
export const PURCHASE_UPLOAD_DELAY_HOURS = 7;

type GoogleAdsConfig = {
  customerId: string;
  loginCustomerId: string | null;
  conversionActionId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type PurchaseUploadResult = {
  configured: boolean;
  selected: number;
  uploaded: number;
  extendedUpload: number;
  failed: number;
  requestId: string | null;
  message?: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function readGoogleAdsConfig(): GoogleAdsConfig | null {
  const customerId = digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID ?? '');
  const conversionActionId = String(process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID ?? '').trim();
  const clientId = String(process.env.GOOGLE_DATAMANAGER_CLIENT_ID ?? '').trim();
  const clientSecret = String(process.env.GOOGLE_DATAMANAGER_CLIENT_SECRET ?? '').trim();
  const refreshToken = String(process.env.GOOGLE_DATAMANAGER_REFRESH_TOKEN ?? '').trim();
  const loginRaw = String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').trim();
  const loginCustomerId = loginRaw ? digitsOnly(loginRaw) : null;

  if (!customerId || !conversionActionId || !clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { customerId, loginCustomerId, conversionActionId, clientId, clientSecret, refreshToken };
}

async function getAccessToken(config: GoogleAdsConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });

  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    timeoutMs: 15_000,
  });
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `OAuth token refresh failed (${response.status})`);
  }
  return payload.access_token;
}

export function buildPurchaseEvent(order: PaymentOrder): Record<string, unknown> {
  const emailHash = hashEmailForAds(order.studentEmail ?? order.stripeCustomerEmail);
  const phoneHash = hashPhoneForAds(order.studentPhone, order.countryCode);
  const adIdentifiers: Record<string, string> = {};
  if (order.gclid) adIdentifiers.gclid = order.gclid;
  if (order.gbraid) adIdentifiers.gbraid = order.gbraid;
  if (order.wbraid) adIdentifiers.wbraid = order.wbraid;

  const event: Record<string, unknown> = {
    eventName: 'purchase',
    transactionId: `po-${order.id}`,
    eventTimestamp: (order.paidAt ?? order.createdAt).toISOString(),
    eventSource: 'WEB',
    conversionValue: order.amount,
    currency: (order.currency || 'USD').toUpperCase(),
  };

  if (Object.keys(adIdentifiers).length > 0) {
    event.adIdentifiers = adIdentifiers;
  }
  const userIdentifiers = [
    ...(emailHash ? [{ emailAddress: emailHash }] : []),
    ...(phoneHash ? [{ phoneNumber: phoneHash }] : []),
  ];
  if (userIdentifiers.length > 0) {
    event.userData = { userIdentifiers };
  }
  if (order.attrUserAgent || order.attrClientIp) {
    event.eventDeviceInfo = {
      ...(order.attrClientIp ? { ipAddress: order.attrClientIp } : {}),
      ...(order.attrUserAgent ? { userAgent: order.attrUserAgent } : {}),
    };
  }

  return event;
}

async function ingestEvents(config: GoogleAdsConfig, events: Record<string, unknown>[]): Promise<string | null> {
  const accessToken = await getAccessToken(config);
  const destination: Record<string, unknown> = {
    operatingAccount: {
      accountType: 'GOOGLE_ADS',
      accountId: config.customerId,
    },
    productDestinationId: config.conversionActionId,
  };
  if (config.loginCustomerId) {
    destination.loginAccount = {
      accountType: 'GOOGLE_ADS',
      accountId: config.loginCustomerId,
    };
  }

  const response = await fetchWithTimeout('https://datamanager.googleapis.com/v1/events:ingest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      destinations: [destination],
      encoding: 'HEX',
      consent: {
        adUserData: 'CONSENT_GRANTED',
        adPersonalization: 'CONSENT_GRANTED',
      },
      events,
    }),
    timeoutMs: 30_000,
  });

  const payload = await response.json() as {
    requestId?: string;
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Data Manager ingest failed (${response.status})`);
  }
  return payload.requestId ?? null;
}

export async function uploadPurchaseOrders(orders: PaymentOrder[]): Promise<PurchaseUploadResult> {
  const config = readGoogleAdsConfig();
  if (!config) {
    return {
      configured: false,
      selected: 0,
      uploaded: 0,
      extendedUpload: 0,
      failed: 0,
      requestId: null,
      message: 'Google Ads Data Manager credentials are not configured',
    };
  }

  const uploadable: Array<{ order: PaymentOrder; status: 'uploaded' | 'extended_upload' }> = [];
  let failed = 0;
  for (const order of orders) {
    const decision = resolveConversionUploadAction({
      gclid: order.gclid,
      gbraid: order.gbraid,
      wbraid: order.wbraid,
      email: order.studentEmail ?? order.stripeCustomerEmail,
      phone: order.studentPhone,
      countryCode: order.countryCode,
    });
    if (decision.action === 'fail') {
      await markConversionUploadResult({
        orderId: order.id,
        status: 'failed',
        error: decision.reason,
      });
      failed += 1;
      continue;
    }
    uploadable.push({ order, status: decision.status });
  }

  if (uploadable.length === 0) {
    return {
      configured: true,
      selected: orders.length,
      uploaded: 0,
      extendedUpload: 0,
      failed,
      requestId: null,
    };
  }

  try {
    const requestId = await ingestEvents(config, uploadable.map(item => buildPurchaseEvent(item.order)));
    await Promise.all(uploadable.map(item => markConversionUploadResult({
      orderId: item.order.id,
      status: item.status,
      requestId,
    })));
    return {
      configured: true,
      selected: orders.length,
      uploaded: uploadable.filter(item => item.status === 'uploaded').length,
      extendedUpload: uploadable.filter(item => item.status === 'extended_upload').length,
      failed,
      requestId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Leave as pending_upload so the next 5-minute run retries.
    await Promise.all(uploadable.map(item => markConversionUploadResult({
      orderId: item.order.id,
      status: 'pending_upload',
      error: message.slice(0, 1000),
    })));
    return {
      configured: true,
      selected: orders.length,
      uploaded: 0,
      extendedUpload: 0,
      failed,
      requestId: null,
      message,
    };
  }
}

export async function uploadDuePurchaseConversions(): Promise<PurchaseUploadResult> {
  const due = await listPurchaseConversionsDueForUpload({
    limit: PURCHASE_UPLOAD_BATCH_SIZE,
    delayHours: PURCHASE_UPLOAD_DELAY_HOURS,
  });
  return uploadPurchaseOrders(due);
}

export async function uploadSinglePurchaseConversion(orderId: number): Promise<PurchaseUploadResult> {
  const order = await getPaymentOrderForConversion(orderId);
  if (!order) throw new Error('Payment order not found');
  if (order.status !== 'Paid') throw new Error('Only paid orders can be uploaded to Google Ads');

  await markConversionUploadResult({
    orderId: order.id,
    status: 'pending_upload',
    error: null,
  });

  return uploadPurchaseOrders([{ ...order, conversionUploadStatus: 'pending_upload' }]);
}
