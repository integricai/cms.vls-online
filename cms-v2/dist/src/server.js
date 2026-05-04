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
const errorAlert_1 = require("./utils/errorAlert");
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
app.get('/api/turnstile-site-key', (_req, res) => {
    const siteKey = process.env.TURNSTILE_SITE_KEY;
    if (!siteKey) {
        return res.status(500).json({ ok: false, error: 'Turnstile is not configured' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, siteKey });
});
app.use('/api/auth', auth_1.default);
app.use('/api/snippets', snippets_1.default);
app.use('/api/content', content_1.default);
app.use('/api/users', users_1.default);
app.use('/api/public', public_1.default);
// ── 404 catch-all ─────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
});
// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('[error]', err);
    (0, errorAlert_1.sendErrorAlert)({
        area: 'CMS API request failure',
        explanation: `Request failed while handling ${req.method} ${req.originalUrl}. This may indicate a database, email, or route-level exception.`,
        error: err,
        req,
    }).catch(alertErr => {
        console.error('[alert] failed to send CMS API error alert', alertErr);
    });
    res.status(500).json({ ok: false, error: 'Internal server error' });
});
process.on('unhandledRejection', reason => {
    console.error('[unhandledRejection]', reason);
    (0, errorAlert_1.sendErrorAlert)({
        area: 'CMS API unhandled rejection',
        explanation: 'A promise rejected without being handled. The API process may be unstable.',
        error: reason,
    }).catch(alertErr => console.error('[alert] failed to send unhandled rejection alert', alertErr));
});
process.on('uncaughtException', err => {
    console.error('[uncaughtException]', err);
    (0, errorAlert_1.sendErrorAlert)({
        area: 'CMS API uncaught exception',
        explanation: 'An uncaught exception reached the process boundary. The API process may crash or restart.',
        error: err,
    }).catch(alertErr => console.error('[alert] failed to send uncaught exception alert', alertErr));
});
// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`cms-v2 running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map