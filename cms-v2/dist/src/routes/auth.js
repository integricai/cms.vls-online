"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const user_1 = require("../models/user");
const email_1 = require("./email");
const router = (0, express_1.Router)();
const CAPTCHA_TTL_MS = 10 * 60 * 1000;
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required');
    }
    return secret;
}
function signCaptchaPayload(payload) {
    return crypto_1.default
        .createHmac('sha256', getJwtSecret())
        .update(payload)
        .digest('base64url');
}
function createCaptchaToken(answer) {
    const payload = JSON.stringify({ answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });
    const encodedPayload = Buffer.from(payload).toString('base64url');
    return `${encodedPayload}.${signCaptchaPayload(encodedPayload)}`;
}
function verifyCaptcha(token, answer) {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature)
        return false;
    const expectedSignature = signCaptchaPayload(encodedPayload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !crypto_1.default.timingSafeEqual(actual, expected))
        return false;
    let payload;
    try {
        payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    }
    catch {
        return false;
    }
    return typeof payload.expiresAt === 'number'
        && payload.expiresAt > Date.now()
        && String(payload.answer) === answer.trim();
}
// GET /auth/captcha
router.get('/captcha', (_req, res) => {
    const left = crypto_1.default.randomInt(2, 10);
    const right = crypto_1.default.randomInt(2, 10);
    const answer = left + right;
    return res.json({
        ok: true,
        data: {
            question: `${left} + ${right}`,
            token: createCaptchaToken(answer),
        },
    });
});
// POST /auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const login = (username ?? email ?? '').trim();
        if (!login || !password) {
            return res.status(400).json({ ok: false, error: 'username and password are required' });
        }
        const user = await (0, user_1.findUserByLogin)(login);
        if (!user) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }
        if (user.isBlocked) {
            return res.status(403).json({ ok: false, error: 'This user has been blocked' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }
        const secret = getJwtSecret();
        const deployId = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.DEPLOY_ID ?? 'local';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, username: user.username, role: user.role, deployId }, secret, { expiresIn: '8h' });
        return res.json({ ok: true, data: { token, user: (0, user_1.toPublicUser)(user) } });
    }
    catch (err) {
        next(err);
    }
});
// POST /auth/request-password-reset
router.post('/request-password-reset', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ ok: false, error: 'email is required' });
        }
        const user = await (0, user_1.findUserByEmail)(email);
        if (!user) {
            return res.json({ ok: true, data: { message: 'If that email exists, a reset link has been sent.' } });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await (0, user_1.saveResetToken)(user.id, resetToken, expiresAt);
        await (0, email_1.sendPasswordResetEmail)(user.email, resetToken);
        return res.json({ ok: true, data: { message: 'If that email exists, a reset link has been sent.' } });
    }
    catch (err) {
        next(err);
    }
});
// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, username, newPassword, captchaToken, captchaAnswer } = req.body;
        if (!token || !username || !newPassword || !captchaToken || !captchaAnswer) {
            return res.status(400).json({
                ok: false,
                error: 'token, username, newPassword and captcha are required',
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
        }
        if (!verifyCaptcha(captchaToken, captchaAnswer)) {
            return res.status(400).json({ ok: false, error: 'Captcha answer is incorrect or expired' });
        }
        const user = await (0, user_1.findUserByResetToken)(token);
        if (!user) {
            return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
        }
        if (user.username.toLowerCase() !== username.trim().toLowerCase()) {
            return res.status(400).json({ ok: false, error: 'Username does not match this reset link' });
        }
        const hash = await bcryptjs_1.default.hash(newPassword, 12);
        await (0, user_1.updatePasswordHash)(user.id, hash);
        return res.json({ ok: true, data: { message: 'Password updated successfully.' } });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map