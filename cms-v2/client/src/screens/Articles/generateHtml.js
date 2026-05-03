import { escapeHtml, normalize, textStyle } from '../../utils/text';
function safeHex(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : fallback;
}
function attr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
function text(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value.text || '';
}
function style(value, key) {
    return `font-family:Poppins,sans-serif;${textStyle(normalize(value, key))}`;
}
export function generateArticlesHtml(data) {
    const uid = `ag${Date.now().toString(36)}`;
    const theme = safeHex(data.theme, '#0d1f3c');
    const total = (data.groups || []).reduce((sum, group) => sum + (group.articles || []).length, 0);
    const headingStyle = style(data.headingStyle, 'articleGroupTitle');
    const bodyStyle = style(data.bodyStyle, 'articleGroupBody');
    const rowTitleStyle = style(data.rowTitleStyle, 'articleGroupRowTitle');
    const noticeStyle = style(data.notice, 'articleGroupNotice');
    const tabs = [
        `<button type="button" class="${uid}-pill is-active" data-topic="all">All topics</button>`,
        ...(data.groups || []).map(group => `<button type="button" class="${uid}-pill" data-topic="${attr(group.title)}">${escapeHtml(group.short || group.title)}</button>`),
    ].join('');
    const nav = `<aside class="${uid}-side"><div class="${uid}-current"><span>Currently viewing</span><strong>${escapeHtml(data.paperCode || 'PM')} Articles</strong></div><div class="${uid}-side-title">Topic areas</div>
    <button type="button" class="${uid}-side-link is-active" data-topic="all"><span>All articles</span><b>${total}</b></button>
    ${(data.groups || []).map(group => `<button type="button" class="${uid}-side-link" data-topic="${attr(group.title)}"><span>${escapeHtml(group.title)}</span><b>${(group.articles || []).length}</b></button>`).join('')}
  </aside>`;
    const groupsHtml = (data.groups || []).map(group => {
        const color = safeHex(group.color, theme);
        const articles = (group.articles || []).map(article => `<a class="${uid}-row" href="${attr(article.url || '#')}" target="_blank" rel="noopener">
      <span class="${uid}-badge" style="background:${color}18;color:${color};">${escapeHtml(article.code || '')}</span>
      <strong style="${rowTitleStyle}">${escapeHtml(article.title || '')}</strong>
      <span style="${bodyStyle}">${escapeHtml(article.desc || '')}</span>
      <em aria-hidden="true">&#8599;</em>
    </a>`).join('');
        return `<section class="${uid}-group" data-topic="${attr(group.title)}">
      <header><span style="background:${color};"></span><h2 style="${headingStyle}">${escapeHtml(group.title || '')}</h2><small>${(group.articles || []).length} articles</small></header>
      <div class="${uid}-rows">${articles}</div>
    </section>`;
    }).join('');
    const css = `<style>
.${uid}{font-family:Poppins,sans-serif;background:#f4f7fb;color:#0d1f3c;padding:0 0 34px;}
.${uid} *{box-sizing:border-box;}
.${uid}-bar{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid #e6ebf2;padding:12px 30px;display:flex;align-items:center;gap:12px;overflow:auto;}
.${uid}-bar-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b2;white-space:nowrap;}
.${uid}-pill{border:1px solid #d8e0ea;background:#fff;border-radius:999px;padding:7px 16px;font:600 12px Poppins,sans-serif;color:#334155;white-space:nowrap;cursor:pointer;}
.${uid}-pill.is-active{background:${theme};border-color:${theme};color:#fff;}
.${uid}-count{margin-left:auto;font-size:12px;color:#9aa3b2;white-space:nowrap;}
.${uid}-layout{max-width:1160px;margin:0 auto;padding:28px 30px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:24px;}
.${uid}-side{align-self:start;position:sticky;top:74px;background:#fff;border:1px solid #e1e8f1;border-radius:12px;overflow:hidden;}
.${uid}-current{background:${theme};padding:18px;color:#fff;}
.${uid}-current span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#63b3ed;font-weight:700;margin-bottom:5px;}
.${uid}-current strong{font-size:16px;}
.${uid}-side-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b2;font-weight:700;padding:14px 18px 8px;}
.${uid}-side-link{width:100%;border:0;border-top:1px solid #edf1f6;background:#fff;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;font:500 12px Poppins,sans-serif;color:#5c6573;text-align:left;cursor:pointer;}
.${uid}-side-link.is-active{background:#e8f3fc;color:#1f6fbf;border-left:3px solid #1f6fbf;}
.${uid}-side-link b{background:#eef2f7;border-radius:999px;padding:2px 7px;font-size:11px;color:#6b7280;}
.${uid}-main{display:flex;flex-direction:column;gap:14px;}
.${uid}-group{background:#fff;border:1px solid #e1e8f1;border-radius:12px;overflow:hidden;}
.${uid}-group[hidden]{display:none;}
.${uid}-group header{background:#f7f9fc;padding:16px 24px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #edf1f6;}
.${uid}-group header span{width:5px;height:24px;border-radius:8px;flex-shrink:0;}
.${uid}-group h2{margin:0;line-height:1.25;flex:1;}
.${uid}-group small{font-size:12px;color:#8b95a5;}
.${uid}-row{display:grid;grid-template-columns:42px minmax(160px,260px) minmax(220px,1fr) 24px;gap:12px;align-items:center;text-decoration:none;padding:14px 24px;border-top:1px solid #edf1f6;}
.${uid}-row:first-child{border-top:0;}
.${uid}-row strong{line-height:1.35;}
.${uid}-row span:nth-child(3){line-height:1.45;}
.${uid}-badge{width:30px;height:30px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;}
.${uid}-row em{font-style:normal;color:#1f6fbf;font-size:14px;text-align:right;}
.${uid}-notice{background:#fff;border:1px solid #e1e8f1;border-radius:12px;padding:16px 22px;display:flex;gap:12px;align-items:flex-start;}
.${uid}-notice p{margin:0;line-height:1.6;}
.${uid}-notice a{color:#1f6fbf;text-decoration:none;}
@media(max-width:860px){.${uid}-layout{grid-template-columns:1fr;padding:20px 16px;}.${uid}-side{position:static;}.${uid}-row{grid-template-columns:38px 1fr 24px;}.${uid}-row span:nth-child(3){grid-column:2/4;}.${uid}-bar{padding:10px 16px;}}
</style>`;
    const script = `<script>(function(){var root=document.currentScript.previousElementSibling;while(root&&!(root.classList&&root.classList.contains("${uid}")))root=root.previousElementSibling;if(!root)return;function setTopic(topic){root.querySelectorAll("[data-topic]").forEach(function(el){if(el.classList&&(el.classList.contains("${uid}-pill")||el.classList.contains("${uid}-side-link")))el.classList.toggle("is-active",el.getAttribute("data-topic")===topic);});root.querySelectorAll(".${uid}-group").forEach(function(g){g.hidden=topic!=="all"&&g.getAttribute("data-topic")!==topic;});}root.addEventListener("click",function(e){var b=e.target.closest("button[data-topic]");if(b)setTopic(b.getAttribute("data-topic"));});})();<\/script>`;
    const body = `<section class="${uid}">
    <div class="${uid}-bar"><span class="${uid}-bar-label">Filter by topic</span>${tabs}<span class="${uid}-count">${total} articles</span></div>
    <div class="${uid}-layout">${nav}<main class="${uid}-main">${groupsHtml}
      <div class="${uid}-notice"><span>&copy;</span><p style="${noticeStyle}">${escapeHtml(text(data.notice))} <a href="${attr(data.hubUrl || '#')}" target="_blank" rel="noopener">&larr; Back to all technical articles</a></p></div>
    </main></div>
  </section>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n${css}\n${body}\n${script}`;
}
