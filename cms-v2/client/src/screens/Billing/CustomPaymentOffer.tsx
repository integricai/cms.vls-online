import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../api/client';
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
  durationDays: number;
  checkoutUrl: string | null;
  emailSent: boolean;
  orderStatus?: string | null;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function CustomPaymentOffer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OfferResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('90');
  const [discountReason, setDiscountReason] = useState('');

  useEffect(() => {
    api.get<Course[]>('/courses/active')
      .then(rows => setCourses(rows.filter(c => c.zenlerCourseId)))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load courses'))
      .finally(() => setLoadingCourses(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    setCopied(false);
    setSubmitting(true);

    try {
      const data = await api.post<OfferResult>('/custom-payment-offers', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        courseId: Number(courseId),
        amount: Number(amount),
        durationDays: Number(durationDays),
        discountReason: discountReason.trim(),
      });
      setResult(data);
      setFirstName('');
      setLastName('');
      setEmail('');
      setCourseId('');
      setAmount('');
      setDurationDays('90');
      setDiscountReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment offer');
    } finally {
      setSubmitting(false);
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
        <h1 className="text-lg font-bold text-slate-800">Custom Payment Offer</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Create a special USD price for a student (e.g. exam resit), generate a Stripe checkout link, and email it to them.
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
                {result.courseTitle} · {formatUsd(result.amount)} · {result.durationDays} days access
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
                required
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                disabled={loadingCourses}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">{loadingCourses ? 'Loading courses…' : 'Select a course'}</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              <button type="submit" disabled={submitting || loadingCourses} className="btn-primary">
                {submitting ? 'Creating & sending…' : 'Create offer & email student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
