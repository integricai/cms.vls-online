import type { EventDescriptionBlock, TextValue, VlsEvent } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

const MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const CLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 12"/></svg>';
const PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

function text(value: TextValue | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.text ?? '';
}

function attr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function month(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : MONS[d.getMonth()];
}

function day(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : String(d.getDate());
}

function time(value: string, timezone: string): string {
  try {
    return new Date(value).toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'Europe/London',
      timeZoneName: 'short',
    });
  } catch {
    return value;
  }
}

function descHtml(blocks: EventDescriptionBlock[]): string {
  return (blocks || []).map(block => {
    if (block.type === 'heading-para') {
      const heading = normalize(block.heading, 'eventHeading');
      const para = normalize(block.para, 'event');
      return `${heading.text ? `<h3 style="font-family:Poppins,sans-serif;margin:0 0 5px;text-align:left;${textStyle(heading)}">${escapeHtml(heading.text)}</h3>` : ''}${para.text ? `<p style="font-family:Poppins,sans-serif;${textStyle(para)}line-height:1.6;margin:0 0 10px;text-align:left;">${escapeHtml(para.text)}</p>` : ''}`;
    }
    if (block.type === 'paragraph') {
      const para = normalize(block.para, 'event');
      return para.text ? `<p style="font-family:Poppins,sans-serif;${textStyle(para)}line-height:1.6;margin:0 0 10px;text-align:left;">${escapeHtml(para.text)}</p>` : '';
    }
    return `<ul style="padding-left:0;list-style:none;margin:0 0 10px;">${(block.items || []).map(item => {
      const bullet = normalize(item, 'eventBullet');
      return bullet.text ? `<li style="font-family:Poppins,sans-serif;padding:2px 0;display:flex;gap:8px;align-items:flex-start;${textStyle(bullet)}"><span style="color:#534AB7;font-weight:700;flex-shrink:0;">&bull;</span>${escapeHtml(bullet.text)}</li>` : '';
    }).join('')}</ul>`;
  }).join('');
}

export function renderEventCardHtml(event: VlsEvent): string {
  const name = normalize(event.name, 'eventName');
  const hosts = normalize(event.hosts, 'eventMeta');
  const venue = normalize(event.venue, 'eventMeta');
  const cta = normalize(event.ctaText, 'eventCta');
  const infoStyle = 'display:inline-flex;align-items:center;gap:6px;font-family:Poppins,sans-serif;font-size:13px;color:#262a32;';

  const info = [
    event.startsAt ? `<span style="${infoStyle}">${CLOCK}${time(event.startsAt, event.timezone)}</span>` : '',
    venue.text ? `<span style="${infoStyle}${textStyle(venue)}">${PIN}${escapeHtml(venue.text)}</span>` : '',
  ].filter(Boolean).join('');

  return `<div style="font-family:Poppins,sans-serif;display:flex;border-radius:12px;border:1px solid #e0e0f0;overflow:hidden;max-width:100%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.06);">
  <div style="background:#534AB7;width:76px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:16px 8px;">
    ${event.startsAt ? `<span style="font-family:Poppins,sans-serif;color:rgba(255,255,255,.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${month(event.startsAt)}</span><span style="font-family:Poppins,sans-serif;color:#fff;font-size:38px;font-weight:700;line-height:1;">${day(event.startsAt)}</span>` : ''}
  </div>
  <div style="flex:1;min-width:0;padding:16px 20px;">
    <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin-bottom:8px;">
      <h2 style="flex:1;min-width:0;font-family:Poppins,sans-serif;margin:0;text-align:left;${textStyle(name)}">${escapeHtml(name.text || 'Untitled')}</h2>
      ${cta.text ? `<a href="${attr(event.ctaUrl || '#')}" style="flex-shrink:0;display:inline-block;padding:9px 18px;background:#534AB7;border-radius:6px;text-decoration:none;white-space:nowrap;${textStyle(cta)}">${escapeHtml(cta.text)}</a>` : ''}
    </div>
    ${hosts.text ? `<div style="font-family:Poppins,sans-serif;margin-bottom:10px;text-align:left;${textStyle(hosts)}">Host: ${escapeHtml(hosts.text)}</div>` : ''}
    ${info ? `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:14px;">${info}</div>` : ''}
    ${event.description?.length ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 14px;">${descHtml(event.description)}` : ''}
  </div>
</div>`;
}

export function renderEventsListPreview(events: VlsEvent[]): string {
  const now = new Date();
  const upcoming = events
    .filter(event => event.startsAt && new Date(event.startsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!upcoming.length) {
    return '<div style="text-align:center;padding:30px;font-family:Poppins,sans-serif;font-size:14px;color:#6b7280;">No upcoming events to preview. Add a future event to see it here.</div>';
  }
  return `<div style="display:flex;flex-direction:column;gap:16px;">${upcoming.map(renderEventCardHtml).join('')}</div>`;
}

export function buildEventEmbedCode(eventId: string, publicUrl: string): string {
  return `<div id="vls-event-${eventId}"></div>
<script>
(function(){
var EID=${JSON.stringify(eventId)},URL=${JSON.stringify(publicUrl)};
${embedRendererJs()}
fetch(URL+"?t="+Date.now()).then(function(r){return r.json();}).then(function(data){var ev=(data.events||[]).find(function(e){return e.id===EID;});if(ev)render(ev);}).catch(function(e){console.warn("VLS Event: failed to load",e);});
})();
<\/script>`;
}

export function buildEventsListEmbedCode(publicUrl: string): string {
  return `<div id="vls-events-list"></div>
<script>
(function(){
var URL=${JSON.stringify(publicUrl)};
${embedRendererJs()}
fetch(URL+"?t="+Date.now()).then(function(r){return r.json();}).then(function(data){
  var now=new Date();
  var events=(data.events||[]).filter(function(e){return e.startsAt&&new Date(e.startsAt)>=now;});
  events.sort(function(a,b){return String(a.startsAt).localeCompare(String(b.startsAt));});
  var el=document.getElementById("vls-events-list");
  if(!el)return;
  if(!events.length){el.innerHTML='<p style="font-family:Poppins,sans-serif;font-size:14px;color:#262a32;text-align:center;padding:30px 0;">No upcoming events at this time.</p>';return;}
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:16px;">'+events.map(card).join("")+'</div>';
}).catch(function(e){console.warn("VLS Events List: failed to load",e);});
})();
<\/script>`;
}

export function eventText(value: TextValue | undefined): string {
  return text(value);
}

function embedRendererJs(): string {
  return `var MONS=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
var CLOCK=${JSON.stringify(CLOCK)},PIN=${JSON.stringify(PIN)};
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return esc(s).replace(/"/g,"&quot;");}
function txt(v){return v&&typeof v==="object"&&!Array.isArray(v)?String(v.text||""):String(v||"");}
function norm(v,size,color,weight,spacing){var o=v&&typeof v==="object"&&!Array.isArray(v)?v:{text:v||""};return{text:String(o.text||""),size:o.size||size,color:o.color||color,weight:o.weight||weight,letterSpacing:o.letterSpacing||spacing||0};}
function sty(v,size,color,weight,spacing){var n=norm(v,size,color,weight,spacing);return "font-size:"+n.size+"px;font-weight:"+n.weight+";color:"+n.color+";letter-spacing:"+n.letterSpacing+"em;";}
function mon(s){var d=new Date(s);return isNaN(d.getTime())?"":MONS[d.getMonth()];}
function day(s){var d=new Date(s);return isNaN(d.getTime())?"":d.getDate();}
function tm(s,tz){try{return new Date(s).toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:tz||"Europe/London",timeZoneName:"short"});}catch(e){return s||"";}}
function desc(blocks){var h="";(blocks||[]).forEach(function(b){if(b.type==="heading-para"){if(txt(b.heading))h+='<h3 style="font-family:Poppins,sans-serif;margin:0 0 5px;text-align:left;'+sty(b.heading,15,"#204280","700",0)+'">'+esc(txt(b.heading))+'</h3>';if(txt(b.para))h+='<p style="font-family:Poppins,sans-serif;line-height:1.6;margin:0 0 10px;text-align:left;'+sty(b.para,14,"#262a32","400",0)+'">'+esc(txt(b.para))+'</p>';}else if(b.type==="paragraph"){if(txt(b.para))h+='<p style="font-family:Poppins,sans-serif;line-height:1.6;margin:0 0 10px;text-align:left;'+sty(b.para,14,"#262a32","400",0)+'">'+esc(txt(b.para))+'</p>';}else if(b.type==="list"){h+='<ul style="padding-left:0;list-style:none;margin:0 0 10px;">';(b.items||[]).forEach(function(i){if(txt(i))h+='<li style="font-family:Poppins,sans-serif;padding:2px 0;display:flex;gap:8px;align-items:flex-start;'+sty(i,14,"#262a32","400",0)+'"><span style="color:#534AB7;font-weight:700;flex-shrink:0;">&bull;</span>'+esc(txt(i))+'</li>';});h+='</ul>';}});return h;}
function card(ev){var name=norm(ev.name,18,"#1a1a1a","700",0),hosts=norm(ev.hosts,13,"#262a32","400",0),venue=norm(ev.venue,13,"#262a32","400",0),cta=norm(ev.ctaText,13,"#ffffff","500",0);var info=[];if(ev.startsAt)info.push('<span style="display:inline-flex;align-items:center;gap:6px;font-family:Poppins,sans-serif;font-size:13px;color:#262a32;">'+CLOCK+tm(ev.startsAt,ev.timezone)+'</span>');if(venue.text)info.push('<span style="display:inline-flex;align-items:center;gap:6px;font-family:Poppins,sans-serif;'+sty(venue,13,"#262a32","400",0)+'">'+PIN+esc(venue.text)+'</span>');var titleRow='<div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin-bottom:8px;"><h2 style="flex:1;min-width:0;font-family:Poppins,sans-serif;margin:0;text-align:left;'+sty(name,18,"#1a1a1a","700",0)+'">'+esc(name.text||"Untitled")+'</h2>'+(cta.text?'<a href="'+attr(ev.ctaUrl||"#")+'" style="flex-shrink:0;display:inline-block;padding:9px 18px;background:#534AB7;border-radius:6px;text-decoration:none;white-space:nowrap;'+sty(cta,13,"#ffffff","500",0)+'">'+esc(cta.text)+'</a>':'')+'</div>';return '<div style="font-family:Poppins,sans-serif;display:flex;border-radius:12px;border:1px solid #e0e0f0;overflow:hidden;max-width:100%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.06);"><div style="background:#534AB7;width:76px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:16px 8px;">'+(ev.startsAt?'<span style="font-family:Poppins,sans-serif;color:rgba(255,255,255,.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">'+mon(ev.startsAt)+'</span><span style="font-family:Poppins,sans-serif;color:#fff;font-size:38px;font-weight:700;line-height:1;">'+day(ev.startsAt)+'</span>':'')+'</div><div style="flex:1;min-width:0;padding:16px 20px;">'+titleRow+(hosts.text?'<div style="font-family:Poppins,sans-serif;margin-bottom:10px;text-align:left;'+sty(hosts,13,"#262a32","400",0)+'">Host: '+esc(hosts.text)+'</div>':'')+(info.length?'<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:14px;">'+info.join("")+'</div>':'')+((ev.description||[]).length?'<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 14px;">'+desc(ev.description):'')+'</div></div>';}
function render(ev){var el=document.getElementById("vls-event-"+EID);if(el)el.innerHTML=card(ev);}`;
}
