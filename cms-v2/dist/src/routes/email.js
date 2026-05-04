"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
function parseSender(value) {
    const fallback = { email: 'noreply@vls-online.com', name: 'VLS Online CMS' };
    if (!value)
        return fallback;
    const match = value.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
    if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
    }
    return { ...fallback, email: value.trim() };
}
function buildPasswordResetEmail(resetUrl) {
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
async function sendWithMailerSend(to, email) {
    const apiKey = process.env.MAILERSEND_API_KEY;
    if (!apiKey) {
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
            to: [{ email: to }],
            subject: email.subject,
            text: email.text,
            html: email.html,
        }),
    });
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`MailerSend ${response.status}: ${details}`);
    }
}
function createTransport() {
    if (!process.env.SMTP_HOST) {
        throw new Error('SMTP_HOST is not configured');
    }
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}
async function sendPasswordResetEmail(to, resetToken) {
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    const email = buildPasswordResetEmail(resetUrl);
    if (process.env.MAILERSEND_API_KEY) {
        await sendWithMailerSend(to, email);
        return;
    }
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
//# sourceMappingURL=email.js.map