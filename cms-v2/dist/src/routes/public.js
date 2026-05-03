"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_1 = require("../models/content");
const router = (0, express_1.Router)();
router.get('/events', async (_req, res, next) => {
    try {
        const row = await (0, content_1.getContent)('vls-events');
        const data = row?.data && typeof row.data === 'object' ? row.data : {};
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ events: Array.isArray(data.events) ? data.events : [] });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=public.js.map