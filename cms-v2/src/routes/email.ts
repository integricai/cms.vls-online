import nodemailer from 'nodemailer';

function buildPasswordResetEmail(resetUrl: string) {
  return {
    subject: 'Reset your CMS password',
    text: `You requested a password reset. Visit the link below (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#204280;color:#fff;border-radius:6px;text-decoration:none;font-family:sans-serif;">
          Reset password
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">Link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
  };
}

function createTransport() {
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
): Promise<void> {
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  const email = buildPasswordResetEmail(resetUrl);

  if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
    console.log(`[password-reset] Reset link for ${to}: ${resetUrl}`);
    return;
  }

  const transport = createTransport();

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? '"CMS" <noreply@vls-online.com>',
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
