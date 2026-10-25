import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import CustomPaymentOffer from '../Billing/CustomPaymentOffer';
import OfferHistory from '../Billing/OfferHistory';
import RetakeCodes from '../Billing/RetakeCodes';
import Banner from '../Banner';
import SalesTab from './SalesTab';

type SalesTabId = 'overview' | 'payments' | 'custom-offer' | 'retake-codes' | 'transactions' | 'banners';

function isSalesTab(value: string | null): value is SalesTabId {
  return value === 'payments' || value === 'custom-offer' || value === 'retake-codes' || value === 'transactions' || value === 'overview' || value === 'banners';
}

function PaymentsTab() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-slate-800">Payments</h1>
      <p className="mt-1 text-xs text-slate-500">Payment gateway configuration coming soon.</p>
    </div>
  );
}

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: SalesTabId = isSalesTab(requested) && requested !== 'overview' ? requested : 'overview';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'overview') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'payments', label: 'Payments' },
          { id: 'custom-offer', label: 'Custom Payment Offer' },
          { id: 'retake-codes', label: 'Retake codes' },
          { id: 'transactions', label: 'Previous transactions' },
          { id: 'banners', label: 'Banners' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'payments' ? (
          <div className="h-full overflow-auto">
            <PaymentsTab />
          </div>
        ) : null}
        {tab === 'custom-offer' ? <CustomPaymentOffer /> : null}
        {tab === 'retake-codes' ? <RetakeCodes /> : null}
        {tab === 'transactions' ? <OfferHistory /> : null}
        {tab === 'banners' ? <Banner /> : null}
        {tab === 'overview' ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <h1 className="text-lg font-bold text-slate-800">Overview</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Course sales, Stripe payments, tutor claims, and commission tracking.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <SalesTab />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
