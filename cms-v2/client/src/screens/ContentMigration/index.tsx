import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type { CourseMigrationResult, StoryblokRegion } from '../../../../shared/migrationTypes';

const STORAGE_KEY = 'vls-content-migration-config';

type SavedConfig = {
  storyblokSpaceId: string;
  storyblokAccessToken: string;
  storyblokRegion: StoryblokRegion;
};

type StatusMessage = {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
};

function statusClass(type: StatusMessage['type']): string {
  return {
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[type];
}

function loadSavedConfig(): SavedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { storyblokSpaceId: '', storyblokAccessToken: '', storyblokRegion: 'eu' };
    }
    const parsed = JSON.parse(raw) as SavedConfig;
    return {
      storyblokSpaceId: parsed.storyblokSpaceId ?? '',
      storyblokAccessToken: parsed.storyblokAccessToken ?? '',
      storyblokRegion: parsed.storyblokRegion === 'us' ? 'us' : 'eu',
    };
  } catch {
    return { storyblokSpaceId: '', storyblokAccessToken: '', storyblokRegion: 'eu' };
  }
}

export default function ContentMigrationTab() {
  const saved = loadSavedConfig();
  const [pageUrl, setPageUrl] = useState('');
  const [storyblokSpaceId, setStoryblokSpaceId] = useState(saved.storyblokSpaceId);
  const [storyblokAccessToken, setStoryblokAccessToken] = useState(saved.storyblokAccessToken);
  const [storyblokRegion, setStoryblokRegion] = useState<StoryblokRegion>(saved.storyblokRegion);
  const [publish, setPublish] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [result, setResult] = useState<CourseMigrationResult | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      storyblokSpaceId,
      storyblokAccessToken,
      storyblokRegion,
    }));
  }, [storyblokSpaceId, storyblokAccessToken, storyblokRegion]);

  function buildPayload(dryRun = false) {
    return {
      pageUrl: pageUrl.trim(),
      storyblokSpaceId: storyblokSpaceId.trim(),
      storyblokAccessToken: storyblokAccessToken.trim(),
      storyblokRegion,
      publish,
      dryRun,
    };
  }

  async function verifyStoryblok() {
    setVerifying(true);
    setMessage(null);
    try {
      const data = await api.post<{ spaceName: string }>('/migration/storyblok/verify', {
        storyblokSpaceId: storyblokSpaceId.trim(),
        storyblokAccessToken: storyblokAccessToken.trim(),
        storyblokRegion,
      });
      setMessage({ type: 'success', text: `Connected to Storyblok space: ${data.spaceName}` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Storyblok verification failed.',
      });
    } finally {
      setVerifying(false);
    }
  }

  async function previewScrape() {
    setPreviewing(true);
    setMessage(null);
    setResult(null);
    try {
      const data = await api.post<CourseMigrationResult>('/migration/course/preview', buildPayload(true));
      setResult(data);
      setMessage({
        type: data.warnings.length ? 'warning' : 'info',
        text: data.warnings.length
          ? `Scrape completed with ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}. Review the extracted sections below.`
          : 'Scrape completed. All major course sections were detected.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Scrape preview failed.',
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function migrateCourse() {
    setMigrating(true);
    setMessage(null);
    try {
      const data = await api.post<CourseMigrationResult>('/migration/course', buildPayload(false));
      setResult(data);
      setMessage({
        type: 'success',
        text: data.storyblok?.created
          ? `Created Storyblok course story at ${data.storyblok.fullSlug}.`
          : `Updated Storyblok course story at ${data.storyblok?.fullSlug ?? 'courses/' + data.scraped.slug}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Course migration failed.',
      });
    } finally {
      setMigrating(false);
    }
  }

  const scraped = result?.scraped;

  return (
    <div className="p-6">
      <div className="mb-6 max-w-3xl">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Content Migration</h2>
        <p className="text-xs text-slate-500">
          Scrape a live vls-online.com course page and create or update a Storyblok course story under the
          courses folder using the built course page components.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <Field label="Course page URL">
            <input
              className="input"
              placeholder="https://vls-online.com/courses/fa2"
              value={pageUrl}
              onChange={event => setPageUrl(event.target.value)}
            />
          </Field>

          <Field label="Storyblok space ID">
            <input
              className="input"
              placeholder="123456"
              value={storyblokSpaceId}
              onChange={event => setStoryblokSpaceId(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Numeric ID from Storyblok → Space settings → General.
            </p>
          </Field>

          <Field label="Storyblok personal access token">
            <input
              className="input"
              type="password"
              placeholder="Personal access token (Management API)"
              value={storyblokAccessToken}
              onChange={event => setStoryblokAccessToken(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Create at My account → Account settings → Personal access tokens.
              Enable Stories read/write for this space. Do not use the Preview/Public token from Space settings.
            </p>
          </Field>

          <Field label="Storyblok region">
            <select
              className="input"
              value={storyblokRegion}
              onChange={event => setStoryblokRegion(event.target.value as StoryblokRegion)}
            >
              <option value="eu">EU (mapi.storyblok.com)</option>
              <option value="us">US (api-us.storyblok.com)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Must match your space server region in Space settings → General.
            </p>
          </Field>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={publish}
              onChange={event => setPublish(event.target.checked)}
            />
            Publish story immediately after migration
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={verifyStoryblok}
              disabled={verifying || !storyblokSpaceId.trim() || !storyblokAccessToken.trim()}
              className="btn-ghost text-xs"
            >
              {verifying ? 'Verifying...' : 'Verify Storyblok'}
            </button>
            <button
              type="button"
              onClick={previewScrape}
              disabled={previewing || !pageUrl.trim()}
              className="btn-ghost text-xs"
            >
              {previewing ? 'Scraping...' : 'Preview Scrape'}
            </button>
            <button
              type="button"
              onClick={migrateCourse}
              disabled={migrating || !pageUrl.trim() || !storyblokSpaceId.trim() || !storyblokAccessToken.trim()}
              className="btn-primary text-xs"
            >
              {migrating ? 'Migrating...' : 'Migrate to Storyblok'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {message && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass(message.type)}`}>
              {message.text}
            </div>
          )}

          {result?.storyblok && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">
                {result.storyblok.created ? 'Story created' : 'Story updated'}: {result.storyblok.fullSlug}
              </p>
              <p className="mt-1 text-xs">Story ID: {result.storyblok.storyId}</p>
              <a
                href={result.storyblok.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-green-700 underline"
              >
                Open Storyblok preview
              </a>
            </div>
          )}

          {result?.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="mb-2 font-bold">Warnings</p>
              <ul className="list-disc space-y-1 pl-4">
                {result.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {scraped ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Scraped content summary</h3>
              </div>
              <div className="grid gap-4 p-4 text-xs text-slate-600 md:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">Page</p>
                  <p>{scraped.title}</p>
                  <p className="mt-1 text-slate-400">Slug: {scraped.slug}</p>
                  <p className="mt-1 text-slate-400">Zenler ID: {scraped.zenlerCourseId || 'Not found'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">SEO</p>
                  <p>{scraped.metaDescription || 'No description found'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Hero</p>
                  <p>{scraped.hero?.heading || 'Not detected'}</p>
                  <p className="mt-1">{scraped.hero?.description || 'No hero description'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Course description</p>
                  <p>{scraped.courseDescription?.title || 'Not detected'}</p>
                  <p className="mt-1 text-slate-400">
                    {scraped.courseDescription
                      ? `${scraped.courseDescription.source === 'cms' ? 'CMS component' : 'Page content'} · ${(scraped.courseDescription.introP1 || scraped.courseDescription.bodyText).slice(0, 120)}${(scraped.courseDescription.introP1 || scraped.courseDescription.bodyText).length > 120 ? '…' : ''}`
                      : 'No description section found between hero and tabs'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Sections detected</p>
                  <ul className="mt-1 space-y-1">
                    <li>Hero right items: {scraped.heroRight?.items.length ?? 0}</li>
                    <li>Course description: {scraped.courseDescription ? 'Yes' : 'No'}</li>
                    <li>Tabs: {scraped.tabs.length}</li>
                    <li>FAQ items: {scraped.faq?.items.length ?? 0}</li>
                    <li>Learn items: {scraped.hero?.learnItems.length ?? 0}</li>
                  </ul>
                </div>
                {scraped.tabs.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="font-semibold text-slate-700">Tabs</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {scraped.tabs.map(tab => (
                        <span key={tab.label} className="rounded bg-slate-100 px-2 py-1">
                          {tab.icon ? `${tab.icon} ` : ''}{tab.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Paste a course page URL, then use Preview Scrape to inspect extracted content before migrating to Storyblok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
