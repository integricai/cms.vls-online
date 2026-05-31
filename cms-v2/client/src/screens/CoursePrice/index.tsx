import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type { Course, CoursePriceRecord, ScrapedCoursePrice } from '../../../../shared/types';
import type { CoursePrice, CoursePriceContent } from '../../types/cms';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { calculatedPrice, generateCoursePriceHtml, money } from './generateHtml';

let idCounter = 0;
const COURSE_PRICE_API_URL = 'https://api.cms.vls-online.com/api/publish-course-prices';
const FONT_FAMILIES = ['Poppins', 'Inter', 'Roboto', 'Lato', 'Montserrat', 'DM Sans', 'Open Sans', 'Arial', 'Georgia'];
const FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];
const SYSTEM_FONTS = ['Arial', 'Georgia'];

function newCoursePrice(): CoursePrice {
  idCounter++;
  return {
    id: `cp${idCounter}`,
    name: '',
    visible: true,
    courseId: undefined,
    eyebrow: 'ACCA • APPLIED KNOWLEDGE',
    title: 'ACCA FA1 - Recording Financial Transactions',
    regularPrice: 279,
    discountPercent: 72,
    currency: '$',
    priceLabel: 'YOUR PRICE',
    savingPrefix: 'You save',
    includesLabel: 'THIS COURSE INCLUDES',
    includes: [
      '46 hours of HD syllabus topic videos',
      '42 hours of kit question videos',
      'Chapter-by-chapter quizzes with automated feedback',
      'Exam-focused study notes',
      'Tutor support via WhatsApp',
      'Weekly live sessions + recordings',
      'Final mock exam with tutor feedback',
    ],
    ctaText: 'Enrol Now →',
    ctaUrl: '#',
    refundText: '🔒 3-day flexible refund policy applies',
    bg: '#ffffff',
    border: '#e5e7eb',
    accent: '#204280',
    discountBg: '#eaf8ef',
    discountTc: '#057a3d',
    saveBg: '#f0fbf4',
    saveBorder: '#b7e4c7',
    radius: 14,
    fontFamily: 'Poppins',
    eyebrowSize: 11,
    eyebrowWeight: 700,
    titleSize: 15,
    titleWeight: 700,
    amountSize: 46,
    bodySize: 13,
    ctaSize: 14,
    ctaWeight: 800,
  };
}

function currencySymbol(currency: string): string {
  const upper = currency.toUpperCase();
  if (upper === 'USD') return '$';
  if (upper === 'EUR') return '€';
  if (currency === '$' || currency === '€' || currency === '£') return currency;
  return '$';
}

function currencyCode(currency: string): string {
  if (currency === '$') return 'USD';
  if (currency === '€') return 'EUR';
  if (currency === '£') return 'GBP';
  const upper = currency.toUpperCase();
  return ['GBP', 'USD', 'EUR'].includes(upper) ? upper : 'USD';
}

function courseCtaUrl(course: Course | undefined, scrapedUrl: string): string {
  if (scrapedUrl) return scrapedUrl;
  if (course?.zenlerUrl) return course.zenlerUrl.replace(/^https:\/\/[^/]+\.newzenler\.com/i, 'https://vls-online.com');
  if (course?.slug) return `https://vls-online.com/courses/${course.slug}`;
  return '#';
}

function baseImportedPriceCard(courseId: number, courseName: string, course: Course | undefined): CoursePrice {
  const card = newCoursePrice();
  const level = course?.courseLevel || course?.level || 'Course';
  const qualification = course?.qualification || course?.category || '';
  return {
    ...card,
    name: `${courseName} price`,
    courseId,
    eyebrow: [qualification, level].filter(Boolean).join(' • ').toUpperCase(),
    title: courseName,
    discountPercent: 0,
    ctaUrl: courseCtaUrl(course, ''),
  };
}

function recordPriceCard(record: CoursePriceRecord, course: Course | undefined): CoursePrice {
  return {
    ...baseImportedPriceCard(record.courseId, record.courseName || course?.name || 'Course price', course),
    regularPrice: record.regularPrice,
    discountPercent: record.discountPercent,
    currency: currencySymbol(record.currency),
    ctaUrl: courseCtaUrl(course, record.sourceUrl || ''),
  };
}

function mergeDbPricesIntoCards(
  base: CoursePrice[],
  records: CoursePriceRecord[],
  courses: Course[],
): CoursePrice[] {
  const courseMap = new Map(courses.map(course => [course.id, course]));
  const next = [...base];

  for (const record of records) {
    if (record.regularPrice <= 0 && record.lastScrapeStatus !== 'manual') continue;
    const existingIndex = next.findIndex(price => price.courseId === record.courseId);
    const course = courseMap.get(record.courseId);
    if (existingIndex >= 0) {
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        regularPrice: record.regularPrice,
        discountPercent: record.discountPercent,
        currency: currencySymbol(record.currency),
        ctaUrl: existing.ctaUrl && existing.ctaUrl !== '#' ? existing.ctaUrl : courseCtaUrl(course, record.sourceUrl || ''),
        title: existing.title || record.courseName || course?.name || '',
        name: existing.name || `${record.courseName || course?.name || 'Course'} price`,
      };
    } else {
      next.push(recordPriceCard(record, course));
    }
  }

  return next;
}

function buildInjectCode(price: CoursePrice): string {
  return `<script>
(function(){
  var PID=${JSON.stringify(price.id)};
  var API=${JSON.stringify(COURSE_PRICE_API_URL)};
  var STYLE_ID="vls-course-price-style";
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function num(v,f){var n=Number(v);return isFinite(n)?n:f;}
  function money(v){var n=Math.round(num(v,0)*100)/100;return Math.abs(n%1)<.001?String(Math.round(n)):n.toFixed(2);}
  function hex(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())?String(v).trim():f;}
  function calc(p){var regular=Math.max(0,num(p.regularPrice,0));var discount=Math.max(0,Math.min(100,num(p.discountPercent,0)));var saving=regular*(discount/100);return{regular:regular,discount:discount,saving:saving,final:Math.max(0,regular-saving)};}
  function ensureStyle(p){
    if(document.getElementById(STYLE_ID))return;
    var accent=hex(p.accent,"#204280"),border=hex(p.border,"#e5e7eb"),discountBg=hex(p.discountBg,"#eaf8ef"),discountTc=hex(p.discountTc,"#057a3d"),saveBg=hex(p.saveBg,"#f0fbf4"),saveBorder=hex(p.saveBorder,"#b7e4c7"),bg=hex(p.bg,"#ffffff"),radius=Math.max(0,Math.min(40,parseInt(p.radius,10)||14));
    var ff=String(p.fontFamily||"Poppins").replace(/['"<>]/g,"");
    var eyebrowSz=Math.max(8,Math.min(24,parseInt(p.eyebrowSize,10)||11));
    var eyebrowWt=parseInt(p.eyebrowWeight,10)||700;
    var titleSz=Math.max(10,Math.min(36,parseInt(p.titleSize,10)||15));
    var titleWt=parseInt(p.titleWeight,10)||700;
    var amountSz=Math.max(20,Math.min(80,parseInt(p.amountSize,10)||46));
    var bodySz=Math.max(10,Math.min(20,parseInt(p.bodySize,10)||13));
    var ctaSz=Math.max(10,Math.min(24,parseInt(p.ctaSize,10)||14));
    var ctaWt=parseInt(p.ctaWeight,10)||800;
    var sysFonts=["Arial","Georgia","Times New Roman","Courier New","Verdana"];
    if(sysFonts.indexOf(ff)<0){var fid="vls-gf-"+ff.replace(/\s/g,"-");if(!document.getElementById(fid)){var fl=document.createElement("link");fl.id=fid;fl.rel="stylesheet";fl.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(ff)+":wght@400;500;600;700;800;900&display=swap";document.head.appendChild(fl);}}
    var s=document.createElement("style");s.id=STYLE_ID;
    s.textContent='.vls-price-card{box-sizing:border-box;width:100%;max-width:300px;background:'+bg+';border:1px solid '+border+';border-top:4px solid '+accent+';border-radius:'+radius+'px;overflow:hidden;font-family:\''+ff+'\',Arial,sans-serif;color:#111827;box-shadow:0 8px 24px rgba(15,23,42,.08)}.vls-price-card *{box-sizing:border-box}.vls-price-head{padding:18px 20px 16px;border-bottom:1px solid #e5e7eb}.vls-price-eyebrow{display:flex;align-items:center;gap:7px;font-size:'+eyebrowSz+'px;font-weight:'+eyebrowWt+';letter-spacing:.08em;text-transform:uppercase;color:'+accent+'}.vls-price-eyebrow:before{content:"";width:5px;height:5px;border-radius:999px;background:'+accent+'}.vls-price-title{margin-top:6px;font-size:'+titleSz+'px;line-height:1.35;font-weight:'+titleWt+';color:#111827}.vls-price-body{padding:18px 20px 14px}.vls-price-row{display:flex;align-items:center;gap:10px;min-height:22px}.vls-price-regular{font-size:15px;color:#374151;text-decoration:line-through;text-decoration-thickness:1.5px}.vls-price-discount{display:inline-flex;align-items:center;border:1px solid '+saveBorder+';background:'+discountBg+';color:'+discountTc+';font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px}.vls-price-label{margin-top:12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#4b5563}.vls-price-final{display:flex;align-items:flex-start;gap:3px;margin-top:4px;color:#102a63}.vls-price-currency{font-size:20px;font-weight:800;line-height:1.25;margin-top:8px}.vls-price-amount{font-size:'+amountSz+'px;font-weight:800;line-height:1}.vls-price-save{margin-top:8px;border:1px solid '+saveBorder+';background:'+saveBg+';color:#006b3c;border-radius:6px;padding:7px 11px;font-size:12px;font-weight:600}.vls-price-inc-label{margin-top:28px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#4b5563}.vls-price-inc{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:11px}.vls-price-inc li{display:grid;grid-template-columns:18px 1fr;gap:9px;align-items:start;font-size:'+bodySz+'px;line-height:1.35;color:#111827}.vls-price-check{display:inline-flex;width:17px;height:17px;border-radius:5px;align-items:center;justify-content:center;background:#eff8ff;border:1px solid #bfdbfe;color:#1d75bd;font-size:11px;line-height:1}.vls-price-cta{display:block;margin-top:30px;width:100%;border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#111827;text-decoration:none;text-align:center;padding:10px 12px;font-size:'+ctaSz+'px;font-weight:'+ctaWt+'}.vls-price-refund{margin:10px 0 0;text-align:center;color:#4b5563;font-size:11px}@media(max-width:640px){.vls-price-card{max-width:none}.vls-price-amount{font-size:'+(amountSz-4)+'px}}';
    document.head.appendChild(s);
  }
  function fullCard(p,c){
    var curr=esc(p.currency||"£"),items=Array.isArray(p.includes)?p.includes.filter(Boolean):[];
    var hasDiscount=c.discount>0&&c.saving>0;
    return '<div class="vls-price-card"><div class="vls-price-head">'+(p.eyebrow?'<div class="vls-price-eyebrow">'+esc(p.eyebrow)+'</div>':'')+(p.title?'<div class="vls-price-title">'+esc(p.title)+'</div>':'')+'</div><div class="vls-price-body">'+(hasDiscount?'<div class="vls-price-row"><span class="vls-price-regular">'+curr+esc(money(c.regular))+'</span><span class="vls-price-discount">'+esc(money(c.discount))+'% OFF</span></div>':'')+'<div class="vls-price-label">'+esc(p.priceLabel||"YOUR PRICE")+'</div><div class="vls-price-final"><span class="vls-price-currency">'+curr+'</span><span class="vls-price-amount">'+esc(money(c.final))+'</span></div>'+(hasDiscount?'<div class="vls-price-save">🎉 '+esc(p.savingPrefix||"You save")+' '+curr+esc(money(c.saving))+' on this course</div>':'')+(items.length?'<div class="vls-price-inc-label">'+esc(p.includesLabel||"THIS COURSE INCLUDES")+'</div><ul class="vls-price-inc">'+items.map(function(item){return '<li><span class="vls-price-check">✓</span><span>'+esc(item)+'</span></li>';}).join("")+'</ul>':'')+(p.ctaText?'<a class="vls-price-cta" href="'+esc(p.ctaUrl||"#")+'">'+esc(p.ctaText)+'</a>':'')+(p.refundText?'<div class="vls-price-refund">'+esc(p.refundText)+'</div>':'')+'</div></div>';
  }
  function setText(root,name,value){var nodes=root.querySelectorAll('[data-vls-price-field="'+name+'"]');for(var i=0;i<nodes.length;i++)nodes[i].textContent=value;}
  function setHref(root,name,value){var nodes=root.querySelectorAll('[data-vls-price-field="'+name+'"]');for(var i=0;i<nodes.length;i++)nodes[i].setAttribute("href",value||"#");}
  function render(p){
    var roots=document.querySelectorAll('[data-vls-price-card="'+PID+'"]');
    if(!p||!p.visible){for(var h=0;h<roots.length;h++)roots[h].style.display="none";return;}
    ensureStyle(p);
    var c=calc(p),curr=p.currency||"£";
    for(var i=0;i<roots.length;i++){
      var root=roots[i];root.style.display="";
      if(!root.querySelector("[data-vls-price-field]")){root.innerHTML=fullCard(p,c);continue;}
      var hasDiscount=c.discount>0&&c.saving>0;
      root.querySelectorAll("[data-vls-price-discount-only]").forEach(function(node){node.style.display=hasDiscount?"":"none";});
      setText(root,"regular",hasDiscount?curr+money(c.regular):"");
      setText(root,"discount",hasDiscount?money(c.discount)+"% OFF":"");
      setText(root,"price",curr+money(c.final));
      setText(root,"currency",curr);
      setText(root,"amount",money(c.final));
      setText(root,"saving",hasDiscount?curr+money(c.saving):"");
      setText(root,"saveText",hasDiscount?(p.savingPrefix||"You save")+" "+curr+money(c.saving)+" on this course":"");
      setText(root,"priceLabel",p.priceLabel||"YOUR PRICE");
      setText(root,"cta",p.ctaText||"");
      setHref(root,"cta",p.ctaUrl||"#");
    }
  }
  function load(){
    fetch(API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("VLS Course Price API returned "+r.status);return r.json();}).then(function(data){
      var p=(data.prices||[]).find(function(x){return x.id===PID;});
      render(p);
    }).catch(function(e){console.error("VLS Course Price ["+PID+"]:",e.message||e);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();
</script>`;
}

function ColorPair({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5"
        />
        <input
          type="text"
          value={value}
          className="input"
          onChange={e => {
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
          }}
        />
      </div>
    </Field>
  );
}

function WeightSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={e => onChange(Number(e.target.value))}>
        {FONT_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
      </select>
    </Field>
  );
}

function CoursePriceForm({
  price,
  courses,
  onChange,
}: {
  price: CoursePrice;
  courses: Course[];
  onChange: (patch: Partial<CoursePrice>) => void;
}) {
  const calc = calculatedPrice(price);

  function updateInclude(index: number, value: string) {
    const next = [...price.includes];
    next[index] = value;
    onChange({ includes: next });
  }

  function handleCourseSelect(courseId: number) {
    const course = courses.find(c => c.id === courseId);
    onChange({
      courseId,
      ...(course && !price.title ? { title: course.name } : {}),
    });
  }

  return (
    <div className="space-y-0">
      <p className="section-label">Identity</p>
      <Field label="Price card ID" hint="Embedded in the inject code and page target">
        <input className="input select-all bg-slate-50 font-mono text-slate-500" value={price.id} readOnly />
      </Field>
      <Field label="Price card name" hint="CMS only">
        <input className="input" value={price.name} placeholder="e.g. FA1 course price" onChange={e => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Status">
        <select className="input" value={String(price.visible)} onChange={e => onChange({ visible: e.target.value === 'true' })}>
          <option value="true">Visible - update cards on pages</option>
          <option value="false">Hidden - hide matching cards</option>
        </select>
      </Field>

      <p className="section-label">Linked Course</p>
      <Field label="Zenler Course" hint="Links this price card to a local course record">
        {courses.length === 0 ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No active courses. Go to <strong>Payment Cards</strong> and run "Sync Courses from Zenler" first.
          </p>
        ) : (
          <select
            className="input"
            value={price.courseId ?? 0}
            onChange={e => handleCourseSelect(Number(e.target.value))}
          >
            <option value={0}>— none —</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </Field>

      <p className="section-label">Course</p>
      <Field label="Eyebrow">
        <input className="input" value={price.eyebrow} onChange={e => onChange({ eyebrow: e.target.value })} />
      </Field>
      <Field label="Course title">
        <input className="input" value={price.title} onChange={e => onChange({ title: e.target.value })} />
      </Field>

      <p className="section-label">Pricing</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Currency">
          <input className="input" value={price.currency} onChange={e => onChange({ currency: e.target.value })} />
        </Field>
        <Field label="Regular price">
          <input type="number" min={0} step="0.01" className="input" value={price.regularPrice} onChange={e => onChange({ regularPrice: Number(e.target.value) })} />
        </Field>
        <Field label="Discount %">
          <input type="number" min={0} max={100} step="0.01" className="input" value={price.discountPercent} onChange={e => onChange({ discountPercent: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Your Price: <span className="font-bold">{price.currency}{money(calc.yourPrice)}</span> · Saving: <span className="font-bold">{price.currency}{money(calc.saving)}</span>
      </div>
      <Field label="Price label">
        <input className="input" value={price.priceLabel} onChange={e => onChange({ priceLabel: e.target.value })} />
      </Field>
      <Field label="Saving text prefix">
        <input className="input" value={price.savingPrefix} onChange={e => onChange({ savingPrefix: e.target.value })} />
      </Field>

      <p className="section-label">Includes</p>
      <Field label="Includes label">
        <input className="input" value={price.includesLabel} onChange={e => onChange({ includesLabel: e.target.value })} />
      </Field>
      <div className="mb-2 space-y-2">
        {price.includes.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input className="input" value={item} onChange={e => updateInclude(index, e.target.value)} />
            <button className="btn-danger shrink-0 text-xs" onClick={() => onChange({ includes: price.includes.filter((_, i) => i !== index) })}>✕</button>
          </div>
        ))}
      </div>
      <button className="btn-ghost mb-3 w-full text-xs" onClick={() => onChange({ includes: [...price.includes, ''] })}>+ Add include item</button>

      <p className="section-label">CTA</p>
      <Field label="Button text">
        <input className="input" value={price.ctaText} onChange={e => onChange({ ctaText: e.target.value })} />
      </Field>
      <Field label="Button URL">
        <input className="input" value={price.ctaUrl} onChange={e => onChange({ ctaUrl: e.target.value })} />
      </Field>
      <Field label="Refund note">
        <input className="input" value={price.refundText} onChange={e => onChange({ refundText: e.target.value })} />
      </Field>

      <p className="section-label">Colours</p>
      <div className="grid grid-cols-2 gap-2">
        <ColorPair label="Background" value={price.bg} onChange={value => onChange({ bg: value })} />
        <ColorPair label="Border" value={price.border} onChange={value => onChange({ border: value })} />
        <ColorPair label="Accent" value={price.accent} onChange={value => onChange({ accent: value })} />
        <ColorPair label="Discount background" value={price.discountBg} onChange={value => onChange({ discountBg: value })} />
        <ColorPair label="Discount text" value={price.discountTc} onChange={value => onChange({ discountTc: value })} />
        <ColorPair label="Saving background" value={price.saveBg} onChange={value => onChange({ saveBg: value })} />
      </div>
      <Field label="Border radius (px)">
        <input type="number" min={0} max={40} className="input" value={price.radius} onChange={e => onChange({ radius: Number(e.target.value) })} />
      </Field>

      <p className="section-label">Typography</p>
      <Field label="Font family">
        <select
          className="input"
          value={price.fontFamily ?? 'Poppins'}
          onChange={e => onChange({ fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Eyebrow size (px)">
          <input type="number" min={8} max={24} className="input" value={price.eyebrowSize ?? 11} onChange={e => onChange({ eyebrowSize: Number(e.target.value) })} />
        </Field>
        <WeightSelect label="Eyebrow weight" value={price.eyebrowWeight ?? 700} onChange={v => onChange({ eyebrowWeight: v })} />
        <Field label="Title size (px)">
          <input type="number" min={10} max={36} className="input" value={price.titleSize ?? 15} onChange={e => onChange({ titleSize: Number(e.target.value) })} />
        </Field>
        <WeightSelect label="Title weight" value={price.titleWeight ?? 700} onChange={v => onChange({ titleWeight: v })} />
        <Field label="Price amount size (px)">
          <input type="number" min={20} max={80} className="input" value={price.amountSize ?? 46} onChange={e => onChange({ amountSize: Number(e.target.value) })} />
        </Field>
        <Field label="Body / includes size (px)">
          <input type="number" min={10} max={20} className="input" value={price.bodySize ?? 13} onChange={e => onChange({ bodySize: Number(e.target.value) })} />
        </Field>
        <Field label="CTA button size (px)">
          <input type="number" min={10} max={24} className="input" value={price.ctaSize ?? 14} onChange={e => onChange({ ctaSize: Number(e.target.value) })} />
        </Field>
        <WeightSelect label="CTA button weight" value={price.ctaWeight ?? 800} onChange={v => onChange({ ctaWeight: v })} />
      </div>
    </div>
  );
}

export default function CoursePriceScreen() {
  const [prices, setPrices] = useState<CoursePrice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncFailures, setSyncFailures] = useState<ScrapedCoursePrice[]>([]);
  const [injectCode, setInjectCode] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');

  const active = prices.find(price => price.id === activeId) ?? null;

  useEffect(() => {
    Promise.all([
      api.get<{ data: CoursePriceContent }>('/content/vls-course-prices').catch(() => null),
      api.get<Course[]>('/courses/active').catch(() => []),
      api.get<CoursePriceRecord[]>('/courses/prices').catch(() => []),
    ]).then(([row, activeCourses, storedPrices]) => {
      const courseList = (activeCourses ?? []) as Course[];
      if (activeCourses) setCourses(courseList);
      const items = (row?.data as CoursePriceContent)?.prices ?? [];
      items.forEach(item => {
        const next = parseInt(item.id.replace('cp', ''), 10);
        if (next > idCounter) idCounter = next;
      });
      const merged = mergeDbPricesIntoCards(items, storedPrices as CoursePriceRecord[], courseList);
      merged.forEach(item => {
        const next = parseInt(item.id.replace('cp', ''), 10);
        if (next > idCounter) idCounter = next;
      });
      if (merged.length > 0) {
        setPrices(merged);
        setActiveId(merged[0].id);
      }
    }).finally(() => setLoading(false));
  }, []);

  const updateActive = useCallback((patch: Partial<CoursePrice>) => {
    setPrices(prev => prev.map(price => price.id === activeId ? { ...price, ...patch } : price));
    setSaved(false);
    setPublished(false);
    setPublishError('');
  }, [activeId]);

  function selectPrice(id: string) {
    setActiveId(id);
    setInjectCode('');
    setSaved(false);
    setPublished(false);
    setPublishError('');
    setActiveTab('preview');
  }

  function addPrice() {
    const price = newCoursePrice();
    setPrices(prev => [...prev, price]);
    setActiveId(price.id);
    setInjectCode('');
    setSaved(false);
    setPublished(false);
    setPublishError('');
    setActiveTab('preview');
  }

  function duplicatePrice(id: string) {
    const source = prices.find(p => p.id === id);
    if (!source) return;
    idCounter++;
    const copy: CoursePrice = { ...source, id: `cp${idCounter}`, name: source.name ? `${source.name} (Copy)` : '' };
    setPrices(prev => {
      const idx = prev.findIndex(p => p.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
    setInjectCode('');
    setSaved(false);
    setActiveTab('preview');
  }

  function deletePrice(id: string) {
    setPrices(prev => {
      const next = prev.filter(price => price.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        setInjectCode('');
        setActiveTab('preview');
      }
      return next;
    });
    setSaved(false);
    setPublished(false);
  }

  function movePrice(id: string, dir: -1 | 1) {
    setPrices(prev => {
      const idx = prev.findIndex(p => p.id === id);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    setSaved(false);
  }

  async function syncPricesFromPages() {
    setSyncingPrices(true);
    setSyncMessage('');
    setSyncFailures([]);
    setPublishError('');
    try {
      const result = await api.post<{ scraped: ScrapedCoursePrice[]; prices: CoursePriceRecord[] }>('/courses/scrape-prices', {});
      const scraped = result.scraped;
      const stored = result.prices;
      const matched = scraped.filter(item => item.matched && item.price != null);
      const failures = scraped.filter(item => !item.matched || item.price == null);
      const nextPrices = mergeDbPricesIntoCards(prices, stored, courses);
      const firstImportedId = nextPrices.find(price => matched.some(item => item.courseId === price.courseId))?.id ?? null;

      setPrices(nextPrices);
      if (firstImportedId) setActiveId(firstImportedId);
      setSaved(false);
      setPublished(false);
      setInjectCode('');
      setActiveTab('preview');
      setSyncFailures(failures);
      setSyncMessage(
        matched.length
          ? `Imported ${matched.length} price${matched.length === 1 ? '' : 's'} into draft cards. Review discounts, then save or publish.`
          : 'No prices were found. The course pages may be rendering prices with JavaScript.',
      );
    } catch (error: unknown) {
      setSyncMessage(error instanceof Error ? error.message : 'Price sync failed. Please try again.');
    } finally {
      setSyncingPrices(false);
    }
  }

  async function saveLinkedPricesToDb(priceList: CoursePrice[]) {
    const linked = priceList
      .filter(price => Number.isInteger(price.courseId))
      .map(price => ({
        courseId: price.courseId,
        regularPrice: price.regularPrice,
        regularPrice2: 0,
        currency: currencyCode(price.currency),
        discountPercent: price.discountPercent,
        discountPercent2: 0,
        sourceUrl: price.ctaUrl && price.ctaUrl !== '#' ? price.ctaUrl : null,
        rawPriceText: null,
      }));

    if (linked.length > 0) {
      await api.put('/courses/prices', { prices: linked });
    }
  }

  async function saveAndGenerate() {
    if (!active) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveLinkedPricesToDb(prices);
      await api.put('/content/vls-course-prices', { prices });
      setSaved(true);
      setPublished(false);
      setPublishError('');
      setInjectCode(buildInjectCode(active));
      setActiveTab('html');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!active) return;
    setPublishing(true);
    setPublishError('');
    try {
      await saveLinkedPricesToDb(prices);
      await api.put('/content/vls-course-prices', { prices });
      setInjectCode(buildInjectCode(active));
      setPublished(true);
      setSaved(true);
      setActiveTab('html');
    } catch (error: unknown) {
      setPublishError(error instanceof Error ? error.message : 'Publish failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  const activeFontFamily = active?.fontFamily ?? 'Poppins';
  const googleFontsHref = SYSTEM_FONTS.includes(activeFontFamily)
    ? ''
    : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(activeFontFamily)}:wght@400;500;600;700;800;900&display=swap`;

  const previewDoc = active
    ? `<!doctype html><html><head><meta charset="utf-8">${googleFontsHref ? `<link href="${googleFontsHref}" rel="stylesheet">` : ''}</head><body style="margin:0;background:#f8f9fc;padding:28px">${wrapGeneratedHtml('Course Price', generateCoursePriceHtml(active))}</body></html>`
    : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a price card to preview.</p>';

  return (
    <div className="flex h-full">
      <div className="w-[440px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Price Cards</h1>
          <p className="mt-0.5 text-xs text-slate-400">Price cards — paste inject code once, publish updates live</p>
        </div>

        <div className="space-y-2 border-b border-slate-100 bg-white px-5 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveAndGenerate} disabled={saving || !active} className="btn-primary justify-center text-xs">
              {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save & Generate HTML'}
            </button>
            <button onClick={publish} disabled={publishing || !active} className="btn-success justify-center text-xs">
              {publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish Price'}
            </button>
          </div>
          <button onClick={syncPricesFromPages} disabled={syncingPrices || courses.length === 0} className="btn-ghost w-full justify-center text-xs">
            {syncingPrices ? 'Syncing course pages…' : 'Sync Prices From Course Pages'}
          </button>
          {publishError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{publishError}</p>}
          {syncMessage && (
            <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <p>{syncMessage}</p>
              {syncFailures.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold">{syncFailures.length} page{syncFailures.length === 1 ? '' : 's'} need review</summary>
                  <div className="mt-2 max-h-32 space-y-1 overflow-auto">
                    {syncFailures.slice(0, 20).map(item => (
                      <div key={item.courseId} className="rounded bg-white/70 px-2 py-1">
                        <span className="font-medium">{item.courseName}</span>
                        <span className="text-blue-600"> — {item.error || 'No price found'}</span>
                      </div>
                    ))}
                    {syncFailures.length > 20 && <p className="text-blue-600">Showing first 20 only.</p>}
                  </div>
                </details>
              )}
            </div>
          )}
          <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              Add <span className="font-mono">data-vls-price-card="{active?.id || 'cp1'}"</span> to the live course card container.
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Price cards</span>
              <button onClick={addPrice} className="btn-ghost px-2 py-1 text-xs">+ New</button>
            </div>
            {prices.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No price cards yet.</p>
            ) : (
              <div className="space-y-1">
                {prices.map((price, idx) => (
                  <div
                    key={price.id}
                    onClick={() => selectPrice(price.id)}
                    className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                      price.id === activeId
                        ? 'bg-brand text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-brand/40'
                    }`}
                  >
                    {/* Sort buttons */}
                    <div className="flex shrink-0 flex-col">
                      <button
                        title="Move up"
                        onClick={e => { e.stopPropagation(); movePrice(price.id, -1); }}
                        disabled={idx === 0}
                        className={`leading-none px-0.5 text-[10px] disabled:opacity-20 ${price.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                      >▲</button>
                      <button
                        title="Move down"
                        onClick={e => { e.stopPropagation(); movePrice(price.id, 1); }}
                        disabled={idx === prices.length - 1}
                        className={`leading-none px-0.5 text-[10px] disabled:opacity-20 ${price.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                      >▼</button>
                    </div>

                    {/* Label */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`text-xs ${price.id === activeId ? 'text-white/70' : 'text-slate-400'}`}>{price.visible ? '●' : '○'}</span>
                      <span className="truncate font-medium">{price.name || price.title || 'Untitled'}</span>
                    </div>

                    {/* Duplicate + Delete */}
                    <button
                      title="Duplicate"
                      onClick={e => { e.stopPropagation(); duplicatePrice(price.id); }}
                      className={`shrink-0 text-xs ${price.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-brand'}`}
                    >⧉</button>
                    <button
                      title="Delete"
                      onClick={e => { e.stopPropagation(); deletePrice(price.id); }}
                      className={`shrink-0 text-xs ${price.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {active && <CoursePriceForm price={active} courses={courses} onChange={updateActive} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${
                activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'html' ? 'HTML (Inject Code)' : 'Preview'}
            </button>
          ))}
        </div>

        {activeTab === 'preview' ? (
          <iframe key={activeId ?? 'empty'} srcDoc={previewDoc} className="w-full flex-1 border-0 bg-slate-50" sandbox="allow-same-origin" />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            {injectCode && (
              <button onClick={() => navigator.clipboard.writeText(injectCode)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">
                Copy
              </button>
            )}
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
              {injectCode || '// Click Save & Generate HTML to get the inject code'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
