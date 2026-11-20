import { getContent, upsertContent } from '../models/content';

export const BPP_BOOK_DISCOUNT_KEY = 'vls-bpp-book-discount';

export class BppBookDiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BppBookDiscountError';
  }
}

export function readBppBookDiscountPercent(data: unknown): number | null {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { percent?: unknown }).percent;
  if (raw == null || raw === '') return null;
  const percent = Number(raw);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return null;
  return percent;
}

export function parseBppBookDiscountInput(value: unknown): number | null {
  if (value == null || value === '') return null;
  const percent = Number(value);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new BppBookDiscountError('BPP Book Discount Percentage must be a whole number from 1 to 100.');
  }
  return percent;
}

export async function getBppBookDiscountPercent(): Promise<number | null> {
  const row = await getContent(BPP_BOOK_DISCOUNT_KEY);
  return readBppBookDiscountPercent(row?.data);
}

export async function saveBppBookDiscountPercent(value: unknown, updatedBy?: number): Promise<number | null> {
  const percent = parseBppBookDiscountInput(value);
  await upsertContent(BPP_BOOK_DISCOUNT_KEY, { percent }, updatedBy);
  return percent;
}
