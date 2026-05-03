"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
function createTransport() {
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
    const transport = createTransport();
    await transport.sendMail({
        from: process.env.EMAIL_FROM ?? '"CMS" <noreply@vls-online.com>',
        to,
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
    });
}
//# sourceMappingURL=email.js.map