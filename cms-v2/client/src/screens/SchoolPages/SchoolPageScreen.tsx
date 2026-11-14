import { useState } from 'react';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

export default function SchoolPageScreen({
  title,
  hint,
  sectionName,
  html,
  previewStates,
}: {
  title: string;
  hint: string;
  sectionName: string;
  html: string;
  previewStates?: { id: string; label: string }[];
}) {
  const wrapped = wrapGeneratedHtml(sectionName, html);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [copied, setCopied] = useState(false);
  const [previewState, setPreviewState] = useState(previewStates?.[0]?.id ?? '');

  async function copy() {
    await navigator.clipboard.writeText(wrapped);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const stateAttr = previewState ? ` data-vls-school-state="${previewState}"` : '';
  const previewDoc = `<!doctype html><html${stateAttr}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${wrapped}</body></html>`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
        </div>
        <button type="button" onClick={() => { void copy(); }} className="btn-primary shrink-0">
          {copied ? 'Copied' : 'Copy HTML'}
        </button>
      </div>
      {previewStates && previewStates.length > 1 ? (
        <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-white px-4 py-3">
          {previewStates.map(state => (
            <button
              key={state.id}
              type="button"
              onClick={() => { setPreviewState(state.id); setActiveTab('preview'); }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                previewState === state.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {state.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex shrink-0 border-b border-slate-200 bg-white px-4">
        {(['preview', 'html'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${
              activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab === 'html' ? 'HTML' : 'Preview'}
          </button>
        ))}
      </div>
      {activeTab === 'preview' ? (
        <iframe
          title={title}
          srcDoc={previewDoc}
          className="min-h-0 w-full flex-1 border-0 bg-slate-50"
          sandbox="allow-same-origin allow-scripts"
        />
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          {wrapped}
        </pre>
      )}
    </div>
  );
}
