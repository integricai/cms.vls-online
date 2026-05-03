"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authGuard_1 = require("../middleware/authGuard");
const content_1 = require("../models/content");
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
    const row = await (0, content_1.upsertContent)(req.params.key, req.body, req.user.userId);
    return res.json({ ok: true, data: row });
});
exports.default = router;
//# sourceMappingURL=content.js.map