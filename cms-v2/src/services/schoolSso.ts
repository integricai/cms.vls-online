/**
 * Zenler signs the student in when we redirect to the school SSO URL.
 * The token is minted at click time and expires in two minutes.
 */

import jwt from 'jsonwebtoken';
import { VLS_SCHOOL_BASE_URL } from './schoolAccess';

const SSO_TTL_SECONDS = 120;

export function schoolSsoUrl(input: {
  firstName: string;
  lastName?: string | null;
  email: string;
  errorUrl?: string | null;
}): string {
  const secret = process.env.ZENLER_API_KEY?.trim();
  if (!secret) throw new Error('ZENLER_API_KEY is not configured');

  const payload: { first_name: string; email: string; last_name?: string } = {
    first_name: input.firstName.trim() || 'Student',
    email: input.email.trim().toLowerCase(),
  };
  const lastName = input.lastName?.trim();
  if (lastName) payload.last_name = lastName;

  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: SSO_TTL_SECONDS,
  });

  const url = new URL(`${VLS_SCHOOL_BASE_URL}/api/sso/v1`);
  url.searchParams.set('token', token);
  url.searchParams.set('return_to', `${VLS_SCHOOL_BASE_URL}/mycourses`);
  if (input.errorUrl?.trim()) url.searchParams.set('error_url', input.errorUrl.trim());
  return url.toString();
}

export function schoolSsoTokenClaims(token: string, secret: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (!decoded || typeof decoded === 'string') throw new Error('SSO token payload is missing');
  return decoded;
}
