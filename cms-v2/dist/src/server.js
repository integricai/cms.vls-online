"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const blog_1 = __importDefault(require("./routes/blog"));
const courses_1 = __importDefault(require("./routes/courses"));
const books_1 = __importDefault(require("./routes/books"));
const adminPayments_1 = __importDefault(require("./routes/adminPayments"));
const paymentOptions_1 = __importDefault(require("./routes/paymentOptions"));
const payments_1 = __importStar(require("./routes/payments"));
const activity_1 = __importDefault(require("./routes/activity"));
const trustpilot_1 = __importDefault(require("./routes/trustpilot"));
const errorAlert_1 = require("./utils/errorAlert");
const content_2 = require("./models/content");
const blog_2 = require("./models/blog");
const blogAsset_1 = require("./models/blogAsset");
const blogRender_1 = require("./services/blogRender");
const coursePrice_1 = require("./models/coursePrice");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT ?? 3001);
// ── Middleware ────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
}));
app.post('/api/payments/webhook', express_1.default.raw({ type: 'application/json' }), payments_1.stripeWebhookHandler);
app.use(express_1.default.json({ limit: '10mb' }));
// ── Routes ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'ok', ts: new Date().toISOString() } });
});
// Public — no auth, must allow any origin (fetched from Zenler/external pages)
app.options('/api/publish-banner', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
});
app.get('/api/publish-banner', async (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
        const row = await (0, content_2.getContent)('vls-banners');
        const data = row?.data && typeof row.data === 'object' ? row.data : {};
        return res.json({ banners: Array.isArray(data.banners) ? data.banners : [] });
    }
    catch (err) {
        next(err);
    }
});
app.options('/api/publish-course-prices', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
});
app.get('/api/publish-course-prices', async (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
        return res.json({ prices: await (0, coursePrice_1.listCoursePrices)() });
    }
    catch (err) {
        next(err);
    }
});
app.options('/api/publish-testimonials-components', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
});
app.get('/api/publish-testimonials-components', async (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
        const row = await (0, content_2.getContent)('vls-testimonials-components');
        const data = row?.data && typeof row.data === 'object' ? row.data : {};
        return res.json({ components: Array.isArray(data.components) ? data.components : [] });
    }
    catch (err) {
        next(err);
    }
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
app.use('/api/blog', blog_1.default);
app.use('/api/courses', courses_1.default);
app.use('/api/books', books_1.default);
app.use('/api/admin', adminPayments_1.default);
app.use('/api/payment-options', paymentOptions_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/activity', activity_1.default);
app.use('/api/trustpilot', trustpilot_1.default);
app.use('/api/public', public_1.default);
app.get('/blog', async (_req, res, next) => {
    try {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send((0, blogRender_1.renderBlogLanding)(await (0, blog_2.listBlogPosts)()));
    }
    catch (err) {
        next(err);
    }
});
app.get('/blog/:topic/:slug', async (req, res, next) => {
    try {
        const posts = await (0, blog_2.listBlogPosts)();
        const post = posts.find(item => item.status === 'published'
            && item.slug === req.params.slug
            && (0, blogRender_1.blogTopicSlug)(item.topic) === req.params.topic);
        if (!post)
            return res.status(404).send('Blog post not found');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send((0, blogRender_1.renderBlogArticle)(post));
    }
    catch (err) {
        next(err);
    }
});
app.get('/blog-assets/:id/:filename', async (req, res, next) => {
    try {
        const asset = await (0, blogAsset_1.getBlogAsset)(req.params.id);
        if (!asset)
            return res.status(404).send('Image not found');
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', String(asset.data.length));
        return res.send(asset.data);
    }
    catch (err) {
        next(err);
    }
});
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