import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  enableTotp,
  findUserByEmail,
  findUserById,
  findUserByLogin,
  findUserByResetToken,
  saveResetToken,
  saveTotpSecret,
  toPublicUser,
  updatePasswordHash,
} from '../models/user';
import { sendPasswordResetEmail } from './email';
import { loginIdentityRateLimit, loginIpRateLimit, totpIpRateLimit } from '../middleware/rateLimit';
import { verifyTurnstileToken } from '../utils/turnstile';
import { authGuard } from '../middleware/authGuard';
import {
  generateTotpSecret,
  openTotpSecret,
  otpauthUrl,
  roleRequiresTotp,
  sealTotpSecret,
  verifyTotp,
} from '../services/totp';
import { clearSessionCookie, setSessionCookie } from '../services/vaultSession';
import type { JwtPayload, LoginRequest, PasswordResetConfirm, PasswordResetRequest, User } from '../../shared/types';

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

function currentDeployId(): string {
  return process.env.VERCEL_DEPLOYMENT_ID ?? process.env.DEPLOY_ID ?? 'local';
}

function signSession(user: User): string {
  return jwt.sign(sessionClaims(user), getJwtSecret(), { expiresIn: '24h' });
}

function signTotpTicket(user: User): string {
  return jwt.sign(
    { ...sessionClaims(user), purpose: 'vault-totp' },
    getJwtSecret(),
    { expiresIn: '5m' },
  );
}

function sessionClaims(user: User): JwtPayload {
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    deployId: currentDeployId(),
  };
}

function issueSession(req: Request, res: Response, user: User): void {
  setSessionCookie(res, req, signSession(user));
  res.json({ ok: true, data: { user: toPublicUser(user) } });
}

function isMissingTotpColumn(err: unknown): boolean {
  return typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code?: string }).code === '42703';
}

async function authenticatorChallenge(user: User): Promise<{ secret: string; setup: boolean }> {
  const existing = user.totpSecret ? openTotpSecret(user.totpSecret) : null;
  if (existing && user.totpEnabled) return { secret: existing, setup: false };
  if (existing) return { secret: existing, setup: true };
  const secret = generateTotpSecret();
  await saveTotpSecret(user.id, sealTotpSecret(secret));
  return { secret, setup: true };
}

// POST /auth/login
router.post('/login', loginIpRateLimit, loginIdentityRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, username, password, turnstileToken } = req.body as LoginRequest;
    const login = (username ?? email ?? '').trim();

    if (!login || !password) {
      return res.status(400).json({ ok: false, error: 'username and password are required' });
    }

    const captcha = await verifyTurnstileToken(turnstileToken, req);
    if (!captcha.ok) {
      return res.status(400).json({ ok: false, error: captcha.error });
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

    if (!roleRequiresTotp(user.role)) {
      issueSession(req, res, user);
      return;
    }

    try {
      const challenge = await authenticatorChallenge(user);
      const loginTicket = signTotpTicket(user);
      if (challenge.setup) {
        return res.json({
          ok: true,
          data: {
            totpSetupRequired: true,
            loginTicket,
            totpSecret: challenge.secret,
            otpauthUrl: otpauthUrl(user.email, challenge.secret),
          },
        });
      }
      return res.json({
        ok: true,
        data: { totpRequired: true, loginTicket },
      });
    } catch (err) {
      if (!isMissingTotpColumn(err)) throw err;
      return res.status(503).json({
        ok: false,
        error: 'Two-factor sign-in is not available until the latest database migration has been applied.',
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /auth/totp
router.post('/totp', totpIpRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { loginTicket, totpCode } = req.body as LoginRequest;
    if (!loginTicket || !totpCode) {
      return res.status(400).json({ ok: false, error: 'Enter the 6-digit code from your authenticator app' });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(loginTicket, getJwtSecret()) as JwtPayload;
    } catch {
      return res.status(401).json({ ok: false, error: 'That sign-in step expired. Enter your password again.' });
    }

    if (payload.purpose !== 'vault-totp') {
      return res.status(401).json({ ok: false, error: 'That sign-in step expired. Enter your password again.' });
    }

    const deployId = currentDeployId();
    if (deployId !== 'local' && payload.deployId !== deployId) {
      return res.status(401).json({ ok: false, error: 'Session invalidated by new deployment — please log in again' });
    }

    const user = await findUserById(payload.userId);
    if (!user || user.isBlocked || !roleRequiresTotp(user.role)) {
      return res.status(401).json({ ok: false, error: 'That sign-in step expired. Enter your password again.' });
    }

    const secret = user.totpSecret ? openTotpSecret(user.totpSecret) : null;
    if (!secret || !verifyTotp(secret, totpCode)) {
      return res.status(401).json({ ok: false, error: 'That authenticator code is not valid' });
    }

    if (!user.totpEnabled) await enableTotp(user.id);
    issueSession(req, res, user);
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await findUserById(req.user!.userId);
    if (!user || user.isBlocked) {
      clearSessionCookie(res, req);
      return res.status(401).json({ ok: false, error: 'Sign in to continue' });
    }
    return res.json({ ok: true, data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', (req: Request, res: Response) => {
  clearSessionCookie(res, req);
  return res.json({ ok: true, data: { message: 'Signed out' } });
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
