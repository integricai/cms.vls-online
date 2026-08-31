import { useEffect, useRef, useState } from 'react';
import { api, getCurrentUser, getToken } from '../../api/client';

type Course = {
  id: number;
  zenlerCourseId: string;
  name: string;
  status: string | null;
  isActive: boolean;
  enableInBanner: boolean;
  enableInNavigation: boolean;
  sortOrder: number;
  qualification: string | null;
  courseLevel: string | null;
  courseLevels: string[];
  courseOption: string | null;
  coursePageUrl: string | null;
  lastSyncedAt: string | null;
};

type CourseDropdownKind = 'qualification' | 'level' | 'course_option';

type CourseDropdownOption = {
  id: number;
  kind: CourseDropdownKind;
  value: string;
  sortOrder: number;
  isActive: boolean;
};

type SyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  deactivated: number;
  syncedAt: string;
  storyblokDatasource?: {
    ok: boolean;
    created: number;
    updated: number;
    deleted: number;
    error?: string;
  };
  salesPageUrls?: {
    ok: boolean;
    scanned: number;
    updated: number;
    unchanged: number;
    unmatched: number;
    error?: string;
  };
};

type PageUrlImportResult = {
  updated: number;
  cleared: number;
  skipped: number;
  errors: Array<{ rowNumber: number; zenlerCourseId: string; message: string }>;
};

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadCoursesCsv(): Promise<void> {
  const token = getToken();
  const base = (import.meta.env.VITE_API_URL ?? '') + '/api';
  const res = await fetch(`${base}/courses/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to download courses CSV');
  downloadText('cms-courses.csv', await res.text());
}

function CoursesTab() {
  const isAdmin = getCurrentUser()?.role === 'admin';
  const [courses, setCourses] = useState<Course[]>([]);
  const [options, setOptions] = useState<Record<CourseDropdownKind, string[]>>({
    qualification: [],
    level: [],
    course_option: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingOptions, setSavingOptions] = useState(false);
  const [savingCourseId, setSavingCourseId] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<string | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggingCourseId, setDraggingCourseId] = useState<number | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<PageUrlImportResult | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Course[]>('/courses'),
      api.get<CourseDropdownOption[]>('/courses/dropdown-options'),
    ])
      .then(([courseData, optionData]) => {
        setCourses(courseData || []);
        setOptions(groupOptions(optionData || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function groupOptions(rows: CourseDropdownOption[]): Record<CourseDropdownKind, string[]> {
    return {
      qualification: rows.filter(row => row.kind === 'qualification').map(row => row.value),
      level: rows.filter(row => row.kind === 'level').map(row => row.value),
      course_option: rows.filter(row => row.kind === 'course_option').map(row => row.value),
    };
  }

  async function sync() {
    setSyncing(true); setSyncResult(null); setSyncError(null);
    try {
      const result = await api.post<SyncResult>('/courses/sync', {});
      setSyncResult(result);
      const fresh = await api.get<Course[]>('/courses');
      setCourses(fresh || []);
      setOrderDirty(false);
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

  function patchCourse(id: number, update: Partial<Course>) {
    setCourses(prev => prev.map(course => course.id === id ? { ...course, ...update } : course));
  }

  function moveCourse(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= courses.length) return;
    const next = [...courses];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setCourses(next.map((course, sortIndex) => ({ ...course, sortOrder: sortIndex + 1 })));
    setOrderDirty(true);
  }

  function moveCourseTo(fromId: number, toId: number) {
    if (fromId === toId) return;
    setCourses(prev => {
      const fromIndex = prev.findIndex(course => course.id === fromId);
      const toIndex = prev.findIndex(course => course.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next.map((course, sortIndex) => ({ ...course, sortOrder: sortIndex + 1 }));
    });
    setOrderDirty(true);
  }

  async function saveCourse(course: Course) {
    setSavingCourseId(course.id);
    setSyncError(null);
    try {
      const saved = await api.put<Course>(`/courses/${course.id}`, {
        isActive: course.isActive,
        enableInBanner: course.enableInBanner,
        enableInNavigation: course.enableInNavigation,
        sortOrder: course.sortOrder,
        qualification: course.qualification,
        courseLevel: course.courseLevel,
        courseLevels: course.courseLevels || [],
        courseOption: course.courseOption,
        coursePageUrl: course.coursePageUrl,
      });
      patchCourse(course.id, saved);
    } catch (e) {
      setSyncError((e instanceof Error ? e.message : null) || 'Course save failed.');
    } finally {
      setSavingCourseId(null);
    }
  }

  async function saveCourseActive(course: Course, isActive: boolean) {
    patchCourse(course.id, { isActive });
    setSavingCourseId(course.id);
    setSyncError(null);
    try {
      const saved = await api.put<Course>(`/courses/${course.id}`, {
        isActive,
        enableInBanner: course.enableInBanner,
        enableInNavigation: course.enableInNavigation,
        sortOrder: course.sortOrder,
        qualification: course.qualification,
        courseLevel: course.courseLevel,
        courseLevels: course.courseLevels || [],
        courseOption: course.courseOption,
      });
      patchCourse(course.id, saved);
    } catch (e) {
      patchCourse(course.id, { isActive: course.isActive });
      setSyncError((e instanceof Error ? e.message : null) || 'Course enabled state save failed.');
    } finally {
      setSavingCourseId(null);
    }
  }

  async function saveCourseBannerEnabled(course: Course, enableInBanner: boolean) {
    patchCourse(course.id, { enableInBanner });
    setSavingCourseId(course.id);
    setSyncError(null);
    try {
      const saved = await api.put<Course>(`/courses/${course.id}`, {
        isActive: course.isActive,
        enableInBanner,
        enableInNavigation: course.enableInNavigation,
        sortOrder: course.sortOrder,
        qualification: course.qualification,
        courseLevel: course.courseLevel,
        courseLevels: course.courseLevels || [],
        courseOption: course.courseOption,
      });
      patchCourse(course.id, saved);
    } catch (e) {
      patchCourse(course.id, { enableInBanner: course.enableInBanner });
      setSyncError((e instanceof Error ? e.message : null) || 'Banner enabled state save failed.');
    } finally {
      setSavingCourseId(null);
    }
  }

  async function saveCourseNavigationEnabled(course: Course, enableInNavigation: boolean) {
    patchCourse(course.id, { enableInNavigation });
    setSavingCourseId(course.id);
    setSyncError(null);
    try {
      const saved = await api.put<Course>(`/courses/${course.id}`, {
        isActive: course.isActive,
        enableInBanner: course.enableInBanner,
        enableInNavigation,
        sortOrder: course.sortOrder,
        qualification: course.qualification,
        courseLevel: course.courseLevel,
        courseLevels: course.courseLevels || [],
        courseOption: course.courseOption,
      });
      patchCourse(course.id, saved);
    } catch (e) {
      patchCourse(course.id, { enableInNavigation: course.enableInNavigation });
      setSyncError((e instanceof Error ? e.message : null) || 'Navigation enabled state save failed.');
    } finally {
      setSavingCourseId(null);
    }
  }

  async function saveOrder() {
    setSavingOrder(true);
    setSyncError(null);
    try {
      const saved = await api.put<Course[]>('/courses/reorder/order', { ids: courses.map(course => course.id) });
      setCourses(saved || []);
      setOrderDirty(false);
    } catch (e) {
      setSyncError((e instanceof Error ? e.message : null) || 'Course order save failed.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function importPageUrlCsv(file: File) {
    setImportingCsv(true);
    setImportResult(null);
    setSyncError(null);
    try {
      const csv = await file.text();
      const result = await api.post<PageUrlImportResult>('/courses/import-page-urls', { csv });
      setImportResult(result);
      const fresh = await api.get<Course[]>('/courses');
      setCourses(fresh || []);
    } catch (e) {
      setSyncError((e instanceof Error ? e.message : null) || 'CSV import failed.');
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  function updateOption(kind: CourseDropdownKind, index: number, value: string) {
    setOptions(prev => ({
      ...prev,
      [kind]: prev[kind].map((item, i) => i === index ? value : item),
    }));
  }

  function addOption(kind: CourseDropdownKind) {
    setOptions(prev => ({ ...prev, [kind]: [...prev[kind], ''] }));
  }

  function removeOption(kind: CourseDropdownKind, index: number) {
    setOptions(prev => ({ ...prev, [kind]: prev[kind].filter((_, i) => i !== index) }));
  }

  async function saveDropdownOptions() {
    setSavingOptions(true);
    setSyncError(null);
    try {
      const payload = {
        qualification: cleanOptions(options.qualification),
        level: cleanOptions(options.level),
        course_option: cleanOptions(options.course_option),
      };
      const saved = await api.put<CourseDropdownOption[]>('/courses/dropdown-options', payload);
      setOptions(groupOptions(saved || []));
    } catch (e) {
      setSyncError((e instanceof Error ? e.message : null) || 'Dropdown option save failed.');
    } finally {
      setSavingOptions(false);
    }
  }

  function cleanOptions(values: string[]): string[] {
    return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
  }

  function selectedValues(select: HTMLSelectElement): string[] {
    return Array.from(select.selectedOptions).map(option => option.value).filter(Boolean);
  }

  function renderOptionsEditor(kind: CourseDropdownKind, label: string) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="space-y-1.5">
          {options[kind].map((value, index) => (
            <div key={`${kind}-${index}`} className="flex gap-2">
              <input
                className="input h-8 text-xs"
                value={value}
                onChange={event => updateOption(kind, index, event.target.value)}
              />
              <button onClick={() => removeOption(kind, index)} className="btn-danger px-2 text-xs">Remove</button>
            </div>
          ))}
        </div>
        <button onClick={() => addOption(kind)} className="btn-ghost mt-2 w-full justify-center text-xs">
          Add {label}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Zenler Course Sync</h2>
      <p className="mb-3 text-xs text-slate-500">
        Sync courses from your Zenler school into the local database. Synced courses become
        available as dropdown options when configuring payment cards.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {isAdmin && (
          <>
            <button onClick={sync} disabled={syncing} className="btn-primary">
              {syncing ? 'Syncing…' : '↻ Sync Courses from Zenler'}
            </button>
            <button onClick={runDebug} disabled={debugging} className="btn-ghost text-xs">
              {debugging ? 'Fetching…' : '🔍 Debug raw response'}
            </button>
          </>
        )}
        <button
          onClick={() => downloadCoursesCsv().catch(err => setSyncError(err instanceof Error ? err.message : 'Download failed.'))}
          className="btn-ghost text-xs"
        >
          Download CSV
        </button>
        <button
          onClick={() => csvInputRef.current?.click()}
          disabled={importingCsv}
          className="btn-ghost text-xs"
        >
          {importingCsv ? 'Importing…' : 'Upload CSV'}
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void importPageUrlCsv(file);
          }}
        />
      </div>
      <p className="mb-4 text-xs text-slate-400">
        CSV updates <code>course_page_url</code> only, matched by <code>zenler_course_id</code>.
      </p>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Dropdown Values</h3>
            <p className="text-xs text-slate-500">Edit the values available in the course metadata dropdowns.</p>
          </div>
          <button onClick={saveDropdownOptions} disabled={savingOptions} className="btn-primary">
            {savingOptions ? 'Saving...' : 'Save Dropdown Values'}
          </button>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {renderOptionsEditor('qualification', 'Qualification')}
          {renderOptionsEditor('level', 'Level')}
          {renderOptionsEditor('course_option', 'Course Option')}
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Sync complete — <strong>{syncResult.fetched}</strong> fetched ·{' '}
          <strong>{syncResult.inserted}</strong> new · <strong>{syncResult.updated}</strong> updated ·{' '}
          <strong>{syncResult.deactivated}</strong> deactivated
          {syncResult.storyblokDatasource
            ? syncResult.storyblokDatasource.ok
              ? ` · Storyblok dropdown ${syncResult.storyblokDatasource.created} created, ${syncResult.storyblokDatasource.updated} updated`
              : ` · Storyblok dropdown failed: ${syncResult.storyblokDatasource.error ?? 'unknown error'}`
            : null}
          {syncResult.salesPageUrls
            ? syncResult.salesPageUrls.ok
              ? ` · Sales page URLs ${syncResult.salesPageUrls.updated} updated, ${syncResult.salesPageUrls.unchanged} already set`
              : ` · Sales page URL pull failed: ${syncResult.salesPageUrls.error ?? 'unknown error'}`
            : null}
        </div>
      )}
      {importResult && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          CSV import — <strong>{importResult.updated}</strong> updated ·{' '}
          <strong>{importResult.cleared}</strong> cleared ·{' '}
          <strong>{importResult.skipped}</strong> unchanged
          {importResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
              {importResult.errors.slice(0, 8).map(error => (
                <li key={`${error.rowNumber}-${error.zenlerCourseId}`}>
                  Row {error.rowNumber}{error.zenlerCourseId ? ` (${error.zenlerCourseId})` : ''}: {error.message}
                </li>
              ))}
              {importResult.errors.length > 8 && (
                <li>…and {importResult.errors.length - 8} more</li>
              )}
            </ul>
          )}
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Drag rows to sort. Enabled, banner, and navigation toggles save immediately; save each row after changing dropdowns.</p>
        <button onClick={saveOrder} disabled={!orderDirty || savingOrder} className="btn-primary">
          {savingOrder ? 'Saving...' : orderDirty ? 'Save Course Order' : 'Order Saved'}
        </button>
      </div>
      {!loading && courses.length === 0 && (
        <p className="text-xs text-slate-400">
          {isAdmin
            ? 'No courses synced yet. Click "Sync Courses from Zenler" above.'
            : 'No courses synced yet. Ask an admin to sync courses from Zenler.'}
        </p>
      )}
      {!loading && courses.length > 0 && (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1280px] w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Sort</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Zenler ID</th>
                <th className="px-3 py-2 font-semibold">Course page URL</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Enabled</th>
                <th className="px-3 py-2 font-semibold">Enable in Banner</th>
                <th className="px-3 py-2 font-semibold">Show in Navigation</th>
                <th className="px-3 py-2 font-semibold">Qualification</th>
                <th className="px-3 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Course Option</th>
                <th className="px-3 py-2 font-semibold">Last synced</th>
                <th className="px-3 py-2 font-semibold">Save</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, index) => (
                <tr
                  key={c.id}
                  draggable
                  onDragStart={event => {
                    setDraggingCourseId(c.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(c.id));
                  }}
                  onDragOver={event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    const fromId = Number(event.dataTransfer.getData('text/plain')) || draggingCourseId;
                    if (fromId) moveCourseTo(fromId, c.id);
                    setDraggingCourseId(null);
                  }}
                  onDragEnd={() => setDraggingCourseId(null)}
                  className={`border-b border-slate-100 last:border-0 ${draggingCourseId === c.id ? 'bg-blue-50 opacity-70' : 'bg-white'}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="cursor-grab select-none rounded border border-slate-200 px-2 py-1 text-slate-400" title="Drag to reorder">⋮⋮</span>
                      <button onClick={() => moveCourse(index, -1)} disabled={index === 0} className="rounded border border-slate-200 px-2 py-1 text-slate-600 disabled:opacity-30">↑</button>
                      <button onClick={() => moveCourse(index, 1)} disabled={index === courses.length - 1} className="rounded border border-slate-200 px-2 py-1 text-slate-600 disabled:opacity-30">↓</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 text-slate-400">{c.zenlerCourseId}</td>
                  <td className="px-3 py-2">
                    <input
                      className="input h-8 min-w-52 text-xs"
                      placeholder="/courses/fa1"
                      value={c.coursePageUrl ?? ''}
                      onChange={event => patchCourse(c.id, { coursePageUrl: event.target.value || null })}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-400">{c.status ?? '—'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      disabled={savingCourseId === c.id}
                      onChange={event => saveCourseActive(c, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={c.enableInBanner}
                      disabled={savingCourseId === c.id || !c.isActive}
                      title={c.isActive ? undefined : 'Enable the course first'}
                      onChange={event => saveCourseBannerEnabled(c, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={c.enableInNavigation}
                      disabled={savingCourseId === c.id || !c.isActive}
                      title={c.isActive ? undefined : 'Enable the course first'}
                      onChange={event => saveCourseNavigationEnabled(c, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select className="input h-8 min-w-36 text-xs" value={c.qualification || ''} onChange={event => patchCourse(c.id, { qualification: event.target.value || null })}>
                      <option value="">Select...</option>
                      {options.qualification.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      multiple
                      className="input min-h-20 min-w-52 py-1 text-xs"
                      value={(c.courseLevels && c.courseLevels.length > 0) ? c.courseLevels : (c.courseLevel ? [c.courseLevel] : [])}
                      onChange={event => {
                        const levels = selectedValues(event.currentTarget);
                        patchCourse(c.id, { courseLevels: levels, courseLevel: levels[0] || null });
                      }}
                    >
                      {options.level.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-400">Hold Ctrl/Cmd to select multiple.</p>
                  </td>
                  <td className="px-3 py-2">
                    <select className="input h-8 min-w-40 text-xs" value={c.courseOption || ''} onChange={event => patchCourse(c.id, { courseOption: event.target.value || null })}>
                      <option value="">Select...</option>
                      {options.course_option.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => saveCourse(c)} disabled={savingCourseId === c.id} className="btn-primary text-xs">
                      {savingCourseId === c.id ? 'Saving...' : 'Save'}
                    </button>
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

export default CoursesTab;
