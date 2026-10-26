import { Navigate, useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import DashboardTab from './DashboardTab';
import SalesTab from './SalesTab';

type SalesTabId = 'dashboard' | 'sales';

const MOVED_TABS: Record<string, string> = {
  'custom-offer': '/payments?tab=custom-offer',
  'retake-codes': '/payments?tab=single-course',
  banners: '/payments?tab=banners',
};

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  if (requested && MOVED_TABS[requested]) {
    return <Navigate to={MOVED_TABS[requested]} replace />;
  }

  const tab: SalesTabId = requested === 'sales' ? 'sales' : 'dashboard';

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
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'dashboard' ? <DashboardTab /> : null}
        {tab === 'sales' ? <SalesTab /> : null}
      </div>
    </div>
  );
}
