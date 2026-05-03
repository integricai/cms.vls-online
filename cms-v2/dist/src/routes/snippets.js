"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authGuard_1 = require("../middleware/authGuard");
const snippet_1 = require("../models/snippet");
const router = (0, express_1.Router)();
// All snippet routes require authentication
router.use(authGuard_1.authGuard);
// GET /snippets
router.get('/', async (_req, res) => {
    const snippets = await (0, snippet_1.getAllSnippets)();
    return res.json({ ok: true, data: snippets });
});
// GET /snippets/:id
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
        return res.status(400).json({ ok: false, error: 'Invalid id' });
    const snippet = await (0, snippet_1.getSnippetById)(id);
    if (!snippet)
        return res.status(404).json({ ok: false, error: 'Snippet not found' });
    return res.json({ ok: true, data: snippet });
});
// POST /snippets — editor or admin only
router.post('/', (0, authGuard_1.requireRole)('admin', 'editor'), async (req, res) => {
    const { key, title, html, meta } = req.body;
    if (!key || !title || html === undefined) {
        return res.status(400).json({ ok: false, error: 'key, title, and html are required' });
    }
    const snippet = await (0, snippet_1.createSnippet)({ key, title, html, meta: meta ?? {} }, req.user.userId);
    return res.status(201).json({ ok: true, data: snippet });
});
// PATCH /snippets/:id — editor or admin only
router.patch('/:id', (0, authGuard_1.requireRole)('admin', 'editor'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
        return res.status(400).json({ ok: false, error: 'Invalid id' });
    const updated = await (0, snippet_1.updateSnippet)(id, req.body);
    if (!updated)
        return res.status(404).json({ ok: false, error: 'Snippet not found' });
    return res.json({ ok: true, data: updated });
});
// DELETE /snippets/:id — admin only
router.delete('/:id', (0, authGuard_1.requireRole)('admin'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
        return res.status(400).json({ ok: false, error: 'Invalid id' });
    const deleted = await (0, snippet_1.deleteSnippet)(id);
    if (!deleted)
        return res.status(404).json({ ok: false, error: 'Snippet not found' });
    return res.json({ ok: true, data: { message: 'Deleted' } });
});
exports.default = router;
//# sourceMappingURL=snippets.js.map