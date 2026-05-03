"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const snippets_1 = __importDefault(require("./routes/snippets"));
const content_1 = __importDefault(require("./routes/content"));
const users_1 = __importDefault(require("./routes/users"));
const public_1 = __importDefault(require("./routes/public"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT ?? 3001);
// ── Middleware ────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
}));
app.use(express_1.default.json());
// ── Routes ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'ok', ts: new Date().toISOString() } });
});
app.use('/auth', auth_1.default);
app.use('/snippets', snippets_1.default);
app.use('/content', content_1.default);
app.use('/users', users_1.default);
app.use('/public', public_1.default);
// ── 404 catch-all ─────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
});
// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});
// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`cms-v2 running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map