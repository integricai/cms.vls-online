import { useEffect, useMemo, useState } from 'react';
import { api, getCurrentUser } from '../../api/client';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import type { CourseFinderCourse } from '../CourseFinder/generateHtml';
import { generateCourseFinderBannerHtml } from './generateHtml';

type ActiveTab = 'preview' | 'html';

function formatSyncDate(value: string | null | undefined): string {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CourseFinderBannerScreen() {
  const [courses, setCourses] = useState<CourseFinderCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  const isAdmin = getCurrentUser()?.role === 'admin';
  const lastSyncedAt = useMemo(() => {
    const values = courses
      .map(course => course.lastSyncedAt)
      .filter(Boolean)
      .sort();
    return values.length > 0 ? values[values.length - 1] : null;
  }, [courses]);

  async function loadCourses() {
    setError('');
    setLoading(true);
    try {
      const rows = await api.get<CourseFinderCourse[]>('/courses/active');
      setCourses(rows);
      setPreviewHtml(wrapGeneratedHtml('Course Finder Banner', generateCourseFinderBannerHtml(rows)));
      setActiveTab('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses');
    } finally {
      setLoading(false);
    }
  }

  async function syncFromZenler() {
    if (!isAdmin) return;
    setError('');
    setSyncing(true);
    try {
      await api.post('/courses/sync', {});
      await loadCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync courses from Zenler');
    } finally {
      setSyncing(false);
    }
  }

  function generateHtml() {
    setPreviewHtml(wrapGeneratedHtml('Course Finder Banner', generateCourseFinderBannerHtml(courses)));
    setActiveTab('preview');
  }

  useEffect(() => {
    void loadCourses();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading courses...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Course Finder Banner</h1>
          <p className="mt-0.5 text-xs text-slate-400">Dropdown-only banner for reusable page inserts</p>
        </div>

        <div className="flex gap-2 border-b border-slate-100 bg-white px-5 py-3">
          <button onClick={generateHtml} className="btn-success flex-1 justify-center">
            Generate HTML
          </button>
          <button onClick={loadCourses} className="btn-ghost flex-1 justify-center" disabled={loading || syncing}>
            Refresh
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="section-label mt-0">Zenler Course Data</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-2xl font-bold text-slate-900">{courses.length}</div>
                <div className="text-xs text-slate-400">Active courses</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-900">{formatSyncDate(lastSyncedAt)}</div>
                <div className="mt-1 text-xs text-slate-400">Last Zenler sync</div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              This uses the same course grouping as the full Course Finder, but only outputs the banner. The Find button redirects the visitor to the selected course page.
            </p>
            {isAdmin ? (
              <button onClick={syncFromZenler} disabled={syncing} className="btn-primary mt-3 w-full justify-center">
                {syncing ? 'Syncing from Zenler...' : 'Sync Courses From Zenler'}
              </button>
            ) : (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Admin access is required to run a fresh Zenler sync.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <p className="section-label">Visitor Flow</p>
          <div className="space-y-2 text-xs leading-5 text-slate-500">
            <p>Only Qualification is enabled on load. Level, Course, and Course Option activate one by one.</p>
            <p>Find Course stays disabled until the visitor chooses both a course and an option.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={
              previewHtml
                ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6fb;padding:24px">${previewHtml}</body></html>`
                : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click Generate HTML to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button
              onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600"
            >
              Copy
            </button>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
              {previewHtml || '// Click Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
