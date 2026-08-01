import type { PaymentOrder } from '../models/paymentOrder';
import type { ZenlerEnrollmentEmailContext } from './zenlerEnrollmentEnsure';
import { VLS_SCHOOL_LOGIN_URL } from './schoolAccess';

const VLS_LOGO_URL = 'https://vls-online.com/media/vertex-logo-mark.svg';
const VLS_SITE_URL = 'https://vls-online.com';
const BRAND = {
  navy: '#0f1e3c',
  navySoft: '#204280',
  accent: '#4ea8de',
  logoBlue: '#1E50C8',
  text: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  panel: '#f4f7fb',
  white: '#ffffff',
  pageBg: '#eef2f7',
  font: "Poppins, Arial, Helvetica, sans-serif",
};

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

function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BRAND.font};font-size:15px;line-height:1.65;color:${BRAND.text};">${html}</p>`;
}

function detailTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows.map((row, index) => {
    const border = index < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : '';
    return `<tr>
      <td style="padding:14px 18px;${border}font-family:${BRAND.font};font-size:13px;color:${BRAND.muted};width:140px;vertical-align:top;">${esc(row.label)}</td>
      <td style="padding:14px 18px;${border}font-family:${BRAND.font};font-size:14px;color:${BRAND.navy};font-weight:600;vertical-align:top;">${esc(row.value)}</td>
    </tr>`;
  }).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${BRAND.border};background-color:${BRAND.panel};border-radius:8px;">
    ${body}
  </table>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      <td style="background-color:${BRAND.logoBlue};border-radius:8px;">
        <a href="${esc(url)}" style="display:inline-block;padding:14px 28px;font-family:${BRAND.font};font-size:14px;font-weight:700;color:${BRAND.white};text-decoration:none;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

function renderBrandedEmail(input: {
  title: string;
  preheader?: string;
  bodyHtml: string;
}): string {
  const preheader = input.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>${esc(input.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${BRAND.font};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND.navy};padding:22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${VLS_LOGO_URL}" width="38" height="38" alt="VLS" style="display:block;border:0;border-radius:10px;width:38px;height:38px;">
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:${BRAND.font};font-size:18px;font-weight:700;color:${BRAND.white};line-height:1.2;">VLS Online</p>
                    <p style="margin:4px 0 0;font-family:${BRAND.font};font-size:12px;font-weight:400;color:${BRAND.accent};letter-spacing:0.04em;">Vertex Learning Solutions</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;background-color:${BRAND.white};">
              <div style="height:3px;background:linear-gradient(90deg, ${BRAND.logoBlue} 0%, ${BRAND.accent} 100%);border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 20px;font-family:${BRAND.font};font-size:22px;font-weight:700;line-height:1.3;color:${BRAND.navy};">${esc(input.title)}</h1>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.border};background-color:${BRAND.panel};">
              <p style="margin:0 0 6px;font-family:${BRAND.font};font-size:14px;line-height:1.6;color:${BRAND.text};">Kind regards,</p>
              <p style="margin:0 0 10px;font-family:${BRAND.font};font-size:14px;font-weight:700;color:${BRAND.navy};">VLS Online</p>
              <p style="margin:0;font-family:${BRAND.font};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                <a href="${VLS_SITE_URL}" style="color:${BRAND.navySoft};text-decoration:none;">vls-online.com</a>
                &nbsp;·&nbsp;
                Expert ACCA, CIMA &amp; CMA exam preparation
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:${BRAND.font};font-size:11px;line-height:1.5;color:${BRAND.muted};text-align:center;">
          This email was sent by Vertex Learning Solutions (VLS Online).
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
      accessHtml = `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`<strong style="color:${BRAND.navy};">Email:</strong> ${esc(to)}<br>
<strong style="color:${BRAND.navy};">Temporary password:</strong> ${esc(access.temporaryPassword)}`)}
${p(`Please log in and change your password after your first sign-in. Your enrolled course will appear under <strong>My Courses</strong>.`)}`;
    } else {
      accessText = `
Access your course at: ${loginUrl}
Sign in with your existing VLS school account. Your enrolled course will appear under My Courses.

`;
      accessHtml = `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`Sign in with your existing VLS school account. Your enrolled course will appear under <strong>My Courses</strong>.`)}`;
    }
  } else {
    accessText = `
Access your course at: ${loginUrl}
If you are a new student, create your account at https://school.vls-online.com/register using the same email address you used for payment.

`;
      accessHtml = `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`If you are a new student, create your account at <a href="https://school.vls-online.com/register" style="color:${BRAND.navySoft};">school.vls-online.com/register</a> using the same email address you used for payment.`)}`;
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

  const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`Thank you for your payment.`)}
${p(`We have successfully received your payment for:`)}
${detailTable([
    { label: 'Course', value: order.courseTitle },
    { label: 'Option', value: option },
    { label: 'Amount paid', value: amount },
  ])}
${p(`Your payment has been confirmed.`)}
${accessHtml}`;

  await sendEmail({
    to,
    subject: 'Payment confirmation - VLS Online',
    text,
    html: renderBrandedEmail({
      title: 'Payment confirmation',
      preheader: `Payment confirmed for ${order.courseTitle} — ${amount}`,
      bodyHtml,
    }),
  });
  return true;
}

export async function sendCustomPaymentOfferEmail(input: {
  firstName: string;
  email: string;
  courseTitle: string;
  amount: number;
  currency: string;
  durationDays: number;
  checkoutUrl: string;
}): Promise<void> {
  const name = input.firstName.trim() || 'Student';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: input.currency || 'USD',
  }).format(input.amount);
  const durationLabel = input.durationDays === 1
    ? '1 day'
    : `${input.durationDays} days`;

  const subject = `Your VLS Online course payment link — ${input.courseTitle}`;

  const text = `Dear ${name},

Thank you for your interest in continuing your studies with VLS Online.

Please find below the details of your course payment arrangement:

Course: ${input.courseTitle}
Amount due: ${amount}
Access duration: ${durationLabel}

To complete your enrolment, please make payment securely via the link below:

${input.checkoutUrl}

Once payment has been received, you will receive a confirmation email with instructions on how to access your course.

If you have any questions, please reply to this email or contact our support team.

Kind regards,
VLS Online
https://vls-online.com`;

  const bodyHtml = `
${p(`Dear ${esc(name)},`)}
${p(`Thank you for your interest in continuing your studies with VLS Online.`)}
${p(`Please find below the details of your course payment arrangement:`)}
${detailTable([
    { label: 'Course', value: input.courseTitle },
    { label: 'Amount due', value: amount },
    { label: 'Access duration', value: durationLabel },
  ])}
${p(`To complete your enrolment, please make payment securely using the button below:`)}
${ctaButton(input.checkoutUrl, `Pay ${amount} securely`)}
${p(`<span style="color:${BRAND.muted};font-size:13px;">Or copy and paste this link into your browser:</span><br>
<a href="${esc(input.checkoutUrl)}" style="color:${BRAND.navySoft};font-size:13px;word-break:break-all;">${esc(input.checkoutUrl)}</a>`)}
${p(`Once payment has been received, you will receive a confirmation email with instructions on how to access your course.`)}
${p(`If you have any questions, please reply to this email or contact our support team.`)}`;

  await sendEmail({
    to: input.email,
    subject,
    text,
    html: renderBrandedEmail({
      title: 'Course payment invitation',
      preheader: `Complete payment for ${input.courseTitle} — ${amount}`,
      bodyHtml,
    }),
  });
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
