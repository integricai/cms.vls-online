import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import {
  normalizeCourseFinderConfig,
  type CourseFinderConfig,
  type CourseFinderCourse,
} from '../CourseFinder/generateHtml';
import { defaultCourseFinderBannerConfig, generateCourseFinderBannerHtml } from './generateHtml';

type ActiveTab = 'preview' | 'html';
type ConfigKey = keyof CourseFinderConfig;

const CONTENT_KEY = 'vls-course-finder-banner-config';
const FONT_FAMILIES = ['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Raleway', 'Oswald', 'Source Sans Pro', 'PT Sans', 'Arial', 'Georgia'];
const FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];
const TEXT_FIELDS: Array<[ConfigKey, string]> = [
  ['eyebrow', 'Eyebrow'],
  ['title', 'Title'],
  ['titleAccent', 'Title accent'],
  ['subtitle', 'Subtitle'],
  ['qualificationLabel', 'Qualification label'],
  ['levelLabel', 'Level label'],
  ['courseLabel', 'Course label'],
  ['optionLabel', 'Option label'],
  ['qualificationPlaceholder', 'Qualification placeholder'],
  ['levelPlaceholder', 'Level placeholder'],
  ['coursePlaceholder', 'Course placeholder'],
  ['optionPlaceholder', 'Option placeholder'],
  ['findButtonText', 'Find button text'],
  ['messageText', 'Validation message'],
  ['statCoursesLabel', 'Courses stat label'],
  ['statQualificationsLabel', 'Qualifications stat label'],
  ['statPapersLabel', 'Papers stat label'],
];

export default function CourseFinderBannerScreen() {
  const [courses, setCourses] = useState<CourseFinderCourse[]>([]);
  const [config, setConfig] = useState<CourseFinderConfig>(defaultCourseFinderBannerConfig);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  async function loadData() {
    setError('');
    setLoading(true);
    try {
      const [rows, configRow] = await Promise.all([
        api.get<CourseFinderCourse[]>('/courses/active'),
        api.get<{ data: Partial<CourseFinderConfig> }>(`/content/${CONTENT_KEY}`).catch(() => null),
      ]);
      const saved = normalizeCourseFinderConfig({ ...defaultCourseFinderBannerConfig, ...(configRow?.data || {}) });
      setCourses(rows);
      setConfig(saved);
      setPreviewHtml(wrapGeneratedHtml('Course Finder Banner', generateCourseFinderBannerHtml(rows, saved)));
      setActiveTab('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setError('');
    setSavingConfig(true);
    try {
      await api.put(`/content/${CONTENT_KEY}`, config);
      setSavedConfig(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Course Finder Banner settings');
      return false;
    } finally {
      setSavingConfig(false);
    }
  }

  async function generateHtml() {
    setError('');
    const saved = await saveConfig();
    if (!saved) return;
    setPreviewHtml(wrapGeneratedHtml('Course Finder Banner', generateCourseFinderBannerHtml(courses, config)));
    setActiveTab('preview');
  }

  function updateConfig(patch: Partial<CourseFinderConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
    setSavedConfig(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading courses...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Course Finder Banner</h1>
          <p className="mt-0.5 text-xs text-slate-400">Dropdown banner for Zenler — paste once, course data loads live from the CMS API</p>
        </div>

        <div className="flex gap-2 border-b border-slate-100 bg-white px-5 py-3">
          <button onClick={() => void generateHtml()} className="btn-success flex-1 justify-center" disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save & Generate HTML'}
          </button>
          <button onClick={loadData} className="btn-ghost flex-1 justify-center" disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="section-label mt-0">Local Course Table</p>
            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-2xl font-bold text-slate-900">{courses.length}</div>
                <div className="text-xs text-slate-400">Active courses</div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Paste the full generated HTML into a Zenler custom HTML block. The banner loads an external script from the CMS API (required for Zenler). After updating this component, click Save &amp; Generate HTML and replace the old paste on your page.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <p className="section-label">Text Fields</p>
          <div className="space-y-2">
            {TEXT_FIELDS.map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
                <input className="input" value={String(config[key] ?? '')} onChange={e => updateConfig({ [key]: e.target.value } as Partial<CourseFinderConfig>)} />
              </label>
            ))}
          </div>

          <p className="section-label">Typography</p>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Font family</span>
              <select className="input" value={config.fontFamily} onChange={e => updateConfig({ fontFamily: e.target.value })}>
                {FONT_FAMILIES.map(font => <option key={font} value={font}>{font}</option>)}
              </select>
            </label>
            {([
              ['eyebrow', 'Eyebrow'],
              ['title', 'Title'],
              ['subtitle', 'Subtitle'],
              ['label', 'Dropdown labels'],
              ['button', 'Buttons'],
            ] as const).map(([prefix, label]) => (
              <div key={prefix} className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500">{label} size</span>
                  <input type="number" className="input" min={8} max={80} value={Number(config[`${prefix}Size` as ConfigKey])} onChange={e => updateConfig({ [`${prefix}Size`]: Number(e.target.value) } as Partial<CourseFinderConfig>)} />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500">{label} weight</span>
                  <select className="input" value={String(config[`${prefix}Weight` as ConfigKey])} onChange={e => updateConfig({ [`${prefix}Weight`]: Number(e.target.value) } as Partial<CourseFinderConfig>)}>
                    {FONT_WEIGHTS.map(weight => <option key={weight} value={weight}>{weight}</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={saveConfig} disabled={savingConfig} className="btn-primary flex-1 justify-center">
              {savingConfig ? 'Saving...' : savedConfig ? 'Saved' : 'Save Settings'}
            </button>
            <button onClick={() => updateConfig(defaultCourseFinderBannerConfig)} className="btn-ghost flex-1 justify-center">
              Reset Defaults
            </button>
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
              {tab === 'html' ? 'HTML (Zenler Paste)' : 'Preview'}
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
