// Report-an-Issue form submission — sends admin notification + user confirmation via MailerSend

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function row(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;width:160px;font-weight:600;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${value || '&mdash;'}</td>
  </tr>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (_) { return res.status(400).json({ error: 'Invalid request body' }); }

  const {
    firstName = '', lastName = '', email = '', phone = '',
    qualification = '', courseName = '', issueType = '', message = '',
    screenshotName = '', screenshotData = '', screenshotType = '',
    refNumber = ''
  } = body || {};

  if (!firstName.trim() || !email.trim()) {
    return res.status(400).json({ error: 'First name and email are required' });
  }
  if (!message.trim()) {
    return res.status(400).json({ error: 'Please describe the issue' });
  }

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

  const recipients = Array.isArray(body.recipients)
    ? body.recipients.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim())).map(e => String(e).trim())
    : ['office@vls-online.com'];
  const adminTo = recipients.length ? recipients : ['office@vls-online.com'];

  const adminHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
  <div style="background:#fff;border-radius:10px;padding:28px 32px;border:1px solid #e5e7eb;">
    <div style="background:#0d1f3c;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <h2 style="color:#ffffff;margin:0;font-size:18px;">🚨 New Issue Report</h2>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Submitted via VLS Online — Student Support</p>
      ${refNumber ? `<p style="color:#fbbf24;margin:8px 0 0;font-size:14px;font-weight:700;">Reference: ${esc(refNumber)}</p>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row('First Name', esc(firstName))}
      ${row('Last Name', esc(lastName))}
      ${row('Email', `<a href="mailto:${esc(email)}" style="color:#204280;text-decoration:none;">${esc(email)}</a>`)}
      ${row('Phone', esc(phone))}
      ${refNumber ? row('Reference No.', `<strong>${esc(refNumber)}</strong>`) : ''}
      ${row('Qualification', esc(qualification))}
      ${row('Course Name', esc(courseName))}
      ${row('Issue Type', esc(issueType))}
    </table>
    <div style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-radius:8px;border-left:4px solid #1a56a3;">
      <p style="font-size:12px;font-weight:600;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">Issue Description</p>
      <p style="font-size:14px;color:#262a32;margin:0;line-height:1.6;white-space:pre-wrap;">${esc(message)}</p>
    </div>
    ${screenshotData ? `<p style="font-size:13px;color:#6b7280;margin:12px 0 0;">📎 Screenshot attached: <strong>${esc(screenshotName)}</strong></p>` : ''}
  </div>
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px;">VLS Online — Student Support System</p>
</div>
</body></html>`;

  const confirmHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
  <div style="background:#fff;border-radius:10px;padding:36px 32px;border:1px solid #e5e7eb;">
    <h2 style="color:#204280;margin:0 0 8px;font-size:22px;font-weight:700;">Report received, ${esc(firstName)}!</h2>
    <p style="color:#4b5563;line-height:1.7;margin:0 0 20px;font-size:15px;">
      Thank you for getting in touch. Our support team has received your report and aims to respond within <strong>1 working day</strong>.
    </p>
    <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="font-size:13px;font-weight:600;color:#204280;margin:0 0 6px;">What you reported</p>
      ${qualification ? `<p style="font-size:13px;color:#374151;margin:0 0 3px;">Qualification: <strong>${esc(qualification)}</strong></p>` : ''}
      ${courseName ? `<p style="font-size:13px;color:#374151;margin:0 0 3px;">Course: <strong>${esc(courseName)}</strong></p>` : ''}
      ${issueType ? `<p style="font-size:13px;color:#374151;margin:0;">Issue type: <strong>${esc(issueType)}</strong></p>` : ''}
    </div>
    ${refNumber ? `<div style="background:#f0f4ff;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <p style="font-size:12px;font-weight:600;color:#204280;margin:0 0 4px;">Your Reference Number</p>
      <p style="font-size:20px;font-weight:700;color:#0d1f3c;margin:0;letter-spacing:0.02em;">${esc(refNumber)}</p>
      <p style="font-size:12px;color:#6b7280;margin:6px 0 0;">Keep this for your records.</p>
    </div>` : ''}
    <p style="font-size:13px;color:#6b7280;margin:0;">If you need to follow up, please reply to this email or contact us directly.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">VLS Online &mdash; Student Support</p>
  </div>
</div>
</body></html>`;

  const MS_URL = 'https://api.mailersend.com/v1/email';
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // Build admin email (with optional screenshot attachment)
  const adminPayload = {
    from: { email: 'noreply@vls-online.com', name: 'VLS Online — Support' },
    to: adminTo.map(e => ({ email: e })),
    reply_to: { email: email.trim(), name: fullName },
    subject: `Issue Report: ${issueType || 'General'} — ${fullName}`,
    html: adminHtml
  };
  if (screenshotData && screenshotName) {
    adminPayload.attachments = [{
      content: screenshotData,
      filename: screenshotName,
      disposition: 'attachment'
    }];
  }

  try {
    const [adminRes] = await Promise.all([
      fetch(MS_URL, { method: 'POST', headers, body: JSON.stringify(adminPayload) }),
      fetch(MS_URL, {
        method: 'POST', headers,
        body: JSON.stringify({
          from: { email: 'noreply@vls-online.com', name: 'VLS Online' },
          to: [{ email: email.trim(), name: fullName }],
          subject: 'Your issue report has been received — VLS Online',
          html: confirmHtml
        })
      })
    ]);

    if (!adminRes.ok) {
      const errText = await adminRes.text().catch(() => '');
      console.error('[report] MailerSend error', adminRes.status, errText);
      return res.status(500).json({ error: 'Failed to send report. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[report] exception', e);
    return res.status(500).json({ error: 'Email service error. Please try again.' });
  }
}
