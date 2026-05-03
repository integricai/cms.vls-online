import type { ProgramsState, ProgramTopic, ProgramCard } from '../../types/cms';
import { normalize, escapeHtml } from '../../utils/text';

function safeHex(v: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v! : fallback;
}

export function generateProgramCardsHtml(componentId: string, componentName: string, data: ProgramsState): string {
  const uid = 'vlspg' + Math.random().toString(36).slice(2, 7);

  const topics    = data.topics || [];
  const allCards  = topics.flatMap((t: ProgramTopic) =>
    (t.cards || []).map((c: ProgramCard) => ({
      topicId:      t.id,
      sectionId:    componentId,
      title:        c.title,
      desc:         c.desc,
      url:          c.url || '#',
      cta:          c.cta || normalize('View Course →', 'programCta'),
      cardBg:       safeHex(c.cardBg || t.topicColor, '#204280'),
      badge:        c.badge  || '',
      rating:       c.rating || '',
      hours:        c.hours  || '',
      badgeBg:      safeHex(t.badgeBg, '#ffffff'),
      badgeOpacity: t.badgeOpacity != null ? t.badgeOpacity : 0.22,
      badgeStyle:   normalize(t.badgeTextStyle, 'programBadge'),
    })),
  );
  const sectionsForHtml = [{ id: componentId, name: componentName, topics }];
  const totalCards = allCards.length;

  // ── Top filter pills ──
  let topPillsHtml = `<div class="${uid}-top-bar">`
    + `<div class="${uid}-top-pills">`
    + `<button class="${uid}-tpill active" id="${uid}-tp-all" onclick="${uid}setSec('all')">All (${totalCards})</button>`;
  sectionsForHtml.forEach(s => {
    topPillsHtml += `<button class="${uid}-tpill" id="${uid}-tp-${s.id}" onclick="${uid}setSec('${s.id}')">${escapeHtml(s.name)}</button>`;
  });
  topPillsHtml += `</div><div class="${uid}-topright"><span class="${uid}-count" id="${uid}-count">Showing all ${totalCards} courses</span></div></div>`;

  // ── Sidebar ──
  let sidebarHtml = `<div class="${uid}-sidebar">`
    + `<div class="${uid}-srch-wrap"><input class="${uid}-search" id="${uid}-srch" type="text" placeholder="🔍  Search courses…" oninput="${uid}filter()"></div>`
    + `<div id="${uid}-filters">`
    + `<div class="${uid}-sg-head">ALL COURSES</div>`
    + `<div class="${uid}-filter active" id="${uid}-fall" onclick="${uid}setTopic('all')"><span>All Courses</span><span class="${uid}-cnt">${totalCards}</span></div>`;
  sectionsForHtml.forEach(s => {
    if (!s.topics || !s.topics.length) return;
    sidebarHtml += `<div class="${uid}-sg-head">${escapeHtml(s.name)}</div>`;
    s.topics.forEach((t: ProgramTopic) => {
      const label = normalize(t.title, 'programCardTitle').text || 'Untitled';
      sidebarHtml += `<div class="${uid}-filter" id="${uid}-f${t.id}" onclick="${uid}setTopic('${t.id}')">`
        + `<span>${escapeHtml(label)}</span>`
        + `<span class="${uid}-cnt">${(t.cards || []).length}</span></div>`;
    });
  });
  sidebarHtml += `</div></div>`;

  const dataJson = JSON.stringify({
    sections: sectionsForHtml.map(s => ({ id: s.id, name: s.name, topics: (s.topics || []).map((t: ProgramTopic) => ({ id: t.id })) })),
    topics: topics.map((t: ProgramTopic) => ({ id: t.id, title: t.title })),
    cards: allCards,
  });

  const css = `<style>\n`
    + `.${uid}-outer{font-family:Poppins,sans-serif;box-sizing:border-box;}\n`
    + `.${uid}-outer *{box-sizing:border-box;}\n`
    + `.${uid}-top-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;}\n`
    + `.${uid}-top-pills{display:flex;gap:8px;flex-wrap:wrap;flex:1;}\n`
    + `.${uid}-tpill{padding:7px 16px;border-radius:999px;border:1.5px solid #e5e7eb;background:#fff;font-family:Poppins,sans-serif;font-size:13px;font-weight:500;color:#374151;cursor:pointer;white-space:nowrap;}\n`
    + `.${uid}-tpill:hover{border-color:#204280;color:#204280;}\n`
    + `.${uid}-tpill.active{background:#204280;border-color:#204280;color:#fff;}\n`
    + `.${uid}-topright{font-size:13px;color:#6b7280;white-space:nowrap;}\n`
    + `.${uid}-wrap{display:flex;gap:24px;align-items:flex-start;}\n`
    + `.${uid}-sidebar{width:220px;flex-shrink:0;}\n`
    + `.${uid}-srch-wrap{position:relative;margin-bottom:12px;}\n`
    + `.${uid}-search{width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none;}\n`
    + `.${uid}-search:focus{border-color:#204280;}\n`
    + `.${uid}-sg-head{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;padding:12px 10px 5px;}\n`
    + `.${uid}-filter{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;font-size:13px;cursor:pointer;color:#374151;gap:8px;}\n`
    + `.${uid}-filter:hover{background:#f3f4f6;}\n`
    + `.${uid}-filter.active{background:#204280;color:#fff;}\n`
    + `.${uid}-filter.active .${uid}-cnt{background:rgba(255,255,255,0.25);color:#fff;}\n`
    + `.${uid}-cnt{font-size:11px;font-weight:600;background:#f3f4f6;color:#6b7280;border-radius:999px;padding:1px 7px;flex-shrink:0;}\n`
    + `.${uid}-main{flex:1;min-width:0;}\n`
    + `.${uid}-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-content:start;}\n`
    + `.${uid}-card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:#fff;transition:box-shadow .15s;}\n`
    + `.${uid}-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.12);transform:translateY(-1px);}\n`
    + `.${uid}-card-top{position:relative;height:80px;display:flex;align-items:flex-end;padding:12px 14px;}\n`
    + `.${uid}-card-badge{display:inline-block;padding:4px 10px;border-radius:6px;color:#fff;font-size:11px;font-weight:600;letter-spacing:0.01em;}\n`
    + `.${uid}-card-body{padding:16px 18px;display:flex;flex-direction:column;flex:1;}\n`
    + `.${uid}-card-title{font-weight:700;font-size:15px;color:#1a1a1a;margin:0 0 8px;line-height:1.4;}\n`
    + `.${uid}-card-desc{font-size:13px;color:#6b7280;line-height:1.6;flex:1;margin:0 0 12px;}\n`
    + `.${uid}-card-meta{display:flex;align-items:center;gap:12px;font-size:12px;color:#6b7280;margin-bottom:14px;}\n`
    + `.${uid}-card-btn{display:inline-block;padding:10px 20px;background:#204280;color:#fff;border:none;border-radius:7px;font-family:Poppins,sans-serif;font-size:13px;font-weight:600;text-align:center;cursor:pointer;text-decoration:none;width:100%;}\n`
    + `.${uid}-card-btn:hover{background:#1a3570;color:#fff;}\n`
    + `.${uid}-pager{display:flex;gap:6px;margin-top:24px;flex-wrap:wrap;align-items:center;justify-content:center;}\n`
    + `.${uid}-pg-btn{min-width:36px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-family:Poppins,sans-serif;font-size:13px;color:#262a32;text-align:center;}\n`
    + `.${uid}-pg-btn.active{background:#204280;color:#fff;border-color:#204280;}\n`
    + `.${uid}-pg-btn:hover:not(.active){background:#f3f4f6;}\n`
    + `.${uid}-pg-btn:disabled{opacity:.4;cursor:default;pointer-events:none;}\n`
    + `.${uid}-empty{padding:40px 0;text-align:center;color:#9ca3af;font-size:14px;grid-column:1/-1;}\n`
    + `@media(max-width:960px){.${uid}-grid{grid-template-columns:repeat(2,1fr);}}\n`
    + `@media(max-width:640px){`
    + `.${uid}-wrap{flex-direction:column;}`
    + `.${uid}-sidebar{width:100%;}`
    + `.${uid}-grid{grid-template-columns:1fr;}`
    + `.${uid}-top-pills{gap:6px;}`
    + `.${uid}-tpill{font-size:12px;padding:6px 12px;}`
    + `}\n`
    + `</style>`;

  const markup = `<div class="${uid}-outer">\n`
    + topPillsHtml + '\n'
    + `  <div class="${uid}-wrap">\n`
    + sidebarHtml + '\n'
    + `    <div class="${uid}-main">\n`
    + `      <div class="${uid}-grid" id="${uid}-grid"></div>\n`
    + `      <div class="${uid}-pager" id="${uid}-pager"></div>\n`
    + `    </div>\n`
    + `  </div>\n`
    + `</div>`;

  const script = `<script data-cfasync="false">\n`
    + `(function(){\n`
    + `  var D=${dataJson};\n`
    + `  var PS=9;\n`
    + `  var st={sec:"all",t:"all",p:1,q:""};\n`
    + `  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}\n`
    + `  function esca(s){return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");}\n`
    + `  function ptxt(p){return typeof p==="string"?(p||""):((p&&p.text)||"");}\n`
    + `  function normWeight(w){w=String(w==null?"":w).toLowerCase();if(w==="700"||w==="bold")return "700";if(w==="500"||w==="medium")return "500";return "400";}\n`
    + `  function tstyle(t,sz,cl,wt){var ls=0;if(typeof t==="object"&&t){sz=t.size||sz;cl=(/^#[0-9a-fA-F]{6}$/.test(t.color||""))?t.color:cl;wt=normWeight(t.weight)||wt;ls=t.letterSpacing||0;}return "font-size:"+sz+"px;font-weight:"+wt+";color:"+cl+";letter-spacing:"+ls+"em;";}\n`
    + `  function pstyle(p){var sz=13,cl="#6b7280",wt="400";if(p&&typeof p==="object"){sz=p.size||sz;cl=(/^#[0-9a-fA-F]{6}$/.test(p.color||""))?p.color:cl;wt=normWeight(p.weight)||wt;}return "font-size:"+sz+"px;font-weight:"+wt+";color:"+cl+";";}\n`
    + `  function getTopicsBySec(sid){\n`
    + `    if(sid==="all")return null;\n`
    + `    var s=D.sections.find(function(x){return x.id===sid;});\n`
    + `    return s?(s.topics||[]).map(function(t){return t.id;}):null;\n`
    + `  }\n`
    + `  function getCards(){\n`
    + `    var c=D.cards;\n`
    + `    if(st.sec!=="all"){var tids=getTopicsBySec(st.sec);if(tids)c=c.filter(function(x){return tids.indexOf(x.topicId)>=0;});}\n`
    + `    if(st.t!=="all")c=c.filter(function(x){return x.topicId===st.t;});\n`
    + `    if(st.q){var q=st.q.toLowerCase();c=c.filter(function(x){return(ptxt(x.title)+" "+ptxt(x.desc)).toLowerCase().indexOf(q)>=0;});}\n`
    + `    return c;\n`
    + `  }\n`
    + `  function render(){\n`
    + `    var fc=getCards(),tot=fc.length,pages=Math.max(1,Math.ceil(tot/PS));\n`
    + `    if(st.p>pages)st.p=1;\n`
    + `    var sl=fc.slice((st.p-1)*PS,(st.p-1)*PS+PS);\n`
    + `    var g=document.getElementById("${uid}-grid");\n`
    + `    var pg=document.getElementById("${uid}-pager");\n`
    + `    var cnt=document.getElementById("${uid}-count");\n`
    + `    if(cnt)cnt.textContent="Showing "+(st.p*PS-PS+1)+"–"+Math.min(st.p*PS,tot)+" of "+tot+" results";\n`
    + `    if(!g)return;\n`
    + `    if(!sl.length){g.innerHTML='<div class="${uid}-empty">No courses found.</div>';pg.innerHTML="";return;}\n`
    + `    g.innerHTML=sl.map(function(c){\n`
    + `      var bg=c.cardBg||"#204280";\n`
    + `      function h2r(h,a){h=(h||"#ffffff").replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);return "rgba("+r+","+g+","+b+","+(isNaN(a)?0.22:a)+")";}\n`
    + `      var bbg=h2r(c.badgeBg,c.badgeOpacity);\n`
    + `      var topHtml='<div class="${uid}-card-top" style="background:'+bg+'">'\n`
    + `        +(c.badge?'<span class="${uid}-card-badge" style="background:'+bbg+';'+tstyle(c.badgeStyle,11,"#ffffff","600")+'">'+esc(c.badge)+"<\\/span>":"")\n`
    + `        +"<\\/div>";\n`
    + `      var metaHtml="";\n`
    + `      if(c.hours||c.rating){\n`
    + `        metaHtml='<div class="${uid}-card-meta">'\n`
    + `          +(c.hours?'<span>\u{1F4F9} '+esc(c.hours)+' video<\\/span>':"")\n`
    + `          +(c.rating?'<span>★ '+esc(c.rating)+"<\\/span>":"")\n`
    + `          +"<\\/div>";\n`
    + `      }\n`
    + `      return '<div class="${uid}-card">'\n`
    + `        +topHtml\n`
    + `        +'<div class="${uid}-card-body">'\n`
    + `        +'<div class="${uid}-card-title" style="'+tstyle(c.title,15,"#1a1a1a","700")+'">'+esc(ptxt(c.title))+"<\\/div>"\n`
    + `        +'<div class="${uid}-card-desc" style="'+pstyle(c.desc)+'">'+esc(ptxt(c.desc))+"<\\/div>"\n`
    + `        +metaHtml\n`
    + `        +'<a class="${uid}-card-btn" style="'+tstyle(c.cta,13,"#ffffff","700")+'" href="'+esca(c.url)+'">'+esc(ptxt(c.cta)||"View Course →")+"<\\/a>"\n`
    + `        +"<\\/div>"\n`
    + `        +"<\\/div>";\n`
    + `    }).join("");\n`
    + `    var ph='<button class="${uid}-pg-btn"'+(st.p===1?" disabled":"")+' onclick="${uid}goto('+(st.p-1)+')">&#x276E;<\\/button>';\n`
    + `    for(var i=1;i<=pages;i++)ph+='<button class="${uid}-pg-btn'+(i===st.p?" active":"")+'"\'+\' onclick="${uid}goto('+i+')">'+i+"<\\/button>";\n`
    + `    ph+='<button class="${uid}-pg-btn"'+(st.p===pages?" disabled":"")+' onclick="${uid}goto('+(st.p+1)+')">&#x276F;<\\/button>';\n`
    + `    pg.innerHTML=ph;\n`
    + `  }\n`
    + `  window.${uid}setSec=function(sid){\n`
    + `    document.querySelectorAll(".${uid}-tpill").forEach(function(el){el.classList.remove("active");});\n`
    + `    var a=document.getElementById("${uid}-tp-"+(sid==="all"?"all":sid));\n`
    + `    if(a)a.classList.add("active");\n`
    + `    st.sec=sid;st.t="all";st.p=1;\n`
    + `    document.querySelectorAll(".${uid}-filter").forEach(function(el){el.classList.remove("active");});\n`
    + `    var fa=document.getElementById("${uid}-fall");if(fa)fa.classList.add("active");\n`
    + `    render();\n`
    + `  };\n`
    + `  window.${uid}setTopic=function(t){\n`
    + `    document.querySelectorAll(".${uid}-filter").forEach(function(el){el.classList.remove("active");});\n`
    + `    var a=t==="all"?document.getElementById("${uid}-fall"):document.getElementById("${uid}-f"+t);\n`
    + `    if(a)a.classList.add("active");\n`
    + `    st.t=t;st.p=1;render();\n`
    + `  };\n`
    + `  window.${uid}filter=function(){st.q=(document.getElementById("${uid}-srch")||{value:""}).value;st.p=1;render();};\n`
    + `  window.${uid}goto=function(p){var max=Math.max(1,Math.ceil(getCards().length/PS));if(p<1||p>max)return;st.p=p;render();};\n`
    + `  render();\n`
    + `})();\n`
    + `<\/script>`;

  return css + '\n\n' + markup + '\n\n' + script;
}
