import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { PricingRegionConfig } from '../../../../shared/types';

type RegionDraft = PricingRegionConfig;

function emptyRegion(sortOrder: number): RegionDraft {
  return {
    code: '',
    label: '',
    discountPercent: 0,
    isActive: true,
    sortOrder,
    countries: [],
  };
}

function parseCountries(value: string): string[] {
  return [...new Set(
    value
      .split(/[,\s]+/)
      .map(code => code.trim().toUpperCase())
      .filter(code => /^[A-Z]{2}$/.test(code)),
  )].sort();
}

export default function GeoPricingTab() {
  const [regions, setRegions] = useState<RegionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadRegions() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<RegionDraft[]>('/pricing-regions');
      setRegions(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load geo pricing regions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegions();
  }, []);

  function updateRegion(index: number, patch: Partial<RegionDraft>) {
    setRegions(prev => prev.map((region, i) => (i === index ? { ...region, ...patch } : region)));
  }

  function addRegion() {
    setRegions(prev => [...prev, emptyRegion((prev.length + 1) * 10)]);
  }

  function removeRegion(index: number) {
    setRegions(prev => prev.filter((_, i) => i !== index));
  }

  async function saveRegions() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = regions.map((region, index) => ({
        code: region.code.trim().toUpperCase().replace(/\s+/g, '_'),
        label: region.label.trim(),
        discountPercent: Number(region.discountPercent) || 0,
        isActive: region.isActive,
        sortOrder: region.sortOrder || (index + 1) * 10,
        countries: region.countries,
      }));

      for (const region of payload) {
        if (!region.code || !region.label) {
          throw new Error('Each region needs a code and label');
        }
      }

      const data = await api.put<RegionDraft[]>('/pricing-regions', { regions: payload });
      setRegions(data ?? payload);
      setMessage('Geo pricing regions saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save geo pricing regions');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading geo pricing…</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 max-w-3xl">
        <h2 className="text-base font-semibold text-slate-800">Geo Pricing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Map ISO country codes to pricing regions. Visitors from mapped countries receive the region
          discount off the list price (then the lower of geo vs campaign price applies). Countries not
          listed here use standard course pricing only.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Discount %</th>
              <th className="px-4 py-3">Countries (ISO)</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {regions.map((region, index) => (
              <tr key={`${region.code || 'new'}-${index}`} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <input
                    className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-xs uppercase"
                    placeholder="SOUTH_ASIA"
                    value={region.code}
                    onChange={event => updateRegion(index, { code: event.target.value })}
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1.5"
                    placeholder="South Asia"
                    value={region.label}
                    onChange={event => updateRegion(index, { label: event.target.value })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="w-24 rounded border border-slate-200 px-2 py-1.5"
                    value={region.discountPercent}
                    onChange={event => updateRegion(index, { discountPercent: Number(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <textarea
                    className="min-h-[72px] w-full min-w-[220px] rounded border border-slate-200 px-2 py-1.5 font-mono text-xs uppercase"
                    placeholder="PK, IN, BD"
                    value={region.countries.join(', ')}
                    onChange={event => updateRegion(index, { countries: parseCountries(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={region.isActive}
                    onChange={event => updateRegion(index, { isActive: event.target.checked })}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => removeRegion(index)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={addRegion}
        >
          Add region
        </button>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
          onClick={() => void saveRegions()}
        >
          {saving ? 'Saving…' : 'Save geo pricing'}
        </button>
      </div>
    </div>
  );
}
