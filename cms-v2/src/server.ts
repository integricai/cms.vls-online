import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import snippetsRouter from './routes/snippets';
import contentRouter from './routes/content';
import usersRouter from './routes/users';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── Middleware ────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  credentials: true,
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'ok', ts: new Date().toISOString() } });
});

app.use('/auth', authRouter);
app.use('/snippets', snippetsRouter);
app.use('/content', contentRouter);
app.use('/users', usersRouter);

// ── 404 catch-all ─────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`cms-v2 running on http://localhost:${PORT}`);
});

export default app;
