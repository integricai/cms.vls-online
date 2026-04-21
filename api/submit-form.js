// Vercel serverless function — handles enquiry form submission
// Sends notification to admin emails + thank-you to submitter via MailerLite transactional API

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.Mailer_Lite_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const {
    firstName = '', lastName = '', email = '',
    phoneCode = '', phoneNumber = '', enquiry = '', comments = ''
  } = body;

  if (!firstName.trim() || !email.trim()) {
    return res.status(400).json({ error: 'First name and email are required' });
  }

  const fullName  = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const fullPhone = phoneCode
    ? `${phoneCode} ${phoneNumber}`.trim()
    : phoneNumber.trim();

  const adminHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
  <div style="background:#fff;border-radius:10px;padding:28px 32px;border:1px solid #e5e7eb;">
    <h2 style="color:#204280;margin:0 0 20px;font-size:20px;border-bottom:2px solid #e5e7eb;padding-bottom:14px;">
      New Enquiry Form Submission
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;width:140px;font-weight:600;vertical-align:top;">First Name</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(firstName)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Last Name</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(lastName) || '&mdash;'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;"><a href="mailto:${esc(email)}" style="color:#204280;text-decoration:none;">${esc(email)}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Phone</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(fullPhone) || '&mdash;'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Enquiry</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(enquiry) || '&mdash;'}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;font-weight:600;vertical-align:top;">Comments</td>
          <td style="padding:10px 0;color:#262a32;white-space:pre-wrap;">${esc(comments) || '&mdash;'}</td></tr>
    </table>
  </div>
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px;">VLS Online — Course Enquiry System</p>
</div>
</body></html>`;

  const tyHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
  <div style="background:#fff;border-radius:10px;padding:36px 32px;border:1px solid #e5e7eb;text-align:center;">
    <h2 style="color:#204280;margin:0 0 12px;font-size:22px;font-weight:700;">Thank you, ${esc(firstName)}!</h2>
    <p style="color:#4b5563;line-height:1.7;margin:0 0 20px;font-size:15px;">
      We have received your enquiry and will be in touch shortly.
    </p>
    ${enquiry ? `<p style="color:#6b7280;font-size:13px;margin:0 0 6px;">Your enquiry: <strong style="color:#262a32;">${esc(enquiry)}</strong></p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">VLS Online &mdash; International Professional Qualifications</p>
  </div>
</div>
</body></html>`;

  const ML_URL = 'https://connect.mailerlite.com/api/emails';
  const mlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const recipients = Array.isArray(body.recipients)
    ? body.recipients.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim())).map(e => ({ email: String(e).trim() }))
    : [];
  const adminTo = recipients.length
    ? recipients
    : [{ email: 'office@vls-online.com' }, { email: 'info@vls-online.com' }];

  try {
    const [adminRes] = await Promise.all([
      fetch(ML_URL, {
        method: 'POST',
        headers: mlHeaders,
        body: JSON.stringify({
          to: adminTo,
          from: { email: 'noreply@vls-online.com', name: 'VLS Online Website' },
          reply_to: { email: email.trim(), name: fullName },
          subject: 'Enquiry Form Submission',
          html: adminHtml
        })
      }),
      fetch(ML_URL, {
        method: 'POST',
        headers: mlHeaders,
        body: JSON.stringify({
          to: [{ email: email.trim(), name: fullName }],
          from: { email: 'noreply@vls-online.com', name: 'VLS Online' },
          subject: 'Thank you for your enquiry \u2014 VLS Online',
          html: tyHtml
        })
      })
    ]);

    if (!adminRes.ok) {
      const errText = await adminRes.text().catch(() => '');
      console.error('MailerLite error', adminRes.status, errText);
      let errData = {};
      try { errData = JSON.parse(errText); } catch(e) {}
      return res.status(500).json({ error: errData.message || 'Failed to send email', mlStatus: adminRes.status, mlBody: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Email service error. Please try again.' });
  }
}
