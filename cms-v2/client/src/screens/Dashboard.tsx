import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../api/client';

interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  username: string | null;
  userRole: string | null;
  action: string;
  componentKey: string;
  componentName: string | null;
  summary: string;
  changedPaths: string[];
  createdAt: string;
}

function labelForKey(key: string): string {
  return key
    .replace(/^vls-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function Dashboard() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    api.get<ActivityLog[]>('/activity?limit=30')
      .then(data => setLogs(data || []))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load activity.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <h1 className="text-lg font-bold text-slate-900">Welcome back{currentUser?.firstName ? `, ${currentUser.firstName}` : ''}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAdmin ? 'Recent CMS work across all users.' : 'Your recent CMS work and saved component changes.'}
        </p>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Tasks</h2>
          <span className="text-xs text-slate-400">{logs.length} shown</span>
        </div>

        {loading && <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-400">Loading activity...</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No saved component activity yet. Your next save will appear here.
          </div>
        )}

        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      {labelForKey(log.componentKey)}
                    </span>
                    {log.componentName && <span className="text-sm font-semibold text-slate-800">{log.componentName}</span>}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{log.summary}</p>
                  {log.changedPaths.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      {log.changedPaths.slice(0, 8).join(', ')}{log.changedPaths.length > 8 ? '...' : ''}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-400">
                  {isAdmin && <div>{log.username || log.userEmail || 'Unknown user'}</div>}
                  <div>{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
