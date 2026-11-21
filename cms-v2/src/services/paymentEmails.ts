import type { PaymentOrder } from '../models/paymentOrder';
import type { ZenlerEnrollmentEmailContext } from './zenlerEnrollmentEnsure';
import { formatDisplayMoney } from './displayCurrency';
import { orderHasSchoolCourse, VLS_SCHOOL_LOGIN_URL, VLS_SCHOOL_PASSWORD_RESET_URL } from './schoolAccess';
import { emailBrandLogoHtml } from './emailBrandLogo';

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

function brandLogoMarkHtml(): string {
  return emailBrandLogoHtml('dark');
}

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

async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
  /** Overrides only the display name of EMAIL_FROM. */
  fromName?: string;
  headers?: Array<{ name: string; value: string }>;
}): Promise<void> {
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
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.fromName
        ? { ...parseSender(process.env.EMAIL_FROM), name: input.fromName }
        : parseSender(process.env.EMAIL_FROM),
      to: [{ email: input.to }],
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
      ...(input.headers?.length ? { headers: input.headers } : {}),
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
                    ${brandLogoMarkHtml()}
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

export function studentPaymentAccessInstructions(input: {
  email: string;
  access?: ZenlerEnrollmentEmailContext | null;
}): { text: string; html: string } {
  const to = input.email;
  const access = input.access;
  const loginUrl = access?.courseAccessUrl ?? VLS_SCHOOL_LOGIN_URL;

  if (access?.isNewZenlerUser && access.studentChosePassword && !access.temporaryPassword) {
    return {
      text: `
Sign in at: ${VLS_SCHOOL_LOGIN_URL}
Email: ${to}

Use the password you chose when you paid. Your enrolled course will appear under My Courses.

`,
      html: `
${p(`Please use the button below to sign in to the school.`)}
${ctaButton(VLS_SCHOOL_LOGIN_URL, 'Log in to the school')}
${p(`<strong style="color:${BRAND.navy};">Email:</strong> ${esc(to)}`)}
${p(`Use the password you chose when you paid. Your enrolled course will appear under <strong>My Courses</strong>.`)}`,
    };
  }

  if (access?.isNewZenlerUser && access.temporaryPassword) {
    return {
      text: `
Access your course at: ${loginUrl}
Email: ${to}
Temporary password: ${access.temporaryPassword}

Please log in and change your password after your first sign-in. Your enrolled course will appear under My Courses.

`,
      html: `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`<strong style="color:${BRAND.navy};">Email:</strong> ${esc(to)}<br>
<strong style="color:${BRAND.navy};">Temporary password:</strong> ${esc(access.temporaryPassword)}`)}
${p(`Please log in and change your password after your first sign-in. Your enrolled course will appear under <strong>My Courses</strong>.`)}`,
    };
  }

  if (access?.isNewZenlerUser) {
    return {
      text: `
We created a VLS school account for ${to}, but this message does not include a temporary password.

Set your password at: ${VLS_SCHOOL_PASSWORD_RESET_URL}
Use the same email address you used for payment.

Then sign in at: ${loginUrl}
Your enrolled course will appear under My Courses.

`,
      html: `
${p(`We created a VLS school account for <strong>${esc(to)}</strong>, but this message does not include a temporary password.`)}
${p(`Set your password with the button below, using the same email address you used for payment.`)}
${ctaButton(VLS_SCHOOL_PASSWORD_RESET_URL, 'Set your password')}
${p(`Then sign in at <a href="${esc(loginUrl)}" style="color:${BRAND.navySoft};">${esc(loginUrl)}</a>. Your enrolled course will appear under <strong>My Courses</strong>.`)}`,
    };
  }

  if (access?.zenlerEnrollmentStatus.startsWith('enrolled')) {
    return {
      text: `
Access your course at: ${loginUrl}
Sign in with your existing VLS school account. Your enrolled course will appear under My Courses.

`,
      html: `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`Sign in with your existing VLS school account. Your enrolled course will appear under <strong>My Courses</strong>.`)}`,
    };
  }

  return {
    text: `
Access your course at: ${loginUrl}
If you are a new student, create your account at https://school.vls-online.com/register using the same email address you used for payment.

`,
    html: `
${p(`Please use the button below to access your course.`)}
${ctaButton(loginUrl, 'Access your course')}
${p(`If you are a new student, create your account at <a href="https://school.vls-online.com/register" style="color:${BRAND.navySoft};">school.vls-online.com/register</a> using the same email address you used for payment.`)}`,
  };
}

/**
 * Payment-first purchases skip the account form. New students receive a temporary
 * password. Returning students are told to use the school login they already have.
 * A buyer who chose a password at checkout keeps the older confirmation.
 */
export function stagingPurchaseConfirmation(input: {
  name: string;
  email: string;
  courseTitle: string;
  amountLabel: string;
  loginUrl: string;
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  zenlerEnrollmentStatus: string;
}): { subject: string; text: string; html: string } | null {
  const name = input.name.trim() || 'Student';
  const subject = 'Payment confirmation - VLS Online';
  const enrolled = input.zenlerEnrollmentStatus.toLowerCase().startsWith('enrolled');

  if (input.isNewZenlerUser && input.temporaryPassword) {
    const text = `Hi ${name},

Thank you! Your purchase was successful.

Course: ${input.courseTitle}
Price: ${input.amountLabel}
Email: ${input.email}
Temporary password: ${input.temporaryPassword}

Please sign in to the school and change this password.

${input.loginUrl}

Kind regards,
VLS Online`;
    const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`Thank you! Your purchase was successful.`)}
${detailTable([
    { label: 'Course', value: input.courseTitle },
    { label: 'Price', value: input.amountLabel },
    { label: 'Email', value: input.email },
    { label: 'Temporary password', value: input.temporaryPassword },
  ])}
${p(`Please sign in to the school and change this password.`)}
${ctaButton(input.loginUrl, 'Sign in to the school')}`;
    return { subject, text, html: bodyHtml };
  }

  if (!input.isNewZenlerUser && enrolled) {
    const text = `Hi ${name},

Thank you! Your purchase was successful.

Course: ${input.courseTitle}
Price: ${input.amountLabel}

You can access the course in the school with the same login information you already use.

${input.loginUrl}

Kind regards,
VLS Online`;
    const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`Thank you! Your purchase was successful.`)}
${detailTable([
    { label: 'Course', value: input.courseTitle },
    { label: 'Price', value: input.amountLabel },
  ])}
${p(`You can access the course in the school with the same login information you already use.`)}
${ctaButton(input.loginUrl, 'Sign in to the school')}`;
    return { subject, text, html: bodyHtml };
  }

  return null;
}

export async function sendStudentPaymentConfirmation(
  order: PaymentOrder,
  access?: ZenlerEnrollmentEmailContext | null,
): Promise<boolean> {
  const to = order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const option = order.optionType || 'Course payment';
  const seenLocally = order.presentmentAmount != null
    && order.presentmentCurrency
    && order.presentmentCurrency.toUpperCase() !== (order.currency || 'USD').toUpperCase();
  const amount = seenLocally
    ? formatDisplayMoney(order.presentmentAmount as number, order.presentmentCurrency as string)
    : formatDisplayMoney(order.amount, order.currency || 'USD');

  if (!orderHasSchoolCourse(order)) {
    const text = `Hi ${name},

Thank you for your payment.

We have successfully received your payment for:

Description: ${order.courseTitle}
Amount paid: ${amount}

Your payment has been confirmed.

If you have any questions, please reply to this email or contact our support team.

Kind regards,
VLS Online`;

    const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`Thank you for your payment.`)}
${p(`We have successfully received your payment for:`)}
${detailTable([
    { label: 'Description', value: order.courseTitle },
    { label: 'Amount paid', value: amount },
  ])}
${p(`Your payment has been confirmed.`)}
${p(`If you have any questions, please reply to this email or contact our support team.`)}`;

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

  const staged = stagingPurchaseConfirmation({
    name,
    email: to,
    courseTitle: order.courseTitle,
    amountLabel: amount,
    loginUrl: access?.courseAccessUrl ?? VLS_SCHOOL_LOGIN_URL,
    isNewZenlerUser: access?.isNewZenlerUser === true,
    temporaryPassword: access?.temporaryPassword ?? null,
    zenlerEnrollmentStatus: access?.zenlerEnrollmentStatus ?? '',
  });
  if (staged) {
    await sendEmail({
      to,
      subject: staged.subject,
      text: staged.text,
      html: renderBrandedEmail({
        title: 'Payment confirmation',
        preheader: `Payment confirmed for ${order.courseTitle} — ${amount}`,
        bodyHtml: staged.html,
      }),
    });
    return true;
  }

  const accessInstructions = studentPaymentAccessInstructions({ email: to, access });

  const text = `Hi ${name},

Thank you for your payment.

We have successfully received your payment for:

Course: ${order.courseTitle}
Option: ${option}
Amount paid: ${amount}

Your payment has been confirmed.
${accessInstructions.text}
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
${accessInstructions.html}`;

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

export function customPaymentOfferMessage(input: {
  firstName: string;
  courseTitle: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  checkoutUrl: string;
}): { subject: string; text: string; bodyHtml: string; title: string; preheader: string } {
  const name = input.firstName.trim() || 'Student';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: input.currency || 'USD',
  }).format(input.amount);
  const hasCourse = input.durationDays != null;
  const durationLabel = !hasCourse
    ? ''
    : input.durationDays === 1
      ? '1 day'
      : `${input.durationDays} days`;
  const itemLabel = hasCourse ? 'Course' : 'Description';
  const subject = hasCourse
    ? `Your VLS Online course payment link — ${input.courseTitle}`
    : `Your VLS Online payment link — ${input.courseTitle}`;
  const arrangement = hasCourse
    ? 'Please find below the details of your course payment arrangement:'
    : 'Please find below the details of your payment:';
  const payPrompt = hasCourse
    ? 'To complete your enrolment, please make payment securely via the link below:'
    : 'To complete your payment, please use the link below:';
  const payPromptHtml = hasCourse
    ? 'To complete your enrolment, please make payment securely using the button below:'
    : 'To complete your payment, please use the button below:';
  const afterPayment = hasCourse
    ? 'Once payment has been received, you will receive a confirmation email with instructions on how to access your course.'
    : 'Once payment has been received, you will receive a confirmation email.';

  const detailRows = [
    { label: itemLabel, value: input.courseTitle },
    { label: 'Amount due', value: amount },
    ...(hasCourse ? [{ label: 'Access duration', value: durationLabel }] : []),
  ];

  const text = `Dear ${name},

Thank you for your interest in continuing your studies with VLS Online.

${arrangement}

${itemLabel}: ${input.courseTitle}
Amount due: ${amount}${hasCourse ? `\nAccess duration: ${durationLabel}` : ''}

${payPrompt}

${input.checkoutUrl}

${afterPayment}

If you have any questions, please reply to this email or contact our support team.

Kind regards,
VLS Online
https://vls-online.com`;

  const bodyHtml = `
${p(`Dear ${esc(name)},`)}
${p(`Thank you for your interest in continuing your studies with VLS Online.`)}
${p(arrangement)}
${detailTable(detailRows)}
${p(payPromptHtml)}
${ctaButton(input.checkoutUrl, `Pay ${amount} securely`)}
${p(`<span style="color:${BRAND.muted};font-size:13px;">Or copy and paste this link into your browser:</span><br>
<a href="${esc(input.checkoutUrl)}" style="color:${BRAND.navySoft};font-size:13px;word-break:break-all;">${esc(input.checkoutUrl)}</a>`)}
${p(afterPayment)}
${p(`If you have any questions, please reply to this email or contact our support team.`)}`;

  return {
    subject,
    text,
    bodyHtml,
    title: hasCourse ? 'Course payment invitation' : 'Payment invitation',
    preheader: `Complete payment for ${input.courseTitle} — ${amount}`,
  };
}

export async function sendCustomPaymentOfferEmail(input: {
  firstName: string;
  email: string;
  courseTitle: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  checkoutUrl: string;
}): Promise<void> {
  const message = customPaymentOfferMessage(input);

  await sendEmail({
    to: input.email,
    subject: message.subject,
    text: message.text,
    html: renderBrandedEmail({
      title: message.title,
      preheader: message.preheader,
      bodyHtml: message.bodyHtml,
    }),
  });
}

export async function sendStudentRefundConfirmation(order: PaymentOrder): Promise<boolean> {
  const to = order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail;
  if (!to) return false;

  const name = order.studentName || 'Student';
  const option = order.optionType || 'Course payment';
  const amount = formatAmount(order);
  const hasCourse = orderHasSchoolCourse(order);
  const itemLabel = hasCourse ? 'Course' : 'Description';
  const accessNote = hasCourse
    ? 'Your course access has been revoked. The refund will be returned to your original payment method and should appear within 5–10 business days, depending on your bank.'
    : 'The refund will be returned to your original payment method and should appear within 5–10 business days, depending on your bank.';

  const text = `Hi ${name},

We have initiated a refund for your VLS Online purchase.

${itemLabel}: ${order.courseTitle}
Option: ${option}
Refund amount: ${amount}

${accessNote}

If you have any questions, please reply to this email or contact our support team.

Kind regards,
VLS Online`;

  const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`We have initiated a refund for your VLS Online purchase.`)}
${detailTable([
    { label: itemLabel, value: order.courseTitle },
    { label: 'Option', value: option },
    { label: 'Refund amount', value: amount },
  ])}
${p(hasCourse
    ? `Your course access has been revoked. The refund will be returned to your original payment method and should appear within <strong>5–10 business days</strong>, depending on your bank.`
    : `The refund will be returned to your original payment method and should appear within <strong>5–10 business days</strong>, depending on your bank.`)}
${p(`If you have any questions, please reply to this email or contact our support team.`)}`;

  await sendEmail({
    to,
    subject: 'Refund confirmation - VLS Online',
    text,
    html: renderBrandedEmail({
      title: 'Refund confirmation',
      preheader: `Refund initiated for ${order.courseTitle} — ${amount}`,
      bodyHtml,
    }),
  });
  return true;
}

export async function sendFreeEnrolConfirmation(input: {
  studentEmail: string;
  studentName: string;
  courseTitle: string;
  accessUrl: string;
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
}): Promise<boolean> {
  const to = input.studentEmail.trim();
  if (!to) return false;

  const name = input.studentName.trim() || 'Student';
  const loginUrl = input.accessUrl || VLS_SCHOOL_LOGIN_URL;

  let accessText = '';
  let accessHtml = '';

  if (input.isNewZenlerUser && input.temporaryPassword) {
    accessText = `
Access your quizzes at: ${loginUrl}
Email: ${to}
Temporary password: ${input.temporaryPassword}

Please log in and change your password after your first sign-in. Your free quizzes will appear under My Courses.

`;
    accessHtml = `
${p(`Please use the button below to access your free quizzes.`)}
${ctaButton(loginUrl, 'Access your quizzes')}
${p(`<strong style="color:${BRAND.navy};">Email:</strong> ${esc(to)}<br>
<strong style="color:${BRAND.navy};">Temporary password:</strong> ${esc(input.temporaryPassword)}`)}
${p(`Please log in and change your password after your first sign-in. Your free quizzes will appear under <strong>My Courses</strong>.`)}`;
  } else {
    accessText = `
Access your quizzes at: ${loginUrl}
Sign in with your existing VLS school account. Your free quizzes will appear under My Courses.

`;
    accessHtml = `
${p(`Please use the button below to access your free quizzes.`)}
${ctaButton(loginUrl, 'Access your quizzes')}
${p(`Sign in with your existing VLS school account. Your free quizzes will appear under <strong>My Courses</strong>.`)}`;
  }

  const text = `Hi ${name},

You are enrolled on ${input.courseTitle}. There is no charge.
${accessText}
Kind regards,
VLS Online`;

  const bodyHtml = `
${p(`Hi ${esc(name)},`)}
${p(`You are enrolled on <strong>${esc(input.courseTitle)}</strong>. There is no charge.`)}
${accessHtml}`;

  await sendEmail({
    to,
    subject: `You're enrolled — ${input.courseTitle}`,
    text,
    html: renderBrandedEmail({
      title: 'Free quiz enrolment',
      preheader: `You are enrolled on ${input.courseTitle}`,
      bodyHtml,
    }),
  });
  return true;
}

export async function sendAdminPaymentNotification(order: PaymentOrder): Promise<boolean> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return false;

  const amount = formatAmount(order);
  const hasCourse = orderHasSchoolCourse(order);
  const itemLabel = hasCourse ? 'Course title' : 'Description';
  const text = `Student name: ${order.studentName ?? ''}
Student email: ${order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail ?? ''}
${itemLabel}: ${order.courseTitle}
Option type: ${order.optionType ?? ''}
Amount paid: ${amount}
Provider: ${order.provider}
Checkout ID: ${order.providerCheckoutId ?? order.stripeCheckoutSessionId ?? ''}
Payment date/time: ${order.paidAt?.toISOString() ?? ''}`;

  await sendEmail({
    to,
    subject: hasCourse
      ? `New course payment received - ${order.courseTitle}`
      : `New payment received - ${order.courseTitle}`,
    text,
    html: `<p><strong>Student name:</strong> ${esc(order.studentName)}</p>
<p><strong>Student email:</strong> ${esc(order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail)}</p>
<p><strong>${esc(itemLabel)}:</strong> ${esc(order.courseTitle)}</p>
<p><strong>Option type:</strong> ${esc(order.optionType)}</p>
<p><strong>Amount paid:</strong> ${esc(amount)}</p>
<p><strong>Provider:</strong> ${esc(order.provider)}</p>
<p><strong>Checkout ID:</strong> ${esc(order.providerCheckoutId ?? order.stripeCheckoutSessionId)}</p>
<p><strong>Payment date/time:</strong> ${esc(order.paidAt?.toISOString())}</p>`,
  });
  return true;
}

export type CheckoutFollowupStep = 1 | 2 | 3;

export interface CheckoutFollowupEmailInput {
  step: CheckoutFollowupStep;
  /** Used in the greeting. Omitted when the checkout never captured a name. */
  firstName?: string | null;
  courseTitle: string;
  /** Course page on the website, e.g. https://vls-online.com/courses/acca-fr-financial-reporting */
  courseUrl: string;
  unsubscribeUrl: string;
  /** Digits with country code, e.g. 447700900000. Omitted from the email when not set. */
  whatsappNumber?: string | null;
}

function withEmailUtm(url: string, step: CheckoutFollowupStep): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('utm_source', 'email');
    parsed.searchParams.set('utm_medium', 'checkout_followup');
    parsed.searchParams.set('utm_campaign', `checkout_followup_${step}`);
    return parsed.toString();
  } catch {
    return url;
  }
}

function followupGreeting(firstName: string | null | undefined): string {
  const name = firstName?.replace(/\s+/g, ' ').trim();
  return name ? `Hello ${name},` : 'Hello,';
}

export function checkoutFollowupMessage(input: CheckoutFollowupEmailInput): { subject: string; text: string; html: string } {
  const course = input.courseTitle.replace(/\s+/g, ' ').trim();
  const greeting = followupGreeting(input.firstName);
  const link = withEmailUtm(input.courseUrl, input.step);
  const digits = (input.whatsappNumber ?? '').replace(/\D/g, '');
  const whatsappUrl = digits ? `https://wa.me/${digits}` : null;

  const helpText = whatsappUrl
    ? `Questions, or trouble paying? Reply to this email or message us on WhatsApp: ${whatsappUrl}`
    : 'Questions, or trouble paying? Just reply to this email and our team will help.';
  const helpHtml = whatsappUrl
    ? p(`Questions, or trouble paying? Reply to this email or <a href="${esc(whatsappUrl)}" style="color:${BRAND.navySoft};font-weight:600;">message us on WhatsApp</a>.`)
    : p('Questions, or trouble paying? Just reply to this email and our team will help.');

  const copy = {
    1: {
      subject: `You didn't finish enrolling in ${course}`,
      title: 'Your enrolment is not finished',
      preheader: `Pick up where you left off with ${course}.`,
      lines: [
        `You started enrolling in ${course}, but the checkout closed before payment went through. Nothing has been charged.`,
        'You can pick up where you left off from the course page.',
      ],
      button: 'Continue enrolling',
      extra: 'If your card was declined, your bank may be blocking an international online payment. Trying another card usually works, or reply and we can help you pay another way.',
    },
    2: {
      subject: `Still thinking about ${course}?`,
      title: 'Still thinking it over?',
      preheader: `Any questions about ${course}? We're happy to help.`,
      lines: [
        `You recently started enrolling in ${course}.`,
        'If something held you back, such as which exam session to choose, what the course includes, or how to pay, tell us and we will answer it.',
      ],
      button: 'View the course',
      extra: null,
    },
    3: {
      subject: `Last reminder: ${course}`,
      title: 'One last reminder',
      preheader: `Your ${course} enrolment is still open.`,
      lines: [
        `This is our last email about ${course}.`,
        'If you are still preparing for your exam, you can enrol from the course page at any time.',
      ],
      button: 'Enrol now',
      extra: null,
    },
  }[input.step];

  const unsubscribeText = `Don't want these reminders? Unsubscribe: ${input.unsubscribeUrl}`;
  const text = [
    greeting,
    '',
    ...copy.lines.flatMap(line => [line, '']),
    `${copy.button}: ${link}`,
    '',
    ...(copy.extra ? [copy.extra, ''] : []),
    helpText,
    '',
    'Kind regards,',
    'VLS Online',
    '',
    unsubscribeText,
  ].join('\n');

  const html = renderBrandedEmail({
    title: copy.title,
    preheader: copy.preheader,
    bodyHtml: `
${p(esc(greeting))}
${copy.lines.map(line => p(esc(line))).join('\n')}
${ctaButton(link, copy.button)}
${copy.extra ? p(esc(copy.extra)) : ''}
${helpHtml}
<p style="margin:24px 0 8px;font-family:${BRAND.font};font-size:12px;line-height:1.6;color:${BRAND.muted};">
  Don't want these reminders? <a href="${esc(input.unsubscribeUrl)}" style="color:${BRAND.muted};">Unsubscribe</a>.
</p>`,
  });

  return { subject: copy.subject, text, html };
}

export async function sendCheckoutFollowupEmail(input: CheckoutFollowupEmailInput & { to: string }): Promise<void> {
  const message = checkoutFollowupMessage(input);
  await sendEmail({
    to: input.to,
    ...message,
    // Replies go to the address on the Contact us page, not to noreply@.
    replyTo: process.env.CHECKOUT_FOLLOWUP_REPLY_TO?.trim() || 'office@vls-online.com',
    fromName: 'VLS Online',
    // MailerSend only accepts custom headers on some plans, so this is opt-in.
    headers: process.env.CHECKOUT_FOLLOWUP_LIST_UNSUBSCRIBE === 'on'
      ? [
          { name: 'List-Unsubscribe', value: `<${input.unsubscribeUrl}>` },
          { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
        ]
      : undefined,
  });
}
