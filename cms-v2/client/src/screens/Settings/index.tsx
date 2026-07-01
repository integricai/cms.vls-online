import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import MenuManagement from '../MenuManagement';
import UserManagement from '../UserManagement';
import Books from '../Books';
import DiscountCodes from '../DiscountCodes';
import type { CoursePriceRecord, ScrapedCoursePrice } from '../../../../shared/types';

type Tab = 'menu' | 'courses' | 'coursePricing' | 'books' | 'discountCodes' | 'payments' | 'users';

type Course = {
  id: number;
  zenlerCourseId: string;
  name: string;
  status: string | null;
  isActive: boolean;
  enableInBanner: boolean;
  sortOrder: number;
  qualification: string | null;
  courseLevel: string | null;
  courseLevels: string[];
  courseOption: string | null;
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
};

function CoursesTab() {
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
        sortOrder: course.sortOrder,
        qualification: course.qualification,
        courseLevel: course.courseLevel,
        courseLevels: course.courseLevels || [],
        courseOption: course.courseOption,
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

      <div className="mb-4 flex gap-2">
        <button onClick={sync} disabled={syncing} className="btn-primary">
          {syncing ? 'Syncing…' : '↻ Sync Courses from Zenler'}
        </button>
        <button onClick={runDebug} disabled={debugging} className="btn-ghost text-xs">
          {debugging ? 'Fetching…' : '🔍 Debug raw response'}
        </button>
      </div>

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
        <p className="text-xs text-slate-500">Drag rows to sort. Enabled and Enable in Banner save immediately; save each row after changing dropdowns.</p>
        <button onClick={saveOrder} disabled={!orderDirty || savingOrder} className="btn-primary">
          {savingOrder ? 'Saving...' : orderDirty ? 'Save Course Order' : 'Order Saved'}
        </button>
      </div>
      {!loading && courses.length === 0 && (
        <p className="text-xs text-slate-400">No courses synced yet. Click "Sync Courses from Zenler" above.</p>
      )}
      {!loading && courses.length > 0 && (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1280px] w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Sort</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Zenler ID</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Enabled</th>
                <th className="px-3 py-2 font-semibold">Enable in Banner</th>
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

function PaymentsTab() {
  return (
    <div className="p-6">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Payments</h2>
      <p className="text-xs text-slate-500">Payment gateway configuration coming soon.</p>
    </div>
  );
}

function finalPrice(regularPrice: number, discountPercent: number): number {
  const regular = Math.max(0, Number(regularPrice) || 0);
  const discount = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  return Math.round((regular - regular * (discount / 100)) * 100) / 100;
}

function formatScrapeDate(value: Date | string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
}

function CoursePricingTab() {
  const [prices, setPrices] = useState<CoursePriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState<ScrapedCoursePrice[]>([]);

  useEffect(() => {
    api.get<CoursePriceRecord[]>('/courses/prices')
      .then(data => setPrices(data || []))
      .catch(error => setMessage(error instanceof Error ? error.message : 'Could not load course prices.'))
      .finally(() => setLoading(false));
  }, []);

  function patchPrice(courseId: number, patch: Partial<CoursePriceRecord>) {
    setPrices(prev => prev.map(price => price.courseId === courseId ? { ...price, ...patch } : price));
  }

  async function syncPrices() {
    setSyncing(true);
    setMessage('');
    setFailures([]);
    try {
      const result = await api.post<{ scraped: ScrapedCoursePrice[]; prices: CoursePriceRecord[] }>('/courses/scrape-prices', {});
      const failed = result.scraped.filter(item => !item.matched || item.price == null);
      setPrices(result.prices || []);
      setFailures(failed);
      const matched = result.scraped.length - failed.length;
      setMessage(`Synced ${matched} price${matched === 1 ? '' : 's'} from course pages. Review discounts, then save.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Price sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function savePrices() {
    setSaving(true);
    setMessage('');
    try {
      const saved = await api.put<CoursePriceRecord[]>('/courses/prices', {
        prices: prices.map(price => ({
          courseId: price.courseId,
          isEnabled: price.isEnabled,
          regularPrice: price.regularPrice,
          regularPrice2: price.regularPrice2,
          currency: price.currency,
          discountPercent: price.discountPercent,
          discountPercent2: price.discountPercent2,
          sourceUrl: price.sourceUrl,
          rawPriceText: price.rawPriceText,
        })),
      });
      setPrices(saved || []);
      setMessage('Course prices saved to Postgres.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Course price save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-sm font-bold text-slate-700">Course Pricing</h2>
          <p className="text-xs text-slate-500">
            Sync prices from course pages, revise regular prices and discounts, then save to Postgres.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncPrices} disabled={syncing} className="btn-ghost text-xs">
            {syncing ? 'Syncing...' : 'Sync Prices'}
          </button>
          <button onClick={savePrices} disabled={saving || prices.length === 0} className="btn-primary text-xs">
            {saving ? 'Saving...' : 'Save Prices'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      {failures.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="mb-2 font-bold">{failures.length} course page{failures.length === 1 ? '' : 's'} need manual review</p>
          <div className="grid gap-1 md:grid-cols-2">
            {failures.slice(0, 20).map(item => (
              <div key={item.courseId} className="truncate rounded bg-white/70 px-2 py-1">
                {item.courseName} — {item.error || 'No price found'}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading course prices...</p>
      ) : prices.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No course prices saved yet. Click <strong>Sync Prices</strong> to pull prices from course pages.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1320px] w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Enabled</th>
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Currency</th>
                <th className="px-3 py-2 font-semibold">Price 1</th>
                <th className="px-3 py-2 font-semibold">Discount 1 %</th>
                <th className="px-3 py-2 font-semibold">Final 1</th>
                <th className="px-3 py-2 font-semibold">Price 2</th>
                <th className="px-3 py-2 font-semibold">Discount 2 %</th>
                <th className="px-3 py-2 font-semibold">Final 2</th>
                <th className="px-3 py-2 font-semibold">Last Scraped</th>
                <th className="px-3 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {prices.map(price => {
                const calculated = finalPrice(price.regularPrice, price.discountPercent);
                const calculated2 = finalPrice(price.regularPrice2, price.discountPercent2);
                return (
                  <tr key={price.courseId} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={price.isEnabled}
                        onChange={event => patchPrice(price.courseId, { isEnabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">{price.courseName || `Course ${price.courseId}`}</div>
                      <div className="text-[11px] text-slate-400">{price.zenlerCourseId || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="input h-8 min-w-24 text-xs"
                        value={price.currency}
                        onChange={event => patchPrice(price.courseId, { currency: event.target.value })}
                      >
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input h-8 min-w-28 text-xs"
                        value={price.regularPrice}
                        onChange={event => patchPrice(price.courseId, { regularPrice: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="input h-8 min-w-24 text-xs"
                        value={price.discountPercent}
                        onChange={event => patchPrice(price.courseId, { discountPercent: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{calculated.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input h-8 min-w-28 text-xs"
                        value={price.regularPrice2}
                        onChange={event => patchPrice(price.courseId, { regularPrice2: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="input h-8 min-w-24 text-xs"
                        value={price.discountPercent2}
                        onChange={event => patchPrice(price.courseId, { discountPercent2: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{calculated2.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-500">
                      <div>{price.lastScrapeStatus}</div>
                      <div className="text-[11px] text-slate-400">
                        {formatScrapeDate(price.lastScrapedAt)}
                      </div>
                      {price.lastScrapedPrice != null && (
                        <div className="text-[11px] text-slate-400">
                          Last: {price.currency} {price.lastScrapedPrice.toFixed(2)}
                          {price.lastScrapedPrice2 != null ? ` / ${price.lastScrapedPrice2.toFixed(2)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      {price.sourceUrl ? (
                        <a href={price.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
                          Open page
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  menu: 'Menu Settings',
  courses: 'Courses',
  coursePricing: 'Course Pricing',
  books: 'Books',
  discountCodes: 'Discount Codes',
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
        {tab === 'coursePricing' && <CoursePricingTab />}
        {tab === 'books'    && <Books />}
        {tab === 'discountCodes' && <DiscountCodes />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'users'    && <UserManagement />}
      </div>
    </div>
  );
}
