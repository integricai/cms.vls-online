import crypto from 'crypto';
import {
  assembleGa4Traffic,
  emptyGa4Traffic,
  ga4BatchBody,
  ga4ErrorMessage,
  ga4PropertyId,
  type Ga4RawReport,
  type Ga4Traffic,
} from '../../shared/ga4Report';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

type Ga4Config = {
  propertyId: string;
  clientEmail: string;
  privateKey: string;
};

type CachedToken = { email: string; token: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

export function normalizeGa4PrivateKey(value: string): string {
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

export function readGa4Config(
  env: NodeJS.ProcessEnv = process.env,
): Ga4Config | null {
  const propertyId = ga4PropertyId(env.GA4_PROPERTY_ID ?? '');
  const clientEmail = (env.GA4_CLIENT_EMAIL ?? '').trim();
  const privateKey = normalizeGa4PrivateKey(env.GA4_PRIVATE_KEY ?? '');
  if (!propertyId || !clientEmail || !privateKey.includes('PRIVATE KEY')) return null;
  return { propertyId, clientEmail, privateKey };
}

export function buildServiceAccountAssertion(email: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
}

async function accessToken(config: Ga4Config): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.email === config.clientEmail && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const assertion = buildServiceAccountAssertion(config.clientEmail, config.privateKey);
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    timeoutMs: 15_000,
  });
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google did not return an access token.');
  }
  cachedToken = { email: config.clientEmail, token: payload.access_token, expiresAt: now + 50 * 60 * 1000 };
  return payload.access_token;
}

export async function loadGa4Traffic(start: string, end: string): Promise<Ga4Traffic> {
  const config = readGa4Config();
  if (!config) return emptyGa4Traffic(false, null);
  try {
    const token = await accessToken(config);
    const response = await fetchWithTimeout(
      `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:batchRunReports`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ga4BatchBody(start, end)),
        timeoutMs: 20_000,
      },
    );
    const payload = await response.json() as {
      reports?: Ga4RawReport[];
      error?: { message?: string; status?: string };
    };
    if (!response.ok) return emptyGa4Traffic(true, ga4ErrorMessage(payload.error));
    return assembleGa4Traffic(payload.reports ?? [], start, end);
  } catch (err) {
    console.error('[ga4]', err instanceof Error ? err.message : err);
    return emptyGa4Traffic(true, 'Could not reach Google Analytics.');
  }
}
