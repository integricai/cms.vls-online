import assert from 'assert';
import type { PaymentOrder } from '../models/paymentOrder';
import { hashPhoneForAds } from './attribution';
import { buildPurchaseEvent } from './googleAdsConversions';

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
    courseTitle: 'ACCA FA2',
    optionType: '6 months',
    studentName: 'Test Student',
    studentEmail: 'Test@Example.com',
    studentPhone: '07911123456',
    countryCode: 'GB',
    amount: 199,
    currency: 'usd',
    durationDays: 180,
    discountPercent: null,
    status: 'Paid',
    stripeCheckoutSessionId: 'cs_test',
    stripePaymentIntentId: 'pi_test',
    stripeRefundId: null,
    stripeCustomerEmail: 'Test@Example.com',
    zenlerUserId: null,
    zenlerEnrollmentStatus: 'enrolled',
    zenlerUserCreated: false,
    confirmationEmailSentAt: null,
    adminEmailSentAt: null,
    createdAt: new Date('2026-08-16T01:00:00.000Z'),
    paidAt: new Date('2026-08-16T01:05:00.000Z'),
    refundedAt: null,
    gclid: 'gclid-abc',
    gbraid: null,
    wbraid: null,
    fbclid: 'fbclid-1',
    fbp: null,
    fbc: null,
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'acca',
    utmContent: null,
    utmTerm: null,
    landingPage: '/courses/fa2?gclid=gclid-abc',
    checkoutEnvironment: 'staging',
    attrUserAgent: 'Mozilla/5.0',
    attrClientIp: '203.0.113.10',
    attrCapturedAt: new Date('2026-08-16T00:50:00.000Z'),
    conversionUploadStatus: 'pending_upload',
    conversionUploadedAt: null,
    conversionUploadError: null,
    conversionUploadRequestId: null,
    ...partial,
  };
}

console.log('googleAdsConversions tests');

run('builds a Data Manager purchase event with click id and hashed email', () => {
  const event = buildPurchaseEvent(order({}));
  assert.strictEqual(event.eventName, 'purchase');
  assert.strictEqual(event.transactionId, 'po-41');
  assert.strictEqual(event.conversionValue, 199);
  assert.strictEqual(event.currency, 'USD');
  assert.deepStrictEqual(event.adIdentifiers, { gclid: 'gclid-abc' });
  assert.deepStrictEqual(event.userData, {
    userIdentifiers: [
      { emailAddress: '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b' },
      { phoneNumber: hashPhoneForAds('07911123456', 'GB') },
    ],
  });
});
