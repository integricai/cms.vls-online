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

function ctaButton(url: string, label: string, color = BRAND.logoBlue): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 12px 16px 0;display:inline-table;">
    <tr>
      <td style="background-color:${color};border-radius:8px;">
        <a href="${esc(url)}" style="display:inline-block;padding:14px 22px;font-family:${BRAND.font};font-size:14px;font-weight:700;color:${BRAND.white};text-decoration:none;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

function brandLogoMarkHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
    <tr>
      <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;background-color:${BRAND.logoBlue};border-radius:10px;font-family:${BRAND.font};font-size:19px;font-weight:700;line-height:38px;color:${BRAND.white};text-align:center;">
        V
      </td>
    </tr>
  </table>`;
}

function renderBrandedEmail(input: { title: string; preheader?: string; bodyHtml: string }): string {
  const preheader = input.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(input.title)}</title>
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
                  <td style="vertical-align:middle;padding-right:12px;">${brandLogoMarkHtml()}</td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:${BRAND.font};font-size:18px;font-weight:700;color:${BRAND.white};">VLS Online</p>
                    <p style="margin:4px 0 0;font-family:${BRAND.font};font-size:12px;color:${BRAND.accent};">Vertex Learning Solutions</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 20px;font-family:${BRAND.font};font-size:22px;font-weight:700;color:${BRAND.navy};">${esc(input.title)}</h1>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.border};background-color:${BRAND.panel};">
              <p style="margin:0 0 6px;font-family:${BRAND.font};font-size:14px;color:${BRAND.text};">Kind regards,</p>
              <p style="margin:0 0 10px;font-family:${BRAND.font};font-size:14px;font-weight:700;color:${BRAND.navy};">VLS Online</p>
              <p style="margin:0;font-family:${BRAND.font};font-size:12px;color:${BRAND.muted};">
                <a href="${VLS_SITE_URL}" style="color:${BRAND.navySoft};text-decoration:none;">vls-online.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

export function examResultAppBaseUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function buildExamResultLinks(token: string): {
  passedUrl: string;
  awaitingUrl: string;
} {
  const base = `${examResultAppBaseUrl()}/exam-result`;
  return {
    passedUrl: `${base}?token=${encodeURIComponent(token)}&status=passed`,
    awaitingUrl: `${base}?token=${encodeURIComponent(token)}&status=awaiting_result`,
  };
}

export async function sendExamResultRequestEmail(input: {
  to: string;
  studentName: string;
  courseName: string;
  token: string;
}): Promise<void> {
  const firstName = input.studentName.trim().split(/\s+/)[0] || 'there';
  const { passedUrl, awaitingUrl } = buildExamResultLinks(input.token);
  const subject = `Update your exam result — ${input.courseName}`;

  const text = `Hi ${firstName},

Please let us know how your ${input.courseName} exam went by choosing one option:

I have passed:
${passedUrl}

I am awaiting my result:
${awaitingUrl}

These links expire in 30 days. If you did not expect this email, you can ignore it.

VLS Online
${VLS_SITE_URL}`;

  const html = renderBrandedEmail({
    title: 'Update your exam result',
    preheader: `Tell us whether you passed ${input.courseName} or are awaiting your result.`,
    bodyHtml: [
      p(`Hi ${esc(firstName)},`),
      p(`Please update us on your <strong>${esc(input.courseName)}</strong> exam by clicking one of the buttons below.`),
      `<div>${ctaButton(passedUrl, 'I have passed', '#15803d')}${ctaButton(awaitingUrl, 'Awaiting my result', BRAND.logoBlue)}</div>`,
      p(`These links expire in 30 days. If the buttons do not work, copy and paste one of these links into your browser:<br><br>
        Passed: <a href="${esc(passedUrl)}" style="color:${BRAND.navySoft};word-break:break-all;">${esc(passedUrl)}</a><br><br>
        Awaiting result: <a href="${esc(awaitingUrl)}" style="color:${BRAND.navySoft};word-break:break-all;">${esc(awaitingUrl)}</a>`),
    ].join(''),
  });

  await sendEmail({ to: input.to, subject, text, html });
}
