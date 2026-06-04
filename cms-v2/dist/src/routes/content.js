"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authGuard_1 = require("../middleware/authGuard");
const content_1 = require("../models/content");
const activityLog_1 = require("../models/activityLog");
const contentDiff_1 = require("../utils/contentDiff");
const router = (0, express_1.Router)();
router.use(authGuard_1.authGuard);
// GET /content — list all known content keys
router.get('/', async (_req, res) => {
    const keys = await (0, content_1.listContentKeys)();
    return res.json({ ok: true, data: keys });
});
// GET /content/:key — fetch a single content blob
router.get('/:key', async (req, res) => {
    const row = await (0, content_1.getContent)(req.params.key);
    if (!row)
        return res.status(404).json({ ok: false, error: 'Content not found' });
    return res.json({ ok: true, data: row });
});
// PUT /content/:key — upsert content (editor or admin)
router.put('/:key', (0, authGuard_1.requireRole)('admin', 'editor'), async (req, res) => {
    if (req.body == null || typeof req.body !== 'object') {
        return res.status(400).json({ ok: false, error: 'JSON body required' });
    }
    const before = await (0, content_1.getContent)(req.params.key);
    const row = await (0, content_1.upsertContent)(req.params.key, req.body, req.user.userId);
    const diff = (0, contentDiff_1.diffContent)(before?.data ?? null, req.body);
    await (0, activityLog_1.createActivityLog)({
        userId: req.user.userId,
        userEmail: req.user.email,
        username: req.user.username,
        userRole: req.user.role,
        action: 'save',
        componentKey: req.params.key,
        componentName: diff.componentName,
        summary: diff.summary,
        changedPaths: diff.changedPaths,
        beforeJson: before?.data ?? null,
        afterJson: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
    });
    return res.json({ ok: true, data: row });
});
exports.default = router;
//# sourceMappingURL=content.js.map