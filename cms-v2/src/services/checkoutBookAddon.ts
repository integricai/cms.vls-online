import type { BookRecord } from '../../shared/types';

export type CheckoutBookAddon = {
  bookId: number;
  title: string;
  amount: number;
};

export function addCheckoutMoney(left: number, right: number): number {
  return Math.round((left + right) * 100) / 100;
}

/**
 * The book may join a course payment only when the vault links it to that course
 * and both charges use the same currency.
 */
export function checkoutBookAddon(input: {
  book: Pick<BookRecord, 'id' | 'title' | 'price' | 'discountedPrice' | 'currency' | 'isActive' | 'courseId'> | null;
  courseId: number;
  chargeCurrency: string;
}): CheckoutBookAddon | null {
  const book = input.book;
  if (!book || book.isActive === false) return null;
  if (!Number.isInteger(book.id) || book.id <= 0) return null;
  if (book.courseId !== input.courseId) return null;
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
