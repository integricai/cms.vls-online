import { timingSafeEqual } from 'crypto';

/** Constant-time string compare. Length differences do not skip the compare. */
export function secretEquals(actual: string, expected: string): boolean {
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  const length = Math.max(actualBuf.length, expectedBuf.length, 1);
  const paddedActual = Buffer.alloc(length);
  const paddedExpected = Buffer.alloc(length);
  actualBuf.copy(paddedActual);
  expectedBuf.copy(paddedExpected);
  return actualBuf.length === expectedBuf.length && timingSafeEqual(paddedActual, paddedExpected);
}
