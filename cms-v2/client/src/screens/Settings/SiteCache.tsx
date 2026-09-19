import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type EnvironmentId = 'staging' | 'production';

type SiteCacheTarget = {
  id: EnvironmentId;
  label: string;
  siteUrl: string;
  configured: boolean;
};

type PurgeResult = {
  environment: EnvironmentId;
  siteUrl: string;
  revalidated?: boolean;
  purged?: boolean;
  paths?: string[];
  skipped?: boolean;
  reason?: string;
  failedStep?: string | null;
};

const DEFAULT_TARGETS: SiteCacheTarget[] = [
  { id: 'staging', label: 'Staging', siteUrl: 'https://staging.vls-online.com', configured: false },
  { id: 'production', label: 'Production', siteUrl: 'https://prod.vls-online.com', configured: false },
];

export default function SiteCache() {
  const [targets, setTargets] = useState<SiteCacheTarget[]>(DEFAULT_TARGETS);
  const [environment, setEnvironment] = useState<EnvironmentId | 'both'>('staging');
  const [page, setPage] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'all' | 'page' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ environments: SiteCacheTarget[] }>('/site-cache');
        if (!cancelled && data.environments?.length) setTargets(data.environments);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load cache settings.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function purge(purgeAll: boolean) {
    setWorking(purgeAll ? 'all' : 'page');
    setError('');
    setMessage('');
    try {
      const data = await api.post<{ results: PurgeResult[] }>('/site-cache/purge', {
        environment,
        purgeAll,
        page: purgeAll ? undefined : page.trim(),
      });
      const lines = data.results.map(result => {
        const label = result.environment === 'production' ? 'Production' : 'Staging';
        if (result.skipped) return `${label}: skipped (${result.reason ?? 'not allowed'})`;
        const scope = result.purged ? 'entire site' : (result.paths ?? []).join(', ') || 'selected page';
        return `${label}: purged ${scope}`;
      });
      setMessage(lines.join(' '));
      if (!purgeAll) setPage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cache purge failed.');
    } finally {
      setWorking(null);
    }
  }

  const selectedTargets = environment === 'both'
    ? targets
    : targets.filter(target => target.id === environment);
  const missingSecrets = selectedTargets.filter(target => !target.configured);

  return (
    <div className="p-6">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Site cache</h2>
      <p className="mb-6 max-w-2xl text-xs text-slate-500">
        Purge Cloudflare HTML cache and Next.js page cache on staging or production.
        Use this after a deploy if about pages or course grids still show old links.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading cache settings…</p>
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-600">Environment</label>
          <select
            value={environment}
            onChange={event => setEnvironment(event.target.value as EnvironmentId | 'both')}
            className="mb-4 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {targets.map(target => (
              <option key={target.id} value={target.id}>
                {target.label} ({target.siteUrl})
                {target.configured ? '' : ' — secret missing'}
              </option>
            ))}
            <option value="both">Staging and production</option>
          </select>

          {missingSecrets.length > 0 && (
            <p className="mb-4 text-xs text-amber-700">
              {missingSecrets.map(target => target.label).join(' and ')} is missing
              {' '}REVALIDATE_SECRET on the CMS. Add STAGING_REVALIDATE_SECRET and
              PRODUCTION_REVALIDATE_SECRET, then redeploy CMS.
            </p>
          )}

          <div className="mb-6">
            <button
              type="button"
              disabled={working !== null}
              onClick={() => {
                const label = environment === 'both' ? 'staging and production' : environment;
                if (!window.confirm(`Purge the entire ${label} site cache?`)) return;
                void purge(true);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {working === 'all' ? 'Purging…' : 'Purge entire site'}
            </button>
          </div>

          <label className="mb-1 block text-xs font-medium text-slate-600">
            One page (path or full URL)
          </label>
          <div className="flex max-w-xl flex-wrap items-center gap-2">
            <input
              value={page}
              onChange={event => setPage(event.target.value)}
              placeholder="/about-acca or https://staging.vls-online.com/about-acca"
              className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={working !== null || !page.trim()}
              onClick={() => void purge(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {working === 'page' ? 'Purging…' : 'Purge this page'}
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
