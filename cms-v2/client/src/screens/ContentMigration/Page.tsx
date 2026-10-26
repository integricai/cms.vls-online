import { Navigate, useSearchParams } from 'react-router-dom';
import { canManageContent, getCurrentUser } from '../../api/client';
import PageTabs from '../../components/PageTabs';
import FooterV2 from '../FooterV2';
import HeaderV2 from '../HeaderV2';
import Books from '../Books';
import BlogMigration from './index';

type MainTab = 'blog' | 'books' | 'global';
type GlobalPanel = 'header' | 'footer';

export default function ContentMigrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  if (searchParams.get('booksTab') === 'discounts') {
    return <Navigate to="/payments?tab=book-codes" replace />;
  }
  const canContent = canManageContent(getCurrentUser()?.role);
  const requested = searchParams.get('tab');
  const tab: MainTab = requested === 'books' || requested === 'global' || requested === 'blog'
    ? requested
    : canContent ? 'blog' : 'global';
  const activeTab: MainTab = !canContent && tab !== 'global' ? 'global' : tab;
  const globalPanel: GlobalPanel = searchParams.get('global') === 'footer' ? 'footer' : 'header';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next !== 'blog') params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  function setGlobalPanel(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'global');
    if (next === 'footer') params.set('global', 'footer');
    else params.delete('global');
    setSearchParams(params, { replace: true });
  }

  const mainTabs = [
    canContent ? { id: 'blog', label: 'Blog Migration' } : null,
    { id: 'global', label: 'Global Header/Footer' },
    canContent ? { id: 'books', label: 'BPP Books' } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  return (
    <div className="flex h-full flex-col">
      <PageTabs tabs={mainTabs} value={activeTab} onChange={setTab} />
      {activeTab === 'global' ? (
        <PageTabs
          tabs={[
            { id: 'header', label: 'Header' },
            { id: 'footer', label: 'Footer' },
          ]}
          value={globalPanel}
          onChange={setGlobalPanel}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'blog' ? (
          <div className="h-full overflow-auto">
            <BlogMigration />
          </div>
        ) : null}
        {activeTab === 'books' ? <Books /> : null}
        {activeTab === 'global' ? (
          <div className="h-full">
            {globalPanel === 'header' ? <HeaderV2 /> : <FooterV2 />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
