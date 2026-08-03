import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import type {
  Course,
  EnrollmentSyncResult,
  EnrollmentSyncState,
  ExamEmailBulkSendResult,
  ExamStatus,
  StudentDetail,
  StudentListItem,
  StudentListPage,
  StudentPurchaseFilter,
  StudentSyncState,
  ZenlerStudentSyncResult,
} from '../../../../shared/types';

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function studentName(student: Pick<StudentListItem, 'firstName' | 'lastName' | 'email'>): string {
  const name = [student.firstName, student.lastName].filter(Boolean).join(' ').trim();
  return name || student.email;
}

function paymentLabel(status: string | null | undefined): string {
  if (!status) return 'No CMS sale';
  if (status === 'Refunded') return 'Refunded';
  if (status === 'Paid') return 'Purchased';
  return status;
}

function examLabel(status: string): string {
  switch (status) {
    case 'passed': return 'Passed';
    case 'awaiting_result': return 'Awaiting result';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
}

function toCsv(students: StudentListItem[]): string {
  const header = [
    'id', 'email', 'first_name', 'last_name', 'phone', 'newsletter', 'source',
    'purchase_count', 'refund_count', 'courses', 'zenler_user_id',
  ];
  const escape = (v: string | number | boolean | null | undefined) => {
    const text = v == null ? '' : String(v);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = students.map((s) => [
    s.id, s.email, s.firstName, s.lastName, s.phone, s.newsletterSubscribed, s.source,
    s.purchaseCount, s.refundCount, s.courseNames.join('; '), s.zenlerUserId,
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\n');
}

const EXAM_OPTIONS: ExamStatus[] = ['unknown', 'awaiting_result', 'passed', 'failed'];

const LIST_PAGE_SIZE = 100;

export default function Students() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncState, setSyncState] = useState<StudentSyncState | null>(null);
  const stopSyncRef = useRef(false);
  const [enrollmentSyncing, setEnrollmentSyncing] = useState(false);
  const [enrollmentSyncState, setEnrollmentSyncState] = useState<EnrollmentSyncState | null>(null);
  const stopEnrollmentSyncRef = useRef(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [newsletter, setNewsletter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [hasPurchased, setHasPurchased] = useState<StudentPurchaseFilter>('yes');
  const [hasRefund, setHasRefund] = useState(false);
  const [examFilter, setExamFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [examDrafts, setExamDrafts] = useState<Record<number, ExamStatus>>({});
  const [savingCourseId, setSavingCourseId] = useState<number | null>(null);
  const [emailingCourseId, setEmailingCourseId] = useState<number | null>(null);
  const [linkCourseId, setLinkCourseId] = useState('');
  const [newsletterSaving, setNewsletterSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(listPage));
    params.set('pageSize', String(LIST_PAGE_SIZE));
    params.set('hasPurchased', hasPurchased);
    if (search.trim()) params.set('search', search.trim());
    if (courseId) params.set('courseId', courseId);
    if (newsletter !== 'all') params.set('newsletter', newsletter);
    if (hasRefund) params.set('hasRefund', 'true');
    if (examFilter) params.set('examStatus', examFilter);
    return `?${params.toString()}`;
  }, [listPage, hasPurchased, search, courseId, newsletter, hasRefund, examFilter]);

  async function loadStudents() {
    setLoading(true);
    setError('');
    try {
      const page = await api.get<StudentListPage>(`/students${query}`);
      setStudents(page.items ?? []);
      setListTotal(page.total ?? 0);
      setListTotalPages(page.totalPages ?? 1);
      if (page.page && page.page !== listPage) setListPage(page.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  async function loadSyncStatus() {
    try {
      const state = await api.get<StudentSyncState>('/students/sync-zenler/status');
      setSyncState(state);
    } catch {
      /* optional on first load */
    }
  }

  async function loadEnrollmentSyncStatus() {
    try {
      const state = await api.get<EnrollmentSyncState>('/students/sync-enrollments/status');
      setEnrollmentSyncState(state);
    } catch {
      /* optional on first load */
    }
  }

  async function loadDetail(id: number) {
    setDetailLoading(true);
    try {
      const data = await api.get<StudentDetail>(`/students/${id}`);
      setDetail(data);
      const drafts: Record<number, ExamStatus> = {};
      for (const course of data.courses) drafts[course.courseId] = course.examStatus;
      setExamDrafts(drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    api.get<Course[]>('/courses')
      .then((data) => setCourses((data ?? []).filter((c) => c.isActive)))
      .catch(() => {/* course filter is optional */});
    void loadSyncStatus();
    void loadEnrollmentSyncStatus();
  }, []);

  useEffect(() => {
    setListPage(1);
  }, [hasPurchased, search, courseId, newsletter, hasRefund, examFilter]);

  useEffect(() => {
    void loadStudents();
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setExamDrafts({});
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  async function runZenlerSync(action: 'continue' | 'restart') {
    if (action === 'restart') {
      const confirmed = window.confirm(
        'Resync ALL Zenler learners from page 1?\n\nThis reprocesses the full list. Prefer Continue sync unless you need a full rebuild.',
      );
      if (!confirmed) return;
    } else if (syncState && syncState.lastCompletedPage > 0 && syncState.status !== 'completed') {
      const confirmed = window.confirm(
        `Continue Zenler sync from page ${syncState.lastCompletedPage + 1}?\n\nProgress so far: ${syncState.fetched.toLocaleString()} fetched.`,
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        'Sync Zenler learners into Students in batches?\n\nThis is for pre-launch backfill. After go-live, enrollments update students automatically.',
      );
      if (!confirmed) return;
    }

    stopSyncRef.current = false;
    setSyncing(true);
    setError('');
    setMessage(action === 'restart' ? 'Restarting Zenler sync from page 1…' : 'Continuing Zenler sync…');

    const collectedErrors: string[] = [];
    let first = true;

    try {
      while (!stopSyncRef.current) {
        const result = await api.post<ZenlerStudentSyncResult>('/students/sync-zenler', {
          action: first ? action : 'continue',
          pageSize: 50,
        });
        first = false;
        setSyncState(result.syncState);

        if (result.errors?.length) {
          for (const err of result.errors) {
            if (collectedErrors.length < 10) collectedErrors.push(err);
          }
        }

        const totals = result.totals;
        setMessage(
          result.stopped
            ? `Sync stopped at page ${result.syncState.lastCompletedPage}. `
              + `Fetched ${totals.fetched.toLocaleString()} so far — use Continue sync to resume.`
            : result.done
              ? `Zenler sync complete: fetched ${totals.fetched.toLocaleString()}, `
                + `created ${totals.created.toLocaleString()}, updated ${totals.updated.toLocaleString()}, `
                + `skipped ${totals.skipped.toLocaleString()}.`
              : `Syncing page ${result.page}/${result.totalPages}… `
                + `(${totals.fetched.toLocaleString()} fetched, ${totals.created.toLocaleString()} created, `
                + `${totals.updated.toLocaleString()} updated)`,
        );

        if (result.stopped || result.done || !result.nextPage) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (stopSyncRef.current) {
        await api.post<StudentSyncState>('/students/sync-zenler/stop', {});
        await loadSyncStatus();
        setMessage((prev) => prev || 'Sync stop requested.');
      }

      if (collectedErrors.length) setError(collectedErrors.slice(0, 5).join(' | '));
      await loadStudents();
      await loadSyncStatus();
    } catch (err) {
      await loadSyncStatus();
      setError(err instanceof Error ? err.message : 'Zenler sync failed');
      setMessage('Sync interrupted. Use Continue sync to resume from the last saved page.');
      await loadStudents();
    } finally {
      setSyncing(false);
      stopSyncRef.current = false;
    }
  }

  async function stopZenlerSync() {
    stopSyncRef.current = true;
    setMessage('Stopping sync after the current page…');
    try {
      const state = await api.post<StudentSyncState>('/students/sync-zenler/stop', {});
      setSyncState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop sync');
    }
  }

  async function runEnrollmentSync(action: 'continue' | 'restart') {
    if (action === 'restart') {
      const confirmed = window.confirm(
        'Resync ALL Zenler course enrollments from the first course?\n\n'
          + 'This walks each CMS course with a Zenler id and links enrolled learners.',
      );
      if (!confirmed) return;
    } else if (
      enrollmentSyncState
      && (enrollmentSyncState.courseIndex > 0 || enrollmentSyncState.lastCompletedPage > 0)
      && enrollmentSyncState.status !== 'completed'
    ) {
      const confirmed = window.confirm(
        `Continue enrollment sync from course ${enrollmentSyncState.courseIndex + 1}`
          + (enrollmentSyncState.totalCourses ? `/${enrollmentSyncState.totalCourses}` : '')
          + ` page ${enrollmentSyncState.lastCompletedPage + 1}?\n\n`
          + `Linked so far: ${enrollmentSyncState.linked.toLocaleString()}.`,
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        'Sync Zenler course enrollments into Students?\n\n'
          + 'Uses course enrollment reports (not per-student calls). Safe for pre-launch backfill.',
      );
      if (!confirmed) return;
    }

    stopEnrollmentSyncRef.current = false;
    setEnrollmentSyncing(true);
    setError('');
    setMessage(action === 'restart' ? 'Restarting enrollment sync…' : 'Continuing enrollment sync…');

    const collectedErrors: string[] = [];
    let first = true;

    try {
      while (!stopEnrollmentSyncRef.current) {
        const result = await api.post<EnrollmentSyncResult>('/students/sync-enrollments', {
          action: first ? action : 'continue',
          pageSize: 100,
        });
        first = false;
        setEnrollmentSyncState(result.syncState);

        if (result.errors?.length) {
          for (const err of result.errors) {
            if (collectedErrors.length < 10) collectedErrors.push(err);
          }
        }

        const totals = result.totals;
        const courseLabel = result.courseName
          ? `"${result.courseName}"`
          : `course ${result.courseIndex + 1}`;
        const skippedCourse = Boolean(result.errors?.some((e) => e.startsWith(`${result.courseName}:`)));
        setMessage(
          result.stopped
            ? `Enrollment sync stopped at ${courseLabel}. `
              + `Linked ${totals.linked.toLocaleString()} so far — use Continue enrollments to resume.`
            : result.done
              ? `Enrollment sync complete: linked ${totals.linked.toLocaleString()} `
                + `(${totals.createdCustomers.toLocaleString()} new customers, `
                + `${totals.skipped.toLocaleString()} skipped) across ${result.totalCourses} courses.`
              : skippedCourse
                ? `Skipped ${courseLabel} (Zenler report failed) — continuing `
                  + `(course ${result.courseIndex + 1}/${result.totalCourses}, `
                  + `${totals.linked.toLocaleString()} linked)…`
                : `Synced ${courseLabel} `
                  + `(course ${result.courseIndex + 1}/${result.totalCourses})… `
                  + `${totals.linked.toLocaleString()} linked`,
        );

        if (result.stopped || result.done || result.nextPage == null) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (stopEnrollmentSyncRef.current) {
        await api.post<EnrollmentSyncState>('/students/sync-enrollments/stop', {});
        await loadEnrollmentSyncStatus();
        setMessage((prev) => prev || 'Enrollment sync stop requested.');
      }

      if (collectedErrors.length) setError(collectedErrors.slice(0, 5).join(' | '));
      await loadStudents();
      await loadEnrollmentSyncStatus();
    } catch (err) {
      await loadEnrollmentSyncStatus();
      const detail = err instanceof Error ? err.message : 'Enrollment sync failed';
      setError(detail);
      setMessage(
        detail.includes('migrations') || detail.includes('missing')
          ? `Enrollment sync blocked: ${detail}`
          : `Enrollment sync interrupted: ${detail}. Use Sync enrollments / Continue enrollments to retry.`,
      );
      await loadStudents();
    } finally {
      setEnrollmentSyncing(false);
      stopEnrollmentSyncRef.current = false;
    }
  }

  async function stopEnrollmentSync() {
    stopEnrollmentSyncRef.current = true;
    setMessage('Stopping enrollment sync after the current page…');
    try {
      const state = await api.post<EnrollmentSyncState>('/students/sync-enrollments/stop', {});
      setEnrollmentSyncState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop enrollment sync');
    }
  }

  async function bulkSendExamEmails() {
    if (!courseId) {
      setError('Select a course filter first, then send exam emails for that course.');
      return;
    }
    const course = courses.find((c) => String(c.id) === courseId);
    const confirmed = window.confirm(
      `Send exam result update emails to all students linked to "${course?.name || 'this course'}"?\n\nEach student gets Passed / Awaiting result links.`,
    );
    if (!confirmed) return;

    setBulkSending(true);
    setError('');
    setMessage('');
    try {
      const result = await api.post<ExamEmailBulkSendResult>('/students/send-exam-emails', {
        courseId: Number(courseId),
      });
      setMessage(`Exam emails: sent ${result.sent} of ${result.attempted} (${result.failed} failed).`);
      if (result.failed > 0) {
        const sample = result.results.filter((r) => !r.sent).slice(0, 3)
          .map((r) => `${r.email}: ${r.error || 'failed'}`).join(' | ');
        setError(sample || 'Some emails failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk exam email failed');
    } finally {
      setBulkSending(false);
    }
  }

  async function saveExamStatus(targetCourseId: number) {
    if (!selectedId) return;
    const examStatus = examDrafts[targetCourseId];
    if (!examStatus) return;

    setSavingCourseId(targetCourseId);
    setError('');
    setMessage('');
    try {
      const updated = await api.put<StudentDetail>(
        `/students/${selectedId}/courses/${targetCourseId}/exam-status`,
        { examStatus },
      );
      setDetail(updated);
      setMessage(`Exam status saved as ${examLabel(examStatus)}.`);
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exam status');
    } finally {
      setSavingCourseId(null);
    }
  }

  async function sendExamEmail(targetCourseId: number) {
    if (!selectedId || !detail) return;
    const course = detail.courses.find((c) => c.courseId === targetCourseId);
    const confirmed = window.confirm(
      `Send exam result email to ${detail.email} for "${course?.courseName || 'this course'}"?`,
    );
    if (!confirmed) return;

    setEmailingCourseId(targetCourseId);
    setError('');
    setMessage('');
    try {
      await api.post(`/students/${selectedId}/courses/${targetCourseId}/send-exam-email`, {});
      setMessage(`Exam result email sent to ${detail.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send exam email');
    } finally {
      setEmailingCourseId(null);
    }
  }

  async function toggleNewsletter(subscribed: boolean) {
    if (!selectedId || !detail) return;
    const action = subscribed ? 'subscribe' : 'unsubscribe';
    const confirmed = window.confirm(
      `${subscribed ? 'Subscribe' : 'Unsubscribe'} ${detail.email} ${subscribed ? 'to' : 'from'} the MailerLite newsletter?`,
    );
    if (!confirmed) return;

    setNewsletterSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.put<StudentDetail>(`/students/${selectedId}/newsletter`, { subscribed });
      setDetail(updated);
      setMessage(`Newsletter ${action}d for ${detail.email}.`);
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setNewsletterSaving(false);
    }
  }

  async function linkCourseAndSetStatus() {
    if (!selectedId || !linkCourseId) return;
    const targetCourseId = Number(linkCourseId);
    setSavingCourseId(targetCourseId);
    setError('');
    setMessage('');
    try {
      const updated = await api.put<StudentDetail>(
        `/students/${selectedId}/courses/${targetCourseId}/exam-status`,
        { examStatus: examDrafts[targetCourseId] ?? 'unknown' },
      );
      setDetail(updated);
      setLinkCourseId('');
      setMessage('Course linked and exam status saved.');
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link course');
    } finally {
      setSavingCourseId(null);
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(students)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const linkableCourses = courses.filter(
    (c) => !detail?.courses.some((linked) => linked.courseId === c.id),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Students</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage learners, exam status, and exam-result emails (Passed / Awaiting result links).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              disabled={loading || students.length === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void bulkSendExamEmails()}
              disabled={bulkSending || !courseId}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title={!courseId ? 'Select a course filter first' : 'Email all students for the selected course'}
            >
              {bulkSending ? 'Sending…' : 'Email exam links (course)'}
            </button>
            {syncing ? (
              <button
                type="button"
                onClick={() => void stopZenlerSync()}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Stop learners sync
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void runZenlerSync('continue')}
                  disabled={enrollmentSyncing}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {syncState && syncState.lastCompletedPage > 0 && syncState.status !== 'completed'
                    ? `Continue learners (page ${syncState.lastCompletedPage + 1})`
                    : 'Sync learners'}
                </button>
                <button
                  type="button"
                  onClick={() => void runZenlerSync('restart')}
                  disabled={enrollmentSyncing}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title="Start learners sync again from page 1"
                >
                  Resync learners
                </button>
              </>
            )}
            {enrollmentSyncing ? (
              <button
                type="button"
                onClick={() => void stopEnrollmentSync()}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Stop enrollments
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void runEnrollmentSync('continue')}
                  disabled={syncing}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  title="Link Zenler course enrollments to students"
                >
                  {enrollmentSyncState
                    && enrollmentSyncState.status !== 'completed'
                    && (enrollmentSyncState.courseIndex > 0 || enrollmentSyncState.lastCompletedPage > 0)
                    ? `Continue enrollments`
                    : 'Sync enrollments'}
                </button>
                <button
                  type="button"
                  onClick={() => void runEnrollmentSync('restart')}
                  disabled={syncing}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title="Restart enrollment sync from the first course"
                >
                  Resync enrollments
                </button>
              </>
            )}
          </div>
        </div>
        {syncState && (syncState.lastCompletedPage > 0 || syncState.status !== 'idle') && (
          <p className="mt-2 text-xs text-slate-500">
            Learners sync: {syncState.status}
            {syncState.lastCompletedPage > 0
              ? ` · last page ${syncState.lastCompletedPage}`
                + (syncState.totalPages ? `/${syncState.totalPages}` : '')
              : ''}
            {syncState.fetched > 0 ? ` · ${syncState.fetched.toLocaleString()} fetched` : ''}
          </p>
        )}
        {enrollmentSyncState
          && (enrollmentSyncState.courseIndex > 0
            || enrollmentSyncState.lastCompletedPage > 0
            || enrollmentSyncState.status !== 'idle') && (
          <p className="mt-1 text-xs text-slate-500">
            Enrollment sync: {enrollmentSyncState.status}
            {enrollmentSyncState.totalCourses
              ? ` · course ${Math.min(enrollmentSyncState.courseIndex + 1, enrollmentSyncState.totalCourses)}/${enrollmentSyncState.totalCourses}`
              : ''}
            {enrollmentSyncState.lastCompletedPage > 0
              ? ` · page ${enrollmentSyncState.lastCompletedPage}`
                + (enrollmentSyncState.totalPagesInCourse
                  ? `/${enrollmentSyncState.totalPagesInCourse}`
                  : '')
              : ''}
            {enrollmentSyncState.linked > 0
              ? ` · ${enrollmentSyncState.linked.toLocaleString()} linked`
              : ''}
            {enrollmentSyncState.lastError
              ? ` · error: ${enrollmentSyncState.lastError}`
              : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Course
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Exam status
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              <option value="">All</option>
              {EXAM_OPTIONS.map((status) => (
                <option key={status} value={status}>{examLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Course access
            <select
              value={hasPurchased}
              onChange={(e) => setHasPurchased(e.target.value as StudentPurchaseFilter)}
              className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              <option value="yes">Has course</option>
              <option value="cms">CMS purchase only</option>
              <option value="no">No course</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Newsletter
            <select
              value={newsletter}
              onChange={(e) => setNewsletter(e.target.value as typeof newsletter)}
              className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              <option value="all">All</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Not subscribed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hasRefund}
              onChange={(e) => setHasRefund(e.target.checked)}
            />
            Has refund
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p>
            Displaying {students.length.toLocaleString()} of {listTotal.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || listPage <= 1}
              onClick={() => setListPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {listPage} of {listTotalPages}
            </span>
            <button
              type="button"
              disabled={loading || listPage >= listTotalPages}
              onClick={() => setListPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading students…</p>
            ) : students.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">
                No students match this filter. Try Course access = All, or run Sync enrollments.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Courses</th>
                    <th className="px-4 py-3 font-semibold">Purchases</th>
                    <th className="px-4 py-3 font-semibold">Newsletter</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedId(student.id)}
                      className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                        selectedId === student.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{studentName(student)}</div>
                        <div className="text-xs text-slate-500">{student.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.courseNames.length
                          ? student.courseNames.slice(0, 3).join(', ')
                            + (student.courseNames.length > 3 ? ` +${student.courseNames.length - 3}` : '')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.purchaseCount}
                        {student.refundCount > 0 && (
                          <span className="ml-1 text-xs text-amber-700">({student.refundCount} refunded)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.newsletterSubscribed ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{student.source || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {!selectedId ? (
              <p className="text-sm text-slate-500">Select a student to manage exam status and emails.</p>
            ) : detailLoading ? (
              <p className="text-sm text-slate-500">Loading detail…</p>
            ) : !detail ? (
              <p className="text-sm text-slate-500">Student not found.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{studentName(detail)}</h2>
                  <p className="text-sm text-slate-500">{detail.email}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Phone</dt>
                    <dd className="text-slate-700">{detail.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Country</dt>
                    <dd className="text-slate-700">{detail.countryCode || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Zenler ID</dt>
                    <dd className="truncate text-slate-700">{detail.zenlerUserId || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Newsletter</dt>
                    <dd className="text-slate-700">
                      {detail.newsletterSubscribed
                        ? `Subscribed ${formatDate(detail.newsletterSubscribedAt)}`
                        : 'Not subscribed'}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => void toggleNewsletter(!detail.newsletterSubscribed)}
                      disabled={newsletterSaving}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {newsletterSaving
                        ? 'Updating…'
                        : detail.newsletterSubscribed
                          ? 'Unsubscribe in MailerLite'
                          : 'Subscribe in MailerLite'}
                    </button>
                  </div>
                </dl>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Courses & exam status</h3>
                  {detail.courses.length === 0 ? (
                    <p className="mb-3 text-sm text-slate-500">No linked courses yet. Link one below.</p>
                  ) : (
                    <ul className="mb-3 space-y-3">
                      {detail.courses.map((course) => (
                        <li
                          key={course.courseId}
                          className="rounded-lg border border-slate-100 px-3 py-3 text-sm"
                        >
                          <div className="font-medium text-slate-800">
                            {course.courseName || `Course #${course.courseId}`}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{paymentLabel(course.paymentStatus)}</span>
                            {course.examStatusSource && <span>Source: {course.examStatusSource}</span>}
                            {course.examStatusUpdatedAt && (
                              <span>Updated {formatDate(course.examStatusUpdatedAt)}</span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select
                              value={examDrafts[course.courseId] ?? course.examStatus}
                              onChange={(e) => setExamDrafts((prev) => ({
                                ...prev,
                                [course.courseId]: e.target.value as ExamStatus,
                              }))}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
                            >
                              {EXAM_OPTIONS.map((status) => (
                                <option key={status} value={status}>{examLabel(status)}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void saveExamStatus(course.courseId)}
                              disabled={savingCourseId === course.courseId}
                              className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {savingCourseId === course.courseId ? 'Saving…' : 'Save status'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void sendExamEmail(course.courseId)}
                              disabled={emailingCourseId === course.courseId}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {emailingCourseId === course.courseId ? 'Sending…' : 'Email links'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {linkableCourses.length > 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 p-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">Link another course</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={linkCourseId}
                          onChange={(e) => setLinkCourseId(e.target.value)}
                          className="min-w-[180px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">Select course…</option>
                          {linkableCourses.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void linkCourseAndSetStatus()}
                          disabled={!linkCourseId || savingCourseId === Number(linkCourseId)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Link course
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
