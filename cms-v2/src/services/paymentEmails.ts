import type { PaymentOrder } from '../models/paymentOrder';
import { countryDisplayName } from './pricingRegions';
import type { ZenlerEnrollmentEmailContext } from './zenlerEnrollmentEnsure';
import { VLS_SCHOOL_LOGIN_URL } from './schoolAccess';

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

export async function sendStudentPaymentConfirmation(
  order: PaymentOrder,
  access?: ZenlerEnrollmentEmailContext | null,
): Promise<boolean> {
  const to = order.studentEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const option = order.optionType || 'Course payment';
  const amount = formatAmount(order);
  const loginUrl = access?.courseAccessUrl ?? VLS_SCHOOL_LOGIN_URL;

  let accessText = '';
  let accessHtml = '';

  if (access?.zenlerEnrollmentStatus.startsWith('enrolled')) {
    if (access.isNewZenlerUser && access.temporaryPassword) {
      accessText = `
Access your course at: ${loginUrl}
Email: ${to}
Temporary password: ${access.temporaryPassword}

Please log in and change your password after your first sign-in. Your enrolled course will appear under My Courses.

`;
      accessHtml = `<p><strong>Access your course:</strong> <a href="${esc(loginUrl)}">${esc(loginUrl)}</a></p>
<p><strong>Email:</strong> ${esc(to)}<br>
<strong>Temporary password:</strong> ${esc(access.temporaryPassword)}</p>
<p>Please log in and change your password after your first sign-in. Your enrolled course will appear under <strong>My Courses</strong>.</p>`;
    } else {
      accessText = `
Access your course at: ${loginUrl}
Sign in with your existing VLS school account. Your enrolled course will appear under My Courses.

`;
      accessHtml = `<p><strong>Access your course:</strong> <a href="${esc(loginUrl)}">${esc(loginUrl)}</a></p>
<p>Sign in with your existing VLS school account. Your enrolled course will appear under <strong>My Courses</strong>.</p>`;
    }
  } else {
    accessText = `
Access your course at: ${loginUrl}
If you are a new student, create your account at https://school.vls-online.com/register using the same email address you used for payment.

`;
    accessHtml = `<p><strong>Access your course:</strong> <a href="${esc(loginUrl)}">${esc(loginUrl)}</a></p>
<p>If you are a new student, create your account at <a href="https://school.vls-online.com/register">https://school.vls-online.com/register</a> using the same email address you used for payment.</p>`;
  }

  const text = `Hi ${name},

Thank you for your payment.

We have successfully received your payment for:

Course: ${order.courseTitle}
Option: ${option}
Amount paid: ${amount}

Your payment has been confirmed.
${accessText}
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
${accessHtml}
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

export async function sendRegionalPricingMismatchCancelled(
  order: PaymentOrder,
  paymentMethodCountry: string,
): Promise<boolean> {
  const to = order.studentEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const amount = formatAmount(order);
  const paymentCountry = countryDisplayName(paymentMethodCountry);
  const quotedCountry = countryDisplayName(order.countryCode);
  const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@vls-online.com';

  const text = `Hi ${name},

We could not complete your payment of ${amount} for "${order.courseTitle}".

Our regional pricing requires that the country of your card matches the country used for the regional price at checkout.

At checkout, pricing was quoted for ${quotedCountry}. The card used is registered in ${paymentCountry}, which does not match.

The payment authorization was cancelled — you have not been charged. No course access has been granted.

If you believe this is an error, please contact us at ${supportEmail} with your order reference.

Kind regards,
VLS Online`;

  await sendEmail({
    to,
    subject: 'Payment cancelled — regional pricing verification - VLS Online',
    text,
    html: `<p>Hi ${esc(name)},</p>
<p>We could not complete your payment of <strong>${esc(amount)}</strong> for <strong>${esc(order.courseTitle)}</strong>.</p>
<p>Our regional pricing requires that the country of your card matches the country used for the regional price at checkout.</p>
<p>At checkout, pricing was quoted for <strong>${esc(quotedCountry)}</strong>. The card used is registered in <strong>${esc(paymentCountry)}</strong>, which does not match.</p>
<p>The payment authorization was <strong>cancelled</strong> — you have not been charged. <strong>No course access has been granted.</strong></p>
<p>If you believe this is an error, please contact us at <a href="mailto:${esc(supportEmail)}">${esc(supportEmail)}</a> with your order reference.</p>
<p>Kind regards,<br>VLS Online</p>`,
  });
  return true;
}

/** @deprecated Use sendRegionalPricingMismatchCancelled */
export const sendRegionalPricingMismatchRefund = sendRegionalPricingMismatchCancelled;

export async function sendAdminRegionalMismatchNotification(
  order: PaymentOrder,
  paymentMethodCountry: string,
): Promise<boolean> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return false;

  const amount = formatAmount(order);
  const text = `Regional pricing mismatch — payment authorization cancelled (not refunded)

Student name: ${order.studentName ?? ''}
Student email: ${order.studentEmail ?? order.stripeCustomerEmail ?? ''}
Course title: ${order.courseTitle}
Amount (not captured): ${amount}
Quoted country: ${order.countryCode ?? ''}
Payment method (card) country: ${paymentMethodCountry}
Order ID: ${order.id}
Stripe checkout session ID: ${order.stripeCheckoutSessionId ?? ''}
Stripe payment intent ID: ${order.stripePaymentIntentId ?? ''}
Enrollment: blocked (regional mismatch)`;

  await sendEmail({
    to,
    subject: `Regional pricing mismatch — authorization cancelled - ${order.courseTitle}`,
    text,
    html: `<p><strong>Regional pricing mismatch — authorization cancelled</strong></p>
<p><strong>Student name:</strong> ${esc(order.studentName)}</p>
<p><strong>Student email:</strong> ${esc(order.studentEmail ?? order.stripeCustomerEmail)}</p>
<p><strong>Course title:</strong> ${esc(order.courseTitle)}</p>
<p><strong>Amount (not captured):</strong> ${esc(amount)}</p>
<p><strong>Quoted country:</strong> ${esc(order.countryCode)}</p>
<p><strong>Payment method (card) country:</strong> ${esc(paymentMethodCountry)}</p>
<p><strong>Order ID:</strong> ${esc(order.id)}</p>
<p><strong>Stripe checkout session ID:</strong> ${esc(order.stripeCheckoutSessionId)}</p>
<p><strong>Stripe payment intent ID:</strong> ${esc(order.stripePaymentIntentId)}</p>
<p><strong>Enrollment:</strong> blocked (regional mismatch)</p>`,
  });
  return true;
}
