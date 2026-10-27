const BRAND = {
  navy: '#0f1e3c',
  text: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  panel: '#f4f7fb',
  white: '#ffffff',
  pageBg: '#eef2f7',
  logoBlue: '#1E50C8',
  font: 'Poppins, Arial, Helvetica, sans-serif',
};

function parseSender(value: string | undefined) {
  const fallback = { email: 'noreply@vls-online.com', name: 'Vertex Learning Solutions' };
  if (!value) return fallback;
  const match = value.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { ...fallback, email: value.trim() };
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function payButton(url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0;">
    <tr>
      <td style="background:${BRAND.logoBlue};border-radius:8px;">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:${BRAND.font};font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;">Pay and enrol</a>
      </td>
    </tr>
  </table>`;
}

function formatExpiryDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

export function buildDiscountPayEmail(input: {
  firstName: string;
  courseName: string;
  fullPriceLabel: string;
  discountLabel: string;
  payableLabel: string;
  payUrl: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const firstName = input.firstName.trim() || 'there';
  const courseName = input.courseName.trim() || 'your course';
  const expires = formatExpiryDate(input.expiresAt);
  const subject = `Pay for ${courseName}`;
  const text = [
    `Hello ${firstName},`,
    '',
    `Your place on ${courseName} is ready.`,
    '',
    `Course: ${courseName}`,
    `Full price: ${input.fullPriceLabel}`,
    `Discount: ${input.discountLabel}`,
    `You pay: ${input.payableLabel}`,
    '',
    `Pay and enrol: ${input.payUrl}`,
    '',
    `This link expires on ${expires} and can be used once.`,
    '',
    'Vertex Learning Solutions',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:${BRAND.pageBg};font-family:${BRAND.font};color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;">
        <tr><td style="padding:24px 28px 8px;">
          <div style="width:38px;height:38px;background:${BRAND.logoBlue};border-radius:10px;color:${BRAND.white};font-weight:700;line-height:38px;text-align:center;">V</div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.navy};">Pay for your course</h1>
          <p style="margin:0 0 12px;">Hello ${esc(firstName)},</p>
          <p style="margin:0 0 12px;">Your place on <strong>${esc(courseName)}</strong> is ready.</p>
          <p style="margin:16px 0;padding:14px 16px;background:${BRAND.panel};border-radius:8px;color:${BRAND.navy};">
            <strong>Course:</strong> ${esc(courseName)}<br>
            <strong>Full price:</strong> ${esc(input.fullPriceLabel)}<br>
            <strong>Discount:</strong> ${esc(input.discountLabel)}<br>
            <strong>You pay:</strong> ${esc(input.payableLabel)}
          </p>
          ${payButton(input.payUrl)}
          <p style="margin:16px 0 0;color:${BRAND.muted};">This link expires on ${esc(expires)} and can be used once. You will enter your email and payment details on the next page.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

async function sendEmail(input: { to: string; cc?: string | null; subject: string; text: string; html: string }): Promise<void> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email] ${input.subject}\nTo: ${input.to}\nCc: ${input.cc ?? ''}\n${input.text}`);
      return;
    }
    throw new Error('MAILERSEND_API_KEY is not configured');
  }

  const cc = input.cc?.trim().toLowerCase() ?? '';
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: parseSender(process.env.EMAIL_FROM),
      to: [{ email: input.to }],
      ...(cc && cc !== input.to.trim().toLowerCase() ? { cc: [{ email: cc }] } : {}),
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

export async function sendRetakeDiscountCodeEmail(input: {
  to: string;
  cc?: string | null;
  firstName: string;
  courseName: string;
  fullPriceLabel: string;
  discountLabel: string;
  payableLabel: string;
  payUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const message = buildDiscountPayEmail(input);
  await sendEmail({ to: input.to, cc: input.cc, ...message });
}
