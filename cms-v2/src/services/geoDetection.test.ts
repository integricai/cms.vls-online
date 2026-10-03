import assert from 'assert';
import type { Request } from 'express';
import { detectClientIpFromRequest, detectCountryFromRequest } from './geoDetection';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

function request(headers: Record<string, string>, remoteAddress?: string): Request {
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) lower[key.toLowerCase()] = value;
  return {
    get(name: string) {
      return lower[name.toLowerCase()];
    },
    socket: { remoteAddress },
  } as Request;
}

function withSecret(secret: string | undefined, fn: () => void): void {
  const previous = process.env.VLS_PROXY_SECRET;
  if (secret === undefined) delete process.env.VLS_PROXY_SECRET;
  else process.env.VLS_PROXY_SECRET = secret;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.VLS_PROXY_SECRET;
    else process.env.VLS_PROXY_SECRET = previous;
  }
}

console.log('geoDetection tests');

run('ignores a forwarded IP without the proxy secret', () => {
  withSecret('proxy-secret', () => {
    const ip = detectClientIpFromRequest(request({
      'x-vls-client-ip': '39.40.100.1',
      'cf-connecting-ip': '39.40.100.2',
      'x-forwarded-for': '39.40.100.3',
      'x-real-ip': '203.0.113.10',
      'x-vercel-forwarded-for': '203.0.113.11',
    }, '198.51.100.20'));
    assert.strictEqual(ip, '198.51.100.20');
  });
});

run('ignores a forwarded IP when the secret does not match', () => {
  withSecret('proxy-secret', () => {
    const ip = detectClientIpFromRequest(request({
      'x-vls-client-ip': '39.40.100.1',
      'x-vls-proxy-secret': 'other-secret',
      'x-real-ip': '203.0.113.10',
      'x-vercel-forwarded-for': '203.0.113.11',
    }, '198.51.100.20'));
    assert.strictEqual(ip, '198.51.100.20');
  });
});

run('trusts the forwarded IP when the proxy secret matches', () => {
  withSecret('proxy-secret', () => {
    const ip = detectClientIpFromRequest(request({
      'x-vls-client-ip': '39.40.100.1',
      'x-vls-proxy-secret': 'proxy-secret',
      'x-real-ip': '203.0.113.10',
    }));
    assert.strictEqual(ip, '39.40.100.1');
  });
});

run('accepts a quoted env secret', () => {
  withSecret('"proxy-secret"', () => {
    const ip = detectClientIpFromRequest(request({
      'x-vls-client-ip': '39.40.100.1',
      'x-vls-proxy-secret': 'proxy-secret',
    }));
    assert.strictEqual(ip, '39.40.100.1');
  });
});

run('does not trust client forwarding headers on a direct call', () => {
  withSecret(undefined, () => {
    const ip = detectClientIpFromRequest(request({
      'x-vls-client-ip': '39.40.100.1',
      'x-vls-proxy-secret': 'proxy-secret',
      'cf-connecting-ip': '39.40.100.2',
      'x-forwarded-for': '39.40.100.3, 203.0.113.10',
      'x-vercel-forwarded-for': '198.51.100.8',
    }, '203.0.113.50'));
    assert.strictEqual(ip, '203.0.113.50');
  });
});

run('ignores spoofed country headers and query overrides', () => {
  withSecret('proxy-secret', () => {
    const geo = detectCountryFromRequest(request({
      'x-vls-country': 'IN',
      'cf-ipcountry': 'PK',
      'x-vercel-ip-country': 'BD',
      'x-country-code': 'NG',
    }));
    assert.strictEqual(geo.countryCode, null);
    assert.strictEqual(geo.source, 'unknown');
  });
});

run('trusts the forwarded country when the proxy secret matches', () => {
  withSecret('proxy-secret', () => {
    const geo = detectCountryFromRequest(request({
      'x-vls-country': 'in',
      'x-vls-proxy-secret': 'proxy-secret',
      'cf-ipcountry': 'US',
    }));
    assert.strictEqual(geo.countryCode, 'IN');
    assert.strictEqual(geo.source, 'header');
  });
});

run('falls back to the socket address', () => {
  withSecret(undefined, () => {
    const ip = detectClientIpFromRequest(request({}, '::ffff:203.0.113.50'));
    assert.strictEqual(ip, '203.0.113.50');
  });
});

console.log('All geoDetection tests passed.');
