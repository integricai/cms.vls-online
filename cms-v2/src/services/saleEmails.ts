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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export async function sendTutorSaleClaimInvite(input: {
  to: string;
  tutorName: string;
  courseName: string;
  studentFirstName: string | null;
  amount: number;
  currency: string;
  soldAt: Date;
  acceptUrl: string;
}): Promise<boolean> {
  if (!input.to) return false;

  const studentLabel = input.studentFirstName?.trim() || 'A student';
  const amount = formatMoney(input.amount, input.currency);
  const soldAt = input.soldAt.toISOString().slice(0, 10);

  const text = `Hi ${input.tutorName},

A new course sale is available for you to accept.

Course: ${input.courseName}
Student: ${studentLabel}
Amount: ${amount}
Sold on: ${soldAt}

If you can take this student, accept here:
${input.acceptUrl}

This link expires in 7 days. The first tutor to accept will be assigned.

Kind regards,
VLS Online`;

  await sendEmail({
    to: input.to,
    subject: `New course sale to accept — ${input.courseName}`,
    text,
    html: `<p>Hi ${esc(input.tutorName)},</p>
<p>A new course sale is available for you to accept.</p>
<p><strong>Course:</strong> ${esc(input.courseName)}<br>
<strong>Student:</strong> ${esc(studentLabel)}<br>
<strong>Amount:</strong> ${esc(amount)}<br>
<strong>Sold on:</strong> ${esc(soldAt)}</p>
<p><a href="${esc(input.acceptUrl)}">Accept this sale</a></p>
<p>This link expires in 7 days. The first tutor to accept will be assigned.</p>
<p>Kind regards,<br>VLS Online</p>`,
  });
  return true;
}
