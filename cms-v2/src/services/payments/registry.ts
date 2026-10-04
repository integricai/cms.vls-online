// Direct PayPal checkout is disabled. PayPal on the site is Stripe's payment method.
// paypalProvider stays imported for legacy refunds of orders already paid through direct PayPal.
import { paypalProvider } from './paypalProvider';
import { stripeProvider } from './stripeProvider';
import {
  parsePaymentProviderId,
  type IPaymentProvider,
  type PaymentProviderId,
} from './types';

/** Checkout providers. Direct PayPal is not one of them. */
export function listEnabledPaymentProviders(): PaymentProviderId[] {
  return ['stripe'];
}

export function getPaymentProvider(id?: string | PaymentProviderId | null): IPaymentProvider {
  const resolved = parsePaymentProviderId(id);
  if (resolved === 'paypal') {
    throw new Error('Direct PayPal checkout is disabled');
  }
  return stripeProvider;
}

/** Direct checkout disabled, legacy refund only. */
export function getPaymentRefundProvider(id?: string | PaymentProviderId | null): IPaymentProvider {
  const resolved = parsePaymentProviderId(id);
  if (resolved === 'paypal') return paypalProvider;
  return getPaymentProvider(resolved);
}

export function isPaymentProviderEnabled(id: PaymentProviderId): boolean {
  return listEnabledPaymentProviders().includes(id);
}
