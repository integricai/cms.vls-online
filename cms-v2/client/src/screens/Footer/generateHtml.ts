import type { FooterData } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

const SOCIAL_ICONS: Record<string, string> = {
  facebook:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
  twitter:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>',
  instagram: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  linkedin:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>',
  youtube:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0f2155"/></svg>',
  tiktok:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/></svg>',
  whatsapp:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.922 2C6.477 2 2 6.477 2 11.922c0 1.832.498 3.546 1.368 5.025L2 22l5.207-1.336A9.88 9.88 0 0011.922 22C17.367 22 22 17.367 22 11.922S17.367 2 11.922 2zm0 18.153a8.23 8.23 0 01-4.195-1.148l-.3-.178-3.09.793.82-3.009-.196-.308a8.23 8.23 0 01-1.273-4.38c0-4.554 3.706-8.26 8.234-8.26 4.528 0 8.234 3.706 8.234 8.26 0 4.554-3.706 8.23-8.234 8.23z"/></svg>',
};

function jsString(value: string): string {
  return JSON.stringify(value);
}

function buildFooterMarkup(data: FooterData, includeToggleScript: boolean, uid?: string, publicFooterUrl?: string): string {
  const P = 'vlsft';
  const BG = '#0f2155';

  const css = `.${P}-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:40px;padding-bottom:32px;}`
    + `.${P}-col{}`
    + `.${P}-hdr{margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;cursor:default;}`
    + `.${P}-arrow{display:none;font-size:18px;color:rgba(255,255,255,.7);line-height:1;}`
    + `.${P}-body{display:block;}`
    + `@media(max-width:768px){`
    +   `.${P}-grid{display:block;}`
    +   `.${P}-col{border-bottom:1px solid rgba(255,255,255,.12);}`
    +   `.${P}-col:first-child{border-top:1px solid rgba(255,255,255,.12);margin-top:8px;}`
    +   `.${P}-hdr{cursor:pointer;padding:14px 0;margin-bottom:0;}`
    +   `.${P}-arrow{display:inline-block;transition:transform .25s;}`
    +   `.${P}-body{display:none;padding-bottom:14px;}`
    +   `.${P}-col.open .${P}-body{display:block;}`
    +   `.${P}-col.open .${P}-arrow{transform:rotate(180deg);}`
    + `}`;

  const ts = `font-family:Poppins,sans-serif;font-size:13px;font-weight:700;color:#fff;margin:0;text-transform:uppercase;letter-spacing:.07em;text-align:left;`;
  const ls = `color:rgba(255,255,255,.8);text-decoration:none;font-size:13px;font-family:Poppins,sans-serif;display:block;margin-bottom:9px;line-height:1.4;text-align:left;`;

  function col(titleVal: unknown, bodyHtml: string) {
    const title = normalize(titleVal as string, 'footerTitle');
    return `<div class="${P}-col">`
      + `<div class="${P}-hdr" onclick="vlsFtTog(this)">`
      + `<span style="${ts}${textStyle(title)}">${escapeHtml(title.text || '')}</span>`
      + `<span class="${P}-arrow">&#9660;</span>`
      + `</div>`
      + `<div class="${P}-body">${bodyHtml}</div>`
      + `</div>`;
  }

  const idAttr = uid ? ` id="${escapeHtml(uid)}"` : '';
  const endpointAttr = publicFooterUrl ? ` data-vls-footer-endpoint="${escapeHtml(publicFooterUrl)}"` : '';
  let html = `<footer${idAttr} class="${P}-generated" data-vls-footer="1"${endpointAttr} data-vls-footer-version="hybrid-2" style="background:${BG};color:#fff;font-family:Poppins,sans-serif;">`;
  html += `<style>${css}</style>`;
  html += `<div style="padding:52px 40px 0;">`;
  html += `<div class="${P}-grid">`;

  data.sections.forEach(sec => {
    const body = (sec.links || [])
      .filter(l => l.label)
      .map(l => {
        const label = normalize(l.label, 'footerLink');
        return `<a href="${escapeHtml(l.url || '#')}" style="${ls}${textStyle(label)}">${escapeHtml(label.text)}</a>`;
      }).join('');
    html += col(sec.title, body);
  });

  const contactTitle   = normalize(data.contact.title,    'footerContactTitle');
  const contactAddress = normalize(data.contact.address,  'footerLink');
  const contactEmail   = normalize(data.contact.email,    'footerLink');
  const contactWhatsapp = normalize(data.contact.whatsapp, 'footerLink');

  let contactBody = '';
  if (contactAddress.text) {
    contactBody += `<div style="line-height:1.75;margin-bottom:12px;font-family:Poppins,sans-serif;text-align:left;${textStyle(contactAddress)}">`
      + contactAddress.text.split('\n').join('<br>') + `</div>`;
  }
  if (contactEmail.text) {
    contactBody += `<a href="mailto:${escapeHtml(contactEmail.text)}" style="${ls}${textStyle(contactEmail)}">${escapeHtml(contactEmail.text)}</a>`;
  }
  if (contactWhatsapp.text) {
    const waNum = contactWhatsapp.text.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    contactBody += `<a href="https://wa.me/${waNum}" style="${ls}${textStyle(contactWhatsapp)}">${escapeHtml(contactWhatsapp.text)}</a>`;
  }
  html += col(contactTitle, contactBody);
  html += `</div>`;

  const activeSocials = (data.socials || []).filter(s => s.url);
  html += `<div style="display:flex;justify-content:flex-end;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.12);">`;
  if (activeSocials.length) {
    html += `<div style="display:flex;gap:18px;align-items:center;">`;
    activeSocials.forEach(s => {
      const icon = SOCIAL_ICONS[s.platform] || '';
      html += `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" style="display:inline-flex;opacity:.85;line-height:0;">${icon}</a>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div style="padding:18px 0;text-align:left;">`;
  const cpLinks = (data.copyright.links || []).filter(l => l.label);
  if (cpLinks.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:8px;text-align:left;">`;
    cpLinks.forEach(l => {
      const label = normalize(l.label, 'footerCopyrightLink');
      html += `<a href="${escapeHtml(l.url || '#')}" style="font-family:Poppins,sans-serif;text-decoration:none;white-space:nowrap;text-align:left;${textStyle(label)}">${escapeHtml(label.text)}</a>`;
    });
    html += `</div>`;
  }
  const cpText = normalize(data.copyright.text, 'footerCopyright');
  if (cpText.text) {
    html += `<div style="font-family:Poppins,sans-serif;text-align:left;${textStyle(cpText)}">${escapeHtml(cpText.text)}</div>`;
  }
  html += `</div>`;
  html += `</div>`;
  if (includeToggleScript) {
    html += `<script>function vlsFtTog(h){if(window.innerWidth>768)return;var c=h.parentElement,o=c.classList.contains('open');document.querySelectorAll('.${P}-col').forEach(function(x){x.classList.remove('open');});if(!o)c.classList.add('open');}document.querySelectorAll('.${P}-yr').forEach(function(el){el.textContent=new Date().getFullYear();});<\/script>`;
  }
  html += `</footer>`;
  return html;
}

function buildFooterUpdaterScript(publicFooterUrl: string | undefined, uid: string): string {
  const url = String(publicFooterUrl || '').trim();
  if (!url) return '';
  const scriptUrl = footerUpdaterUrl(url);
  return `<script data-cfasync="false" src="${escapeHtml(scriptUrl)}" data-vls-footer-id="${escapeHtml(uid)}" data-vls-footer-endpoint="${escapeHtml(url)}"><\/script>`;

  return `<script data-cfasync="false">(function(){
var ENDPOINT=${jsString(url)};
var ROOT_ID=${jsString(uid)};
function getRoot(){var el=document.getElementById(ROOT_ID);if(el)return el;if(document.currentScript)el=document.currentScript.previousElementSibling;if(!el||!el.matches||!el.matches('[data-vls-footer="1"]'))el=document.querySelector('[data-vls-footer="1"][data-vls-footer-version="hybrid-2"]')||document.querySelector('[data-vls-footer="1"]');return el;}
if(!ENDPOINT)return;
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var D={footerTitle:{size:13,color:'#ffffff',weight:'700',letterSpacing:.07},footerLink:{size:13,color:'#d6dbea',weight:'400',letterSpacing:0},footerContactTitle:{size:13,color:'#ffffff',weight:'700',letterSpacing:.07},footerCopyright:{size:12,color:'#b5bfd6',weight:'400',letterSpacing:0},footerCopyrightLink:{size:12,color:'#cbd5e1',weight:'400',letterSpacing:0}};
function norm(v,k){var d=D[k];if(!v)return Object.assign({text:''},d);if(typeof v==='string')return Object.assign({text:v},d);return {text:v.text||'',size:v.size||d.size,color:v.color||d.color,weight:v.weight||d.weight,letterSpacing:v.letterSpacing==null?d.letterSpacing:v.letterSpacing};}
function sty(t){return 'font-size:'+t.size+'px;font-weight:'+t.weight+';color:'+t.color+';letter-spacing:'+t.letterSpacing+'em;';}
var ICONS={facebook:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',twitter:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>',instagram:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',linkedin:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>',youtube:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0f2155"/></svg>',tiktok:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/></svg>',whatsapp:'<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.922 2C6.477 2 2 6.477 2 11.922c0 1.832.498 3.546 1.368 5.025L2 22l5.207-1.336A9.88 9.88 0 0011.922 22C17.367 22 22 17.367 22 11.922S17.367 2 11.922 2zm0 18.153a8.23 8.23 0 01-4.195-1.148l-.3-.178-3.09.793.82-3.009-.196-.308a8.23 8.23 0 01-1.273-4.38c0-4.554 3.706-8.26 8.234-8.26 4.528 0 8.234 3.706 8.234 8.26 0 4.554-3.706 8.23-8.234 8.23z"/></svg>'};
function col(titleVal,bodyHtml,key){var title=norm(titleVal,key||'footerTitle');return '<div class="vlsft-col"><div class="vlsft-hdr" onclick="vlsFtTog(this)"><span style="font-family:Poppins,sans-serif;font-size:13px;font-weight:700;color:#fff;margin:0;text-transform:uppercase;letter-spacing:.07em;text-align:left;'+sty(title)+'">'+esc(title.text)+'</span><span class="vlsft-arrow">&#9660;</span></div><div class="vlsft-body">'+bodyHtml+'</div></div>';}
function render(data){data=data||{};var sections=Array.isArray(data.sections)?data.sections:[];var contact=data.contact||{};var copyright=data.copyright||{links:[]};var css='.vlsft-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:40px;padding-bottom:32px;}.vlsft-hdr{margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;cursor:default;}.vlsft-arrow{display:none;font-size:18px;color:rgba(255,255,255,.7);line-height:1;}.vlsft-body{display:block;}@media(max-width:768px){.vlsft-grid{display:block;}.vlsft-col{border-bottom:1px solid rgba(255,255,255,.12);}.vlsft-col:first-child{border-top:1px solid rgba(255,255,255,.12);margin-top:8px;}.vlsft-hdr{cursor:pointer;padding:14px 0;margin-bottom:0;}.vlsft-arrow{display:inline-block;transition:transform .25s;}.vlsft-body{display:none;padding-bottom:14px;}.vlsft-col.open .vlsft-body{display:block;}.vlsft-col.open .vlsft-arrow{transform:rotate(180deg);}}';var ls='color:rgba(255,255,255,.8);text-decoration:none;font-size:13px;font-family:Poppins,sans-serif;display:block;margin-bottom:9px;line-height:1.4;text-align:left;';var h='<footer id="'+esc(ROOT_ID)+'" class="vlsft-generated" data-vls-footer="1" data-vls-footer-endpoint="'+esc(ENDPOINT)+'" data-vls-footer-version="hybrid-2" style="background:#0f2155;color:#fff;font-family:Poppins,sans-serif;"><style>'+css+'</style><div style="padding:52px 40px 0;"><div class="vlsft-grid">';sections.forEach(function(sec){var body=(sec.links||[]).filter(function(l){return l.label;}).map(function(l){var label=norm(l.label,'footerLink');return '<a href="'+esc(l.url||'#')+'" style="'+ls+sty(label)+'">'+esc(label.text)+'</a>';}).join('');h+=col(sec.title,body,'footerTitle');});var addr=norm(contact.address,'footerLink'),email=norm(contact.email,'footerLink'),wa=norm(contact.whatsapp,'footerLink'),body='';if(addr.text)body+='<div style="line-height:1.75;margin-bottom:12px;font-family:Poppins,sans-serif;text-align:left;'+sty(addr)+'">'+esc(addr.text).replace(/\\n/g,'<br>')+'</div>';if(email.text)body+='<a href="mailto:'+esc(email.text)+'" style="'+ls+sty(email)+'">'+esc(email.text)+'</a>';if(wa.text){var waNum=wa.text.replace(/[\\s\\-()]/g,'').replace(/^\\+/,'');body+='<a href="https://wa.me/'+waNum+'" style="'+ls+sty(wa)+'">'+esc(wa.text)+'</a>';}h+=col(contact.title,body,'footerContactTitle')+'</div>';var socials=(data.socials||[]).filter(function(s){return s.url;});h+='<div style="display:flex;justify-content:flex-end;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.12);">';if(socials.length){h+='<div style="display:flex;gap:18px;align-items:center;">';socials.forEach(function(s){h+='<a href="'+esc(s.url)+'" target="_blank" rel="noopener" style="display:inline-flex;opacity:.85;line-height:0;">'+(ICONS[s.platform]||'')+'</a>';});h+='</div>';}h+='</div><div style="padding:18px 0;text-align:left;">';var cpLinks=(copyright.links||[]).filter(function(l){return l.label;});if(cpLinks.length){h+='<div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:8px;text-align:left;">';cpLinks.forEach(function(l){var label=norm(l.label,'footerCopyrightLink');h+='<a href="'+esc(l.url||'#')+'" style="font-family:Poppins,sans-serif;text-decoration:none;white-space:nowrap;text-align:left;'+sty(label)+'">'+esc(label.text)+'</a>';});h+='</div>';}var cp=norm(copyright.text,'footerCopyright');if(cp.text)h+='<div style="font-family:Poppins,sans-serif;text-align:left;'+sty(cp)+'">'+esc(cp.text)+'</div>';return h+'</div></div></footer>';}
window.vlsFtTog=window.vlsFtTog||function(h){if(window.innerWidth>768)return;var c=h.parentElement,o=c.classList.contains('open');document.querySelectorAll('.vlsft-col').forEach(function(x){x.classList.remove('open');});if(!o)c.classList.add('open');};
function refresh(){var root=getRoot();if(!root)return;fetch(ENDPOINT+(ENDPOINT.indexOf('?')>-1?'&':'?')+'t='+Date.now(),{cache:'no-store',mode:'cors'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(payload){var data=payload&&(payload.footer||payload);if(data&&data.sections){root.outerHTML=render(data);}}).catch(function(error){if(window.console&&console.warn)console.warn('VLS footer update failed:',error);});}
refresh();
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',refresh);}else{setTimeout(refresh,0);}
setTimeout(refresh,800);
setTimeout(refresh,2500);
})();<\/script>`;
}

export function generateFooterHtml(data: FooterData, publicFooterUrl?: string): string {
  const uid = 'vlsft-' + Math.random().toString(36).slice(2, 9);
  return buildFooterMarkup(data, true, uid, publicFooterUrl) + buildFooterUpdaterScript(publicFooterUrl, uid);
}

function footerUpdaterUrl(publicFooterUrl: string): string {
  try {
    const parsed = new URL(publicFooterUrl);
    return `${parsed.origin}/api/public/footer-updater.js`;
  } catch {
    return '/api/public/footer-updater.js';
  }
}
