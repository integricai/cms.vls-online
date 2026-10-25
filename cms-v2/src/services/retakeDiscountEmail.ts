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
    signal: AbortSignal.timeout(15_000),
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

export async function sendRetakeDiscountCodeEmail(input: {
  to: string;
  firstName: string;
  courseName: string;
  code: string;
  discountLabel: string;
}): Promise<void> {
  const firstName = input.firstName.trim() || 'there';
  const subject = `Your Vertex retake code for ${input.courseName}`;
  const text = [
    `Hello ${firstName},`,
    '',
    `Your retake code for ${input.courseName} is ${input.code}.`,
    `It takes ${input.discountLabel} off the course price and can be used once.`,
    'Enter it on the Vertex checkout page with this same email address.',
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
          <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.navy};">Your retake code</h1>
          <p style="margin:0 0 12px;">Hello ${esc(firstName)},</p>
          <p style="margin:0 0 12px;">Use this code once when you enrol again in <strong>${esc(input.courseName)}</strong>. It takes ${esc(input.discountLabel)} off the course price.</p>
          <p style="margin:16px 0;padding:14px 16px;background:${BRAND.panel};border-radius:8px;font-size:20px;letter-spacing:1px;font-weight:700;color:${BRAND.navy};">${esc(input.code)}</p>
          <p style="margin:0;color:${BRAND.muted};">Enter it on the checkout page with this same email address. After a successful payment the code cannot be used again.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({ to: input.to, subject, text, html });
}
