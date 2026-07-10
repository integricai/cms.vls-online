import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type {
  MigrationPageRecord,
  MigrationTemplate,
  PageMigrationResult,
  PageScanResult,
  ScrapedCoursePage,
  StoryblokRegion,
  TemplateReferenceSummary,
} from '../../../../shared/migrationTypes';
import { MIGRATION_TEMPLATE_LABELS } from '../../../../shared/migrationTemplateLabels';
import { suggestDestinationSlug } from '../../../../shared/migrationDestination';

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

function isCoursePage(scraped: PageMigrationResult['scraped']): scraped is ScrapedCoursePage {
  return 'hero' in scraped;
}

export default function ContentMigrationTab() {
  const saved = loadSavedConfig();
  const [pages, setPages] = useState<MigrationPageRecord[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [template, setTemplate] = useState<MigrationTemplate>('course');
  const [destinationSlug, setDestinationSlug] = useState('');
  const [destinationTouched, setDestinationTouched] = useState(false);
  const [storyblokSpaceId, setStoryblokSpaceId] = useState(saved.storyblokSpaceId);
  const [storyblokAccessToken, setStoryblokAccessToken] = useState(saved.storyblokAccessToken);
  const [storyblokRegion, setStoryblokRegion] = useState<StoryblokRegion>(saved.storyblokRegion);
  const [publish, setPublish] = useState(false);
  const [loadingPages, setLoadingPages] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [result, setResult] = useState<PageMigrationResult | null>(null);
  const [templateReference, setTemplateReference] = useState<TemplateReferenceSummary | null>(null);

  const selectedPage = useMemo(
    () => pages.find(page => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const pageUrl = selectedPage?.originUrl ?? '';

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const data = await api.get<MigrationPageRecord[]>('/migration/pages');
      setPages(data);
      if (!selectedPageId && data.length) {
        setSelectedPageId(data[0].id);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load migration pages.',
      });
    } finally {
      setLoadingPages(false);
    }
  }, [selectedPageId]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      storyblokSpaceId,
      storyblokAccessToken,
      storyblokRegion,
    }));
  }, [storyblokSpaceId, storyblokAccessToken, storyblokRegion]);

  useEffect(() => {
    if (!selectedPage) return;
    setTemplate(selectedPage.template);
    if (!destinationTouched) {
      setDestinationSlug(suggestDestinationSlug(selectedPage.originUrl, selectedPage.template));
    }
  }, [selectedPage, destinationTouched]);

  useEffect(() => {
    api.get<TemplateReferenceSummary[]>('/migration/templates')
      .then(templates => {
        const match = templates.find(item => item.template === template) ?? null;
        setTemplateReference(match);
      })
      .catch(() => setTemplateReference(null));
  }, [template]);

  function buildPayload(dryRun = false) {
    return {
      pageUrl: pageUrl.trim(),
      template,
      destinationSlug: destinationSlug.trim(),
      storyblokSpaceId: storyblokSpaceId.trim(),
      storyblokAccessToken: storyblokAccessToken.trim(),
      storyblokRegion,
      publish,
      dryRun,
    };
  }

  async function scanSitePages() {
    setScanning(true);
    setMessage(null);
    try {
      const data = await api.post<PageScanResult>('/migration/pages/scan', { fetchTitles: false });
      setPages(data.pages);
      if (data.pages.length && !selectedPageId) {
        setSelectedPageId(data.pages[0].id);
      }
      setMessage({
        type: 'success',
        text: `Scan complete. ${data.scanned} pages found (${data.inserted} new, ${data.updated} updated).`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Site scan failed.',
      });
    } finally {
      setScanning(false);
    }
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
      const data = await api.post<PageMigrationResult>('/migration/page/preview', buildPayload(true));
      setResult(data);
      if (data.templateReference) setTemplateReference(data.templateReference);
      setMessage({
        type: data.warnings.length ? 'warning' : 'info',
        text: data.warnings.length
          ? `Scrape completed with ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}. Review the extracted sections below.`
          : 'Scrape completed. All major sections were detected.',
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

  async function migratePage() {
    setMigrating(true);
    setMessage(null);
    try {
      const data = await api.post<PageMigrationResult>('/migration/page', buildPayload(false));
      setResult(data);
      if (data.templateReference) setTemplateReference(data.templateReference);
      setMessage({
        type: 'success',
        text: data.storyblok?.created
          ? `Created Storyblok story at ${data.storyblok.fullSlug}.`
          : `Updated Storyblok story at ${data.storyblok?.fullSlug ?? data.fullSlug}.`,
      });
      await loadPages();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Page migration failed.',
      });
    } finally {
      setMigrating(false);
    }
  }

  async function handleTemplateChange(nextTemplate: MigrationTemplate) {
    setTemplate(nextTemplate);
    if (!selectedPage) return;

    if (!destinationTouched) {
      setDestinationSlug(suggestDestinationSlug(selectedPage.originUrl, nextTemplate));
    }

    try {
      await api.patch<MigrationPageRecord>(`/migration/pages/${selectedPage.id}`, {
        template: nextTemplate,
      });
      setPages(current => current.map(page => (
        page.id === selectedPage.id ? { ...page, template: nextTemplate } : page
      )));
    } catch {
      // Non-blocking — selection still works locally
    }
  }

  async function handleDestinationBlur() {
    if (!selectedPage || !destinationSlug.trim()) return;
    try {
      const updated = await api.patch<MigrationPageRecord>(`/migration/pages/${selectedPage.id}`, {
        destinationSlug: destinationSlug.trim(),
      });
      setPages(current => current.map(page => (page.id === updated.id ? updated : page)));
    } catch {
      // Non-blocking
    }
  }

  const scraped = result?.scraped;
  const courseScraped = scraped && isCoursePage(scraped) ? scraped : null;

  return (
    <div className="p-6">
      <div className="mb-6 max-w-4xl">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Content Migration</h2>
        <p className="text-xs text-slate-500">
          Scan the live VLS site once to populate all pages, then migrate each page to Storyblok.
          Course stories are created under the courses folder; all other templates are created at the root.
          Pages are scraped from Zenler internal URLs for reliability.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Site pages</p>
            <button
              type="button"
              onClick={scanSitePages}
              disabled={scanning}
              className="btn-primary text-xs"
            >
              {scanning ? 'Scanning...' : 'Scan site once'}
            </button>
          </div>

          <Field label="Origin URL">
            <select
              className="input"
              value={selectedPageId ?? ''}
              onChange={event => {
                const id = Number(event.target.value);
                setSelectedPageId(Number.isInteger(id) ? id : null);
                setDestinationTouched(false);
                setResult(null);
              }}
              disabled={loadingPages || !pages.length}
            >
              {loadingPages ? (
                <option value="">Loading pages...</option>
              ) : !pages.length ? (
                <option value="">Run a site scan to populate pages</option>
              ) : (
                pages.map(page => (
                  <option key={page.id} value={page.id}>
                    {page.path} {page.title ? `— ${page.title}` : ''}
                  </option>
                ))
              )}
            </select>
            {selectedPage ? (
              <p className="mt-1 break-all text-[11px] text-slate-400">{selectedPage.originUrl}</p>
            ) : null}
          </Field>

          <Field label="Template">
            <select
              className="input"
              value={template}
              onChange={event => void handleTemplateChange(event.target.value as MigrationTemplate)}
            >
              {(Object.entries(MIGRATION_TEMPLATE_LABELS) as Array<[MigrationTemplate, string]>).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Course pages go to <code>courses/</code>; all other templates go to the Storyblok root.
              {templateReference ? (
                <> Reference HTML: <code>templates/{templateReference.fileName}</code> ({templateReference.sectionCount} sections).</>
              ) : null}
            </p>
          </Field>

          <Field label="Destination URL (Storyblok story slug)">
            <input
              className="input"
              placeholder="e.g. courses/fa2 or privacy-policy"
              value={destinationSlug}
              onChange={event => {
                setDestinationSlug(event.target.value);
                setDestinationTouched(true);
              }}
              onBlur={() => void handleDestinationBlur()}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Auto-suggested from the origin URL using SEO-friendly slugs. Edit before migrating if needed.
              {selectedPage && !destinationTouched ? ` Suggested: ${selectedPage.suggestedDestination}` : ''}
            </p>
            {destinationSlug ? (
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Story path: {template === 'course' ? `courses/${destinationSlug.replace(/^courses\//, '')}` : destinationSlug}
              </p>
            ) : null}
          </Field>

          <Field label="Storyblok space ID">
            <input
              className="input"
              placeholder="123456"
              value={storyblokSpaceId}
              onChange={event => setStoryblokSpaceId(event.target.value)}
            />
          </Field>

          <Field label="Storyblok personal access token">
            <input
              className="input"
              type="password"
              placeholder="Personal access token (Management API)"
              value={storyblokAccessToken}
              onChange={event => setStoryblokAccessToken(event.target.value)}
            />
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
              onClick={migratePage}
              disabled={migrating || !pageUrl.trim() || !destinationSlug.trim() || !storyblokSpaceId.trim() || !storyblokAccessToken.trim()}
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

          {result?.componentLibrary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">Component library synced</p>
              <p className="mt-1 text-xs">
                {result.componentLibrary.presetsCreated} created, {result.componentLibrary.presetsUpdated} updated in
                {' '}<code>{result.componentLibrary.folderSlug}/{template}</code>
              </p>
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-blue-800">
                {result.componentLibrary.presets.map(preset => (
                  <li key={preset.fullSlug}>{preset.fullSlug} → {preset.component}</li>
                ))}
              </ul>
            </div>
          )}

          {result?.templateReference && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Template reference: templates/{result.templateReference.fileName}</p>
              <ul className="mt-2 space-y-1">
                {result.templateReference.sections.map(section => (
                  <li key={section.key}>{section.label} → {section.component}</li>
                ))}
              </ul>
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

          {courseScraped ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Scraped course content summary</h3>
              </div>
              <div className="grid gap-4 p-4 text-xs text-slate-600 md:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">Page</p>
                  <p>{courseScraped.title}</p>
                  <p className="mt-1 text-slate-400">Slug: {courseScraped.slug}</p>
                  <p className="mt-1 text-slate-400">Zenler ID: {courseScraped.zenlerCourseId || 'Not found'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">SEO</p>
                  <p>{courseScraped.metaDescription || 'No description found'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Hero</p>
                  <p>{courseScraped.hero?.heading || 'Not detected'}</p>
                  <p className="mt-1">{courseScraped.hero?.description || 'No hero description'}</p>
                  {courseScraped.hero?.breadcrumbItems.length ? (
                    <ul className="mt-2 space-y-1">
                      {courseScraped.hero.breadcrumbItems.map(item => (
                        <li key={`${item.label}-${item.url}`}>
                          {item.label} → {item.url}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Sections detected</p>
                  <ul className="mt-1 space-y-1">
                    <li>Hero right items: {courseScraped.heroRight?.items.length ?? 0}</li>
                    <li>Course description: {courseScraped.courseDescription ? 'Yes' : 'No'}</li>
                    <li>Tabs: {courseScraped.tabs.length}</li>
                    <li>FAQ items: {courseScraped.faq?.items.length ?? 0}</li>
                    <li>Testimonials: {courseScraped.testimonials?.cards.length ?? 0}</li>
                    <li>Promotion: {courseScraped.promotion ? 'Yes' : 'No'}</li>
                    <li>Course finder banner: {courseScraped.hasCourseFinderBanner ? 'Yes' : 'No'}</li>
                  </ul>
                </div>
                {courseScraped.tabs.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="font-semibold text-slate-700">Tabs</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {courseScraped.tabs.map(tab => (
                        <span key={tab.label} className="rounded bg-slate-100 px-2 py-1">
                          {tab.icon ? `${tab.icon} ` : ''}{tab.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : scraped ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Scraped page content summary</h3>
              </div>
              <div className="grid gap-4 p-4 text-xs text-slate-600 md:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">Page</p>
                  <p>{scraped.title}</p>
                  <p className="mt-1 text-slate-400">Slug: {scraped.slug}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Sections</p>
                  <p>{'sections' in scraped ? scraped.sections.length : 0} content sections</p>
                  <p className="mt-1">FAQ items: {'faq' in scraped ? scraped.faq?.items.length ?? 0 : 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Scan the site once to populate pages, select an origin URL, then preview or migrate to Storyblok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
