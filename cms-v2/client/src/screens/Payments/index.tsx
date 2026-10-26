import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import Banner from '../Banner';
import CustomPaymentOffer from '../Billing/CustomPaymentOffer';
import RetakeCodes from '../Billing/RetakeCodes';
import DiscountCodes from '../DiscountCodes';

type PaymentsTabId = 'custom-offer' | 'single-course' | 'banners' | 'book-codes';

function normalizeTab(value: string | null): PaymentsTabId {
  if (value === 'single-course' || value === 'retake-codes') return 'single-course';
  if (value === 'banners') return 'banners';
  if (value === 'book-codes' || value === 'discounts') return 'book-codes';
  return 'custom-offer';
}

export default function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeTab(searchParams.get('tab'));

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'custom-offer') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs
        tabs={[
          { id: 'custom-offer', label: 'Customer Payment Form' },
          { id: 'single-course', label: 'Single course Discount' },
          { id: 'banners', label: 'Banner Discounts' },
          { id: 'book-codes', label: 'Book Discount Codes' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'custom-offer' ? <CustomPaymentOffer /> : null}
        {tab === 'single-course' ? <RetakeCodes /> : null}
        {tab === 'banners' ? <Banner /> : null}
        {tab === 'book-codes' ? <DiscountCodes /> : null}
      </div>
    </div>
  );
}
