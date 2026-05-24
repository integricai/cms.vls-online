import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import MenuManagement from '../MenuManagement';
import UserManagement from '../UserManagement';

type Tab = 'menu' | 'courses' | 'payments' | 'users';

type Course = {
  id: number;
  zenlerCourseId: string;
  name: string;
  status: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
};

type SyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  deactivated: number;
  syncedAt: string;
};

function CoursesTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<string | null>(null);
  const [debugging, setDebugging] = useState(false);

  useEffect(() => {
    api.get<Course[]>('/courses')
      .then(data => setCourses(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function sync() {
    setSyncing(true); setSyncResult(null); setSyncError(null);
    try {
      const result = await api.post<SyncResult>('/courses/sync', {});
      setSyncResult(result);
      const fresh = await api.get<Course[]>('/courses');
      setCourses(fresh || []);
    } catch (e) {
      setSyncError((e instanceof Error ? e.message : null) || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function runDebug() {
    setDebugging(true); setDebugData(null);
    try {
      const raw = await api.get<unknown>('/courses/zenler-debug');
      setDebugData(JSON.stringify(raw, null, 2));
    } catch (e) {
      setDebugData('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDebugging(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Zenler Course Sync</h2>
      <p className="mb-3 text-xs text-slate-500">
        Sync courses from your Zenler school into the local database. Synced courses become
        available as dropdown options when configuring payment cards.
      </p>

      <div className="mb-4 flex gap-2">
        <button onClick={sync} disabled={syncing} className="btn-primary">
          {syncing ? 'Syncing…' : '↻ Sync Courses from Zenler'}
        </button>
        <button onClick={runDebug} disabled={debugging} className="btn-ghost text-xs">
          {debugging ? 'Fetching…' : '🔍 Debug raw response'}
        </button>
      </div>

      {syncResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Sync complete — <strong>{syncResult.fetched}</strong> fetched ·{' '}
          <strong>{syncResult.inserted}</strong> new · <strong>{syncResult.updated}</strong> updated ·{' '}
          <strong>{syncResult.deactivated}</strong> deactivated
        </div>
      )}
      {syncError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncError}
        </div>
      )}
      {debugData && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">Raw Zenler API response (page 1):</p>
          <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 max-h-96">
            {debugData}
          </pre>
        </div>
      )}

      <h3 className="mb-2 text-sm font-bold text-slate-700">
        {loading ? 'Loading courses…' : `${courses.length} Course${courses.length !== 1 ? 's' : ''}`}
      </h3>
      {!loading && courses.length === 0 && (
        <p className="text-xs text-slate-400">No courses synced yet. Click "Sync Courses from Zenler" above.</p>
      )}
      {!loading && courses.length > 0 && (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Zenler ID</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Active</th>
                <th className="px-3 py-2 font-semibold">Last synced</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 text-slate-400">{c.zenlerCourseId}</td>
                  <td className="px-3 py-2 text-slate-400">{c.status ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={c.isActive ? 'text-green-600' : 'text-red-400'}>
                      {c.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  return (
    <div className="p-6">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Payments</h2>
      <p className="text-xs text-slate-500">Payment gateway configuration coming soon.</p>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  menu: 'Menu Settings',
  courses: 'Courses',
  payments: 'Payments',
  users: 'Users',
};

export default function Settings() {
  const [tab, setTab] = useState<Tab>('menu');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Admin Settings</h1>
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
        {tab === 'menu'     && <MenuManagement />}
        {tab === 'courses'  && <CoursesTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'users'    && <UserManagement />}
      </div>
    </div>
  );
}
