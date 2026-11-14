import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  customPaymentOfferCanResend,
  customPaymentOfferLinkStatus,
  type CustomPaymentOfferLinkStatus,
} from '../../../../shared/customPaymentOfferStatus';
import type { Course } from '../../../../shared/types';

interface OfferResult {
  id: number;
  paymentOrderId: number;
  courseTitle?: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  checkoutUrl: string | null;
  emailSent: boolean;
  orderStatus?: string | null;
}

interface SentOffer {
  id: number;
  courseTitle?: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  checkoutUrl: string | null;
  emailSentAt: string | null;
  orderCreatedAt?: string | null;
  orderStatus?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount} ${currency || 'USD'}`;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: CustomPaymentOfferLinkStatus): string {
  if (status === 'Accepted') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Waiting') return 'bg-amber-50 text-amber-700';
  if (status === 'Failed') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

export default function CustomPaymentOffer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OfferResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [notice, setNotice] = useState('');
  const [resendingId, setResendingId] = useState<number | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('90');
  const [discountReason, setDiscountReason] = useState('');

  async function loadOffers() {
    const rows = await api.get<SentOffer[]>('/custom-payment-offers?limit=100');
    setOffers(rows);
  }

  useEffect(() => {
    Promise.all([
      api.get<Course[]>('/courses/active'),
      api.get<SentOffer[]>('/custom-payment-offers?limit=100'),
    ])
      .then(([courseRows, offerRows]) => {
        setCourses(courseRows.filter(c => c.zenlerCourseId));
        setOffers(offerRows);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load the payment form'))
      .finally(() => {
        setLoadingCourses(false);
        setLoadingOffers(false);
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setResult(null);
    setCopied(false);
    setSubmitting(true);

    try {
      const data = await api.post<OfferResult>('/custom-payment-offers', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        courseId: courseId ? Number(courseId) : null,
        description: courseId ? '' : description.trim(),
        amount: Number(amount),
        durationDays: courseId ? Number(durationDays) : null,
        discountReason: discountReason.trim(),
      });
      setResult(data);
      setFirstName('');
      setLastName('');
      setEmail('');
      setCourseId('');
      setDescription('');
      setAmount('');
      setDurationDays('90');
      setDiscountReason('');
      try {
        await loadOffers();
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : 'The offer was sent, but the list could not be refreshed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment offer');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend(id: number) {
    setError('');
    setNotice('');
    setResendingId(id);
    try {
      const issued = await api.post<SentOffer>(`/custom-payment-offers/${id}/resend`, {});
      if (issued.emailSent) {
        setResult(null);
        setNotice(`Sent a new payment link to ${issued.studentEmail}. The previous link no longer works.`);
      } else {
        setError(`The previous link no longer works, but the new email could not be sent. ${issued.emailError ?? ''}`.trim());
        setResult({
          id: issued.id,
          paymentOrderId: 0,
          courseTitle: issued.courseTitle,
          studentFirstName: issued.studentFirstName,
          studentLastName: issued.studentLastName,
          studentEmail: issued.studentEmail,
          amount: issued.amount,
          currency: issued.currency,
          durationDays: issued.durationDays,
          checkoutUrl: issued.checkoutUrl,
          emailSent: false,
        });
      }
      try {
        await loadOffers();
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : 'The link was sent, but the list could not be refreshed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend that payment link.');
    } finally {
      setResendingId(null);
    }
  }

  async function copyCheckoutUrl() {
    if (!result?.checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(result.checkoutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy link to clipboard');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Customer Payment Form</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Create a USD payment for a student. Choose a course, or describe what the payment is for, then email a live checkout link.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <p className="font-semibold">
                {result.emailSent
                  ? 'Payment offer created and emailed to the student.'
                  : 'Payment offer created, but the email could not be sent. Share the link below manually.'}
              </p>
              <p className="mt-2">
                {result.studentFirstName} {result.studentLastName} · {result.studentEmail}
              </p>
              <p className="mt-1">
                {result.courseTitle} · {formatMoney(result.amount, result.currency)}
                {result.durationDays ? ` · ${result.durationDays} days access` : ''}
              </p>
              {result.checkoutUrl && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={result.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-emerald-800 underline"
                  >
                    {result.checkoutUrl}
                  </a>
                  <button type="button" onClick={copyCheckoutUrl} className="btn-ghost text-xs">
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">First name</span>
                <input
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Last name</span>
                <input
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Email address</span>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Course</span>
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                disabled={loadingCourses}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">{loadingCourses ? 'Loading courses…' : 'No course — add a description'}</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                Optional. Leave this blank to charge for something other than a course.
              </span>
            </label>

            {!courseId && (
              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Description</span>
                <textarea
                  required
                  rows={3}
                  maxLength={200}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="e.g. Exam resit fee for the June sitting."
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Shown to the student and used as the payment description. No course access is granted.
                </span>
              </label>
            )}

            <div className={`mt-4 grid gap-4 ${courseId ? 'sm:grid-cols-2' : ''}`}>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Price (USD)</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">$</span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    placeholder="0.00"
                  />
                </div>
              </label>
              {courseId && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Duration (days)</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={durationDays}
                    onChange={e => setDurationDays(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </label>
              )}
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Reason for discount</span>
              <textarea
                required
                rows={4}
                value={discountReason}
                onChange={e => setDiscountReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                placeholder="e.g. Student failed exams and requested a resit at a special rate."
              />
              <span className="mt-1 block text-xs text-slate-400">
                Stored for admin audit only — not shown to the student.
              </span>
            </label>

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating & sending…' : 'Create offer & email student'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Sent payment requests</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Accepted means the student has paid. A course on the request is opened after payment. A description-only request does not grant course access.
              </p>
            </div>
            {notice ? <p className="px-4 pt-3 text-sm text-emerald-700">{notice}</p> : null}
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Course / description</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loadingOffers ? (
                  <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>Loading payment requests…</td></tr>
                ) : offers.length === 0 ? (
                  <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>No payment requests yet.</td></tr>
                ) : offers.map(row => {
                  const status = customPaymentOfferLinkStatus({
                    orderStatus: row.orderStatus,
                    checkoutIssuedAt: row.orderCreatedAt,
                  });
                  return (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <div>{row.studentFirstName} {row.studentLastName}</div>
                        <div className="text-xs text-slate-500">{row.studentEmail}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.courseTitle ?? '—'}</div>
                        {row.durationDays ? (
                          <div className="text-xs text-slate-500">{row.durationDays} days access</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatMoney(row.amount, row.currency)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {row.emailSentAt ? formatDateTime(row.emailSentAt) : 'Not sent'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {customPaymentOfferCanResend(status) ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-blue-700 disabled:opacity-60"
                            disabled={resendingId !== null}
                            onClick={() => { void resend(row.id); }}
                          >
                            {resendingId === row.id ? 'Sending…' : 'Resend'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
