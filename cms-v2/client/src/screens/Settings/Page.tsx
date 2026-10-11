import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import SitemapScreen from '../Sitemap';
import UserManagement from '../UserManagement';
import SiteCache from './SiteCache';
import SystemLogs from './SystemLogs';

type Tab = 'logs' | 'cache' | 'sitemap' | 'users';

const TABS: { id: Tab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'cache', label: 'Cache' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'users', label: 'Users' },
];

function isTab(value: string | null): value is Tab {
  return value === 'logs' || value === 'cache' || value === 'sitemap' || value === 'users';
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: Tab = isTab(requested) ? requested : 'logs';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'logs') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'logs' ? <SystemLogs /> : null}
        {tab === 'cache' ? <SiteCache /> : null}
        {tab === 'sitemap' ? <SitemapScreen /> : null}
        {tab === 'users' ? <UserManagement /> : null}
      </div>
    </div>
  );
}
