import type { Request, Response } from 'express';
import {
  AutoseoImportError,
  importAutoseoArticle,
  parseAutoseoWebhook,
  verifyAutoseoBearer,
  verifyAutoseoSignature,
  vlsBlogUrl,
} from '../services/autoseoWebhook';
import { sendErrorAlert } from '../utils/errorAlert';

function rawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  return Buffer.from('');
}

/** Public AutoSEO delivery. Signature and bearer token are checked before a draft is saved. */
export async function autoseoWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.AUTOSEO_WEBHOOK_SECRET?.trim() || '';
  if (!secret) {
    console.error('[autoseo-webhook] AUTOSEO_WEBHOOK_SECRET is not set');
    res.status(500).json({ ok: false, error: 'Webhook is not configured' });
    return;
  }

  const body = rawBody(req);
  const authorized = verifyAutoseoBearer(req.get('authorization'), secret)
    && verifyAutoseoSignature(body, req.get('x-autoseo-signature'), secret);
  if (!authorized) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString('utf8')) as unknown;
  } catch {
    res.status(400).json({ ok: false, error: 'Webhook body must be JSON' });
    return;
  }

  const parsed = parseAutoseoWebhook(payload);
  if (!parsed.ok) {
    res.status(parsed.status).json({ ok: false, error: parsed.error });
    return;
  }

  if (parsed.kind === 'test' || parsed.kind === 'skip') {
    res.status(200).json({ url: vlsBlogUrl() });
    return;
  }

  try {
    const result = await importAutoseoArticle(parsed.article);
    if (result.warnings.length) {
      console.warn(`[autoseo-webhook] ${parsed.article.id}`, result.warnings.join(' | '));
    }
    console.log(`[autoseo-webhook] ${result.created ? 'created' : 'updated'} draft ${result.slug}`);
    res.status(200).json({ url: result.url });
  } catch (err) {
    if (err instanceof AutoseoImportError && err.status < 500) {
      res.status(err.status).json({ ok: false, error: err.message });
      return;
    }
    console.error('[autoseo-webhook]', parsed.article.id, err);
    sendErrorAlert({
      area: 'AutoSEO webhook',
      explanation: `AutoSEO article ${parsed.article.id} could not be saved as a VLS blog draft. AutoSEO will retry.`,
      error: err,
      req,
      extra: { autoseoId: parsed.article.id },
    }).catch(alertErr => console.error('[alert] failed to send autoseo webhook alert', alertErr));
    res.status(500).json({ ok: false, error: 'Webhook processing failed' });
  }
}
