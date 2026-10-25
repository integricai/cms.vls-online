import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import CustomPaymentOffer from '../Billing/CustomPaymentOffer';
import RetakeCodes from '../Billing/RetakeCodes';
import Banner from '../Banner';
import DashboardTab from './DashboardTab';
import SalesTab from './SalesTab';

type SalesTabId = 'dashboard' | 'sales' | 'custom-offer' | 'retake-codes' | 'banners';

function isSalesTab(value: string | null): value is SalesTabId {
  return value === 'dashboard'
    || value === 'sales'
    || value === 'custom-offer'
    || value === 'retake-codes'
    || value === 'banners';
}

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: SalesTabId = isSalesTab(requested) ? requested : 'dashboard';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'dashboard') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'sales', label: 'Sales' },
          { id: 'custom-offer', label: 'Customer Payment form' },
          { id: 'retake-codes', label: 'Discount Code' },
          { id: 'banners', label: 'Banner' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'dashboard' ? <DashboardTab /> : null}
        {tab === 'sales' ? <SalesTab /> : null}
        {tab === 'custom-offer' ? <CustomPaymentOffer /> : null}
        {tab === 'retake-codes' ? <RetakeCodes /> : null}
        {tab === 'banners' ? <Banner /> : null}
      </div>
    </div>
  );
}
