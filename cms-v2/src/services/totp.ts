import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;

export function roleRequiresTotp(role: string): boolean {
  return role === 'admin';
}

function bytes(data: Buffer): Uint8Array {
  return Uint8Array.from(data);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeBase64Url(data: Uint8Array): string {
  return Buffer.from(data).toString('base64url');
}

export function generateTotpSecret(): string {
  return base32Encode(bytes(randomBytes(20)));
}

export function otpauthUrl(account: string, secret: string): string {
  const label = encodeURIComponent(`Vertex Vault:${account}`);
  const issuer = encodeURIComponent('Vertex Vault');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${CODE_DIGITS}&period=${STEP_SECONDS}`;
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const cleaned = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step < 0) continue;
    if (fixedEqual(totpAt(secret, step), cleaned)) return true;
  }
  return false;
}

export function sealTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', bytes(sealKey()), bytes(iv));
  const encrypted = concat([bytes(cipher.update(secret, 'utf8')), bytes(cipher.final())]);
  const tag = cipher.getAuthTag();
  return [bytes(iv), bytes(tag), encrypted].map(encodeBase64Url).join('.');
}

export function openTotpSecret(sealed: string): string | null {
  const [ivPart, tagPart, encryptedPart] = sealed.split('.');
  if (!ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      bytes(sealKey()),
      bytes(Buffer.from(ivPart, 'base64url')),
    );
    decipher.setAuthTag(bytes(Buffer.from(tagPart, 'base64url')));
    const plain = concat([
      bytes(decipher.update(bytes(Buffer.from(encryptedPart, 'base64url')))),
      bytes(decipher.final()),
    ]);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** RFC 6238 code for one time step. Exported for the known test vector. */
export function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  message.writeUInt32BE(high, 0);
  message.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', bytes(key)).update(bytes(message)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(CODE_DIGITS, '0');
}

function sealKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return createHash('sha256').update(secret).digest();
}

function fixedEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(bytes(a), bytes(b));
}

export function base32Encode(data: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= bits === 0 ? 0 : (1 << bits) - 1;
  }
  if (bits > 0) output += ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid authenticator secret');
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
    buffer &= bits === 0 ? 0 : (1 << bits) - 1;
  }
  return Buffer.from(bytes);
}
