/**
 * Pure password checks and encryption. Storage lives in studentPassword.ts.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStudentEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** Empty is "no password". A present value must already meet the length rule. */
export function parseChosenPassword(value: unknown): { password: string | null; invalid: boolean } {
  if (value == null || value === '') return { password: null, invalid: false };
  if (typeof value !== 'string') return { password: null, invalid: true };
  if (value.length < 8 || value.length > 72) return { password: null, invalid: true };
  return { password: value, invalid: false };
}

export function studentPasswordKey(): Buffer {
  const dedicated = process.env.STUDENT_PASSWORD_KEY?.trim();
  const source = dedicated || process.env.ZENLER_API_KEY?.trim();
  if (!source) throw new Error('STUDENT_PASSWORD_KEY is not configured');
  return createHash('sha256').update(source).digest();
}

export function encryptStudentPassword(password: string, key: Buffer = studentPasswordKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptStudentPassword(payload: string, key: Buffer = studentPasswordKey()): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Stored student password is unreadable');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
