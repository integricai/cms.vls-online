import { useSearchParams } from 'react-router-dom';
import Books from '../Books';
import ContentMigrationTab from '../ContentMigration';
import CoursesTab from '../Configurations/CoursesTab';

type Tab = 'pageMigration' | 'books' | 'courses';

const TAB_LABELS: Record<Tab, string> = {
  pageMigration: 'Page Migration',
  books: 'Books',
  courses: 'Courses',
};

function isTab(value: string | null): value is Tab {
  return value === 'pageMigration' || value === 'books' || value === 'courses';
}

export default function ContentManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = isTab(rawTab) ? rawTab : 'pageMigration';

  function setTab(next: Tab) {
    if (next === 'pageMigration') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: next }, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Content Management</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Migrate pages and manage books and courses.
        </p>
      </div>
      <div className="flex border-b border-slate-200 bg-white px-6">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`mr-1 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'pageMigration' && <ContentMigrationTab />}
        {tab === 'books' && <Books />}
        {tab === 'courses' && <CoursesTab />}
      </div>
    </div>
  );
}
