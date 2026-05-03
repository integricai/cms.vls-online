import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authGuard, requireRole } from '../middleware/authGuard';
import { createUser, deleteUser, findUserByUsername, listUsers, updateUser } from '../models/user';
import type { AccessLevel } from '../../shared/types';

const router = Router();
const ACCESS_LEVELS: AccessLevel[] = ['admin', 'editor', 'viewer'];

router.use(authGuard);
router.use(requireRole('admin'));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listUsers();
    return res.json({ ok: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      username,
      first_name,
      last_name,
      password_,
      access_level,
    } = req.body as Record<string, string>;

    const cleanUsername = username?.trim();
    const accessLevel = access_level as AccessLevel;

    if (!cleanUsername || !password_ || !accessLevel) {
      return res.status(400).json({ ok: false, error: 'username, password_ and access_level are required' });
    }

    if (!ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ ok: false, error: 'Invalid access_level' });
    }

    const existing = await findUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password_, 12);
    const user = await createUser({
      username: cleanUsername,
      firstName: first_name?.trim() ?? '',
      lastName: last_name?.trim() ?? '',
      passwordHash,
      accessLevel,
    });

    return res.status(201).json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const {
      first_name,
      last_name,
      access_level,
      is_blocked,
    } = req.body as {
      first_name?: string;
      last_name?: string;
      access_level?: AccessLevel;
      is_blocked?: boolean;
    };

    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    if (access_level && !ACCESS_LEVELS.includes(access_level)) {
      return res.status(400).json({ ok: false, error: 'Invalid access_level' });
    }

    if (req.user!.userId === userId && (is_blocked === true || access_level === 'editor' || access_level === 'viewer')) {
      return res.status(400).json({ ok: false, error: 'You cannot block or demote your own user' });
    }

    const user = await updateUser(userId, {
      firstName: first_name,
      lastName: last_name,
      accessLevel: access_level,
      isBlocked: is_blocked,
    });

    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    return res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    if (req.user!.userId === userId) {
      return res.status(400).json({ ok: false, error: 'You cannot remove your own user' });
    }

    const deleted = await deleteUser(userId);
    if (!deleted) return res.status(404).json({ ok: false, error: 'User not found' });
    return res.json({ ok: true, data: { id: userId } });
  } catch (err) {
    next(err);
  }
});

export default router;
