import { paypalProvider, isPaypalConfigured } from './paypalProvider';
import { stripeProvider } from './stripeProvider';
import {
  parsePaymentProviderId,
  type IPaymentProvider,
  type PaymentProviderId,
} from './types';

export function listEnabledPaymentProviders(): PaymentProviderId[] {
  const providers: PaymentProviderId[] = ['stripe'];
  if (isPaypalConfigured()) providers.push('paypal');
  return providers;
}

export function getPaymentProvider(id?: string | PaymentProviderId | null): IPaymentProvider {
  const resolved = parsePaymentProviderId(id);
  if (resolved === 'paypal') {
    if (!isPaypalConfigured()) {
      throw new Error('PayPal is not configured');
    }
    return paypalProvider;
  }
  return stripeProvider;
}

export function isPaymentProviderEnabled(id: PaymentProviderId): boolean {
  return listEnabledPaymentProviders().includes(id);
}
