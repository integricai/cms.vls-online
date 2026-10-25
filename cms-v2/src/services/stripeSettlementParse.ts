/** Read the fee, net, and payment method off an expanded Stripe PaymentIntent. */

export interface StripeSettlement {
  fee: number;
  net: number;
  paymentMethod: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function paymentMethodLabel(details: Record<string, unknown> | null): string | null {
  const type = typeof details?.type === 'string' ? details.type : '';
  if (type === 'card') {
    const card = asRecord(details?.card);
    const brand = typeof card?.brand === 'string' ? card.brand.trim() : '';
    const pretty = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
    return `Card · ${pretty}`;
  }
  if (type === 'paypal') return 'PayPal';
  if (type === 'klarna') return 'Klarna';
  if (type === 'link') return 'Link';
  if (!type) return null;
  return type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function parseStripeSettlement(body: unknown): StripeSettlement | null {
  const paymentIntent = asRecord(body);
  const charge = asRecord(paymentIntent?.latest_charge);
  const balance = asRecord(charge?.balance_transaction);
  if (!charge || !balance) return null;
  const feeMinor = Number(balance.fee);
  const netMinor = Number(balance.net);
  if (!Number.isFinite(feeMinor) || !Number.isFinite(netMinor)) return null;
  return {
    fee: Math.round(feeMinor) / 100,
    net: Math.round(netMinor) / 100,
    paymentMethod: paymentMethodLabel(asRecord(charge.payment_method_details)),
  };
}
