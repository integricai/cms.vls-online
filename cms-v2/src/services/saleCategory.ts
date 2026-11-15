export const SALE_CATEGORIES = [
  'Course',
  'Notes',
  'BPP Book',
  'Payment Order',
  'Discount Order',
] as const;

export type SaleCategory = (typeof SALE_CATEGORIES)[number];

export function isSaleCategory(value: string): value is SaleCategory {
  return (SALE_CATEGORIES as readonly string[]).includes(value);
}

/** Course and notes sales can be assigned to a tutor. The other categories cannot. */
export function saleCategoryAssignsTutor(category: SaleCategory): boolean {
  return category === 'Course' || category === 'Notes';
}

function mentionsNotes(value: string | null | undefined): boolean {
  return /notes/i.test(value ?? '');
}

/**
 * Category is taken from the payment, not chosen on the sales row.
 * A custom or resit offer is a Discount Order even when it names a course.
 * A custom charge with no course is a Payment Order.
 */
export function saleCategoryForOrder(input: {
  optionType?: string | null;
  courseTitle?: string | null;
  courseName?: string | null;
  coursePageUrl?: string | null;
  courseSlug?: string | null;
}): SaleCategory {
  const option = (input.optionType ?? '').trim();
  if (option === 'BPP Book') return 'BPP Book';
  if (option === 'Custom payment') return 'Payment Order';
  if (option === 'Custom / Resit offer') return 'Discount Order';
  if (
    mentionsNotes(input.courseName)
    || mentionsNotes(input.courseTitle)
    || mentionsNotes(input.coursePageUrl)
    || mentionsNotes(input.courseSlug)
  ) {
    return 'Notes';
  }
  return 'Course';
}
