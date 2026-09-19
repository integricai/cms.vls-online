(function () {
  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute('data-vls-footer-endpoint')) || '';
  var ROOT_ID = (script && script.getAttribute('data-vls-footer-id')) || '';
  var refreshed = false;
  if (!ENDPOINT) return;

  function getRoot() {
    var el = ROOT_ID ? document.getElementById(ROOT_ID) : null;
    if (el) return el;
    if (script) el = script.previousElementSibling;
    if (!el || !el.matches || !el.matches('[data-vls-footer-v2="1"]')) {
      el = document.querySelector('[data-vls-footer-v2="1"]');
    }
    return el;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function abs(url, base) {
    var u = String(url || '').trim();
    var b = String(base || '').replace(/\/$/, '');
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:|\/\/|#)/i.test(u)) return u;
    if (u.charAt(0) === '/' && b) return b + u;
    return u;
  }

  var ICONS = {
    facebook: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
    twitter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    linkedin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>',
    youtube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff"/></svg>',
    tiktok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/></svg>',
    whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>',
  };

  function textOf(v, fallback) {
    if (!v) return fallback || '';
    if (typeof v === 'string') return v;
    return v.text || fallback || '';
  }

  function stars(value) {
    var rating = Math.min(5, Math.max(0, Number(value) || 0));
    var html = '';
    for (var i = 0; i < 5; i++) {
      var fill = Math.min(1, Math.max(0, rating - i));
      html += '<span class="vlsft2-star" aria-hidden="true"><span class="vlsft2-star-empty">★</span><span class="vlsft2-star-fill" style="width:' + Math.round(fill * 100) + '%">★</span></span>';
    }
    return html;
  }

  function render(data) {
    data = data || {};
    var base = data.siteBaseUrl || 'https://vls-online.com';
    var css = '.block.footer-style.parrot.zenstyle.footer-block,.block.parrot.zenstyle.footers{display:none!important;}.vlsft2{background:#0e2a57;color:#c5d2ec;font-family:Poppins,sans-serif;padding:40px 0 36px;width:100%;}.vlsft2-inner{max-width:1200px;margin:0 auto;padding:0 40px;box-sizing:border-box;}.vlsft2-intro{margin-bottom:20px;}.vlsft2-brand{display:flex;align-items:center;gap:12px;text-decoration:none!important;margin-bottom:12px;}.vlsft2-logo,.vlsft2-mark{width:38px;height:38px;border-radius:10px;flex-shrink:0;}.vlsft2-logo{object-fit:cover;display:block;}.vlsft2-mark{background:#fff;color:#0e2a57;font-weight:700;font-size:19px;display:grid;place-items:center;}.vlsft2-brand-text{display:flex;flex-direction:column;}.vlsft2-name{color:#fff;font-weight:700;font-size:18px;line-height:1;}.vlsft2-sub{color:#8399c4;font-size:9.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;margin-top:3px;}.vlsft2-about{margin:0;line-height:1.65;color:#a4b4d6;}.vlsft2-social-bar{display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,.13);padding:0 0 8px;}.vlsft2-social{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px;transform:translateY(-50%);background:#0e2a57;padding-left:8px;}.vlsft2-social a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;color:#0e2a57;background:#fff;}.vlsft2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:48px;margin-bottom:40px;}.vlsft2-hdr{display:flex;justify-content:space-between;align-items:center;}.vlsft2-hdr span{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#93a9d6;}.vlsft2-arrow{display:none;}.vlsft2-col a,.vlsft2-address{font-size:14.5px;color:#c5d2ec!important;text-decoration:none!important;display:block;padding:1px 0;}.vlsft2-col ul{list-style:none;margin:0;padding:0;}.vlsft2-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,.13);flex-wrap:wrap;gap:14px;}.vlsft2-legal{display:flex;flex-wrap:wrap;gap:16px;}.vlsft2-legal a{font-size:13.5px;color:#a4b4d6!important;text-decoration:none!important;}.vlsft2-rating{display:flex;align-items:center;gap:9px;color:#a4b4d6;}.vlsft2-stars{display:inline-flex;gap:2px;}.vlsft2-star{position:relative;display:inline-block;width:14px;height:14px;font-size:14px;line-height:1;}.vlsft2-star-empty{color:rgba(255,255,255,.25);}.vlsft2-star-fill{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f5a623;}.vlsft2-copy{font-size:13.5px;color:#a4b4d6;margin:10px 0 0;}@media(max-width:980px){.vlsft2-grid{grid-template-columns:1fr 1fr;}.vlsft2-inner{padding:0 24px;}}@media(max-width:768px){.vlsft2-grid{display:block;}.vlsft2-col{border-bottom:1px solid rgba(255,255,255,.12);}.vlsft2-hdr{cursor:pointer;padding:14px 0;}.vlsft2-arrow{display:inline-block;}.vlsft2-body{display:none;padding-bottom:14px;}.vlsft2-col.open .vlsft2-body{display:block;}.vlsft2-col.open .vlsft2-arrow{transform:rotate(180deg);}}';
    var brandInner = data.logoUrl
      ? '<img src="' + esc(data.logoUrl) + '" alt="' + esc(data.logoAlt || 'Vertex Learning Solutions') + '" class="vlsft2-logo">'
      : '<span class="vlsft2-mark" aria-hidden="true">V</span>';
    var h = '<footer id="' + esc(ROOT_ID) + '" class="vlsft2" data-vls-footer-v2="1" data-vls-footer-endpoint="' + esc(ENDPOINT) + '"><style>' + css + '</style><div class="vlsft2-inner">';
    h += '<div class="vlsft2-intro"><a class="vlsft2-brand" href="' + esc(abs(data.logoLink || '/', base)) + '">' + brandInner + '<span class="vlsft2-brand-text"><span class="vlsft2-name">' + esc(textOf(data.siteTitle, 'Vertex')) + '</span><span class="vlsft2-sub">' + esc(textOf(data.subTitle, 'Learning Solutions')) + '</span></span></a>';
    var about = textOf(data.aboutText);
    if (about) h += '<p class="vlsft2-about">' + esc(about) + '</p>';
    h += '</div><div class="vlsft2-social-bar">';
    var socials = (data.socials || []).filter(function (s) { return s.url; });
    if (socials.length) {
      h += '<div class="vlsft2-social">';
      socials.forEach(function (s) {
        h += '<a href="' + esc(abs(s.url, base)) + '" target="_blank" rel="noopener" aria-label="' + esc(s.platform) + '">' + (ICONS[s.platform] || '') + '</a>';
      });
      h += '</div>';
    }
    h += '</div><div class="vlsft2-grid">';
    (data.sections || []).forEach(function (sec) {
      var body = (sec.links || []).filter(function (l) { return l.label; }).map(function (l) {
        return '<li><a href="' + esc(abs(l.url || '#', base)) + '">' + esc(textOf(l.label)) + '</a></li>';
      }).join('');
      h += '<div class="vlsft2-col"><div class="vlsft2-hdr" onclick="vlsFt2Tog(this)"><span>' + esc(textOf(sec.title)) + '</span><span class="vlsft2-arrow">&#9660;</span></div><div class="vlsft2-body">' + (body ? '<ul>' + body + '</ul>' : '') + '</div></div>';
    });
    var contact = data.contact || {};
    var cbody = '';
    var addr = textOf(contact.address);
    if (addr) cbody += '<address class="vlsft2-address">' + esc(addr).replace(/\n/g, '<br>') + '</address>';
    var email = textOf(contact.email);
    if (email) cbody += '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>';
    var wa = textOf(contact.whatsapp);
    if (wa) {
      var waNum = wa.replace(/[\s\-()]/g, '').replace(/^\+/, '');
      cbody += '<a href="https://wa.me/' + esc(waNum) + '">' + esc(wa) + '</a>';
    }
    h += '<div class="vlsft2-col"><div class="vlsft2-hdr" onclick="vlsFt2Tog(this)"><span>' + esc(textOf(contact.title, 'Contact Us')) + '</span><span class="vlsft2-arrow">&#9660;</span></div><div class="vlsft2-body">' + cbody + '</div></div></div>';
    h += '<div class="vlsft2-bottom"><div class="vlsft2-legal">';
    ((data.copyright && data.copyright.links) || []).filter(function (l) { return l.label; }).forEach(function (l) {
      h += '<a href="' + esc(abs(l.url || '#', base)) + '">' + esc(textOf(l.label)) + '</a>';
    });
    h += '</div><div class="vlsft2-rating"><span class="vlsft2-stars">' + stars(data.ratingValue || 5) + '</span>' + esc(textOf(data.ratingText)) + '</div></div>';
    var cp = textOf(data.copyright && data.copyright.text);
    if (cp) h += '<p class="vlsft2-copy">© ' + new Date().getFullYear() + ' ' + esc(cp.replace(/^©\s*(\d{4}\s*)?/i, '')) + '</p>';
    return h + '</div></footer>';
  }

  window.vlsFt2Tog = window.vlsFt2Tog || function (hdr) {
    if (window.innerWidth > 768) return;
    var col = hdr.parentElement;
    var open = col.classList.contains('open');
    document.querySelectorAll('.vlsft2-col').forEach(function (x) { x.classList.remove('open'); });
    if (!open) col.classList.add('open');
  };

  function refresh() {
    if (refreshed) return;
    refreshed = true;
    var root = getRoot();
    if (!root) return;
    fetch(ENDPOINT, { cache: 'default', mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (payload) {
        var data = payload && (payload.footer || payload);
        if (data && (data.sections || data.aboutText)) root.outerHTML = render(data);
      })
      .catch(function (error) {
        if (window.console && console.warn) console.warn('VLS footer V2 update failed:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
})();
