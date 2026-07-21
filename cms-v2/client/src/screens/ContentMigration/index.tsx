import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type {
  ComponentDraftResult,
  ContentPhaseResult,
  MigrationPageRecord,
  MigrationTemplate,
  PageScanResult,
  ScrapedCoursePage,
  ScrapedGenericPage,
  ScrapePhaseResult,
  StoryblokRegion,
  StructurePhaseResult,
  TemplateReferenceSummary,
} from '../../../../shared/migrationTypes';
import { MIGRATION_TEMPLATE_LABELS } from '../../../../shared/migrationTemplateLabels';
import { storyFullSlug, suggestDestinationSlug, isCoursePageTemplate } from '../../../../shared/migrationDestination';

const STORAGE_KEY = 'vls-content-migration-config';

type MigrationTemplateOption = TemplateReferenceSummary & { label: string };

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

function courseDescriptionPreviewParts(desc: NonNullable<ScrapedCoursePage['courseDescription']>) {
  return [
    desc.title ? { label: 'Section title', text: desc.title } : null,
    desc.introBold ? { label: 'Heading', text: desc.introBold } : null,
    desc.introP1 ? { label: 'Paragraph 1', text: desc.introP1 } : null,
    desc.introP2 ? { label: 'Paragraph 2', text: desc.introP2 } : null,
    desc.bodyText ? { label: 'Expanded body', text: desc.bodyText } : null,
  ].filter((part): part is { label: string; text: string } => Boolean(part?.text.trim()));
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

function isCoursePage(scraped: ScrapedCoursePage | ScrapedGenericPage): scraped is ScrapedCoursePage {
  return 'hero' in scraped;
}

/** api.post rejects with `err.data` set to whatever the backend put in the JSON `data` field — shape varies by error type. */
function describeApiError(error: unknown, fallback: string): string {
  const err = error as Error & { data?: unknown };
  const base = err instanceof Error && err.message ? err.message : fallback;
  if (Array.isArray(err.data)) {
    const extra = err.data.filter((item): item is string => typeof item === 'string').join(' ');
    return extra ? `${base} ${extra}`.trim() : base;
  }
  if (err.data && typeof err.data === 'object') {
    return `${base} ${JSON.stringify(err.data)}`.trim();
  }
  return base;
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function pageStatusLabel(page: MigrationPageRecord): string {
  if (page.migratedAt) return 'Migrated';
  if (page.draftStoryId) return 'Structure ready';
  if (page.scrapedAt) return 'Scraped';
  return 'Not started';
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
  const [scraping, setScraping] = useState(false);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [migratingContent, setMigratingContent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [migrationTemplates, setMigrationTemplates] = useState<MigrationTemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateReference, setTemplateReference] = useState<TemplateReferenceSummary | null>(null);

  const [scrapeResult, setScrapeResult] = useState<ScrapePhaseResult | null>(null);
  const [structureResult, setStructureResult] = useState<StructurePhaseResult | null>(null);
  const [contentResult, setContentResult] = useState<ContentPhaseResult | null>(null);

  const [componentDraft, setComponentDraft] = useState<ComponentDraftResult | null>(null);
  const [componentDraftLoading, setComponentDraftLoading] = useState(false);
  const [componentCreating, setComponentCreating] = useState(false);
  const [componentNameText, setComponentNameText] = useState('');
  const [componentSchemaText, setComponentSchemaText] = useState('');
  const [componentTsxText, setComponentTsxText] = useState('');
  const [componentTypeText, setComponentTypeText] = useState('');
  const [componentCreated, setComponentCreated] = useState<{ componentName: string } | null>(null);

  const selectedPage = useMemo(
    () => pages.find(page => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const pageUrl = selectedPage?.originUrl ?? '';
  const hasCredentials = Boolean(storyblokSpaceId.trim() && storyblokAccessToken.trim());
  const canGenerateStructure = Boolean(selectedPage?.scrapedAt || scrapeResult);
  const canMigrateContent = Boolean(selectedPage?.draftStoryId || structureResult?.draftStory);

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
    setDestinationSlug(
      selectedPage.destinationSlug?.trim()
      || suggestDestinationSlug(selectedPage.originUrl, selectedPage.template),
    );
    setDestinationTouched(false);
  }, [selectedPage]);

  useEffect(() => {
    setLoadingTemplates(true);
    api.get<MigrationTemplateOption[]>('/migration/templates')
      .then(templates => {
        const byKey = new Map(templates.map(item => [item.template, item]));
        const merged = (Object.entries(MIGRATION_TEMPLATE_LABELS) as Array<[MigrationTemplate, string]>)
          .map(([value, label]) => byKey.get(value) ?? {
            template: value,
            label,
            fileName: '',
            sectionCount: 0,
            sections: [],
          });
        setMigrationTemplates(merged);
        const match = merged.find(item => item.template === template) ?? null;
        setTemplateReference(match);
      })
      .catch(() => {
        const fallback = (Object.entries(MIGRATION_TEMPLATE_LABELS) as Array<[MigrationTemplate, string]>)
          .map(([value, label]) => ({
            template: value,
            label,
            fileName: '',
            sectionCount: 0,
            sections: [],
          }));
        setMigrationTemplates(fallback);
        setTemplateReference(fallback.find(item => item.template === template) ?? null);
      })
      .finally(() => setLoadingTemplates(false));
  }, [template]);

  function credentialsPayload() {
    return {
      storyblokSpaceId: storyblokSpaceId.trim(),
      storyblokAccessToken: storyblokAccessToken.trim(),
      storyblokRegion,
    };
  }

  function resetPhaseResults() {
    setScrapeResult(null);
    setStructureResult(null);
    setContentResult(null);
    resetComponentDraft();
  }

  function resetComponentDraft() {
    setComponentDraft(null);
    setComponentNameText('');
    setComponentSchemaText('');
    setComponentTsxText('');
    setComponentTypeText('');
    setComponentCreated(null);
  }

  function applyPageUpdate(updated: MigrationPageRecord) {
    setPages(current => current.map(page => (page.id === updated.id ? updated : page)));
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
      const data = await api.post<{ spaceName: string }>('/migration/storyblok/verify', credentialsPayload());
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

  async function persistPageSettings() {
    if (!selectedPage || !destinationSlug.trim()) return;
    try {
      const updated = await api.patch<MigrationPageRecord>(`/migration/pages/${selectedPage.id}`, {
        template,
        destinationSlug: destinationSlug.trim(),
      });
      setPages(current => current.map(page => (page.id === updated.id ? updated : page)));
    } catch {
      // Non-blocking — migration can still proceed with the last saved values
    }
  }

  async function runScrape() {
    if (!selectedPage) return;
    await persistPageSettings();
    setScraping(true);
    setMessage(null);
    resetPhaseResults();
    try {
      const data = await api.post<ScrapePhaseResult>(`/migration/pages/${selectedPage.id}/scrape`, {});
      setScrapeResult(data);
      applyPageUpdate(data.page);
      setMessage({
        type: data.warnings.length ? 'warning' : 'info',
        text: data.warnings.length
          ? `Scrape completed with ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}. Review the extracted content below.`
          : 'Scrape completed. All major sections were detected.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Preview scrape failed.',
      });
    } finally {
      setScraping(false);
    }
  }

  async function runGenerateStructure() {
    if (!selectedPage) return;
    await persistPageSettings();
    setGeneratingStructure(true);
    setMessage(null);
    setStructureResult(null);
    setContentResult(null);
    resetComponentDraft();
    try {
      const data = await api.post<StructurePhaseResult>(`/migration/pages/${selectedPage.id}/structure`, credentialsPayload());
      setStructureResult(data);
      applyPageUpdate(data.page);
      if (data.missingComponents.length) {
        setMessage({
          type: 'error',
          text: `Blocked: ${data.missingComponents.length} component${data.missingComponents.length === 1 ? '' : 's'} missing in Storyblok. See the list below.`,
        });
      } else if (!data.draftStory) {
        setMessage({
          type: 'error',
          text: `Blocked: this page's live layout doesn't match the "${selectedPage.template}" template. See the unmatched sections below.`,
        });
      } else if (data.unmatchedSections.length) {
        setMessage({
          type: 'success',
          text: `Draft structure ${data.draftStory.created ? 'created' : 'updated'} at ${data.draftStory.fullSlug}. ${data.unmatchedSections.length} section(s) had no matching live content and will be skipped in Migrate Content.`,
        });
      } else {
        setMessage({
          type: 'success',
          text: `Draft structure ${data.draftStory?.created ? 'created' : 'updated'} at ${data.draftStory?.fullSlug}.`,
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Generate structure failed.') });
    } finally {
      setGeneratingStructure(false);
    }
  }

  async function runMigrateContent() {
    if (!selectedPage) return;
    await persistPageSettings();
    setMigratingContent(true);
    setMessage(null);
    try {
      const data = await api.post<ContentPhaseResult>(`/migration/pages/${selectedPage.id}/content`, {
        ...credentialsPayload(),
        publish,
      });
      setContentResult(data);
      applyPageUpdate(data.page);
      setMessage({
        type: 'success',
        text: data.storyblok.created
          ? `Created Storyblok story at ${data.storyblok.fullSlug}.`
          : `Updated Storyblok story at ${data.storyblok.fullSlug}.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Migrate content failed.') });
    } finally {
      setMigratingContent(false);
    }
  }

  async function runGenerateComponent() {
    if (!selectedPage) return;
    setComponentDraftLoading(true);
    setMessage(null);
    setComponentCreated(null);
    try {
      const data = await api.post<ComponentDraftResult>(
        `/migration/pages/${selectedPage.id}/generate-component`,
        credentialsPayload(),
      );
      setComponentDraft(data);
      setComponentNameText(data.componentName);
      setComponentSchemaText(JSON.stringify(data.storyblokSchema, null, 2));
      setComponentTsxText(data.tsxCode);
      setComponentTypeText(data.typeCode);
      setMessage({
        type: data.warnings.length ? 'warning' : 'info',
        text: 'Component draft generated from the live page. Review and edit before creating it in Storyblok.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Generate component failed.') });
    } finally {
      setComponentDraftLoading(false);
    }
  }

  async function runConfirmComponent() {
    if (!selectedPage) return;
    let parsedSchema: { components: Array<Record<string, unknown>> };
    try {
      parsedSchema = JSON.parse(componentSchemaText);
    } catch {
      setMessage({ type: 'error', text: 'Storyblok schema is not valid JSON — fix it before creating the component.' });
      return;
    }
    setComponentCreating(true);
    setMessage(null);
    try {
      const data = await api.post<{ page: MigrationPageRecord; componentName: string; created: boolean }>(
        `/migration/pages/${selectedPage.id}/confirm-component`,
        {
          ...credentialsPayload(),
          componentName: componentNameText.trim(),
          storyblokSchema: parsedSchema,
        },
      );
      applyPageUpdate(data.page);
      setComponentCreated({ componentName: data.componentName });
      setMessage({
        type: 'success',
        text: `Component "${data.componentName}" ${data.created ? 'created' : 'already existed'} in Storyblok.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Create component failed.') });
    } finally {
      setComponentCreating(false);
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

  function selectPage(id: number | null) {
    setSelectedPageId(id);
    setDestinationTouched(false);
    resetPhaseResults();
  }

  const scraped = scrapeResult?.scraped;
  const courseScraped = scraped && isCoursePage(scraped) ? scraped : null;
  const genericScraped = scraped && !isCoursePage(scraped) ? scraped : null;

  const fullyBlocked = Boolean(
    structureResult && !structureResult.draftStory && structureResult.unmatchedSections.length > 0,
  );

  return (
    <div className="p-6">
      <div className="mb-6 max-w-4xl">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Content Migration</h2>
        <p className="text-xs text-slate-500">
          Scan the live VLS site once to populate all pages, then work through the 3 migration phases for each page:
          Preview Scrape, Generate Structure, Migrate Content. Course and study notes stories are created under the
          <code className="mx-1">courses/</code> folder (e.g. <code>courses/cima-notes</code>); all other templates
          are created at the Storyblok root. Pages are scraped from Zenler internal URLs for reliability.
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
                selectPage(Number.isInteger(id) ? id : null);
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
                    {page.path} {page.title ? `— ${page.title}` : ''} [{pageStatusLabel(page)}]
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
              disabled={loadingTemplates || !migrationTemplates.length}
            >
              {loadingTemplates ? (
                <option value="">Loading templates...</option>
              ) : (
                migrationTemplates.map(item => (
                  <option key={item.template} value={item.template}>{item.label}</option>
                ))
              )}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Course and study notes pages go to <code>courses/</code> (e.g. <code>courses/cima-notes</code>);
              all other templates go to the Storyblok root.
              {templateReference?.fileName ? (
                <> Reference HTML: <code>templates/{templateReference.fileName}</code> ({templateReference.sectionCount} sections).</>
              ) : null}
            </p>
          </Field>

          <Field label="Destination URL (Storyblok story slug)">
            <input
              className="input"
              placeholder="e.g. cima-notes or privacy-policy"
              value={destinationSlug}
              onChange={event => {
                setDestinationSlug(event.target.value);
                setDestinationTouched(true);
              }}
              onBlur={() => void handleDestinationBlur()}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Auto-suggested from the origin URL using SEO-friendly slugs. Edit before generating structure if needed.
              {selectedPage && !destinationTouched ? ` Suggested: ${selectedPage.suggestedDestination}` : ''}
            </p>
            {destinationSlug ? (
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Story path: {storyFullSlug(template, destinationSlug)}
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
            Publish story when migrating content
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={verifyStoryblok}
              disabled={verifying || !hasCredentials}
              className="btn-ghost text-xs"
            >
              {verifying ? 'Verifying...' : 'Verify Storyblok'}
            </button>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">3-phase workflow</p>
            <button
              type="button"
              onClick={runScrape}
              disabled={scraping || !pageUrl.trim()}
              className="btn-ghost w-full justify-start text-xs"
            >
              {scraping ? 'Scraping...' : '1. Preview Scrape'}
            </button>
            <button
              type="button"
              onClick={runGenerateStructure}
              disabled={generatingStructure || !canGenerateStructure || !hasCredentials}
              className="btn-ghost w-full justify-start text-xs"
              title={!canGenerateStructure ? 'Run Preview Scrape first' : undefined}
            >
              {generatingStructure ? 'Generating...' : '2. Generate Structure'}
            </button>
            {fullyBlocked ? (
              <button
                type="button"
                onClick={runGenerateComponent}
                disabled={componentDraftLoading || !hasCredentials}
                className="btn-ghost w-full justify-start text-xs"
                title="This page's layout matches no template — generate a custom component from its live HTML"
              >
                {componentDraftLoading ? 'Analyzing page...' : '2b. Generate Component'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={runMigrateContent}
              disabled={migratingContent || !canMigrateContent || !hasCredentials}
              className="btn-primary w-full justify-start text-xs"
              title={!canMigrateContent ? 'Run Generate Structure first' : undefined}
            >
              {migratingContent ? 'Migrating...' : '3. Migrate Content'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {message && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass(message.type)}`}>
              {message.text}
            </div>
          )}

          {scrapeResult?.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="mb-2 font-bold">Scrape warnings</p>
              <ul className="list-disc space-y-1 pl-4">
                {scrapeResult.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {structureResult && structureResult.missingComponents.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <p className="mb-2 font-bold">Missing components — Generate Structure stopped</p>
              <p className="mb-2">
                These components (or renderers in vls-online-v2) don't exist yet. Ask for them to be built, then run
                Generate Structure again.
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {structureResult.missingComponents.map(component => (
                  <li key={component}><code>{component}</code></li>
                ))}
              </ul>
            </div>
          )}

          {structureResult && structureResult.unmatchedSections.length > 0 && (
            <div className={`rounded-lg border px-4 py-3 text-xs ${structureResult.draftStory ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              <p className="mb-2 font-bold">
                {structureResult.draftStory ? 'Sections skipped — no matching live content' : 'Unmatched sections — Generate Structure stopped'}
              </p>
              <p className="mb-2">
                {structureResult.draftStory
                  ? 'These template sections had nothing matching on the live page, so Migrate Content will leave them out rather than filling them with the template reference file\'s sample copy.'
                  : `None of this template's sections match the live page's actual layout. This page's real structure needs its own component(s) built (e.g. for its sidebar/list layout) instead of being forced into this template.`}
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {structureResult.unmatchedSections.map(section => (
                  <li key={section}>{section}</li>
                ))}
              </ul>
            </div>
          )}

          {componentDraft && (
            <div className="space-y-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Generate Component — review before creating</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Best-effort guess from the live page's HTML. Edit anything below before creating the component —
                  none of this is written anywhere until you click "Create Component in Storyblok".
                </p>
              </div>

              {componentDraft.warnings.length ? (
                <div className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <ul className="list-disc space-y-1 pl-4">
                    {componentDraft.warnings.map(warning => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="px-4">
                <Field label="Component name">
                  <input
                    className="input"
                    value={componentNameText}
                    onChange={event => setComponentNameText(event.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-3 p-4 pt-0">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Storyblok schema (JSON)</p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(componentSchemaText)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    className="input h-48 w-full font-mono text-[11px] leading-relaxed"
                    value={componentSchemaText}
                    onChange={event => setComponentSchemaText(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">TSX renderer (for vls-online-v2)</p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(componentTsxText)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    className="input h-64 w-full font-mono text-[11px] leading-relaxed"
                    value={componentTsxText}
                    onChange={event => setComponentTsxText(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">TypeScript types (for vls-online-v2)</p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(componentTypeText)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    className="input h-40 w-full font-mono text-[11px] leading-relaxed"
                    value={componentTypeText}
                    onChange={event => setComponentTypeText(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={runConfirmComponent}
                  disabled={componentCreating || !hasCredentials || !componentNameText.trim()}
                  className="btn-primary text-xs"
                >
                  {componentCreating ? 'Creating...' : 'Create Component in Storyblok'}
                </button>
              </div>
            </div>
          )}

          {componentCreated && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">Component "{componentCreated.componentName}" created in Storyblok.</p>
              <p className="mt-1 text-xs">
                Copy the TSX/type code above into vls-online-v2 (<code>templateSections.tsx</code>,{' '}
                <code>types/storyblok.ts</code>, and register it in <code>StoryblokBloks.tsx</code>), then re-run
                Generate Structure to build the draft story from this component.
              </p>
            </div>
          )}

          {structureResult?.componentLibrary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">Component library synced</p>
              <p className="mt-1 text-xs">
                {structureResult.componentLibrary.presetsCreated} created, {structureResult.componentLibrary.presetsUpdated} updated in
                {' '}<code>{structureResult.componentLibrary.folderSlug}/{template}</code>
              </p>
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-blue-800">
                {structureResult.componentLibrary.presets.map(preset => (
                  <li key={preset.fullSlug}>{preset.fullSlug} → {preset.component}</li>
                ))}
              </ul>
            </div>
          )}

          {(structureResult?.templateReference ?? templateReference) && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">
                Template reference: templates/{(structureResult?.templateReference ?? templateReference)?.fileName}
              </p>
              <ul className="mt-2 space-y-1">
                {(structureResult?.templateReference ?? templateReference)?.sections.map(section => {
                  const refTemplate = (structureResult?.templateReference ?? templateReference)?.template;
                  const isCourseTemplate = isCoursePageTemplate(template)
                    || (refTemplate != null && isCoursePageTemplate(refTemplate));
                  const source = genericScraped?.sectionMatchSource?.[section.key];
                  const confidence = genericScraped?.sectionMatchConfidence?.[section.key];
                  return (
                    <li key={section.key} className="flex items-center gap-2">
                      <span>{section.label} → {section.component}</span>
                      {isCourseTemplate ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Course blueprint
                        </span>
                      ) : source === 'live' ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Live match</span>
                      ) : source === 'ai' ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          AI-matched{confidence !== undefined ? ` · ${Math.round(confidence * 100)}% confidence` : ''}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Unmatched</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {structureResult?.draftStory && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">
                {structureResult.draftStory.created ? 'Draft story created' : 'Draft story updated'}: {structureResult.draftStory.fullSlug}
              </p>
              <p className="mt-1 text-xs">Story ID: {structureResult.draftStory.storyId} (unpublished)</p>
              <a
                href={structureResult.draftStory.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-green-700 underline"
              >
                Open draft in Storyblok
              </a>
            </div>
          )}

          {contentResult?.storyblok && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">
                {contentResult.storyblok.created ? 'Story created' : 'Story updated'}: {contentResult.storyblok.fullSlug}
              </p>
              <p className="mt-1 text-xs">Story ID: {contentResult.storyblok.storyId}</p>
              <a
                href={contentResult.storyblok.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-green-700 underline"
              >
                Open Storyblok preview
              </a>
            </div>
          )}

          {contentResult?.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="mb-2 font-bold">Migrate content warnings</p>
              <ul className="list-disc space-y-1 pl-4">
                {contentResult.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {courseScraped ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Scraped course content (full detail)</h3>
              </div>
              <div className="space-y-4 p-4 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-700">Page</p>
                  <p>{courseScraped.title}</p>
                  <p className="mt-1 text-slate-400">Slug: {courseScraped.slug}</p>
                  <p className="mt-1 text-slate-400">Zenler ID: {courseScraped.zenlerCourseId || 'Not found'}</p>
                  <p className="mt-1">{courseScraped.metaDescription || 'No meta description found'}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-700">Hero</p>
                  <p>{courseScraped.hero?.heading || 'Not detected'}</p>
                  <p className="mt-1">{courseScraped.hero?.description || 'No hero description'}</p>
                  {courseScraped.hero?.breadcrumbItems.length ? (
                    <ul className="mt-2 space-y-1">
                      {courseScraped.hero.breadcrumbItems.map(item => (
                        <li key={`${item.label}-${item.url}`}>{item.label} → {item.url}</li>
                      ))}
                    </ul>
                  ) : null}
                  {courseScraped.hero?.learnItems.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {courseScraped.hero.learnItems.map(item => (
                        <li key={item.title}>
                          <span className="font-medium">{item.title}</span>
                          {item.subtitle ? ` — ${item.subtitle}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {courseScraped.heroRight?.items.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Hero right — {courseScraped.heroRight.label}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {courseScraped.heroRight.items.map(item => (
                        <li key={item.title}>{item.icon} {item.title} — {item.description}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {courseScraped.courseDescription ? (() => {
                  const descriptionParts = courseDescriptionPreviewParts(courseScraped.courseDescription);
                  return (
                  <div>
                    <p className="font-semibold text-slate-700">
                      Course description
                      {courseScraped.courseDescription.source
                        ? ` (${courseScraped.courseDescription.source})`
                        : ''}
                    </p>
                    {descriptionParts.length ? (
                      <div className="mt-2 space-y-3">
                        {descriptionParts.map(part => (
                          <div key={part.label}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{part.label}</p>
                            <p className="mt-1 whitespace-pre-wrap">{part.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-slate-400">Description block found but no text extracted.</p>
                    )}
                  </div>
                  );
                })() : null}

                {courseScraped.tabs.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700">Tabs ({courseScraped.tabs.length})</p>
                    <div className="mt-2 space-y-3">
                      {courseScraped.tabs.map(tab => (
                        <div key={tab.label} className="rounded border border-slate-200 p-2">
                          <p className="font-medium text-slate-700">{tab.icon ? `${tab.icon} ` : ''}{tab.label}</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-500">{tab.contentText}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="font-semibold text-slate-700">FAQ ({courseScraped.faq?.items.length ?? 0} items)</p>
                  {courseScraped.faq?.items.length ? (
                    <div className="mt-2 space-y-2">
                      {courseScraped.faq.items.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded border border-slate-200 p-2">
                          <p className="font-medium text-slate-700">Q: {item.question}</p>
                          <p className="mt-1 text-slate-500">A: {item.answerText}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-400">No FAQ detected.</p>
                  )}
                </div>

                {courseScraped.testimonials?.cards.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Testimonials ({courseScraped.testimonials.cards.length})</p>
                    <div className="mt-2 space-y-2">
                      {courseScraped.testimonials.cards.map((card, index) => (
                        <div key={`${card.author}-${index}`} className="rounded border border-slate-200 p-2">
                          <p className="italic text-slate-600">&ldquo;{card.quote}&rdquo;</p>
                          <p className="mt-1 text-slate-400">— {card.author}{card.role ? `, ${card.role}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {courseScraped.promotion ? (
                  <div>
                    <p className="font-semibold text-slate-700">Promotion</p>
                    <p className="mt-1">{courseScraped.promotion.title}</p>
                    <p className="mt-1 text-slate-500">{courseScraped.promotion.subtitle}</p>
                  </div>
                ) : null}

                <p>Course finder banner: {courseScraped.hasCourseFinderBanner ? 'Yes' : 'No'}</p>
              </div>
            </div>
          ) : genericScraped ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Scraped page content (full detail)</h3>
              </div>
              <div className="space-y-4 p-4 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-700">Page</p>
                  <p>{genericScraped.title}</p>
                  <p className="mt-1 text-slate-400">Slug: {genericScraped.slug}</p>
                  <p className="mt-1">{genericScraped.metaDescription || 'No meta description found'}</p>
                </div>

                {genericScraped.breadcrumbItems.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Breadcrumb</p>
                    <ul className="mt-1 space-y-1">
                      {genericScraped.breadcrumbItems.map(item => (
                        <li key={`${item.label}-${item.url}`}>{item.label} → {item.url}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <p className="font-semibold text-slate-700">Content sections ({genericScraped.sections.length})</p>
                  <div className="mt-2 space-y-2">
                    {genericScraped.sections.map((section, index) => (
                      <div key={`${section.heading}-${index}`} className="rounded border border-slate-200 p-2">
                        {section.heading ? <p className="font-medium text-slate-700">{section.heading}</p> : null}
                        <p className="mt-1 whitespace-pre-wrap text-slate-500">{section.bodyText}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-700">FAQ ({genericScraped.faq?.items.length ?? 0} items)</p>
                  {genericScraped.faq?.items.length ? (
                    <div className="mt-2 space-y-2">
                      {genericScraped.faq.items.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded border border-slate-200 p-2">
                          <p className="font-medium text-slate-700">Q: {item.question}</p>
                          <p className="mt-1 text-slate-500">A: {item.answerText}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-400">No FAQ detected.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Scan the site once to populate pages, select an origin URL, then run Preview Scrape to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
