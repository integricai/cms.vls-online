"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const authGuard_1 = require("../middleware/authGuard");
const user_1 = require("../models/user");
const router = (0, express_1.Router)();
const ACCESS_LEVELS = ['admin', 'editor', 'viewer'];
router.use(authGuard_1.authGuard);
router.use((0, authGuard_1.requireRole)('admin'));
router.get('/', async (_req, res, next) => {
    try {
        const users = await (0, user_1.listUsers)();
        return res.json({ ok: true, data: users });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { username, first_name, last_name, password_, access_level, } = req.body;
        const cleanUsername = username?.trim();
        const accessLevel = access_level;
        if (!cleanUsername || !password_ || !accessLevel) {
            return res.status(400).json({ ok: false, error: 'username, password_ and access_level are required' });
        }
        if (!ACCESS_LEVELS.includes(accessLevel)) {
            return res.status(400).json({ ok: false, error: 'Invalid access_level' });
        }
        const existing = await (0, user_1.findUserByUsername)(cleanUsername);
        if (existing) {
            return res.status(409).json({ ok: false, error: 'Username already exists' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password_, 12);
        const user = await (0, user_1.createUser)({
            username: cleanUsername,
            firstName: first_name?.trim() ?? '',
            lastName: last_name?.trim() ?? '',
            passwordHash,
            accessLevel,
        });
        return res.status(201).json({ ok: true, data: user });
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const { first_name, last_name, access_level, is_blocked, } = req.body;
        if (!Number.isInteger(userId)) {
            return res.status(400).json({ ok: false, error: 'Invalid user id' });
        }
        if (access_level && !ACCESS_LEVELS.includes(access_level)) {
            return res.status(400).json({ ok: false, error: 'Invalid access_level' });
        }
        if (req.user.userId === userId && (is_blocked === true || access_level === 'editor' || access_level === 'viewer')) {
            return res.status(400).json({ ok: false, error: 'You cannot block or demote your own user' });
        }
        const user = await (0, user_1.updateUser)(userId, {
            firstName: first_name,
            lastName: last_name,
            accessLevel: access_level,
            isBlocked: is_blocked,
        });
        if (!user)
            return res.status(404).json({ ok: false, error: 'User not found' });
        return res.json({ ok: true, data: user });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId)) {
            return res.status(400).json({ ok: false, error: 'Invalid user id' });
        }
        if (req.user.userId === userId) {
            return res.status(400).json({ ok: false, error: 'You cannot remove your own user' });
        }
        const deleted = await (0, user_1.deleteUser)(userId);
        if (!deleted)
            return res.status(404).json({ ok: false, error: 'User not found' });
        return res.json({ ok: true, data: { id: userId } });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map