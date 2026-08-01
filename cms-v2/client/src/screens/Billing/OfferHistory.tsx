import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface CustomPaymentOfferRow {
  id: number;
  paymentOrderId: number;
  courseTitle?: string;
  createdByName?: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number;
  discountReason: string;
  checkoutUrl: string | null;
  emailSentAt: string | null;
  createdAt: string;
  orderStatus?: string | null;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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

export default function OfferHistory() {
  const [offers, setOffers] = useState<CustomPaymentOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<CustomPaymentOfferRow[]>('/custom-payment-offers')
      .then(setOffers)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load offers'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Offer History</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Recently created custom / resit payment offers and their payment status.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading offers…</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-slate-500">No custom payment offers yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {offers.map(offer => (
                  <tr key={offer.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <div>{formatDateTime(offer.createdAt)}</div>
                      {offer.createdByName && (
                        <div className="text-xs text-slate-400">{offer.createdByName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {offer.studentFirstName} {offer.studentLastName}
                      </div>
                      <div className="text-xs text-slate-500">{offer.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{offer.courseTitle ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                      {formatUsd(offer.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {offer.durationDays} days
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          offer.orderStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {offer.orderStatus ?? 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {offer.emailSentAt ? formatDateTime(offer.emailSentAt) : 'Not sent'}
                    </td>
                    <td className="px-4 py-3 max-w-xs text-slate-600">
                      <p className="line-clamp-3 whitespace-pre-wrap">{offer.discountReason}</p>
                    </td>
                    <td className="px-4 py-3">
                      {offer.checkoutUrl ? (
                        <a
                          href={offer.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand underline"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
