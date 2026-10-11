import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import DiscountCodes from '../DiscountCodes';
import Books from './index';

type Tab = 'collection' | 'discounts';

export default function BooksSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('booksTab') === 'discounts' ? 'discounts' : 'collection';

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'books');
    if (next === 'discounts') params.set('booksTab', 'discounts');
    else params.delete('booksTab');
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs
        tabs={[
          { id: 'collection', label: 'Book collection' },
          { id: 'discounts', label: 'Discount codes' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1">
        {tab === 'collection' ? <Books /> : <DiscountCodes />}
      </div>
    </div>
  );
}
