import { Navigate, useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import FooterV2 from '../FooterV2';
import HeaderV2 from '../HeaderV2';
import SchoolPageScreen from '../SchoolPages/SchoolPageScreen';
import { generateSchoolDashboardHtml } from '../SchoolPages/dashboardHtml';
import { generateSchoolHomeHtml } from '../SchoolPages/homeHtml';
import { generateSchoolLoggedOutHtml } from '../SchoolPages/loggedOutHtml';

type MainTab = 'global' | 'school-dashboard' | 'logged-out' | 'home';
type GlobalPanel = 'header' | 'footer';

function resolveTab(requested: string | null): MainTab {
  if (requested === 'school-dashboard' || requested === 'logged-out' || requested === 'home') return requested;
  return 'global';
}

export default function ContentMigrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  if (searchParams.get('booksTab') === 'discounts') {
    return <Navigate to="/payments?tab=book-codes" replace />;
  }
  if (searchParams.get('tab') === 'books') {
    return <Navigate to="/books" replace />;
  }
  const activeTab = resolveTab(searchParams.get('tab'));
  const globalPanel: GlobalPanel = searchParams.get('global') === 'footer' ? 'footer' : 'header';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next === 'school-dashboard' || next === 'logged-out' || next === 'home' || next === 'global') {
      params.set('tab', next);
    } else {
      params.set('tab', 'global');
    }
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
    { id: 'global', label: 'Global Header/Footer' },
    { id: 'school-dashboard', label: 'School dashboard' },
    { id: 'logged-out', label: 'Logged out page' },
    { id: 'home', label: 'Home page' },
  ];

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
        {activeTab === 'school-dashboard' ? (
          <SchoolPageScreen
            title="School dashboard"
            sectionName="School dashboard"
            hint="Dashboard body only. Header and footer stay in Global Header/Footer. Sample student shown. Paste into the Zenler page at /dashboard."
            html={generateSchoolDashboardHtml()}
          />
        ) : null}
        {activeTab === 'logged-out' ? (
          <SchoolPageScreen
            title="Logged out page"
            sectionName="Logged out page"
            hint="No session shows the sign-in card. A live Zenler session shows Continue your studies, and that button opens /dashboard. Paste this as the school landing page."
            html={generateSchoolLoggedOutHtml()}
            previewStates={[
              { id: 'out', label: 'No session' },
              { id: 'in', label: 'Session alive' },
            ]}
          />
        ) : null}
        {activeTab === 'home' ? (
          <SchoolPageScreen
            title="Home page"
            sectionName="Home page"
            hint="Page body only. Header and footer stay in Global Header/Footer. Signed in shows Log out. Signed out shows Log in. Paste into the school home page."
            html={generateSchoolHomeHtml()}
            previewStates={[
              { id: 'in', label: 'Signed in' },
              { id: 'out', label: 'Signed out' },
            ]}
          />
        ) : null}
        {activeTab === 'global' ? (
          <div className="h-full">
            {globalPanel === 'header' ? <HeaderV2 /> : <FooterV2 />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
