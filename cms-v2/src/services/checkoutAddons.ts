import { sql } from '../db/client';
import { getBook } from '../models/book';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import { addCheckoutMoney, checkoutBookAddon, type CheckoutBookAddon } from './checkoutBookAddon';
import { buildCourseDisplayPricing } from './courseDisplayPricing';

export type CheckoutUpsellOffer = {
  courseId: number;
  zenlerCourseId: string;
  title: string;
  listAmount: number;
  chargeAmount: number;
  saveAmount: number;
};

export class CheckoutAddonError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CheckoutAddonError';
    this.status = status;
  }
}

type UpsellRow = {
  id: number;
  name: string;
  zenler_course_id: string;
  slug: string | null;
  qualification: string | null;
};

function money(amount: number): number {
  return addCheckoutMoney(amount, 0);
}

/** UpSell Courses saved on this course, priced the way the course page prices them. */
export async function listCheckoutUpsellOffers(input: {
  courseId: number;
  countryCode?: string | null;
  ipAddress?: string | null;
  ignoreVpnBlock?: boolean;
}): Promise<CheckoutUpsellOffer[]> {
  const rows = await sql`
    SELECT c.id, c.name, c.zenler_course_id, c.slug, c.qualification
    FROM course_upsells cu
    JOIN courses c ON c.id = cu.upsell_course_id
    WHERE cu.course_id = ${input.courseId}
      AND c.is_active = true
    ORDER BY cu.sort_order ASC, c.id ASC
  ` as UpsellRow[];

  const offers: CheckoutUpsellOffer[] = [];
  for (const row of rows) {
    const prices = await listActiveGeoPricesForCourse(row.id);
    const pricing = await buildCourseDisplayPricing({
      zenlerCourseId: row.zenler_course_id,
      courseSlug: row.slug,
      courseName: row.name,
      prices,
      courseId: row.id,
      qualification: row.qualification,
      countryCode: input.countryCode,
      ipAddress: input.ipAddress,
      ignoreVpnBlock: input.ignoreVpnBlock,
    });
    const plan = pricing?.plans.find((item) => item.isDefault) ?? pricing?.plans[0];
    if (!plan) continue;
    const listAmount = money(plan.amount);
    const chargeAmount = money(plan.effectiveAmount);
    if (!(listAmount > 0) || !(chargeAmount > 0)) continue;
    offers.push({
      courseId: row.id,
      zenlerCourseId: String(row.zenler_course_id).trim(),
      title: row.name.trim() || 'Course',
      listAmount,
      chargeAmount,
      saveAmount: money(Math.max(0, listAmount - chargeAmount)),
    });
  }
  return offers.filter((offer) => /^\d+$/.test(offer.zenlerCourseId));
}

/** Keeps only the ticked upsells, and refuses an id that is not on this course. */
export function selectedUpsellOffers(
  offers: CheckoutUpsellOffer[],
  requestedIds: number[],
): CheckoutUpsellOffer[] {
  const wanted = Array.from(new Set(requestedIds.filter((id) => Number.isInteger(id) && id > 0)));
  const byId = new Map(offers.map((offer) => [offer.courseId, offer]));
  return wanted.map((id) => {
    const offer = byId.get(id);
    if (!offer) {
      throw new CheckoutAddonError('One of the added courses is not available with this purchase.');
    }
    return offer;
  });
}

/** Books the student ticked. Each one must match this course's paper and currency. */
export async function checkoutBookLineItems(input: {
  bookIds: number[];
  courseTitle: string;
  chargeCurrency: string;
}): Promise<CheckoutBookAddon[]> {
  const ids = Array.from(new Set(input.bookIds.filter((id) => Number.isInteger(id) && id > 0)));
  const lines: CheckoutBookAddon[] = [];
  for (const id of ids) {
    const addon = checkoutBookAddon({
      book: await getBook(id),
      courseTitle: input.courseTitle,
      chargeCurrency: input.chargeCurrency,
    });
    if (!addon) {
      throw new CheckoutAddonError('This book cannot be added to this course.');
    }
    lines.push(addon);
  }
  return lines;
}
