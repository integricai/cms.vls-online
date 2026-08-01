import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type {
  QualificationOfferRule,
  QualificationOfferType,
} from '../../../../shared/types';

type RuleDraft = {
  key: string;
  qualification: string;
  offerType: QualificationOfferType;
  durationDaysText: string;
  examMonths: number[];
  cutoffDay: string;
  isActive: boolean;
  sortOrder: number;
};

type PreviewPlan = {
  durationDays: number;
  durationLabel: string;
  sessionMonth: number | null;
  sessionYear: number | null;
  sessionTitle: string;
};

type PreviewResult = {
  offerType: QualificationOfferType;
  asOf: string;
  plans: PreviewPlan[];
};

const MONTHS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

function emptyRule(sortOrder: number): RuleDraft {
  return {
    key: `new-${sortOrder}-${Date.now()}`,
    qualification: '',
    offerType: 'exam_sessions',
    durationDaysText: '90, 180',
    examMonths: [3, 6, 9, 12],
    cutoffDay: '12',
    isActive: true,
    sortOrder,
  };
}

function parseDurationDays(text: string): number[] {
  return [...new Set(
    text
      .split(/[,\s]+/)
      .map(v => Number(v.trim()))
      .filter(n => Number.isInteger(n) && n > 0),
  )].sort((a, b) => a - b);
}

function toDraft(rule: QualificationOfferRule): RuleDraft {
  return {
    key: `id-${rule.id}`,
    qualification: rule.qualification,
    offerType: rule.offerType,
    durationDaysText: rule.durationDays.join(', '),
    examMonths: [...rule.examMonths].sort((a, b) => a - b),
    cutoffDay: rule.cutoffDay == null ? '' : String(rule.cutoffDay),
    isActive: rule.isActive,
    sortOrder: rule.sortOrder,
  };
}

function toPayload(rule: RuleDraft) {
  const durationDays = parseDurationDays(rule.durationDaysText);
  const cutoffRaw = rule.cutoffDay.trim();
  return {
    qualification: rule.qualification.trim(),
    offerType: rule.offerType,
    durationDays,
    examMonths: rule.offerType === 'exam_sessions' ? rule.examMonths : [],
    cutoffDay: rule.offerType === 'exam_sessions' && cutoffRaw !== ''
      ? Number(cutoffRaw)
      : null,
    isActive: rule.isActive,
    sortOrder: rule.sortOrder,
  };
}

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function QualificationOfferRulesTab() {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [asOf, setAsOf] = useState(todayInputValue);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);

  async function loadRules() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<QualificationOfferRule[]>('/qualification-offer-rules');
      const drafts = (data ?? []).map(toDraft);
      setRules(drafts.length > 0 ? drafts : [emptyRule(10)]);
      setPreviewIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offer rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  function updateRule(index: number, patch: Partial<RuleDraft>) {
    setRules(prev => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function toggleMonth(index: number, month: number) {
    setRules(prev => prev.map((rule, i) => {
      if (i !== index) return rule;
      const has = rule.examMonths.includes(month);
      const examMonths = has
        ? rule.examMonths.filter(m => m !== month)
        : [...rule.examMonths, month].sort((a, b) => a - b);
      return { ...rule, examMonths };
    }));
  }

  function addRule() {
    setRules(prev => [...prev, emptyRule((prev.length + 1) * 10)]);
  }

  function removeRule(index: number) {
    setRules(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function saveRules() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = rules.map(toPayload);
      for (const rule of payload) {
        if (!rule.qualification) throw new Error('Each rule needs a qualification name');
        if (rule.durationDays.length === 0) {
          throw new Error(`${rule.qualification}: add at least one duration in days`);
        }
      }
      const data = await api.put<QualificationOfferRule[]>('/qualification-offer-rules', { rules: payload });
      setRules((data ?? []).map(toDraft));
      setMessage('Qualification offer rules saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save offer rules');
    } finally {
      setSaving(false);
    }
  }

  const selectedRule = rules[previewIndex] ?? rules[0] ?? null;

  async function runPreview() {
    if (!selectedRule) return;
    setPreviewing(true);
    setPreviewError('');
    try {
      const data = await api.post<PreviewResult>('/qualification-offer-rules/preview', {
        rule: toPayload(selectedRule),
        asOf: `${asOf}T12:00:00`,
      });
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  const previewSignature = selectedRule
    ? [
      selectedRule.qualification,
      selectedRule.offerType,
      selectedRule.durationDaysText,
      selectedRule.examMonths.join(','),
      selectedRule.cutoffDay,
      selectedRule.isActive ? '1' : '0',
    ].join('|')
    : '';

  useEffect(() => {
    if (!selectedRule || loading) return;
    void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, asOf, loading, previewSignature]);

  const monthSummary = useMemo(() => {
    if (!selectedRule || selectedRule.offerType !== 'exam_sessions') return 'Any time';
    if (selectedRule.examMonths.length === 0) return 'None selected';
    return selectedRule.examMonths
      .map(m => MONTHS.find(x => x.value === m)?.label ?? m)
      .join(', ');
  }, [selectedRule]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading qualification offer rules…</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 max-w-3xl">
        <h2 className="text-base font-semibold text-slate-800">Qualification Offer Rules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Map each qualification to the durations you sell and, for exam-based quals (e.g. ACCA),
          the exam months plus an enrollment cutoff day. Session labels on course prices roll
          forward automatically from that cutoff.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={rule.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">
                Rule {index + 1}
                {rule.qualification ? ` — ${rule.qualification}` : ''}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={event => updateRule(index, { isActive: event.target.checked })}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setPreviewIndex(index)}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                  disabled={rules.length <= 1}
                  onClick={() => removeRule(index)}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs text-slate-600">
                Qualification
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="ACCA"
                  value={rule.qualification}
                  onChange={event => updateRule(index, { qualification: event.target.value })}
                />
              </label>

              <label className="block text-xs text-slate-600">
                Offer type
                <select
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={rule.offerType}
                  onChange={event => {
                    const offerType = event.target.value as QualificationOfferType;
                    updateRule(index, {
                      offerType,
                      examMonths: offerType === 'exam_sessions' ? (rule.examMonths.length ? rule.examMonths : [3, 6, 9, 12]) : [],
                      cutoffDay: offerType === 'exam_sessions' ? (rule.cutoffDay || '12') : '',
                      durationDaysText: offerType === 'open' && !rule.durationDaysText.trim()
                        ? '180, 365'
                        : rule.durationDaysText,
                    });
                  }}
                >
                  <option value="exam_sessions">Exam sessions</option>
                  <option value="open">Open / subscription</option>
                </select>
              </label>

              <label className="block text-xs text-slate-600">
                Duration days
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm"
                  placeholder="90, 180"
                  value={rule.durationDaysText}
                  onChange={event => updateRule(index, { durationDaysText: event.target.value })}
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  e.g. 90, 180 or 180, 365
                </span>
              </label>

              <label className="block text-xs text-slate-600">
                Cutoff day
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
                  placeholder="12"
                  disabled={rule.offerType !== 'exam_sessions'}
                  value={rule.cutoffDay}
                  onChange={event => updateRule(index, { cutoffDay: event.target.value })}
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Last day of prior month to sell the next sitting
                </span>
              </label>
            </div>

            {rule.offerType === 'exam_sessions' ? (
              <div className="mt-3">
                <div className="mb-1.5 text-xs text-slate-600">Exam months</div>
                <div className="flex flex-wrap gap-2">
                  {MONTHS.map(month => {
                    const selected = rule.examMonths.includes(month.value);
                    return (
                      <button
                        key={month.value}
                        type="button"
                        onClick={() => toggleMonth(index, month.value)}
                        className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
                          selected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {month.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Students can sit exams any time. Plan labels stay as durations (no exam session titles).
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={addRule}
        >
          Add rule
        </button>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
          onClick={() => void saveRules()}
        >
          {saving ? 'Saving…' : 'Save offer rules'}
        </button>
      </div>

      <div className="mt-8 max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Live preview</div>
            <p className="mt-0.5 text-xs text-slate-500">
              {selectedRule
                ? `${selectedRule.qualification || 'Untitled'} · ${selectedRule.offerType === 'exam_sessions' ? monthSummary : 'Open / anytime'}`
                : 'No rule selected'}
            </p>
          </div>
          <label className="ml-auto block text-xs text-slate-600">
            As of
            <input
              type="date"
              className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={asOf}
              onChange={event => setAsOf(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            disabled={previewing || !selectedRule}
            onClick={() => void runPreview()}
          >
            {previewing ? 'Updating…' : 'Refresh'}
          </button>
        </div>

        {previewError ? <p className="mt-3 text-sm text-red-600">{previewError}</p> : null}

        {preview ? (
          <ul className="mt-3 space-y-2">
            {preview.plans.map(plan => (
              <li
                key={`${plan.durationDays}-${plan.sessionTitle}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-600">{plan.durationLabel}</span>
                <span className="font-medium text-slate-900">{plan.sessionTitle}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
