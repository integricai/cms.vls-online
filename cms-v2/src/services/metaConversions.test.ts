import assert from 'assert';
import { createHash } from 'crypto';
import type { PaymentOrder } from '../models/paymentOrder';
import {
  buildMetaPurchaseRequest,
  hashPhoneForMeta,
  readMetaCapiConfig,
} from './metaConversions';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

function order(partial: Partial<PaymentOrder>): PaymentOrder {
  return {
    id: 41,
    paymentOptionId: null,
    courseId: 1,
    coursePriceId: 2,
    customerId: 3,
    zenlerCourseId: 'z1',
    accessZenlerCourseIds: [],
    courseTitle: 'ACCA FA2',
    optionType: '6 months',
    studentName: 'Test Student',
    studentEmail: 'Test@Example.com',
    studentPhone: '07911123456',
    countryCode: 'GB',
    amount: 199,
    currency: 'gbp',
    presentmentAmount: null,
    presentmentCurrency: null,
    durationDays: 180,
    sessionMonth: null,
    sessionYear: null,
    discountPercent: null,
    status: 'Paid',
    provider: 'stripe',
    providerCheckoutId: 'cs_test',
    providerPaymentId: 'pi_test',
    providerRefundId: null,
    providerCustomerEmail: null,
    stripeCheckoutSessionId: 'cs_test',
    stripePaymentIntentId: 'pi_test',
    stripeRefundId: null,
    stripeCustomerEmail: null,
    zenlerUserId: null,
    zenlerEnrollmentStatus: 'enrolled',
    zenlerUserCreated: false,
    confirmationEmailSentAt: null,
    adminEmailSentAt: null,
    createdAt: new Date('2026-11-04T09:00:00.000Z'),
    paidAt: new Date('2026-11-04T09:05:00.000Z'),
    refundedAt: null,
    gclid: null,
    gbraid: null,
    wbraid: null,
    fbclid: 'fbclid-1',
    fbp: 'fb.1.1700000000.1234567890',
    fbc: 'fb.1.1700000000.fbclid-1',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    gadSource: null,
    gadCampaignId: null,
    landingPage: null,
    checkoutEnvironment: 'production',
    attrUserAgent: 'Mozilla/5.0',
    attrClientIp: '203.0.113.10',
    attrCapturedAt: new Date('2026-11-04T09:00:00.000Z'),
    conversionUploadStatus: 'pending_upload',
    conversionUploadedAt: null,
    conversionUploadError: null,
    conversionUploadRequestId: null,
    ...partial,
  };
}

run('production purchase includes the shared event id and hashed contact', () => {
  const body = buildMetaPurchaseRequest(order({}));
  assert.ok(body);
  const event = body.data[0];
  assert.strictEqual(event.event_name, 'Purchase');
  assert.strictEqual(event.event_id, 'po-41');
  assert.strictEqual(event.event_time, Math.floor(new Date('2026-11-04T09:05:00.000Z').getTime() / 1000));
  const custom = event.custom_data as { value: number; currency: string; content_name: string };
  assert.strictEqual(custom.value, 199);
  assert.strictEqual(custom.currency, 'GBP');
  assert.strictEqual(custom.content_name, 'ACCA FA2');
  const user = event.user_data as {
    em: string[];
    ph: string[];
    fbp: string;
    fbc: string;
    client_ip_address: string;
    client_user_agent: string;
  };
  assert.strictEqual(user.em[0], createHash('sha256').update('test@example.com').digest('hex'));
  assert.strictEqual(user.ph[0], hashPhoneForMeta('07911123456', 'GB'));
  assert.strictEqual(user.ph[0], createHash('sha256').update('447911123456').digest('hex'));
  assert.strictEqual(user.fbp, 'fb.1.1700000000.1234567890');
  assert.strictEqual(user.fbc, 'fb.1.1700000000.fbclid-1');
  assert.strictEqual(user.client_ip_address, '203.0.113.10');
  assert.strictEqual(user.client_user_agent, 'Mozilla/5.0');
});

run('staging and unpaid orders are not sent', () => {
  assert.strictEqual(buildMetaPurchaseRequest(order({ checkoutEnvironment: 'staging' })), null);
  assert.strictEqual(buildMetaPurchaseRequest(order({ status: 'Pending' })), null);
  assert.strictEqual(buildMetaPurchaseRequest(order({ amount: 0 })), null);
});

run('config is absent until the access token is set', () => {
  const previousToken = process.env.META_CAPI_ACCESS_TOKEN;
  const previousPixel = process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.META_PIXEL_ID;
  assert.strictEqual(readMetaCapiConfig(), null);
  process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
  process.env.META_PIXEL_ID = '1187799681576907';
  assert.deepStrictEqual(readMetaCapiConfig(), {
    pixelId: '1187799681576907',
    accessToken: 'test-token',
  });
  if (previousToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN;
  else process.env.META_CAPI_ACCESS_TOKEN = previousToken;
  if (previousPixel === undefined) delete process.env.META_PIXEL_ID;
  else process.env.META_PIXEL_ID = previousPixel;
});

console.log('metaConversions.test.ts ok');
