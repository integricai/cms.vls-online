import type { BookRecord } from '../../shared/types';

export type CheckoutBookAddon = {
  bookId: number;
  title: string;
  amount: number;
};

const PAPER_CODES = [
  'DIPIFR', 'FA1', 'MA1', 'FA2', 'MA2', 'FBT', 'FMA', 'FFA', 'FAB',
  'SBL', 'SBR', 'AFM', 'APM', 'ATX', 'AAA',
  'BT', 'MA', 'FA', 'LW', 'PM', 'TX', 'FR', 'AA', 'FM',
] as const;

const PAPER_ALIASES: Record<string, string> = {
  F4: 'LW', F5: 'PM', F6: 'TX', F7: 'FR', F8: 'AA', F9: 'FM',
};

const PAPER_CODE_PATTERN = new RegExp(
  `\\b(${[...PAPER_CODES, ...Object.keys(PAPER_ALIASES)].join('|')})\\b`,
  'i',
);

/** The first paper code in a course or book title. FA1 stays distinct from FA. */
export function paperCodeFromTitle(title: string): string {
  const match = String(title || '').match(PAPER_CODE_PATTERN);
  if (!match) return '';
  const raw = match[1].toUpperCase();
  return PAPER_ALIASES[raw] || raw;
}

export function addCheckoutMoney(left: number, right: number): number {
  return Math.round((left + right) * 100) / 100;
}

/**
 * The book may join a course payment when its title carries the same paper
 * code as the course, and both charges use the same currency.
 */
export function checkoutBookAddon(input: {
  book: Pick<BookRecord, 'id' | 'title' | 'price' | 'discountedPrice' | 'currency' | 'isActive'> | null;
  courseTitle: string;
  chargeCurrency: string;
}): CheckoutBookAddon | null {
  const book = input.book;
  if (!book || book.isActive === false) return null;
  if (!Number.isInteger(book.id) || book.id <= 0) return null;
  const courseCode = paperCodeFromTitle(input.courseTitle);
  const bookCode = paperCodeFromTitle(book.title);
  if (!courseCode || courseCode !== bookCode) return null;
  const currency = (book.currency || 'USD').trim().toUpperCase() || 'USD';
  if (currency !== input.chargeCurrency.trim().toUpperCase()) return null;
  const list = Number(book.price);
  const charge = book.discountedPrice != null ? Number(book.discountedPrice) : list;
  if (!Number.isFinite(charge) || charge <= 0) return null;
  return {
    bookId: book.id,
    title: book.title.trim().slice(0, 250) || 'BPP book',
    amount: addCheckoutMoney(charge, 0),
  };
}
