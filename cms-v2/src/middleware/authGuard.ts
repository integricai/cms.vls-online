import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../../shared/types';
import { readCookie, VAULT_SESSION_COOKIE } from '../services/vaultSession';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const cookie = readCookie(req, VAULT_SESSION_COOKIE);
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = cookie || bearer;

  if (!token) {
    res.status(401).json({ ok: false, error: 'Sign in to continue' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ ok: false, error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    if (payload.purpose) {
      res.status(401).json({ ok: false, error: 'Sign in to continue' });
      return;
    }
    const currentDeployId = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.DEPLOY_ID ?? 'local';
    if (currentDeployId !== 'local' && payload.deployId !== currentDeployId) {
      res.status(401).json({ ok: false, error: 'Session invalidated by new deployment — please log in again' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(
  ...roles: JwtPayload['role'][]
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    const allowed = roles.includes(role as JwtPayload['role'])
      || (role === 'editor' && roles.includes('assistant'));
    if (!req.user || !allowed) {
      res.status(403).json({ ok: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
