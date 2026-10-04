import { Router, Request, Response, NextFunction } from 'express';
import { contactEmailRateLimit, contactIpRateLimit } from '../middleware/rateLimit';
import { sendErrorAlert } from '../utils/errorAlert';
import { verifyTurnstileToken } from '../utils/turnstile';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MS_URL = 'https://api.mailersend.com/v1/email';

function allowContactCors(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  next();
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

router.options('/', allowContactCors, (_req, res) => {
  res.status(204).end();
});

router.post(
  '/',
  allowContactCors,
  contactIpRateLimit,
  contactEmailRateLimit,
  async (req: Request, res: Response) => {
    const apiKey = process.env.MAILERSEND_API_KEY;
    if (!apiKey) {
      await sendErrorAlert({
        area: 'Contact form email configuration',
        explanation: 'Contact form submission could not send because MAILERSEND_API_KEY is missing.',
        error: new Error('MAILERSEND_API_KEY is not configured'),
        req,
      }).catch(alertErr => console.error('[alert] contact form config alert failed', alertErr));
      res.status(500).json({ ok: false, error: 'Email service not configured' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const firstName = asText(body.firstName);
    const lastName = asText(body.lastName);
    const email = asText(body.email);
    const phone = asText(body.phone) || [asText(body.phoneCode), asText(body.phoneNumber)].filter(Boolean).join(' ');
    const enquiry = asText(body.enquiry);
    const comments = asText(body.comments) || asText(body.message);
    const qualification = asText(body.qualification);
    const howHeard = asText(body.howHeard);

    if (!firstName || !email) {
      res.status(400).json({ ok: false, error: 'First name and email are required' });
      return;
    }

    const captcha = await verifyTurnstileToken(body.turnstileToken, req);
    if (!captcha.ok) {
      await sendErrorAlert({
        area: 'Contact form captcha failed',
        explanation: 'Contact form submission was blocked because Turnstile verification failed.',
        error: new Error(captcha.error),
        req,
        extra: { submitter: email },
      }).catch(alertErr => console.error('[alert] contact form captcha alert failed', alertErr));
      res.status(400).json({ ok: false, error: captcha.error });
      return;
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const recipients = Array.isArray(body.recipients)
      ? body.recipients
        .filter((item): item is string => typeof item === 'string' && EMAIL_RE.test(item.trim()))
        .map(item => item.trim())
      : [];
    const adminTo = recipients.length ? recipients : ['office@vls-online.com', 'info@vls-online.com'];

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
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(phone) || '&mdash;'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Enquiry</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(enquiry) || '&mdash;'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Message</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;white-space:pre-wrap;">${esc(comments) || '&mdash;'}</td></tr>
      ${qualification ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">Qualification</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(qualification)}</td></tr>` : ''}
      ${howHeard ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:600;vertical-align:top;">How They Found Us</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#262a32;">${esc(howHeard)}</td></tr>` : ''}
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

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const [adminRes, thankYouRes] = await Promise.all([
        fetch(MS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: { email: 'noreply@vls-online.com', name: 'VLS Online Website' },
            to: adminTo.map(item => ({ email: item })),
            reply_to: { email, name: fullName },
            subject: 'Enquiry Form Submission',
            html: adminHtml,
          }),
        }),
        fetch(MS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: { email: 'noreply@vls-online.com', name: 'VLS Online' },
            to: [{ email, name: fullName }],
            subject: 'Thank you for your enquiry \u2014 VLS Online',
            html: tyHtml,
          }),
        }),
      ]);

      if (!adminRes.ok) {
        const errText = await adminRes.text().catch(() => '');
        console.error('MailerSend error', adminRes.status, errText);
        await sendErrorAlert({
          area: 'Contact form admin email failed',
          explanation: 'MailerSend rejected or failed the admin notification for a contact form submission.',
          error: new Error(`MailerSend ${adminRes.status}: ${errText}`),
          req,
          extra: { adminTo, submitter: email, enquiry },
        }).catch(alertErr => console.error('[alert] contact form admin alert failed', alertErr));
        res.status(500).json({ ok: false, error: `MailerSend ${adminRes.status}: ${errText}` });
        return;
      }

      if (!thankYouRes.ok) {
        const errText = await thankYouRes.text().catch(() => '');
        console.error('MailerSend thank-you error', thankYouRes.status, errText);
        await sendErrorAlert({
          area: 'Contact form user confirmation failed',
          explanation: 'The contact form admin notification was sent, but the submitter confirmation email failed.',
          error: new Error(`MailerSend ${thankYouRes.status}: ${errText}`),
          req,
          extra: { submitter: email, fullName },
        }).catch(alertErr => console.error('[alert] contact form thank-you alert failed', alertErr));
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[contact] exception', err);
      await sendErrorAlert({
        area: 'Contact form exception',
        explanation: 'An exception occurred while processing the contact form submission.',
        error: err,
        req,
        extra: { adminTo, submitter: email, enquiry },
      }).catch(alertErr => console.error('[alert] contact form exception alert failed', alertErr));
      res.status(500).json({ ok: false, error: 'Email service error. Please try again.' });
    }
  },
);

export default router;
