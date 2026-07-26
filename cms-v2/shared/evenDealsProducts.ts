/** Allowed Evendeals product IDs selectable on course price rows. */
export const EVENDEALS_PRODUCT_OPTIONS = [
  {
    value: '73e50a3e-152a-4d61-b0eb-4229f831bf39',
    label: 'ACCA Foundation and Knowledge and LW',
  },
  {
    value: '81318eab-7b83-4b9b-babc-808fc0bc2433',
    label: 'ACCA Skills and Pro',
  },
  {
    value: '4815e1b8-6b76-40ce-9bbb-8383abafe962',
    label: 'ACCA Subscription Plans',
  },
  {
    value: '267c3700-2ec7-4d0a-a254-786e301c6582',
    label: 'CIMA Courses',
  },
  {
    value: '19957417-8278-408a-8626-39154319d42e',
    label: 'CMA and CIA Courses',
  },
  {
    value: 'a6b37076-4c0b-443b-aef2-c48084e5d7fb',
    label: 'IFRS Courses',
  },
  {
    value: '0a2723a9-7c5c-45da-870e-77e6d3ab02fd',
    label: 'Revision Courses',
  },
] as const;

export type EvenDealsProductId = (typeof EVENDEALS_PRODUCT_OPTIONS)[number]['value'];

const ALLOWED = new Set<string>(EVENDEALS_PRODUCT_OPTIONS.map(option => option.value));

export function isEvenDealsProductId(value: string | null | undefined): value is EvenDealsProductId {
  return typeof value === 'string' && ALLOWED.has(value);
}

export function evenDealsProductLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return EVENDEALS_PRODUCT_OPTIONS.find(option => option.value === value)?.label ?? null;
}
