import type { PaymentOrder } from '../models/paymentOrder';
import {
  countryDisplayName,
  pricingRegionLabel,
  resolvePricingRegion,
} from './pricingRegions';

function parseSender(value: string | undefined) {
  const fallback = { email: 'noreply@vls-online.com', name: 'VLS Online' };
  if (!value) return fallback;

  const match = value.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { ...fallback, email: value.trim() };
}

function formatAmount(order: PaymentOrder): string {
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: order.currency || 'GBP',
  }).format(order.amount);
  return amount;
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email] ${input.subject}\nTo: ${input.to}\n${input.text}`);
      return;
    }
    throw new Error('MAILERSEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: parseSender(process.env.EMAIL_FROM),
      to: [{ email: input.to }],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`MailerSend ${response.status}: ${details}`);
  }
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendStudentPaymentConfirmation(order: PaymentOrder): Promise<boolean> {
  const to = order.studentEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const option = order.optionType || 'Course payment';
  const amount = formatAmount(order);
  const text = `Hi ${name},

Thank you for your payment.

We have successfully received your payment for:

Course: ${order.courseTitle}
Option: ${option}
Amount paid: ${amount}

Your payment has been confirmed.

Kind regards,
VLS Online`;

  await sendEmail({
    to,
    subject: 'Payment confirmation - VLS Online',
    text,
    html: `<p>Hi ${esc(name)},</p>
<p>Thank you for your payment.</p>
<p>We have successfully received your payment for:</p>
<p><strong>Course:</strong> ${esc(order.courseTitle)}<br>
<strong>Option:</strong> ${esc(option)}<br>
<strong>Amount paid:</strong> ${esc(amount)}</p>
<p>Your payment has been confirmed.</p>
<p>Kind regards,<br>VLS Online</p>`,
  });
  return true;
}

export async function sendAdminPaymentNotification(order: PaymentOrder): Promise<boolean> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return false;

  const amount = formatAmount(order);
  const text = `Student name: ${order.studentName ?? ''}
Student email: ${order.studentEmail ?? order.stripeCustomerEmail ?? ''}
Course title: ${order.courseTitle}
Option type: ${order.optionType ?? ''}
Amount paid: ${amount}
Stripe checkout session ID: ${order.stripeCheckoutSessionId ?? ''}
Payment date/time: ${order.paidAt?.toISOString() ?? ''}`;

  await sendEmail({
    to,
    subject: `New course payment received - ${order.courseTitle}`,
    text,
    html: `<p><strong>Student name:</strong> ${esc(order.studentName)}</p>
<p><strong>Student email:</strong> ${esc(order.studentEmail ?? order.stripeCustomerEmail)}</p>
<p><strong>Course title:</strong> ${esc(order.courseTitle)}</p>
<p><strong>Option type:</strong> ${esc(order.optionType)}</p>
<p><strong>Amount paid:</strong> ${esc(amount)}</p>
<p><strong>Stripe checkout session ID:</strong> ${esc(order.stripeCheckoutSessionId)}</p>
<p><strong>Payment date/time:</strong> ${esc(order.paidAt?.toISOString())}</p>`,
  });
  return true;
}

export async function sendRegionalPricingMismatchRefund(
  order: PaymentOrder,
  paymentMethodCountry: string,
): Promise<boolean> {
  const to = order.studentEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const amount = formatAmount(order);
  const quotedRegion = pricingRegionLabel(resolvePricingRegion(order.countryCode));
  const paymentCountry = countryDisplayName(paymentMethodCountry);
  const quotedCountry = countryDisplayName(order.countryCode);
  const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@vls-online.com';

  const text = `Hi ${name},

We have refunded your recent payment of ${amount} for "${order.courseTitle}".

Our regional pricing is based on the country where you access our site and the country your payment method is registered in. These must match to qualify for a regional discount.

At checkout, your session was associated with ${quotedCountry} (${quotedRegion} pricing). The payment method used is registered in ${paymentCountry}, which does not match our regional pricing rules.

Your payment has been fully refunded. No course access has been granted.

If you believe this is an error, please contact us at ${supportEmail} with your order reference.

Kind regards,
VLS Online`;

  await sendEmail({
    to,
    subject: 'Payment refunded — regional pricing verification - VLS Online',
    text,
    html: `<p>Hi ${esc(name)},</p>
<p>We have <strong>refunded</strong> your recent payment of <strong>${esc(amount)}</strong> for <strong>${esc(order.courseTitle)}</strong>.</p>
<p>Our regional pricing is based on the country where you access our site and the country your payment method is registered in. These must match to qualify for a regional discount.</p>
<p>At checkout, your session was associated with <strong>${esc(quotedCountry)}</strong> (${esc(quotedRegion)} pricing). The payment method used is registered in <strong>${esc(paymentCountry)}</strong>, which does not match our regional pricing rules.</p>
<p>Your payment has been fully refunded. <strong>No course access has been granted.</strong></p>
<p>If you believe this is an error, please contact us at <a href="mailto:${esc(supportEmail)}">${esc(supportEmail)}</a> with your order reference.</p>
<p>Kind regards,<br>VLS Online</p>`,
  });
  return true;
}

export async function sendAdminRegionalMismatchNotification(
  order: PaymentOrder,
  paymentMethodCountry: string,
): Promise<boolean> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return false;

  const amount = formatAmount(order);
  const text = `Regional pricing mismatch — payment refunded

Student name: ${order.studentName ?? ''}
Student email: ${order.studentEmail ?? order.stripeCustomerEmail ?? ''}
Course title: ${order.courseTitle}
Amount refunded: ${amount}
Quoted country: ${order.countryCode ?? ''} (${pricingRegionLabel(resolvePricingRegion(order.countryCode))})
Payment method country: ${paymentMethodCountry} (${pricingRegionLabel(resolvePricingRegion(paymentMethodCountry))})
Order ID: ${order.id}
Stripe checkout session ID: ${order.stripeCheckoutSessionId ?? ''}
Stripe refund ID: ${order.stripeRefundId ?? ''}
Enrollment: blocked (regional mismatch)`;

  await sendEmail({
    to,
    subject: `Regional pricing mismatch — refund issued - ${order.courseTitle}`,
    text,
    html: `<p><strong>Regional pricing mismatch — payment refunded</strong></p>
<p><strong>Student name:</strong> ${esc(order.studentName)}</p>
<p><strong>Student email:</strong> ${esc(order.studentEmail ?? order.stripeCustomerEmail)}</p>
<p><strong>Course title:</strong> ${esc(order.courseTitle)}</p>
<p><strong>Amount refunded:</strong> ${esc(amount)}</p>
<p><strong>Quoted country:</strong> ${esc(order.countryCode)} (${esc(pricingRegionLabel(resolvePricingRegion(order.countryCode)))})</p>
<p><strong>Payment method country:</strong> ${esc(paymentMethodCountry)} (${esc(pricingRegionLabel(resolvePricingRegion(paymentMethodCountry)))})</p>
<p><strong>Order ID:</strong> ${esc(order.id)}</p>
<p><strong>Stripe checkout session ID:</strong> ${esc(order.stripeCheckoutSessionId)}</p>
<p><strong>Stripe refund ID:</strong> ${esc(order.stripeRefundId)}</p>
<p><strong>Enrollment:</strong> blocked (regional mismatch)</p>`,
  });
  return true;
}
