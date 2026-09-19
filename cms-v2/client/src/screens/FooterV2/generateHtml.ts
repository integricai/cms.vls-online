import type { FooterV2Data } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

const SOCIAL_ICONS: Record<string, string> = {
  facebook:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
  twitter:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  linkedin:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>',
  youtube:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff"/></svg>',
  tiktok:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/></svg>',
  whatsapp:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.922 2C6.477 2 2 6.477 2 11.922c0 1.832.498 3.546 1.368 5.025L2 22l5.207-1.336A9.88 9.88 0 0011.922 22C17.367 22 22 17.367 22 11.922S17.367 2 11.922 2zm0 18.153a8.23 8.23 0 01-4.195-1.148l-.3-.178-3.09.793.82-3.009-.196-.308a8.23 8.23 0 01-1.273-4.38c0-4.554 3.706-8.26 8.234-8.26 4.528 0 8.234 3.706 8.234 8.26 0 4.554-3.706 8.23-8.234 8.23z"/></svg>',
};

function absUrl(url: string, base: string): string {
  const u = String(url || '').trim();
  const b = String(base || '').replace(/\/$/, '');
  if (!u) return '#';
  if (/^(https?:|mailto:|tel:|\/\/|#)/i.test(u)) return u;
  if (u.startsWith('/') && b) return b + u;
  return u;
}

function starRow(value: number): string {
  const rating = Math.min(5, Math.max(0, Number(value) || 0));
  return Array.from({ length: 5 }, (_, i) => {
    const fill = Math.min(1, Math.max(0, rating - i));
    return `<span class="vlsft2-star" aria-hidden="true"><span class="vlsft2-star-empty">★</span><span class="vlsft2-star-fill" style="width:${Math.round(fill * 100)}%">★</span></span>`;
  }).join('');
}

export function buildFooterV2Markup(data: FooterV2Data, uid: string, publicFooterUrl?: string): string {
  const siteBase = data.siteBaseUrl || 'https://vls-online.com';
  const about = normalize(data.aboutText, 'footerV2About');
  const rating = normalize(data.ratingText, 'footerV2Rating');
  const siteTitle = normalize(data.siteTitle, 'headerV2SiteTitle');
  const subTitle = normalize(data.subTitle, 'headerV2SubTitle');
  const logoLink = escapeHtml(absUrl(data.logoLink || '/', siteBase));
  const hasLogo = Boolean((data.logoUrl || '').trim());
  const brandInner = hasLogo
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.logoAlt || 'Vertex Learning Solutions')}" class="vlsft2-logo">`
    : `<span class="vlsft2-mark" aria-hidden="true">V</span>`;

  const css = `.block.footer-style.parrot.zenstyle.footer-block,.block.parrot.zenstyle.footers{display:none!important;}`
    + `.vlsft2{background:#0e2a57;color:#c5d2ec;font-family:Poppins,sans-serif;padding:40px 0 36px;width:100%;}`
    + `.vlsft2-inner{max-width:1200px;margin:0 auto;padding:0 40px;box-sizing:border-box;}`
    + `.vlsft2-intro{margin-bottom:20px;}`
    + `.vlsft2-brand{display:flex;align-items:center;gap:12px;text-decoration:none!important;margin-bottom:12px;}`
    + `.vlsft2-logo,.vlsft2-mark{width:38px;height:38px;border-radius:10px;flex-shrink:0;}`
    + `.vlsft2-logo{object-fit:cover;display:block;}`
    + `.vlsft2-mark{background:#fff;color:#0e2a57;font-weight:700;font-size:19px;display:grid;place-items:center;}`
    + `.vlsft2-brand-text{display:flex;flex-direction:column;}`
    + `.vlsft2-name{color:#fff;font-weight:700;font-size:18px;line-height:1;}`
    + `.vlsft2-sub{color:#8399c4;font-size:9.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;margin-top:3px;}`
    + `.vlsft2-about{margin:0;line-height:1.65;}`
    + `.vlsft2-social-bar{display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,.13);padding:0 0 8px;}`
    + `.vlsft2-social{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px;transform:translateY(-50%);background:#0e2a57;padding-left:8px;}`
    + `.vlsft2-social a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;color:#0e2a57;background:#fff;}`
    + `.vlsft2-social a:hover{color:#fff;background:#1e50c8;}`
    + `.vlsft2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:48px;margin-bottom:40px;}`
    + `.vlsft2-col h4,.vlsft2-hdr span{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#93a9d6;margin:0 0 10px;}`
    + `.vlsft2-hdr{display:flex;justify-content:space-between;align-items:center;}`
    + `.vlsft2-arrow{display:none;color:rgba(255,255,255,.7);}`
    + `.vlsft2-col ul{list-style:none;margin:0;padding:0;}`
    + `.vlsft2-col a,.vlsft2-address{font-size:14.5px;color:#c5d2ec!important;text-decoration:none!important;display:block;padding:1px 0;line-height:1.45;}`
    + `.vlsft2-col a:hover{color:#fff!important;}`
    + `.vlsft2-address{font-style:normal;margin:0 0 8px;}`
    + `.vlsft2-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,.13);flex-wrap:wrap;gap:14px;}`
    + `.vlsft2-legal{display:flex;flex-wrap:wrap;gap:16px;}`
    + `.vlsft2-legal a{font-size:13.5px;color:#a4b4d6!important;text-decoration:none!important;}`
    + `.vlsft2-legal a:hover{color:#fff!important;}`
    + `.vlsft2-rating{display:flex;align-items:center;gap:9px;}`
    + `.vlsft2-stars{display:inline-flex;gap:2px;}`
    + `.vlsft2-star{position:relative;display:inline-block;width:14px;height:14px;font-size:14px;line-height:1;}`
    + `.vlsft2-star-empty{color:rgba(255,255,255,.25);}`
    + `.vlsft2-star-fill{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f5a623;}`
    + `.vlsft2-copy{font-size:13.5px;color:#a4b4d6;margin:10px 0 0;}`
    + `@media(max-width:980px){.vlsft2-grid{grid-template-columns:1fr 1fr;gap:36px;}.vlsft2-inner{padding:0 24px;}}`
    + `@media(max-width:768px){`
    + `.vlsft2-grid{display:block;}`
    + `.vlsft2-col{border-bottom:1px solid rgba(255,255,255,.12);}`
    + `.vlsft2-hdr{cursor:pointer;padding:14px 0;margin-bottom:0;}`
    + `.vlsft2-arrow{display:inline-block;transition:transform .25s;}`
    + `.vlsft2-body{display:none;padding-bottom:14px;}`
    + `.vlsft2-col.open .vlsft2-body{display:block;}`
    + `.vlsft2-col.open .vlsft2-arrow{transform:rotate(180deg);}`
    + `}`;

  function col(titleVal: unknown, bodyHtml: string, titleKey: 'footerTitle' | 'footerContactTitle' = 'footerTitle') {
    const title = normalize(titleVal as string, titleKey);
    return `<div class="vlsft2-col">`
      + `<div class="vlsft2-hdr" onclick="vlsFt2Tog(this)">`
      + `<span style="${textStyle(title)}">${escapeHtml(title.text || '')}</span>`
      + `<span class="vlsft2-arrow">&#9660;</span>`
      + `</div>`
      + `<div class="vlsft2-body">${bodyHtml}</div>`
      + `</div>`;
  }

  const endpointAttr = publicFooterUrl ? ` data-vls-footer-endpoint="${escapeHtml(publicFooterUrl)}"` : '';
  let html = `<footer id="${escapeHtml(uid)}" class="vlsft2" data-vls-footer-v2="1"${endpointAttr}>`;
  html += `<style>${css}</style>`;
  html += `<div class="vlsft2-inner">`;
  html += `<div class="vlsft2-intro">`;
  html += `<a class="vlsft2-brand" href="${logoLink}">${brandInner}<span class="vlsft2-brand-text">`;
  html += `<span class="vlsft2-name">${escapeHtml(siteTitle.text || 'Vertex')}</span>`;
  html += `<span class="vlsft2-sub">${escapeHtml(subTitle.text || 'Learning Solutions')}</span>`;
  html += `</span></a>`;
  if (about.text) html += `<p class="vlsft2-about" style="${textStyle(about)}">${escapeHtml(about.text)}</p>`;
  html += `</div>`;

  const socials = (data.socials || []).filter(s => s.url);
  html += `<div class="vlsft2-social-bar">`;
  if (socials.length) {
    html += `<div class="vlsft2-social">`;
    socials.forEach(s => {
      html += `<a href="${escapeHtml(absUrl(s.url, siteBase))}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.platform)}">${SOCIAL_ICONS[s.platform] || ''}</a>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div class="vlsft2-grid">`;
  (data.sections || []).forEach(sec => {
    const body = (sec.links || []).filter(l => l.label).map(l => {
      const label = normalize(l.label, 'footerLink');
      return `<li><a href="${escapeHtml(absUrl(l.url || '#', siteBase))}" style="${textStyle(label)}">${escapeHtml(label.text)}</a></li>`;
    }).join('');
    html += col(sec.title, body ? `<ul>${body}</ul>` : '');
  });

  const contactTitle = data.contact?.title;
  const addr = normalize(data.contact?.address, 'footerLink');
  const email = normalize(data.contact?.email, 'footerLink');
  const wa = normalize(data.contact?.whatsapp, 'footerLink');
  let contactBody = '';
  if (addr.text) contactBody += `<address class="vlsft2-address" style="${textStyle(addr)}">${escapeHtml(addr.text).split('\n').join('<br>')}</address>`;
  if (email.text) contactBody += `<a href="mailto:${escapeHtml(email.text)}" style="${textStyle(email)}">${escapeHtml(email.text)}</a>`;
  if (wa.text) {
    const waNum = wa.text.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    contactBody += `<a href="https://wa.me/${waNum}" style="${textStyle(wa)}">${escapeHtml(wa.text)}</a>`;
  }
  html += col(contactTitle, contactBody, 'footerContactTitle');
  html += `</div>`;

  html += `<div class="vlsft2-bottom">`;
  const legal = (data.copyright?.links || []).filter(l => l.label);
  html += `<div class="vlsft2-legal">`;
  legal.forEach(l => {
    const label = normalize(l.label, 'footerCopyrightLink');
    html += `<a href="${escapeHtml(absUrl(l.url || '#', siteBase))}" style="${textStyle(label)}">${escapeHtml(label.text)}</a>`;
  });
  html += `</div>`;
  html += `<div class="vlsft2-rating" style="${textStyle(rating)}"><span class="vlsft2-stars" aria-label="${escapeHtml(String(data.ratingValue || 5))} out of 5 stars">${starRow(data.ratingValue || 5)}</span>${escapeHtml(rating.text)}</div>`;
  html += `</div>`;

  const year = new Date().getFullYear();
  const cp = normalize(data.copyright?.text, 'footerCopyright');
  if (cp.text) html += `<p class="vlsft2-copy" style="${textStyle(cp)}">© ${year} ${escapeHtml(cp.text.replace(/^©\s*(\d{4}\s*)?/i, ''))}</p>`;
  html += `</div>`;
  html += `<script>function vlsFt2Tog(h){if(window.innerWidth>768)return;var c=h.parentElement,o=c.classList.contains("open");document.querySelectorAll(".vlsft2-col").forEach(function(x){x.classList.remove("open");});if(!o)c.classList.add("open");}<\/script>`;
  html += `</footer>`;
  return html;
}

function footerUpdaterUrl(publicFooterUrl: string): string {
  try {
    const parsed = new URL(publicFooterUrl);
    return `${parsed.origin}/api/public/footer-v2-updater.js`;
  } catch {
    return '/api/public/footer-v2-updater.js';
  }
}

export function generateFooterV2Html(data: FooterV2Data, publicFooterUrl?: string): string {
  const uid = 'vlsft2-' + Math.random().toString(36).slice(2, 9);
  const markup = buildFooterV2Markup(data, uid, publicFooterUrl);
  const url = String(publicFooterUrl || '').trim();
  if (!url) return markup;
  return markup + `<script data-cfasync="false" src="${escapeHtml(footerUpdaterUrl(url))}" data-vls-footer-id="${escapeHtml(uid)}" data-vls-footer-endpoint="${escapeHtml(url)}"><\/script>`;
}
