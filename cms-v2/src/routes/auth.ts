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

    const secret = process.env.JWT_SECRET!;
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
    const { token, newPassword } = req.body as PasswordResetConfirm;

    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: 'token and newPassword are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
    }

    const user = await findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await updatePasswordHash(user.id, hash);

    return res.json({ ok: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    next(err);
  }
});

export default router;
