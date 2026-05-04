import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  findUserByEmail,
  findUserByLogin,
  findUserByResetToken,
  saveResetToken,
  toPublicUser,
  updatePasswordHash,
} from '../models/user';
import { sendPasswordResetEmail } from './email';
import type { LoginRequest, PasswordResetConfirm, PasswordResetRequest } from '../../shared/types';

const router = Router();
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

function signCaptchaPayload(payload: string): string {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(payload)
    .digest('base64url');
}

function createCaptchaToken(answer: number): string {
  const payload = JSON.stringify({ answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  return `${encodedPayload}.${signCaptchaPayload(encodedPayload)}`;
}

function verifyCaptcha(token: string, answer: string): boolean {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signCaptchaPayload(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

  let payload: { answer?: number; expiresAt?: number };
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }

  return typeof payload.expiresAt === 'number'
    && payload.expiresAt > Date.now()
    && String(payload.answer) === answer.trim();
}

// GET /auth/captcha
router.get('/captcha', (_req: Request, res: Response) => {
  const left = crypto.randomInt(2, 10);
  const right = crypto.randomInt(2, 10);
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
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, username, password } = req.body as LoginRequest;
    const login = (username ?? email ?? '').trim();

    if (!login || !password) {
      return res.status(400).json({ ok: false, error: 'username and password are required' });
    }

    const user = await findUserByLogin(login);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ ok: false, error: 'This user has been blocked' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const secret = getJwtSecret();
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username, role: user.role },
      secret,
      { expiresIn: '8h' },
    );

    return res.json({ ok: true, data: { token, user: toPublicUser(user) } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/request-password-reset
router.post('/request-password-reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as PasswordResetRequest;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.json({ ok: true, data: { message: 'If that email exists, a reset link has been sent.' } });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await saveResetToken(user.id, resetToken, expiresAt);
    await sendPasswordResetEmail(user.email, resetToken);

    return res.json({ ok: true, data: { message: 'If that email exists, a reset link has been sent.' } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, username, newPassword, captchaToken, captchaAnswer } = req.body as PasswordResetConfirm;

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

    const user = await findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
    }

    if (user.username.toLowerCase() !== username.trim().toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'Username does not match this reset link' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await updatePasswordHash(user.id, hash);

    return res.json({ ok: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    next(err);
  }
});

export default router;
