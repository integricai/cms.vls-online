import { useSearchParams } from 'react-router-dom';
import PageTabs from '../../components/PageTabs';
import ActiveStudentsTab from './ActiveStudentsTab';
import StudentsList from './StudentsList';

type StudentsTabId = 'students' | 'active';

export default function Students() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: StudentsTabId = searchParams.get('tab') === 'active' ? 'active' : 'students';

  function setTab(next: string) {
    const params = new URLSearchParams();
    if (next === 'active') params.set('tab', 'active');
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <PageTabs
        tabs={[
          { id: 'students', label: 'Students' },
          { id: 'active', label: 'Active Students' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'students' ? <StudentsList /> : <ActiveStudentsTab />}
      </div>
    </div>
  );
}
