import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Course } from '../../../../shared/types';

const DEFAULT_CC_EMAIL = 'office@vls-online.com';

type DiscountType = 'percent' | 'fixed';

type RetakeCode = {
  id: number;
  code: string;
  courseName: string | null;
  studentEmail: string;
  ccEmail?: string | null;
  firstName: string;
  lastName: string;
  discountType: DiscountType;
  discountValue: number;
  used: boolean;
  usedAt: string | null;
  paymentOrderId: number | null;
  emailSentAt: string | null;
  createdAt: string;
  emailSent?: boolean;
  emailError?: string | null;
};

function discountLabel(row: Pick<RetakeCode, 'discountType' | 'discountValue'>): string {
  if (row.discountType === 'percent') return `${row.discountValue}%`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.discountValue);
}

function statusLabel(row: RetakeCode): string {
  if (row.used) return 'Used';
  if (row.paymentOrderId) return 'Waiting on payment';
  return 'Unused';
}

export default function RetakeCodes() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [codes, setCodes] = useState<RetakeCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [ccEmail, setCcEmail] = useState(DEFAULT_CC_EMAIL);
  const [courseId, setCourseId] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');

  async function loadCodes() {
    const rows = await api.get<RetakeCode[]>('/retake-discount-codes');
    setCodes(rows);
  }

  useEffect(() => {
    Promise.all([
      api.get<Course[]>('/courses/active'),
      api.get<RetakeCode[]>('/retake-discount-codes'),
    ])
      .then(([courseRows, codeRows]) => {
        setCourses(courseRows.filter(course => course.zenlerCourseId));
        setCodes(codeRows);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load discount codes.'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const issued = await api.post<RetakeCode>('/retake-discount-codes', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        ccEmail: ccEmail.trim() || DEFAULT_CC_EMAIL,
        courseId: Number(courseId),
        discountType,
        discountValue: Number(discountValue),
      });
      setMessage(issued.emailSent
        ? `Sent ${issued.code} to ${issued.studentEmail} and ${issued.ccEmail || DEFAULT_CC_EMAIL}.`
        : `Saved ${issued.code}, but the email was not sent. ${issued.emailError ?? ''}`.trim());
      setFirstName('');
      setLastName('');
      setEmail('');
      setCcEmail(DEFAULT_CC_EMAIL);
      setCourseId('');
      setDiscountValue('');
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a discount code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend(id: number) {
    setError('');
    setMessage('');
    try {
      const issued = await api.post<RetakeCode>(`/retake-discount-codes/${id}/resend`, {});
      setMessage(`Sent ${issued.code} to ${issued.studentEmail}.`);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend that code.');
    }
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Discount Code</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Generate a one-time code for one student and one course.
          The code is emailed to the student, copied to the office, and marked used after payment.
        </p>
      </div>

      <form onSubmit={onSubmit} className="m-6 grid max-w-3xl gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            First name
            <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={firstName} onChange={event => setFirstName(event.target.value)} required />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Last name
            <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={lastName} onChange={event => setLastName(event.target.value)} required />
          </label>
        </div>
        <label className="text-xs font-semibold text-slate-600">
          Email
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          CC email
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="email" value={ccEmail} onChange={event => setCcEmail(event.target.value)} required />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Course
          <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={courseId} onChange={event => setCourseId(event.target.value)} required>
            <option value="">{loading ? 'Loading courses…' : 'Choose a course'}</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Discount
            <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={discountType} onChange={event => setDiscountType(event.target.value as DiscountType)}>
              <option value="percent">Percent off the course price</option>
              <option value="fixed">Fixed USD amount off</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            {discountType === 'percent' ? 'Percent' : 'Amount (USD)'}
            <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" inputMode="decimal" value={discountValue} onChange={event => setDiscountValue(event.target.value)} required />
          </label>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div>
          <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting}>
            {submitting ? 'Generating…' : 'Generate discount code'}
          </button>
        </div>
      </form>

      <div className="mx-6 mb-8 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>No discount codes yet.</td></tr>
            ) : codes.map(row => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-3 py-2">
                  <div>{row.firstName} {row.lastName}</div>
                  <div className="text-xs text-slate-500">{row.studentEmail}</div>
                </td>
                <td className="px-3 py-2">{row.courseName}</td>
                <td className="px-3 py-2">{discountLabel(row)}</td>
                <td className="px-3 py-2">{statusLabel(row)}</td>
                <td className="px-3 py-2 text-right">
                  {row.used ? null : (
                    <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => { void resend(row.id); }}>
                      Resend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
