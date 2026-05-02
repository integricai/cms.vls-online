import type { TextData } from '../types/cms';
import { normalize, type DefaultKey } from '../utils/text';

interface Props {
  label: string;
  hint?: string;
  value: TextData;
  defaultKey: DefaultKey;
  onChange: (v: TextData) => void;
  multiline?: boolean;
  placeholder?: string;
}

const FONT_WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi-bold' },
  { value: '700', label: 'Bold' },
] as const;

export default function RichTextField({ label, hint, value, defaultKey, onChange, multiline, placeholder }: Props) {
  const td = normalize(value, defaultKey);

  function patch(partial: Partial<TextData>) {
    onChange({ ...td, ...partial });
  }

  return (
    <div className="mb-3">
      <label className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>

      {multiline ? (
        <textarea
          rows={3}
          value={td.text}
          placeholder={placeholder}
          onChange={e => patch({ text: e.target.value })}
          className="input resize-y"
        />
      ) : (
        <input
          type="text"
          value={td.text}
          placeholder={placeholder}
          onChange={e => patch({ text: e.target.value })}
          className="input"
        />
      )}

      {multiline && (
        <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">HTML allowed — e.g. &lt;strong&gt;, &lt;br&gt;, &lt;p&gt;</p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-lg border border-slate-100 bg-slate-50 p-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Size</span>
          <input
            type="number"
            value={td.size}
            min={8} max={120}
            onChange={e => patch({ size: Number(e.target.value) })}
            className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Color</span>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(td.color) ? td.color : '#000000'}
            onChange={e => patch({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
          />
          <input
            type="text"
            value={td.color}
            maxLength={7}
            onChange={e => patch({ color: e.target.value })}
            className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Weight</span>
          <select
            value={td.weight}
            onChange={e => patch({ weight: e.target.value })}
            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-brand"
          >
            {FONT_WEIGHTS.map(w => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Spacing</span>
          <input
            type="number"
            value={td.letterSpacing}
            min={-0.1} max={1} step={0.01}
            onChange={e => patch({ letterSpacing: Number(e.target.value) })}
            className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
          />
        </div>
      </div>
    </div>
  );
}
