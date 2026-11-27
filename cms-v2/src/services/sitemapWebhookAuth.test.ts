import assert from 'assert';
import { createHmac } from 'crypto';
import {
  isSitemapWebhookAuthorized,
  storyblokWebhookSignature,
} from './sitemapWebhookAuth';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

const secret = 'sitemap-webhook-secret';
const body = JSON.stringify({
  action: 'published',
  story_id: 17,
  full_slug: 'blog/acca-south-africa',
});

function sign(payload: string, key = secret): string {
  return createHmac('sha1', key).update(payload).digest('hex');
}

console.log('sitemapWebhookAuth tests');

run('accepts a Bearer token', () => {
  assert.equal(isSitemapWebhookAuthorized({
    authorization: `Bearer ${secret}`,
    secret,
  }), true);
});

run('accepts x-sitemap-secret', () => {
  assert.equal(isSitemapWebhookAuthorized({
    sitemapSecret: secret,
    secret,
  }), true);
});

run('accepts Storyblok webhook-signature over the raw body', () => {
  assert.equal(storyblokWebhookSignature(body, secret), sign(body));
  assert.equal(isSitemapWebhookAuthorized({
    webhookSignature: sign(body).toUpperCase(),
    rawBody: Buffer.from(body),
    secret,
  }), true);
});

run('rejects a signature for a different body', () => {
  assert.equal(isSitemapWebhookAuthorized({
    webhookSignature: sign('{"action":"published"}'),
    rawBody: body,
    secret,
  }), false);
});

run('rejects a signature made with another secret', () => {
  assert.equal(isSitemapWebhookAuthorized({
    webhookSignature: sign(body, 'other-secret'),
    rawBody: body,
    secret,
  }), false);
});

run('rejects a signature when the raw body was not kept', () => {
  assert.equal(isSitemapWebhookAuthorized({
    webhookSignature: sign(body),
    secret,
  }), false);
});

run('rejects a request when the CMS secret is unset', () => {
  assert.equal(isSitemapWebhookAuthorized({
    authorization: `Bearer ${secret}`,
    webhookSignature: sign(body),
    rawBody: body,
  }), false);
});

console.log('sitemapWebhookAuth tests passed');
