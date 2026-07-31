import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import type { SitemapAdminData, SitemapGroup, SiteUrlRecord } from '../../../../shared/types';

type EnabledFilter = 'all' | 'enabled' | 'disabled';
type GroupFilter = 'all' | SitemapGroup;

const GROUP_LABELS: Record<SitemapGroup, string> = {
  pages: 'Site pages',
  courses: 'Courses',
  blog: 'Blog',
};

function apiOrigin(): string {
  return (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function SitemapScreen() {
  const [data, setData] = useState<SitemapAdminData | null>(null);
  const [urls, setUrls] = useState<SiteUrlRecord[]>([]);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [enabled, setEnabled] = useState<EnabledFilter>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewBase, setPreviewBase] = useState('');

  async function load() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (group !== 'all') params.set('group', group);
      if (enabled !== 'all') params.set('enabled', enabled);
      if (q.trim()) params.set('q', q.trim());
      const result = await api.get<SitemapAdminData>(`/sitemap?${params.toString()}`);
      setData(result);
      setUrls(result.urls);
      if (!previewBase) setPreviewBase(result.siteOrigin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load sitemap URLs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [group, enabled]);

  const previewLinks = useMemo(() => {
    const origin = apiOrigin();
    const base = encodeURIComponent(previewBase || data?.siteOrigin || 'https://vls-online.com');
    return {
      index: `${origin}/api/sitemap/xml/sitemap.xml?base=${base}`,
      pages: `${origin}/api/sitemap/xml/sitemap-pages.xml?base=${base}`,
      courses: `${origin}/api/sitemap/xml/sitemap-courses.xml?base=${base}`,
      blog: `${origin}/api/sitemap/xml/sitemap-blog.xml?base=${base}`,
    };
  }, [previewBase, data?.siteOrigin]);

  async function syncFromStoryblok() {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const result = await api.post<{
        scanned: number;
        upserted: number;
        skipped: number;
        disabled: number;
      }>('/sitemap/sync', {});
      setMessage(
        `Synced from Storyblok: ${result.upserted} upserted, ${result.disabled} disabled, ${result.skipped} skipped (${result.scanned} scanned).`,
      );
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function toggleEnabled(row: SiteUrlRecord) {
    setTogglingId(row.id);
    setError('');
    try {
      const updated = await api.patch<SiteUrlRecord>(`/sitemap/${row.id}/enabled`, {
        isEnabled: !row.isEnabled,
      });
      setUrls(current => current.map(item => (item.id === updated.id ? updated : item)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update URL.');
    } finally {
      setTogglingId(null);
    }
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    void load();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-sm font-bold text-slate-700">Sitemap</h2>
          <p className="max-w-2xl text-xs text-slate-500">
            Manage which published Storyblok pages are included in the search sitemaps.
            Use staging site origin below to verify XML before production.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncFromStoryblok()}
          disabled={syncing}
          className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync from Storyblok'}
        </button>
      </div>

      {data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(GROUP_LABELS) as SitemapGroup[]).map(key => (
            <div key={key} className="rounded border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-700">{GROUP_LABELS[key]}</div>
              <div className="text-xs text-slate-500">
                {data.counts[key].enabled} enabled / {data.counts[key].total} total
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">Preview XML (staging-safe)</div>
        <label className="mb-2 flex flex-col gap-1 text-xs text-slate-600">
          Absolute URL base used inside XML
          <input
            value={previewBase}
            onChange={e => setPreviewBase(e.target.value)}
            placeholder="https://staging.example.com"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            ['Index', previewLinks.index],
            ['Pages', previewLinks.pages],
            ['Courses', previewLinks.courses],
            ['Blog', previewLinks.blog],
          ] as const).map(([label, href]) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-100"
            >
              Open {label}
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Staging tip: set the base to your staging Next.js URL, open the XML here, then confirm the same paths on
          the staging site at <code className="rounded bg-white px-1">/sitemap.xml</code>. Staging robots still
          block crawlers — this is for manual verification only.
        </p>
        {data && (
          <p className="mt-1 text-[11px] text-slate-500">
            Storyblok webhook: <code className="rounded bg-white px-1">POST {data.webhookPath}</code> with
            header <code className="rounded bg-white px-1">Authorization: Bearer SITEMAP_WEBHOOK_SECRET</code>
          </p>
        )}
      </div>

      <form onSubmit={search} className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Group
          <select
            value={group}
            onChange={e => setGroup(e.target.value as GroupFilter)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="pages">Site pages</option>
            <option value="courses">Courses</option>
            <option value="blog">Blog</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Status
          <select
            value={enabled}
            onChange={e => setEnabled(e.target.value as EnabledFilter)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-slate-600">
          Search
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Path, title, or Storyblok slug"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      {message && <p className="mb-3 text-xs text-green-700">{message}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Enabled</th>
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold">Path</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Storyblok</th>
                <th className="px-3 py-2 font-semibold">Lastmod</th>
              </tr>
            </thead>
            <tbody>
              {urls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No URLs yet. Run “Sync from Storyblok” or publish a page to the sitemap webhook.
                  </td>
                </tr>
              ) : (
                urls.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={togglingId === row.id}
                        onClick={() => void toggleEnabled(row)}
                        className={`rounded px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                          row.isEnabled
                            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                        }`}
                      >
                        {row.isEnabled ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{GROUP_LABELS[row.sitemapGroup]}</td>
                    <td className="px-3 py-2 font-mono text-slate-800">{row.path}</td>
                    <td className="px-3 py-2 text-slate-700">{row.title || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.storyblokFullSlug}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(row.lastmod)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
