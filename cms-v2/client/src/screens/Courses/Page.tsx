import { useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../api/client';
import PageTabs from '../../components/PageTabs';
import CoursePricing from '../CoursePricing';
import CoursesTab from '../Configurations/CoursesTab';
import QualificationOfferRulesTab from '../Configurations/QualificationOfferRulesTab';

type Tab = 'courses' | 'configuration' | 'prices';

export default function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = getCurrentUser()?.role === 'admin';
  const requested = searchParams.get('tab');
  const tab: Tab = isAdmin && (requested === 'configuration' || requested === 'prices')
    ? requested
    : 'courses';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'courses') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  const tabs = [
    { id: 'courses', label: 'Courses' },
    isAdmin ? { id: 'configuration', label: 'Prices configuration' } : null,
    isAdmin ? { id: 'prices', label: 'Prices' } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  return (
    <div className="flex h-full flex-col">
      <PageTabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'courses' ? <CoursesTab /> : null}
        {tab === 'configuration' ? <QualificationOfferRulesTab /> : null}
        {tab === 'prices' ? <CoursePricing /> : null}
      </div>
    </div>
  );
}
