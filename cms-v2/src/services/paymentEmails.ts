import type { PaymentOrder } from '../models/paymentOrder';
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f172a;padding:28px 32px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">VLS Online</p>
              <h1 style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;line-height:1.3;color:#ffffff;">Course Payment Invitation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">Dear ${esc(name)},</p>
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">Thank you for your interest in continuing your studies with VLS Online.</p>
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">Please find below the details of your course payment arrangement:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e2e8f0;background-color:#f8fafc;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;width:140px;">Course</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;font-weight:600;">${esc(input.courseTitle)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Amount due</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;font-weight:600;">${esc(amount)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Access duration</td>
                  <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;font-weight:600;">${esc(durationLabel)}</td>
                </tr>
              </table>
              <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">To complete your enrolment, please make payment securely using the button below:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#0f172a;border-radius:4px;">
                    <a href="${esc(input.checkoutUrl)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Pay ${esc(amount)} securely</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">Or copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${esc(input.checkoutUrl)}" style="color:#1d4ed8;">${esc(input.checkoutUrl)}</a></p>
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">Once payment has been received, you will receive a confirmation email with instructions on how to access your course.</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">If you have any questions, please reply to this email or contact our support team.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">Kind regards,<br><strong style="color:#0f172a;">VLS Online</strong><br><a href="https://vls-online.com" style="color:#1d4ed8;text-decoration:none;">vls-online.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: input.email,
    subject,
    text,
    html,
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
