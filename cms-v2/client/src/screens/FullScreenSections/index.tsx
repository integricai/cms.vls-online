import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type {
  DcsState, DcsComponent, DcsCard,
  Dcs2State, Dcs2Component, DcsStat,
  Dcs3State, Dcs3Component, Dcs3Feature, Dcs3Tag,
  ReachState, ReachComponent, ReachStat, ReachRegion,
  PhbState, PhbComponent,
  Phv2State, Phv2Component, Phv2TrustItem, Phv2Card,
  BmsState, BmsComponent, BmsCheckItem,
  TextValue,
} from '../../types/cms';
import { normalize } from '../../utils/text';
import {
  generateDcsHtml, generateDcs2Html, generateDcs3Html, generateReachHtml,
  generatePhbHtml, generatePhv2Html, generateBmsHtml,
} from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function tv<K extends Parameters<typeof normalize>[1]>(v: TextValue, k: K) { return normalize(v as any, k); }
function hex(v: string, fb = '#ffffff') { return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb; }

// ── Default states ─────────────────────────────────────────────────────────────

function makeDcs(): DcsState {
  return { padTop: 60, padBot: 60, padLeft: 20, padRight: 20, leftWidth: 50, leftBg: '#ffffff', rightBg: '#132239', cardBg: '#1e3550', leftLabel: normalize('', 'dcsLabel'), leftTitle: normalize('', 'dcsTitle'), leftParas: [normalize('', 'dcsPara')], rightLabel: normalize('', 'dcsLabel'), cards: [] };
}
function makeDcs2(): Dcs2State {
  return { padTop: 60, padBot: 60, padLeft: 20, padRight: 20, leftWidth: 50, leftBg: '#132239', rightBg: '#f9fafb', leftLabel: normalize('', 'dcs2Label'), leftTitle: normalize('', 'dcs2Title'), leftParas: [normalize('', 'dcs2Para')], bulletColor: '#eef2f8', leftBullets: [], rightLabel: normalize('', 'dcs2RLabel'), statBg: '#ffffff', statBorder: '#e5e7eb', statsPerRow: 2, stats: [], quoteShow: false, quoteBg: '#eef2f8', quoteText: normalize('', 'dcs2Quote'), quoteAttrib: normalize('', 'dcs2Attrib') };
}
function makeDcs3(): Dcs3State {
  return { padTop: 60, padBot: 60, leftPadH: 20, rightPadH: 20, leftWidth: 60, leftBg: '#f8fafc', rightBg: '#1a56a3', checkColor: '#1a56a3', featBg: '#ffffff', featCols: 2, tagBg: '#ffffff26', ctaUrl: '', ctaColor: '#ffffff', ctaBorder: '#ffffff', ctaFill: '#1a56a3', leftLabel: normalize('', 'dcs3Label'), leftTitle: normalize('', 'dcs3Title'), leftPara: normalize('', 'dcs3Para'), rightLabel: normalize('', 'dcs3RLabel'), rightTitle: normalize('', 'dcs3RTitle'), rightPara: normalize('', 'dcs3RPara'), ctaText: normalize('', 'dcs3Cta'), features: [], tags: [] };
}
function makeReach(): ReachState {
  return { padTop: 60, padBot: 60, padLeft: 48, padRight: 48, bg: '#0d1f3c', leftWidth: 45, statBg: '#1e3550', imgHeight: 300, imgBg: '#1e3550', imgUrl: '', imgAlt: '', imgPlaceholder: 'Map image', regionBg: '#1e3550', label: normalize('', 'reachLabel'), title: normalize('', 'reachTitle'), para: normalize('', 'reachPara'), stats: [], regions: [] };
}
function makePhb(): PhbState {
  return { bg: '#0d1f3c', radius: 0, padTop: 40, padBot: 40, padLeft: 60, padRight: 60, eyebrow: '', eyebrowTc: '#4a90d9', showDot: true, dotColor: '#4a90d9', heading: normalize('', 'phbHeading'), bulletTc: '#c7d2e0', sepColor: '#4a90d9', bullets: [], showBadge: false, badgeBg: '#1a3a6e', badgeRadius: 12, badgeEyebrow: '', badgeEyebrowTc: '#c7d2e0', badgeMain: normalize('', 'phbBadgeMain'), badgeSub: '', badgeSubTc: '#c7d2e0' };
}
function makePhv2(): Phv2State {
  return { bg: '#0d1f3c', padTop: 48, padBot: 48, padLeft: 60, padRight: 60, split: 60, colGap: 48, breadcrumb: '', breadcrumbTc: '#94a3b8', eyebrowTc: '#4a90d9', eyebrowDot: '#4a90d9', eyebrowLabels: [], heading: normalize('', 'phv2Heading'), headingAccent: '', headingAccentColor: '#4a90d9', headingPost: '', desc: normalize('', 'phv2Desc'), trustTc: '#94a3b8', trustDot: '#4a90d9', trustItems: [], cardBg: '#0f2744', cardBorder: '#1e3a5f', cardRadius: 10, cardVc: '#ffffff', cardLc: '#94a3b8', cards: [] };
}

function makeBms(): BmsState {
  return {
    bg: '#ffffff', padTop: 60, padBot: 60, padLeft: 60, padRight: 60,
    imgUrl: '', imgAlt: '', imgSplit: 45, imgFit: 'cover', imgPosition: 'center',
    eyebrow: '', eyebrowColor: '#1a56a3', eyebrowDot: true,
    headingPre: normalize('', 'bmsHeadingPre'), headingAccent: '', headingAccentColor: '#1a56a3',
    desc: normalize('', 'bmsDesc'),
    checkColor: '#1a56a3', checks: [],
    ctaText: normalize('', 'bmsCta'), ctaUrl: '', ctaBg: '#1a56a3', ctaTc: '#ffffff',
    footerNote: '', footerNoteTc: '#6b7280',
  };
}

function normBms(raw: any): BmsState {
  return {
    bg: raw.bg || '#ffffff',
    padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
    padLeft: normalizeNum(raw.padLeft, 60), padRight: normalizeNum(raw.padRight, 60),
    imgUrl: raw.imgUrl || '', imgAlt: raw.imgAlt || '',
    imgSplit: normalizeNum(raw.imgSplit, 45),
    imgFit: raw.imgFit || 'cover', imgPosition: raw.imgPosition || 'center',
    eyebrow: raw.eyebrow || '', eyebrowColor: raw.eyebrowColor || '#1a56a3',
    eyebrowDot: raw.eyebrowDot !== false,
    headingPre: raw.headingPre || normalize('', 'bmsHeadingPre'),
    headingAccent: raw.headingAccent || '', headingAccentColor: raw.headingAccentColor || '#1a56a3',
    desc: raw.desc || normalize('', 'bmsDesc'),
    checkColor: raw.checkColor || '#1a56a3',
    checks: (raw.checks || []),
    ctaText: raw.ctaText || normalize('', 'bmsCta'),
    ctaUrl: raw.ctaUrl || '', ctaBg: raw.ctaBg || '#1a56a3', ctaTc: raw.ctaTc || '#ffffff',
    footerNote: raw.footerNote || '', footerNoteTc: raw.footerNoteTc || '#6b7280',
  };
}

function normalizeNum(v: unknown, fb: number) { const n = Number(v); return isNaN(n) ? fb : n; }

function normDcs(raw: any): DcsState {
  return {
    padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
    padLeft: normalizeNum(raw.padLeft, 20), padRight: normalizeNum(raw.padRight, 20),
    leftWidth: normalizeNum(raw.leftWidth, 50), leftBg: raw.leftBg || '#ffffff',
    rightBg: raw.rightBg || '#132239', cardBg: raw.cardBg || '#1e3550',
    leftLabel: raw.leftLabel || normalize('', 'dcsLabel'),
    leftTitle: raw.leftTitle || normalize('', 'dcsTitle'),
    leftParas: (raw.leftParas || [normalize('', 'dcsPara')]),
    rightLabel: raw.rightLabel || normalize('', 'dcsLabel'),
    cards: (raw.cards || []),
  };
}
function normDcs2(raw: any): Dcs2State {
  return {
    padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
    padLeft: normalizeNum(raw.padLeft, 20), padRight: normalizeNum(raw.padRight, 20),
    leftWidth: normalizeNum(raw.leftWidth, 50), leftBg: raw.leftBg || '#132239', rightBg: raw.rightBg || '#f9fafb',
    leftLabel: raw.leftLabel || normalize('', 'dcs2Label'),
    leftTitle: raw.leftTitle || normalize('', 'dcs2Title'),
    leftParas: raw.leftParas || [normalize('', 'dcs2Para')],
    bulletColor: raw.bulletColor || '#eef2f8',
    leftBullets: raw.leftBullets || [],
    rightLabel: raw.rightLabel || normalize('', 'dcs2RLabel'),
    statBg: raw.statBg || '#ffffff', statBorder: raw.statBorder || '#e5e7eb',
    statsPerRow: normalizeNum(raw.statsPerRow, 2), stats: raw.stats || [],
    quoteShow: !!raw.quoteShow, quoteBg: raw.quoteBg || '#eef2f8',
    quoteText: raw.quoteText || normalize('', 'dcs2Quote'),
    quoteAttrib: raw.quoteAttrib || normalize('', 'dcs2Attrib'),
  };
}
function normDcs3(raw: any): Dcs3State {
  return {
    padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
    leftPadH: normalizeNum(raw.leftPadH, 20), rightPadH: normalizeNum(raw.rightPadH, 20),
    leftWidth: normalizeNum(raw.leftWidth, 60), leftBg: raw.leftBg || '#f8fafc', rightBg: raw.rightBg || '#1a56a3',
    checkColor: raw.checkColor || '#1a56a3', featBg: raw.featBg || '#ffffff',
    featCols: normalizeNum(raw.featCols, 2), tagBg: raw.tagBg || '#ffffff26',
    ctaUrl: raw.ctaUrl || '', ctaColor: raw.ctaColor || '#ffffff',
    ctaBorder: raw.ctaBorder || '#ffffff', ctaFill: raw.ctaFill || '#1a56a3',
    leftLabel: raw.leftLabel || normalize('', 'dcs3Label'),
    leftTitle: raw.leftTitle || normalize('', 'dcs3Title'),
    leftPara: raw.leftPara || normalize('', 'dcs3Para'),
    rightLabel: raw.rightLabel || normalize('', 'dcs3RLabel'),
    rightTitle: raw.rightTitle || normalize('', 'dcs3RTitle'),
    rightPara: raw.rightPara || normalize('', 'dcs3RPara'),
    ctaText: raw.ctaText || normalize('', 'dcs3Cta'),
    features: raw.features || [], tags: raw.tags || [],
  };
}
function normReach(raw: any): ReachState {
  return {
    padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
    padLeft: normalizeNum(raw.padLeft, 48), padRight: normalizeNum(raw.padRight, 48),
    bg: raw.bg || '#0d1f3c', leftWidth: normalizeNum(raw.leftWidth, 45),
    statBg: raw.statBg || '#1e3550',
    imgHeight: normalizeNum(raw.imgHeight, 300), imgBg: raw.imgBg || '#1e3550',
    imgUrl: raw.imgUrl || '', imgAlt: raw.imgAlt || '', imgPlaceholder: raw.imgPlaceholder || '',
    regionBg: raw.regionBg || '#1e3550',
    label: raw.label || normalize('', 'reachLabel'),
    title: raw.title || normalize('', 'reachTitle'),
    para: raw.para || normalize('', 'reachPara'),
    stats: raw.stats || [], regions: raw.regions || [],
  };
}
function normPhb(raw: any): PhbState {
  return {
    bg: raw.bg || '#0d1f3c', radius: normalizeNum(raw.radius, 0),
    padTop: normalizeNum(raw.padTop, 40), padBot: normalizeNum(raw.padBot, 40),
    padLeft: normalizeNum(raw.padLeft, 60), padRight: normalizeNum(raw.padRight, 60),
    eyebrow: raw.eyebrow || '', eyebrowTc: raw.eyebrowTc || '#4a90d9',
    showDot: raw.showDot !== false, dotColor: raw.dotColor || '#4a90d9',
    heading: raw.heading || normalize('', 'phbHeading'),
    bulletTc: raw.bulletTc || '#c7d2e0', sepColor: raw.sepColor || '#4a90d9',
    bullets: raw.bullets || [],
    showBadge: !!raw.showBadge, badgeBg: raw.badgeBg || '#1a3a6e',
    badgeRadius: normalizeNum(raw.badgeRadius, 12),
    badgeEyebrow: raw.badgeEyebrow || '', badgeEyebrowTc: raw.badgeEyebrowTc || '#c7d2e0',
    badgeMain: raw.badgeMain || normalize('', 'phbBadgeMain'),
    badgeSub: raw.badgeSub || '', badgeSubTc: raw.badgeSubTc || '#c7d2e0',
  };
}
function normPhv2(raw: any): Phv2State {
  return {
    bg: raw.bg || '#0d1f3c',
    padTop: normalizeNum(raw.padTop, 48), padBot: normalizeNum(raw.padBot, 48),
    padLeft: normalizeNum(raw.padLeft, 60), padRight: normalizeNum(raw.padRight, 60),
    split: normalizeNum(raw.split, 60), colGap: normalizeNum(raw.colGap, 48),
    breadcrumb: raw.breadcrumb || '', breadcrumbTc: raw.breadcrumbTc || '#94a3b8',
    eyebrowTc: raw.eyebrowTc || '#4a90d9', eyebrowDot: raw.eyebrowDot || '#4a90d9',
    eyebrowLabels: raw.eyebrowLabels || [],
    heading: raw.heading || normalize('', 'phv2Heading'),
    headingAccent: raw.headingAccent || '', headingAccentColor: raw.headingAccentColor || '#4a90d9',
    headingPost: raw.headingPost || '',
    desc: raw.desc || normalize('', 'phv2Desc'),
    trustTc: raw.trustTc || '#94a3b8', trustDot: raw.trustDot || '#4a90d9',
    trustItems: raw.trustItems || [],
    cardBg: raw.cardBg || '#0f2744', cardBorder: raw.cardBorder || '#1e3a5f',
    cardRadius: normalizeNum(raw.cardRadius, 10),
    cardVc: raw.cardVc || '#ffffff', cardLc: raw.cardLc || '#94a3b8',
    cards: raw.cards || [],
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={hex(value)} onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
        <input type="text" value={value} className="input"
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value) || e.target.value.length <= 9) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

function PaddingRow({ value, onChange }: { value: { padTop: number; padBot: number; padLeft: number; padRight: number }; onChange: (p: Partial<typeof value>) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      {(['padTop', 'padBot', 'padLeft', 'padRight'] as const).map(k => (
        <Field key={k} label={k.replace('pad', 'Pad ').trim()}>
          <input type="number" className="input" min={0} max={240} value={value[k]} onChange={e => onChange({ [k]: Number(e.target.value) })} />
        </Field>
      ))}
    </div>
  );
}

interface CmpMgrProps<C> {
  components: C[]; activeId: string | null; name: string; saving: boolean; saved: boolean;
  onSelect: (id: string) => void; onNew: () => void; onDelete: () => void;
  onNameChange: (n: string) => void; onSave: () => void; onGenerate: () => void;
}
function CmpMgr<C extends { id: string; name: string }>({ components, activeId, name, saving, saved, onSelect, onNew, onDelete, onNameChange, onSave, onGenerate }: CmpMgrProps<C>) {
  return (
    <div className="border-b border-slate-100 bg-white px-5 py-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3">
        <p className="section-label mt-0">Saved Components</p>
        <div className="flex gap-2 mb-2">
          <select className="input flex-1" value={activeId || ''} onChange={e => onSelect(e.target.value)}>
            <option value="">— select —</option>
            {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={onNew} className="btn-ghost text-xs px-3">+ New</button>
          {activeId && <button onClick={onDelete} className="btn-danger text-xs px-3">Delete</button>}
        </div>
        <Field label="Component name">
          <input className="input" value={name} placeholder="e.g. About Us" onChange={e => onNameChange(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
        </button>
        <button onClick={onGenerate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
      </div>
    </div>
  );
}

// ── Tab sub-screens ────────────────────────────────────────────────────────────

function DcsTab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<DcsComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<DcsState>(makeDcs());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-dcs2-components').then(row => {
      const raw = row?.data as any;
      const cs: DcsComponent[] = (raw?.components || []).map((c: any) => ({ ...c, data: normDcs(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<DcsState>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makeDcs()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `dcs-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-dcs2-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete this component?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-dcs2-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makeDcs());
  }

  function updCard(i: number, p: Partial<DcsCard>) { const a = [...state.cards]; a[i] = { ...a[i], ...p }; upd({ cards: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Two Column v1', generateDcsHtml(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <PaddingRow value={state} onChange={upd} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Left width %"><input type="number" className="input" min={20} max={80} value={state.leftWidth} onChange={e => upd({ leftWidth: Number(e.target.value) })} /></Field>
          <ColorInput label="Card bg" value={state.cardBg} onChange={v => upd({ cardBg: v })} />
          <ColorInput label="Left bg" value={state.leftBg} onChange={v => upd({ leftBg: v })} />
          <ColorInput label="Right bg" value={state.rightBg} onChange={v => upd({ rightBg: v })} />
        </div>
        <p className="section-label mt-3">Left Column</p>
        <RichTextField label="Label" value={tv(state.leftLabel, 'dcsLabel')} defaultKey="dcsLabel" onChange={v => upd({ leftLabel: v })} />
        <RichTextField label="Title" value={tv(state.leftTitle, 'dcsTitle')} defaultKey="dcsTitle" onChange={v => upd({ leftTitle: v })} />
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Paragraphs</p>
        {state.leftParas.map((p, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              <RichTextField label={`Para ${i + 1}`} value={tv(p, 'dcsPara')} defaultKey="dcsPara" multiline
                onChange={v => { const a = [...state.leftParas]; a[i] = v; upd({ leftParas: a }); }} />
            </div>
            <button onClick={() => upd({ leftParas: state.leftParas.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ leftParas: [...state.leftParas, normalize('', 'dcsPara')] })} className="btn-ghost text-xs w-full">+ Add paragraph</button>
        <p className="section-label mt-3">Right Column</p>
        <RichTextField label="Label" value={tv(state.rightLabel, 'dcsLabel')} defaultKey="dcsLabel" onChange={v => upd({ rightLabel: v })} />
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Icon Cards</p>
        {state.cards.map((card, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 mb-2">
            <div className="flex gap-2 items-center mb-2">
              <span className="text-xs font-semibold text-slate-500 flex-1">Card {i + 1}</span>
              <button onClick={() => upd({ cards: state.cards.filter((_, idx) => idx !== i) })} className="btn-danger text-xs">✕</button>
            </div>
            <div className="flex gap-2 mb-2">
              <Field label="Icon emoji" className="w-24">
                <input className="input text-center text-lg" value={card.icon} onChange={e => updCard(i, { icon: e.target.value })} />
              </Field>
              <ColorInput label="Icon bg" value={card.iconBg} onChange={v => updCard(i, { iconBg: v })} />
            </div>
            <RichTextField label="Title" value={tv(card.title, 'dcsCardTitle')} defaultKey="dcsCardTitle" onChange={v => updCard(i, { title: v })} />
            <RichTextField label="Description" value={tv(card.desc, 'dcsCardDesc')} defaultKey="dcsCardDesc" multiline onChange={v => updCard(i, { desc: v })} />
          </div>
        ))}
        <button onClick={() => upd({ cards: [...state.cards, { icon: '⭐', iconBg: '#3b82f6', title: normalize('', 'dcsCardTitle'), desc: normalize('', 'dcsCardDesc') }] })} className="btn-ghost text-xs w-full">+ Add card</button>
      </div>
    </div>
  );
}

function Dcs2Tab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<Dcs2Component[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<Dcs2State>(makeDcs2());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-dcs-components').then(row => {
      const raw = row?.data as any;
      const cs: Dcs2Component[] = (raw?.components || []).map((c: any) => ({ ...c, data: normDcs2(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<Dcs2State>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makeDcs2()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `dcs2-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-dcs-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-dcs-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makeDcs2());
  }

  function updStat(i: number, p: Partial<DcsStat>) { const a = [...state.stats]; a[i] = { ...a[i], ...p }; upd({ stats: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Two Column v2', generateDcs2Html(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <PaddingRow value={state} onChange={upd} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Left width %"><input type="number" className="input" min={20} max={80} value={state.leftWidth} onChange={e => upd({ leftWidth: Number(e.target.value) })} /></Field>
          <Field label="Stats per row"><input type="number" className="input" min={1} max={4} value={state.statsPerRow} onChange={e => upd({ statsPerRow: Number(e.target.value) })} /></Field>
          <ColorInput label="Left bg" value={state.leftBg} onChange={v => upd({ leftBg: v })} />
          <ColorInput label="Right bg" value={state.rightBg} onChange={v => upd({ rightBg: v })} />
          <ColorInput label="Stat bg" value={state.statBg} onChange={v => upd({ statBg: v })} />
          <ColorInput label="Stat border" value={state.statBorder} onChange={v => upd({ statBorder: v })} />
        </div>
        <p className="section-label mt-3">Left Column</p>
        <RichTextField label="Label" value={tv(state.leftLabel, 'dcs2Label')} defaultKey="dcs2Label" onChange={v => upd({ leftLabel: v })} />
        <RichTextField label="Title" value={tv(state.leftTitle, 'dcs2Title')} defaultKey="dcs2Title" onChange={v => upd({ leftTitle: v })} />
        {state.leftParas.map((p, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              <RichTextField label={`Para ${i + 1}`} value={tv(p, 'dcs2Para')} defaultKey="dcs2Para" multiline
                onChange={v => { const a = [...state.leftParas]; a[i] = v; upd({ leftParas: a }); }} />
            </div>
            <button onClick={() => upd({ leftParas: state.leftParas.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ leftParas: [...state.leftParas, normalize('', 'dcs2Para')] })} className="btn-ghost text-xs w-full">+ Add paragraph</button>
        <div className="flex gap-2 items-center mt-2">
          <ColorInput label="Bullet colour" value={state.bulletColor} onChange={v => upd({ bulletColor: v })} />
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Bullet Points</p>
        {state.leftBullets.map((b, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              <RichTextField label={`Bullet ${i + 1}`} value={tv(b, 'dcs2Bullet')} defaultKey="dcs2Bullet"
                onChange={v => { const a = [...state.leftBullets]; a[i] = v; upd({ leftBullets: a }); }} />
            </div>
            <button onClick={() => upd({ leftBullets: state.leftBullets.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ leftBullets: [...state.leftBullets, normalize('', 'dcs2Bullet')] })} className="btn-ghost text-xs w-full">+ Add bullet</button>
        <p className="section-label mt-3">Right Column — Stats</p>
        <RichTextField label="Label" value={tv(state.rightLabel, 'dcs2RLabel')} defaultKey="dcs2RLabel" onChange={v => upd({ rightLabel: v })} />
        {state.stats.map((st, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <RichTextField label="Value" value={tv(st.value, 'dcs2StatVal')} defaultKey="dcs2StatVal" onChange={v => updStat(i, { value: v })} />
              <RichTextField label="Label" value={tv(st.label, 'dcs2StatLbl')} defaultKey="dcs2StatLbl" onChange={v => updStat(i, { label: v })} />
            </div>
            <button onClick={() => upd({ stats: state.stats.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ stats: [...state.stats, { value: normalize('', 'dcs2StatVal'), label: normalize('', 'dcs2StatLbl') }] })} className="btn-ghost text-xs w-full">+ Add stat</button>
        <p className="section-label mt-3">Quote (optional)</p>
        <label className="flex items-center gap-2 text-sm text-slate-600 mb-2 cursor-pointer">
          <input type="checkbox" checked={state.quoteShow} onChange={e => upd({ quoteShow: e.target.checked })} />
          Show quote block
        </label>
        {state.quoteShow && (
          <>
            <ColorInput label="Quote bg" value={state.quoteBg} onChange={v => upd({ quoteBg: v })} />
            <RichTextField label="Quote text" value={tv(state.quoteText, 'dcs2Quote')} defaultKey="dcs2Quote" multiline onChange={v => upd({ quoteText: v })} />
            <RichTextField label="Attribution" value={tv(state.quoteAttrib, 'dcs2Attrib')} defaultKey="dcs2Attrib" onChange={v => upd({ quoteAttrib: v })} />
          </>
        )}
      </div>
    </div>
  );
}

function Dcs3Tab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<Dcs3Component[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<Dcs3State>(makeDcs3());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-dcs3-components').then(row => {
      const raw = row?.data as any;
      const cs: Dcs3Component[] = (raw?.components || []).map((c: any) => ({ ...c, data: normDcs3(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<Dcs3State>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makeDcs3()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `dcs3-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-dcs3-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-dcs3-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makeDcs3());
  }

  function updFeat(i: number, p: Partial<Dcs3Feature>) { const a = [...state.features]; a[i] = { ...a[i], ...p }; upd({ features: a }); }
  function updTag(i: number, p: Partial<Dcs3Tag>) { const a = [...state.tags]; a[i] = { ...a[i], ...p }; upd({ tags: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Two Column v3', generateDcs3Html(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pad top"><input type="number" className="input" value={state.padTop} onChange={e => upd({ padTop: Number(e.target.value) })} /></Field>
          <Field label="Pad bot"><input type="number" className="input" value={state.padBot} onChange={e => upd({ padBot: Number(e.target.value) })} /></Field>
          <Field label="Left pad H"><input type="number" className="input" value={state.leftPadH} onChange={e => upd({ leftPadH: Number(e.target.value) })} /></Field>
          <Field label="Right pad H"><input type="number" className="input" value={state.rightPadH} onChange={e => upd({ rightPadH: Number(e.target.value) })} /></Field>
          <Field label="Left width %"><input type="number" className="input" min={20} max={80} value={state.leftWidth} onChange={e => upd({ leftWidth: Number(e.target.value) })} /></Field>
          <Field label="Feature cols"><input type="number" className="input" min={1} max={4} value={state.featCols} onChange={e => upd({ featCols: Number(e.target.value) })} /></Field>
          <ColorInput label="Left bg" value={state.leftBg} onChange={v => upd({ leftBg: v })} />
          <ColorInput label="Right bg" value={state.rightBg} onChange={v => upd({ rightBg: v })} />
          <ColorInput label="Check colour" value={state.checkColor} onChange={v => upd({ checkColor: v })} />
          <ColorInput label="Feature bg" value={state.featBg} onChange={v => upd({ featBg: v })} />
        </div>
        <p className="section-label mt-3">Left Column</p>
        <RichTextField label="Label" value={tv(state.leftLabel, 'dcs3Label')} defaultKey="dcs3Label" onChange={v => upd({ leftLabel: v })} />
        <RichTextField label="Title" value={tv(state.leftTitle, 'dcs3Title')} defaultKey="dcs3Title" onChange={v => upd({ leftTitle: v })} />
        <RichTextField label="Paragraph" value={tv(state.leftPara, 'dcs3Para')} defaultKey="dcs3Para" multiline onChange={v => upd({ leftPara: v })} />
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Features</p>
        {state.features.map((f, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2">
            <div className="flex-1 space-y-1">
              <RichTextField label="Title" value={tv(f.title, 'dcs3FeatTitle')} defaultKey="dcs3FeatTitle" onChange={v => updFeat(i, { title: v })} />
              <RichTextField label="Desc" value={tv(f.desc, 'dcs3FeatDesc')} defaultKey="dcs3FeatDesc" onChange={v => updFeat(i, { desc: v })} />
            </div>
            <button onClick={() => upd({ features: state.features.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ features: [...state.features, { title: normalize('', 'dcs3FeatTitle'), desc: normalize('', 'dcs3FeatDesc') }] })} className="btn-ghost text-xs w-full">+ Add feature</button>
        <p className="section-label mt-3">Right Column</p>
        <RichTextField label="Label" value={tv(state.rightLabel, 'dcs3RLabel')} defaultKey="dcs3RLabel" onChange={v => upd({ rightLabel: v })} />
        <RichTextField label="Title" value={tv(state.rightTitle, 'dcs3RTitle')} defaultKey="dcs3RTitle" onChange={v => upd({ rightTitle: v })} />
        <RichTextField label="Paragraph" value={tv(state.rightPara, 'dcs3RPara')} defaultKey="dcs3RPara" multiline onChange={v => upd({ rightPara: v })} />
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Tags</p>
        <div className="flex gap-2 items-center mb-2">
          <Field label="Tag bg (CSS colour)"><input className="input" value={state.tagBg} onChange={e => upd({ tagBg: e.target.value })} placeholder="#ffffff26" /></Field>
        </div>
        {state.tags.map((tag, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <Field label="Icon" className="w-20"><input className="input text-center" value={tag.icon} onChange={e => updTag(i, { icon: e.target.value })} /></Field>
            <div className="flex-1">
              <RichTextField label="Text" value={tv(tag.text, 'dcs3Tag')} defaultKey="dcs3Tag" onChange={v => updTag(i, { text: v })} />
            </div>
            <button onClick={() => upd({ tags: state.tags.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ tags: [...state.tags, { icon: '🖥️', text: normalize('', 'dcs3Tag') }] })} className="btn-ghost text-xs w-full">+ Add tag</button>
        <p className="section-label mt-3">CTA Button</p>
        <Field label="URL"><input className="input" value={state.ctaUrl} onChange={e => upd({ ctaUrl: e.target.value })} placeholder="/courses/" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Text colour" value={state.ctaColor} onChange={v => upd({ ctaColor: v })} />
          <ColorInput label="Border colour" value={state.ctaBorder} onChange={v => upd({ ctaBorder: v })} />
          <ColorInput label="Fill colour" value={state.ctaFill} onChange={v => upd({ ctaFill: v })} />
        </div>
        <RichTextField label="CTA text" value={tv(state.ctaText, 'dcs3Cta')} defaultKey="dcs3Cta" onChange={v => upd({ ctaText: v })} />
      </div>
    </div>
  );
}

function ReachTab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<ReachComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<ReachState>(makeReach());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-reach-components').then(row => {
      const raw = row?.data as any;
      const cs: ReachComponent[] = (raw?.components || []).map((c: any) => ({ ...c, data: normReach(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<ReachState>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makeReach()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `reach-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-reach-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-reach-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makeReach());
  }

  function updStat(i: number, p: Partial<ReachStat>) { const a = [...state.stats]; a[i] = { ...a[i], ...p }; upd({ stats: a }); }
  function updRegion(i: number, p: Partial<ReachRegion>) { const a = [...state.regions]; a[i] = { ...a[i], ...p }; upd({ regions: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Global Reach', generateReachHtml(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <PaddingRow value={state} onChange={upd} />
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
          <Field label="Left width %"><input type="number" className="input" min={20} max={80} value={state.leftWidth} onChange={e => upd({ leftWidth: Number(e.target.value) })} /></Field>
          <ColorInput label="Stat bg" value={state.statBg} onChange={v => upd({ statBg: v })} />
          <ColorInput label="Region bg" value={state.regionBg} onChange={v => upd({ regionBg: v })} />
        </div>
        <p className="section-label mt-3">Left Column — Text</p>
        <RichTextField label="Label" value={tv(state.label, 'reachLabel')} defaultKey="reachLabel" onChange={v => upd({ label: v })} />
        <RichTextField label="Title" value={tv(state.title, 'reachTitle')} defaultKey="reachTitle" onChange={v => upd({ title: v })} />
        <RichTextField label="Paragraph" value={tv(state.para, 'reachPara')} defaultKey="reachPara" multiline onChange={v => upd({ para: v })} />
        <p className="section-label mt-3">Right Column — Stats</p>
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Stats</p>
        {state.stats.map((st, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2">
            <div className="flex-1 space-y-1">
              <RichTextField label="Value" value={tv(st.value, 'reachStatVal')} defaultKey="reachStatVal" onChange={v => updStat(i, { value: v })} />
              <RichTextField label="Label" value={tv(st.label, 'reachStatLbl')} defaultKey="reachStatLbl" onChange={v => updStat(i, { label: v })} />
            </div>
            <button onClick={() => upd({ stats: state.stats.filter((_, idx) => idx !== i) })} className="btn-danger mt-6">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ stats: [...state.stats, { value: normalize('', 'reachStatVal'), label: normalize('', 'reachStatLbl') }] })} className="btn-ghost text-xs w-full">+ Add stat</button>
        <p className="section-label mt-3">Full-width — Regions Row</p>
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Regions</p>
        {state.regions.map((r, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-2 mb-2">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-xs font-semibold text-slate-500 flex-1">Region {i + 1}</span>
              <button onClick={() => upd({ regions: state.regions.filter((_, idx) => idx !== i) })} className="btn-danger text-xs">✕</button>
            </div>
            <div className="flex gap-2 mb-1">
              <Field label="Flag" className="w-20"><input className="input text-center text-lg" value={r.flag} onChange={e => updRegion(i, { flag: e.target.value })} /></Field>
              <Field label="Code" className="flex-1"><input className="input" value={r.code} placeholder="UK" onChange={e => updRegion(i, { code: e.target.value })} /></Field>
            </div>
            <RichTextField label="Name" value={tv(r.name, 'reachRegName')} defaultKey="reachRegName" onChange={v => updRegion(i, { name: v })} />
            <RichTextField label="Sub-label" value={tv(r.sub, 'reachRegSub')} defaultKey="reachRegSub" onChange={v => updRegion(i, { sub: v })} />
          </div>
        ))}
        <button onClick={() => upd({ regions: [...state.regions, { flag: '🌐', code: '', name: normalize('', 'reachRegName'), sub: normalize('', 'reachRegSub') }] })} className="btn-ghost text-xs w-full">+ Add region</button>
        <p className="section-label mt-3">Full-width — Image Block</p>
        <Field label="Image URL"><input className="input" value={state.imgUrl} placeholder="https://…" onChange={e => upd({ imgUrl: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><input className="input" value={state.imgAlt} onChange={e => upd({ imgAlt: e.target.value })} /></Field>
          <Field label="Height (px)"><input type="number" className="input" value={state.imgHeight} onChange={e => upd({ imgHeight: Number(e.target.value) })} /></Field>
          <ColorInput label="Image bg" value={state.imgBg} onChange={v => upd({ imgBg: v })} />
          <Field label="Placeholder text"><input className="input" value={state.imgPlaceholder} onChange={e => upd({ imgPlaceholder: e.target.value })} /></Field>
        </div>
      </div>
    </div>
  );
}

function PhbTab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<PhbComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<PhbState>(makePhb());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-page-hero-banner-components').then(row => {
      const raw = row?.data as any;
      const cs: PhbComponent[] = (raw?.components || []).map((c: any) => ({ ...c, data: normPhb(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<PhbState>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makePhb()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `phb-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-page-hero-banner-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-page-hero-banner-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makePhb());
  }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Hero Banner', generatePhbHtml(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <PaddingRow value={state} onChange={upd} />
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
          <Field label="Border radius"><input type="number" className="input" min={0} max={40} value={state.radius} onChange={e => upd({ radius: Number(e.target.value) })} /></Field>
        </div>
        <p className="section-label mt-3">Eyebrow</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow text"><input className="input" value={state.eyebrow} onChange={e => upd({ eyebrow: e.target.value })} /></Field>
          <ColorInput label="Eyebrow colour" value={state.eyebrowTc} onChange={v => upd({ eyebrowTc: v })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={state.showDot} onChange={e => upd({ showDot: e.target.checked })} />
          Show dot
        </label>
        {state.showDot && <ColorInput label="Dot colour" value={state.dotColor} onChange={v => upd({ dotColor: v })} />}
        <p className="section-label mt-3">Heading</p>
        <RichTextField label="Heading" value={tv(state.heading, 'phbHeading')} defaultKey="phbHeading" onChange={v => upd({ heading: v })} />
        <p className="section-label mt-3">Feature Bullets</p>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Bullet colour" value={state.bulletTc} onChange={v => upd({ bulletTc: v })} />
          <ColorInput label="Separator colour" value={state.sepColor} onChange={v => upd({ sepColor: v })} />
        </div>
        {state.bullets.map((b, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className="input flex-1" value={b} onChange={e => { const a = [...state.bullets]; a[i] = e.target.value; upd({ bullets: a }); }} />
            <button onClick={() => upd({ bullets: state.bullets.filter((_, idx) => idx !== i) })} className="btn-danger text-xs">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ bullets: [...state.bullets, ''] })} className="btn-ghost text-xs w-full">+ Add bullet</button>
        <p className="section-label mt-3">Badge Card (optional)</p>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-2">
          <input type="checkbox" checked={state.showBadge} onChange={e => upd({ showBadge: e.target.checked })} />
          Show badge card
        </label>
        {state.showBadge && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Card bg" value={state.badgeBg} onChange={v => upd({ badgeBg: v })} />
              <Field label="Border radius"><input type="number" className="input" min={0} max={30} value={state.badgeRadius} onChange={e => upd({ badgeRadius: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Badge eyebrow"><input className="input" value={state.badgeEyebrow} onChange={e => upd({ badgeEyebrow: e.target.value })} /></Field>
              <ColorInput label="Eyebrow colour" value={state.badgeEyebrowTc} onChange={v => upd({ badgeEyebrowTc: v })} />
            </div>
            <RichTextField label="Main value" value={tv(state.badgeMain, 'phbBadgeMain')} defaultKey="phbBadgeMain" onChange={v => upd({ badgeMain: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Subtitle"><input className="input" value={state.badgeSub} onChange={e => upd({ badgeSub: e.target.value })} /></Field>
              <ColorInput label="Subtitle colour" value={state.badgeSubTc} onChange={v => upd({ badgeSubTc: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Phv2Tab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]     = useState<Phv2Component[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]       = useState('');
  const [state, setState]     = useState<Phv2State>(makePhv2());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-page-hero-v2-components').then(row => {
      const raw = row?.data as any;
      const cs: Phv2Component[] = (raw?.components || []).map((c: any) => ({ ...c, data: normPhv2(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<Phv2State>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makePhv2()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `phv2-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-page-hero-v2-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-page-hero-v2-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makePhv2());
  }

  function updCard(i: number, p: Partial<Phv2Card>) { const a = [...state.cards]; a[i] = { ...a[i], ...p }; upd({ cards: a }); }
  function updTrust(i: number, p: Partial<Phv2TrustItem>) { const a = [...state.trustItems]; a[i] = { ...a[i], ...p }; upd({ trustItems: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Hero Banner V2', generatePhv2Html(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <PaddingRow value={state} onChange={upd} />
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
          <Field label="Left width %"><input type="number" className="input" min={30} max={80} value={state.split} onChange={e => upd({ split: Number(e.target.value) })} /></Field>
          <Field label="Column gap (px)"><input type="number" className="input" min={0} max={120} value={state.colGap} onChange={e => upd({ colGap: Number(e.target.value) })} /></Field>
        </div>
        <p className="section-label mt-3">Left Column</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Breadcrumb"><input className="input" value={state.breadcrumb} placeholder="Home › Section" onChange={e => upd({ breadcrumb: e.target.value })} /></Field>
          <ColorInput label="Breadcrumb colour" value={state.breadcrumbTc} onChange={v => upd({ breadcrumbTc: v })} />
          <ColorInput label="Eyebrow colour" value={state.eyebrowTc} onChange={v => upd({ eyebrowTc: v })} />
          <ColorInput label="Eyebrow dot colour" value={state.eyebrowDot} onChange={v => upd({ eyebrowDot: v })} />
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Eyebrow Labels</p>
        {state.eyebrowLabels.map((l, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input className="input flex-1" value={l} onChange={e => { const a = [...state.eyebrowLabels]; a[i] = e.target.value; upd({ eyebrowLabels: a }); }} />
            <button onClick={() => upd({ eyebrowLabels: state.eyebrowLabels.filter((_, idx) => idx !== i) })} className="btn-danger text-xs">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ eyebrowLabels: [...state.eyebrowLabels, ''] })} className="btn-ghost text-xs w-full">+ Add label</button>
        <p className="text-xs font-semibold text-slate-500 mt-3 mb-1">Heading</p>
        <RichTextField label="Heading (pre-accent)" value={tv(state.heading, 'phv2Heading')} defaultKey="phv2Heading" onChange={v => upd({ heading: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Accent phrase"><input className="input" value={state.headingAccent} onChange={e => upd({ headingAccent: e.target.value })} /></Field>
          <ColorInput label="Accent colour" value={state.headingAccentColor} onChange={v => upd({ headingAccentColor: v })} />
        </div>
        <Field label="Post-accent text"><input className="input" value={state.headingPost} onChange={e => upd({ headingPost: e.target.value })} /></Field>
        <RichTextField label="Description" value={tv(state.desc, 'phv2Desc')} defaultKey="phv2Desc" multiline onChange={v => upd({ desc: v })} />
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Trust Strip</p>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Text colour" value={state.trustTc} onChange={v => upd({ trustTc: v })} />
          <ColorInput label="Dot colour" value={state.trustDot} onChange={v => upd({ trustDot: v })} />
        </div>
        {state.trustItems.map((item, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <Field label="Icon" className="w-20"><input className="input text-center" value={item.icon} onChange={e => updTrust(i, { icon: e.target.value })} /></Field>
            <Field label="Text" className="flex-1"><input className="input" value={item.text} onChange={e => updTrust(i, { text: e.target.value })} /></Field>
            <button onClick={() => upd({ trustItems: state.trustItems.filter((_, idx) => idx !== i) })} className="btn-danger mt-5 text-xs">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ trustItems: [...state.trustItems, { icon: '', text: '' }] })} className="btn-ghost text-xs w-full">+ Add trust item</button>
        <p className="section-label mt-3">Right Column — Cards</p>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Card bg" value={state.cardBg} onChange={v => upd({ cardBg: v })} />
          <ColorInput label="Card border" value={state.cardBorder} onChange={v => upd({ cardBorder: v })} />
          <Field label="Border radius"><input type="number" className="input" min={0} max={30} value={state.cardRadius} onChange={e => upd({ cardRadius: Number(e.target.value) })} /></Field>
          <ColorInput label="Value colour" value={state.cardVc} onChange={v => upd({ cardVc: v })} />
          <ColorInput label="Label colour" value={state.cardLc} onChange={v => upd({ cardLc: v })} />
        </div>
        {state.cards.map((card, i) => (
          <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 mb-2">
            <div className="flex gap-2 items-center mb-2">
              <span className="text-xs font-semibold text-slate-500 flex-1">Card {i + 1}</span>
              <button onClick={() => upd({ cards: state.cards.filter((_, idx) => idx !== i) })} className="btn-danger text-xs">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="Type">
                <select className="input" value={card.type} onChange={e => updCard(i, { type: e.target.value as Phv2Card['type'] })}>
                  <option value="stat">Stat (number + label)</option>
                  <option value="info">Info (title + subtitle)</option>
                  <option value="tags">Tags (title + tag list)</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mt-5">
                <input type="checkbox" checked={card.full} onChange={e => updCard(i, { full: e.target.checked })} />
                Full width
              </label>
            </div>
            <Field label="Value / Title"><input className="input" value={card.value} onChange={e => updCard(i, { value: e.target.value })} /></Field>
            <Field label="Label / Subtitle / Tags"><input className="input" value={card.label} onChange={e => updCard(i, { label: e.target.value })} /></Field>
          </div>
        ))}
        <button onClick={() => upd({ cards: [...state.cards, { type: 'stat', full: false, value: '', label: '' }] })} className="btn-ghost text-xs w-full">+ Add card</button>
      </div>
    </div>
  );
}

function BmsTab({ onHtml }: { onHtml: (html: string) => void }) {
  const [comps, setComps]       = useState<BmsComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName]         = useState('');
  const [state, setState]       = useState<BmsState>(makeBms());
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    api.get<any>('/content/vls-bms-components').then(row => {
      const raw = row?.data as any;
      const cs: BmsComponent[] = (raw?.components || []).map((c: any) => ({ ...c, data: normBms(c.data || {}) }));
      setComps(cs);
      if (cs.length) { setActiveId(cs[0].id); setName(cs[0].name); setState(cs[0].data); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const upd = useCallback((p: Partial<BmsState>) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);

  function load(id: string) {
    if (!id) { setActiveId(null); setName(''); setState(makeBms()); setSaved(false); return; }
    const c = comps.find(c => c.id === id);
    if (c) { setActiveId(c.id); setName(c.name); setState(c.data); setSaved(false); }
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name.'); return; }
    setSaving(true);
    const id = activeId || `bms-${Date.now().toString(36)}`;
    const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
    await api.put('/content/vls-bms-components', { components: updated });
    setComps(updated); setActiveId(id); setSaved(true); setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete this component?')) return;
    const updated = comps.filter(c => c.id !== activeId);
    await api.put('/content/vls-bms-components', { components: updated });
    setComps(updated); setActiveId(null); setName(''); setState(makeBms());
  }

  function updCheck(i: number, p: Partial<BmsCheckItem>) { const a = [...state.checks]; a[i] = { ...a[i], ...p }; upd({ checks: a }); }

  if (!loaded) return <div className="p-5 text-xs text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col">
      <CmpMgr components={comps} activeId={activeId} name={name} saving={saving} saved={saved}
        onSelect={load} onNew={() => load('')} onDelete={del} onNameChange={setName}
        onSave={save} onGenerate={() => onHtml(wrapGeneratedHtml('Book a Meeting Section', generateBmsHtml(state)))} />
      <div className="px-5 py-4 space-y-1 overflow-y-auto">
        <p className="section-label">Layout</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ColorInput label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
          <Field label="Image split %"><input type="number" className="input" min={20} max={80} value={state.imgSplit} onChange={e => upd({ imgSplit: Number(e.target.value) })} /></Field>
        </div>
        <PaddingRow value={state} onChange={upd} />

        <p className="section-label mt-3">Left Column — Image</p>
        <Field label="Image URL"><input className="input" value={state.imgUrl} placeholder="https://…" onChange={e => upd({ imgUrl: e.target.value })} /></Field>
        <Field label="Alt text"><input className="input" value={state.imgAlt} onChange={e => upd({ imgAlt: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Image fit">
            <select className="input" value={state.imgFit} onChange={e => upd({ imgFit: e.target.value })}>
              <option value="cover">Cover (crop to fill)</option>
              <option value="contain">Contain (show full)</option>
              <option value="fill">Fill (stretch)</option>
              <option value="scale-down">Scale down</option>
            </select>
          </Field>
          <Field label="Image position">
            <select className="input" value={state.imgPosition} onChange={e => upd({ imgPosition: e.target.value })}>
              <option value="center">Center</option>
              <option value="top center">Top</option>
              <option value="bottom center">Bottom</option>
              <option value="left center">Left</option>
              <option value="right center">Right</option>
              <option value="top left">Top left</option>
              <option value="top right">Top right</option>
              <option value="bottom left">Bottom left</option>
              <option value="bottom right">Bottom right</option>
            </select>
          </Field>
        </div>

        <p className="section-label mt-3">Right Column — Content</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eyebrow text"><input className="input" value={state.eyebrow} onChange={e => upd({ eyebrow: e.target.value })} /></Field>
          <ColorInput label="Eyebrow colour" value={state.eyebrowColor} onChange={v => upd({ eyebrowColor: v })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-2">
          <input type="checkbox" checked={state.eyebrowDot} onChange={e => upd({ eyebrowDot: e.target.checked })} />
          Show dot before eyebrow
        </label>

        <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Heading</p>
        <RichTextField label="Heading text" value={tv(state.headingPre, 'bmsHeadingPre')} defaultKey="bmsHeadingPre" onChange={v => upd({ headingPre: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Accent phrase"><input className="input" value={state.headingAccent} onChange={e => upd({ headingAccent: e.target.value })} /></Field>
          <ColorInput label="Accent colour" value={state.headingAccentColor} onChange={v => upd({ headingAccentColor: v })} />
        </div>

        <RichTextField label="Description" value={tv(state.desc, 'bmsDesc')} defaultKey="bmsDesc" multiline onChange={v => upd({ desc: v })} />

        <p className="text-xs font-semibold text-slate-500 mt-3 mb-1">Checklist</p>
        <ColorInput label="Check icon colour" value={state.checkColor} onChange={v => upd({ checkColor: v })} />
        {state.checks.map((ch, i) => (
          <div key={i} className="flex gap-2 items-start mb-1">
            <div className="flex-1">
              <RichTextField label={`Item ${i + 1}`} value={tv(ch.text, 'bmsCheck')} defaultKey="bmsCheck"
                onChange={v => updCheck(i, { text: v })} />
            </div>
            <button onClick={() => upd({ checks: state.checks.filter((_, idx) => idx !== i) })} className="btn-danger mt-6 text-xs">✕</button>
          </div>
        ))}
        <button onClick={() => upd({ checks: [...state.checks, { text: normalize('', 'bmsCheck') }] })} className="btn-ghost text-xs w-full">+ Add item</button>

        <p className="text-xs font-semibold text-slate-500 mt-3 mb-1">CTA Button</p>
        <RichTextField label="Button text" value={tv(state.ctaText, 'bmsCta')} defaultKey="bmsCta" onChange={v => upd({ ctaText: v })} />
        <Field label="Button URL"><input className="input" value={state.ctaUrl} placeholder="https://…" onChange={e => upd({ ctaUrl: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Button bg" value={state.ctaBg} onChange={v => upd({ ctaBg: v })} />
          <ColorInput label="Button text" value={state.ctaTc} onChange={v => upd({ ctaTc: v })} />
        </div>

        <p className="text-xs font-semibold text-slate-500 mt-3 mb-1">Footer Note</p>
        <Field label="Note text"><input className="input" value={state.footerNote} placeholder="🔒 Free · Online · …" onChange={e => upd({ footerNote: e.target.value })} /></Field>
        <ColorInput label="Note colour" value={state.footerNoteTc} onChange={v => upd({ footerNoteTc: v })} />
      </div>
    </div>
  );
}

// ── Section titles ─────────────────────────────────────────────────────────────

const SECTION_TITLES: Record<string, { title: string; desc: string }> = {
  'dcs':            { title: 'Two Column v1',    desc: 'Left text + right icon cards' },
  'dcs2':           { title: 'Two Column v2',    desc: 'Left text/bullets + right stats/quote' },
  'dcs3':           { title: 'Two Column v3',    desc: 'Left features + right tags/CTA' },
  'reach':          { title: 'Global Reach',     desc: 'Text + stats + world map + regions' },
  'hero-banner':    { title: 'Hero Banner',      desc: 'Eyebrow + heading + bullets + badge card' },
  'hero-banner-v2': { title: 'Hero Banner v2',   desc: 'Two-column: text left + info cards right' },
  'book-meeting':   { title: 'Book a Meeting',   desc: 'Image left + eyebrow/heading/checklist/CTA right' },
};

// ── Main screen ────────────────────────────────────────────────────────────────

export default function FullScreenSections() {
  const { type } = useParams<{ type: string }>();
  const [activeTab, setActiveTab]     = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  function handleHtml(html: string) { setPreviewHtml(html); setActiveTab('preview'); }

  const meta = SECTION_TITLES[type || ''] ?? { title: 'Full Screen Section', desc: '' };

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[520px] shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">{meta.title}</h1>
          {meta.desc && <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {type === 'dcs'            && <DcsTab   onHtml={handleHtml} />}
          {type === 'dcs2'           && <Dcs2Tab  onHtml={handleHtml} />}
          {type === 'dcs3'           && <Dcs3Tab  onHtml={handleHtml} />}
          {type === 'reach'          && <ReachTab onHtml={handleHtml} />}
          {type === 'hero-banner'    && <PhbTab   onHtml={handleHtml} />}
          {type === 'hero-banner-v2' && <Phv2Tab  onHtml={handleHtml} />}
          {type === 'book-meeting'   && <BmsTab   onHtml={handleHtml} />}
          {!type && <div className="p-6 text-sm text-slate-400">Select a section type from the sidebar.</div>}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'}
            className="flex-1 w-full border-0 bg-slate-50" sandbox="allow-same-origin allow-scripts" />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click ⚡ Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
