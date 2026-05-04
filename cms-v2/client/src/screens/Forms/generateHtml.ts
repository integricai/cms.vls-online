import { escapeHtml, normalize, textStyle } from '../../utils/text';

type AnyConfig = Record<string, any>;

const API_BASE = 'https://api.cms.vls-online.com';
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function attr(value: string) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function safeHex(value: string | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value! : fallback;
}

function clampNumber(value: any, fallback: number, min: number, max: number) {
  const next = parseInt(String(value), 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

export function generateContactFormHtml(config: AnyConfig) {
  const uid = `vlsf${Math.random().toString(36).slice(2, 7)}`;
  const title = normalize(config.formTitle, 'formTitle');
  const submit = normalize(config.submitText, 'formButton');
  const thankTitle = normalize(config.thankTitle, 'formThankTitle');
  const thankDesc = normalize(config.thankDesc, 'formThank');
  const enquiryOptions = config.enquiryOptions || [];
  const recipients: string[] = Array.isArray(config.recipients) ? config.recipients : [];
  const messageRows = clampNumber(config.messageRows, 4, 2, 20);
  const messageMinHeight = clampNumber(config.messageMinHeight, 120, 80, 600);

  const optionHtml = enquiryOptions
    .filter((option: any) => String(option.label || '').trim())
    .map((option: any) => `<option value="${attr(option.label)}">${escapeHtml(option.label)}</option>`)
    .join('\n');

  const submitLabel = escapeHtml(submit.text) || 'Submit';

  return `<style>
.${uid}{font-family:Poppins,sans-serif;max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 8px 30px rgba(15,23,42,.08);}
.${uid} *{box-sizing:border-box;}
.${uid} label{display:block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;}
.${uid} input,.${uid} select,.${uid} textarea{width:100%;border:1px solid #d8dee8;border-radius:8px;padding:10px 12px;font-family:Poppins,sans-serif;font-size:14px;color:#172033;outline:none;}
.${uid} textarea{resize:vertical;}
.${uid} input:focus,.${uid} select:focus,.${uid} textarea:focus{border-color:#204280;box-shadow:0 0 0 3px rgba(32,66,128,.14);}
.${uid}-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.${uid}-field{margin-bottom:14px;}
.${uid}-btn{width:100%;border:0;border-radius:8px;background:#204280;padding:12px 18px;cursor:pointer;font-family:Poppins,sans-serif;${textStyle(submit)}}
.${uid}-btn:disabled{opacity:.6;cursor:not-allowed;}
.${uid}-err{display:none;margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#b91c1c;font-family:Poppins,sans-serif;}
.${uid}-thanks{display:none;text-align:center;padding:24px 10px;}
@media(max-width:640px){.${uid}-grid{grid-template-columns:1fr;}}
</style>
<div class="${uid}">
  <div id="${uid}-form">
    <h2 style="font-family:Poppins,sans-serif;margin:0 0 18px;${textStyle(title)}">${escapeHtml(title.text)}</h2>
    <div class="${uid}-grid">
      <div class="${uid}-field"><label>First name *</label><input id="${uid}-fn" placeholder="First name" required></div>
      <div class="${uid}-field"><label>Last name</label><input id="${uid}-ln" placeholder="Last name"></div>
    </div>
    <div class="${uid}-field"><label>Email *</label><input id="${uid}-em" type="email" placeholder="Email address" required></div>
    <div class="${uid}-grid">
      <div class="${uid}-field"><label>Country code</label><input id="${uid}-pc" placeholder="+44" style="max-width:100px;"></div>
      <div class="${uid}-field"><label>Phone</label><input id="${uid}-ph" placeholder="Phone number"></div>
    </div>
    <div class="${uid}-field"><label>Enquiry</label><select id="${uid}-eq"><option value="">Select...</option>${optionHtml}</select></div>
    <div class="${uid}-field"><label>Message</label><textarea id="${uid}-cm" rows="${messageRows}" style="min-height:${messageMinHeight}px;" placeholder="Your message…"></textarea></div>
    <div class="${uid}-field"><div id="${uid}-ts"></div></div>
    <button class="${uid}-btn" id="${uid}-btn" type="button" onclick="${uid}sub()">${submitLabel}</button>
    <div class="${uid}-err" id="${uid}-err"></div>
  </div>
  <div class="${uid}-thanks" id="${uid}-thanks">
    <h3 style="font-family:Poppins,sans-serif;margin:0 0 8px;${textStyle(thankTitle)}">${escapeHtml(thankTitle.text)}</h3>
    <p style="font-family:Poppins,sans-serif;margin:0;line-height:1.6;${textStyle(thankDesc)}">${thankDesc.text}</p>
  </div>
</div>
<script data-cfasync="false">
(function(){
  var RCP=${JSON.stringify(recipients)};
  var tsToken='';
  var tsWidget=null;
  function showErr(msg){var err=document.getElementById('${uid}-err');err.textContent=msg;err.style.display='block';}
  function resetTurnstile(){tsToken='';if(window.turnstile&&tsWidget!==null){window.turnstile.reset(tsWidget);}}
  function loadTurnstile(){
    fetch('${API_BASE}/api/turnstile-site-key').then(function(r){return r.json();}).then(function(data){
      if(!data.ok||!data.siteKey){throw new Error('Missing Turnstile site key');}
      function render(){
        tsWidget=window.turnstile.render('#${uid}-ts',{
          sitekey:data.siteKey,
          callback:function(token){tsToken=token;},
          'expired-callback':function(){tsToken='';},
          'error-callback':function(){tsToken='';showErr('Verification failed to load. Please refresh and try again.');}
        });
      }
      if(window.turnstile){render();return;}
      var s=document.createElement('script');
      s.src='${TURNSTILE_SCRIPT}';
      s.async=true;
      s.defer=true;
      s.onload=render;
      document.head.appendChild(s);
    }).catch(function(){showErr('Verification could not load. Please refresh and try again.');});
  }
  loadTurnstile();
  window['${uid}sub']=async function(){
    var fn=document.getElementById('${uid}-fn').value.trim();
    var ln=document.getElementById('${uid}-ln').value.trim();
    var em=document.getElementById('${uid}-em').value.trim();
    var pc=document.getElementById('${uid}-pc').value.trim();
    var ph=document.getElementById('${uid}-ph').value.trim();
    var eq=document.getElementById('${uid}-eq').value;
    var cm=document.getElementById('${uid}-cm').value.trim();
    var btn=document.getElementById('${uid}-btn');
    var err=document.getElementById('${uid}-err');
    err.style.display='none';
    if(!fn){err.textContent='Please enter your first name.';err.style.display='block';return;}
    if(!em||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)){err.textContent='Please enter a valid email address.';err.style.display='block';return;}
    if(!tsToken){err.textContent='Please complete the verification.';err.style.display='block';return;}
    var orig=btn.textContent;
    btn.disabled=true;btn.textContent='Sending…';
    try{
      var r=await fetch('${API_BASE}/api/submit-form',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({firstName:fn,lastName:ln,email:em,phoneCode:pc,phoneNumber:ph,enquiry:eq,comments:cm,recipients:RCP,turnstileToken:tsToken})});
      var data=await r.json();
      if(r.ok&&data.ok){
        document.getElementById('${uid}-form').style.display='none';
        document.getElementById('${uid}-thanks').style.display='block';
      } else {
        err.textContent=data.error||'Something went wrong. Please try again.';
        err.style.display='block';
        resetTurnstile();
        btn.disabled=false;btn.textContent=orig;
      }
    }catch(e){
      err.textContent='Unable to send. Please check your connection and try again.';
      err.style.display='block';
      resetTurnstile();
      btn.disabled=false;btn.textContent=orig;
    }
  };
})();
</script>`;
}

export function generateReportIssueHtml(config: AnyConfig) {
  const uid = `vlsri${Math.random().toString(36).slice(2, 7)}`;
  const accent = safeHex(config.accent, '#204280');
  const quals = config.qualifications || [];
  const issueTypes = config.issueTypes || [];
  const steps = config.steps || [];
  const cards = config.cards || [];
  const contacts = config.contactItems || [];
  const recipients: string[] = Array.isArray(config.recipients) ? config.recipients : [];
  const tyUrl = config.tyUrl || '';

  return `<style>
.${uid}{font-family:Poppins,sans-serif;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;}
.${uid} *{box-sizing:border-box;}
.${uid}-hero{background:${safeHex(config.heroBg, '#0d1f3c')};padding:36px 32px;}
.${uid}-wrap{display:flex;align-items:stretch;}
.${uid}-side{width:${parseInt(config.sidebarW, 10) || 300}px;background:${safeHex(config.sidebarBg, '#f8fafc')};padding:26px;}
.${uid}-main{flex:1;padding:26px;}
.${uid} label{display:block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;}
.${uid} input,.${uid} select,.${uid} textarea{width:100%;border:1px solid #d8dee8;border-radius:8px;padding:10px 12px;font-family:Poppins,sans-serif;font-size:14px;outline:none;}
.${uid} input:focus,.${uid} select:focus,.${uid} textarea:focus{border-color:${accent};box-shadow:0 0 0 3px rgba(32,66,128,.14);}
.${uid}-field{margin-bottom:14px;}
.${uid}-btn{width:100%;border:0;border-radius:8px;background:${accent};color:#fff;padding:12px 18px;font-family:Poppins,sans-serif;font-size:14px;font-weight:700;cursor:pointer;}
.${uid}-btn:disabled{opacity:.6;cursor:not-allowed;}
.${uid}-err{display:none;margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#b91c1c;font-family:Poppins,sans-serif;}
.${uid}-ok{display:none;padding:32px 24px;text-align:center;}
@media(max-width:800px){.${uid}-wrap{flex-direction:column;}.${uid}-side{width:100%;}}
</style>
<section class="${uid}">
  <div class="${uid}-hero">
    <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${safeHex(config.eyebrowTc, '#72cdf4')};margin-bottom:10px;">${escapeHtml(config.heroEyebrow || '')}</div>
    <h2 style="font-size:30px;line-height:1.2;margin:0 0 10px;color:${safeHex(config.titleTc, '#ffffff')};">${escapeHtml(config.heroTitle || 'Report an Issue')}</h2>
    <p style="font-size:15px;line-height:1.7;margin:0;color:${safeHex(config.descTc, '#94a3b8')};">${escapeHtml(config.heroDesc || '')}</p>
  </div>
  <div class="${uid}-wrap">
    <aside class="${uid}-side">
      <div style="font-size:11px;font-weight:700;color:${accent};letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(config.hiwEyebrow || '')}</div>
      <h3 style="font-size:20px;margin:0 0 10px;color:#172033;">${escapeHtml(config.hiwHeading || '')}</h3>
      <p style="font-size:14px;line-height:1.65;color:#64748b;margin:0 0 18px;">${escapeHtml(config.hiwDesc || '')}</p>
      ${steps.map((step: any, i: number) => `<div style="display:flex;gap:10px;margin-bottom:14px;"><span style="width:26px;height:26px;border-radius:50%;background:${accent};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${i + 1}</span><div><strong style="font-size:13px;color:#172033;">${escapeHtml(step.title || '')}</strong><p style="font-size:12px;color:#64748b;line-height:1.5;margin:3px 0 0;">${escapeHtml(step.desc || '')}</p></div></div>`).join('')}
      ${cards.map((card: any) => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:10px;"><div style="font-size:18px;">${escapeHtml(card.icon || '')}</div><strong style="font-size:13px;color:#172033;">${escapeHtml(card.title || '')}</strong><p style="font-size:12px;color:#64748b;line-height:1.5;margin:4px 0 0;">${escapeHtml(card.desc || '')}</p></div>`).join('')}
      <div style="background:${safeHex(config.contactBg, '#0d1f3c')};border-radius:10px;padding:16px;margin-top:18px;color:#fff;"><strong>${escapeHtml(config.contactTitle || '')}</strong>${contacts.map((item: string) => `<p style="margin:8px 0 0;font-size:13px;">${escapeHtml(item)}</p>`).join('')}</div>
    </aside>
    <div class="${uid}-main">
      <div id="${uid}-form">
        <div class="${uid}-field"><label>First name *</label><input id="${uid}-fn" placeholder="First name" required></div>
        <div class="${uid}-field"><label>Last name</label><input id="${uid}-ln" placeholder="Last name"></div>
        <div class="${uid}-field"><label>Email *</label><input id="${uid}-em" type="email" placeholder="Email address" required></div>
        <div class="${uid}-field"><label>Phone</label><input id="${uid}-ph" placeholder="Phone number"></div>
        <div class="${uid}-field"><label>Qualification</label><select id="${uid}-ql">${quals.map((q: string) => `<option>${escapeHtml(q)}</option>`).join('')}</select></div>
        <div class="${uid}-field"><label>Issue type</label><select id="${uid}-it">${issueTypes.map((issue: string) => `<option>${escapeHtml(issue)}</option>`).join('')}</select></div>
        <div class="${uid}-field"><label>Course / paper</label><input id="${uid}-cn" placeholder="e.g. PM, FA1"></div>
        <div class="${uid}-field"><label>Describe the issue *</label><textarea id="${uid}-msg" rows="6" placeholder="Please describe the issue in detail…" required></textarea></div>
        <div class="${uid}-field"><div id="${uid}-ts"></div></div>
        <button class="${uid}-btn" id="${uid}-btn" type="button" onclick="${uid}submit()">${escapeHtml(config.btnText || 'Submit Report')}</button>
        <div class="${uid}-err" id="${uid}-err"></div>
      </div>
      <div class="${uid}-ok" id="${uid}-ok">
        <div style="font-size:40px;margin-bottom:12px;">✓</div>
        <h3 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:700;color:#172033;margin:0 0 8px;">Report submitted</h3>
        <p style="font-family:Poppins,sans-serif;font-size:14px;color:#64748b;margin:0;line-height:1.6;">Thank you. We have received your report and will be in touch shortly.</p>
      </div>
    </div>
  </div>
</section>
<script data-cfasync="false">
(function(){
  var RCP=${JSON.stringify(recipients)};
  var TY_URL=${JSON.stringify(tyUrl)};
  var tsToken='';
  var tsWidget=null;
  function showErr(msg){var err=document.getElementById('${uid}-err');err.textContent=msg;err.style.display='block';}
  function resetTurnstile(){tsToken='';if(window.turnstile&&tsWidget!==null){window.turnstile.reset(tsWidget);}}
  function loadTurnstile(){
    fetch('${API_BASE}/api/turnstile-site-key').then(function(r){return r.json();}).then(function(data){
      if(!data.ok||!data.siteKey){throw new Error('Missing Turnstile site key');}
      function render(){
        tsWidget=window.turnstile.render('#${uid}-ts',{
          sitekey:data.siteKey,
          callback:function(token){tsToken=token;},
          'expired-callback':function(){tsToken='';},
          'error-callback':function(){tsToken='';showErr('Verification failed to load. Please refresh and try again.');}
        });
      }
      if(window.turnstile){render();return;}
      var s=document.createElement('script');
      s.src='${TURNSTILE_SCRIPT}';
      s.async=true;
      s.defer=true;
      s.onload=render;
      document.head.appendChild(s);
    }).catch(function(){showErr('Verification could not load. Please refresh and try again.');});
  }
  loadTurnstile();
  window['${uid}submit']=async function(){
    var fn=document.getElementById('${uid}-fn').value.trim();
    var ln=document.getElementById('${uid}-ln').value.trim();
    var em=document.getElementById('${uid}-em').value.trim();
    var ph=document.getElementById('${uid}-ph').value.trim();
    var ql=document.getElementById('${uid}-ql').value;
    var it=document.getElementById('${uid}-it').value;
    var cn=document.getElementById('${uid}-cn').value.trim();
    var msg=document.getElementById('${uid}-msg').value.trim();
    var btn=document.getElementById('${uid}-btn');
    var err=document.getElementById('${uid}-err');
    err.style.display='none';
    if(!fn){err.textContent='Please enter your first name.';err.style.display='block';return;}
    if(!em||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)){err.textContent='Please enter a valid email address.';err.style.display='block';return;}
    if(!msg){err.textContent='Please describe the issue.';err.style.display='block';return;}
    if(!tsToken){err.textContent='Please complete the verification.';err.style.display='block';return;}
    var now=new Date();var pad=function(n){return String(n).padStart(2,'0');};
    var ref='VLS-'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+pad(now.getHours())+pad(now.getMinutes());
    var orig=btn.textContent;
    btn.disabled=true;btn.textContent='Sending…';
    try{
      var r=await fetch('${API_BASE}/api/submit-report',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({firstName:fn,lastName:ln,email:em,phone:ph,qualification:ql,issueType:it,courseName:cn,message:msg,recipients:RCP,refNumber:ref,turnstileToken:tsToken})});
      var data=await r.json();
      if(r.ok&&data.ok){
        if(TY_URL){window.location.href=TY_URL+'?ref='+encodeURIComponent(ref);}
        else{document.getElementById('${uid}-form').style.display='none';document.getElementById('${uid}-ok').style.display='block';}
      } else {
        err.textContent=data.error||'Something went wrong. Please try again.';
        err.style.display='block';
        resetTurnstile();
        btn.disabled=false;btn.textContent=orig;
      }
    }catch(e){
      err.textContent='Unable to send. Please check your connection and try again.';
      err.style.display='block';
      resetTurnstile();
      btn.disabled=false;btn.textContent=orig;
    }
  };
})();
</script>`;
}

export function generateContactPageHtml(config: AnyConfig) {
  const uid = `vlscp${Math.random().toString(36).slice(2, 7)}`;

  const formLabel       = String(config.formLabel       || 'SEND US A MESSAGE').trim();
  const formSubheader   = String(config.formSubheader   || "We'll respond within 1 working day").trim();
  const submitText      = String(config.submitText      || 'Send Message →').trim();
  const thankTitle      = String(config.thankTitle      || 'Message sent!').trim();
  const thankDesc       = String(config.thankDesc       || "Thank you for reaching out. We'll be in touch within 1 working day.").trim();
  const privacyUrl      = String(config.privacyUrl      || '/privacy').trim();
  const recipients: string[] = Array.isArray(config.recipients) ? config.recipients : [];
  const enquiryOptions  = (config.enquiryOptions  || []) as any[];
  const qualOptions     = (config.qualificationOptions || []) as string[];
  const howHeardOptions = (config.howHeardOptions  || []) as string[];
  const messageRows = clampNumber(config.messageRows, 5, 2, 20);
  const messageMinHeight = clampNumber(config.messageMinHeight, 140, 80, 700);

  const companyName       = String(config.companyName       || '').trim();
  const contactInfoLabel  = String(config.contactInfoLabel  || 'CONTACT INFORMATION').trim();
  const contactItems      = (config.contactItems  || []) as any[];
  const supportHoursLabel = String(config.supportHoursLabel || 'SUPPORT HOURS').trim();
  const supportHours      = (config.supportHours  || []) as any[];
  const responseNote      = String(config.responseNote      || '').trim();
  const followLabel       = String(config.followLabel       || 'FOLLOW VLS').trim();
  const socialLinks       = (config.socialLinks   || []) as any[];
  const faqTitle          = String(config.faqTitle          || '').trim();
  const faqDesc           = String(config.faqDesc           || '').trim();
  const faqBtnText        = String(config.faqBtnText        || 'View FAQs →').trim();
  const faqBtnUrl         = String(config.faqBtnUrl         || '').trim();

  const enquiryOptHtml = enquiryOptions
    .filter((o: any) => String(o.label || '').trim())
    .map((o: any) => `<option value="${attr(o.label)}">${escapeHtml(o.label)}</option>`)
    .join('');
  const howHeardOptHtml = howHeardOptions
    .filter((s: string) => String(s || '').trim())
    .map((s: string) => `<option value="${attr(s)}">${escapeHtml(s)}</option>`)
    .join('');
  const qualButtonsHtml = qualOptions
    .filter((q: string) => String(q || '').trim())
    .map((q: string) => `<button type="button" class="${uid}-qual" data-val="${attr(q)}" onclick="${uid}TQ(this)">${escapeHtml(q)}</button>`)
    .join('');

  const contactItemsHtml = contactItems.map((ci: any) => {
    const valHtml = ci.url
      ? `<a href="${attr(ci.url)}" class="${uid}-civ" style="color:#204280;text-decoration:none;">${escapeHtml(ci.value || '')}</a>`
      : `<span class="${uid}-civ">${escapeHtml(ci.value || '')}</span>`;
    return `<div class="${uid}-ci"><div class="${uid}-cic">${escapeHtml(ci.icon || '\u{1F4E7}')}</div><div><div class="${uid}-cil">${escapeHtml(ci.label || '')}</div>${valHtml}${ci.subtext ? `<div class="${uid}-cis">${escapeHtml(ci.subtext)}</div>` : ''}</div></div>`;
  }).join('');

  const hoursHtml = supportHours.map((h: any) => {
    const closed = /^closed$/i.test(String(h.hours || '').trim());
    return `<div class="${uid}-shr"><span>${escapeHtml(h.day || '')}</span><span style="${closed ? 'color:#ef4444;font-weight:600' : 'font-weight:600'}">${escapeHtml(h.hours || '')}</span></div>`;
  }).join('');

  const socialHtml = socialLinks.map((s: any) =>
    `<a href="${attr(s.url || '#')}" class="${uid}-sl" target="_blank" rel="noopener"><div class="${uid}-sic">${escapeHtml(s.icon || '\u{1F517}')}</div><div><div class="${uid}-sp">${escapeHtml(s.platform || '')}</div><div class="${uid}-sha">${escapeHtml(s.handle || '')}</div></div></a>`
  ).join('');

  const hasRight = companyName || contactItems.length || supportHours.length || socialLinks.length || faqTitle;

  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;}
#${uid}{font-family:'Poppins',sans-serif;padding:40px 24px;max-width:1140px;margin:0 auto;}
#${uid}-lay{display:grid;grid-template-columns:${hasRight ? '1fr 380px' : '1fr'};gap:28px;align-items:start;}
#${uid}-fw{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;}
#${uid}-fhdr{background:#0d1f3c;padding:18px 24px;display:flex;align-items:center;gap:14px;}
#${uid}-fhi{width:42px;height:42px;border-radius:8px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
#${uid}-fhl{font-size:11px;font-weight:700;color:rgba(255,255,255,.55);letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px;}
#${uid}-fhs{font-size:16px;font-weight:700;color:#fff;}
#${uid}-fb{padding:24px;}
.${uid}-sec{font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;}
.${uid}-sec+.${uid}-sec{margin-top:20px;}
.${uid}-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.${uid}-f{margin-bottom:14px;}
.${uid}-f label{display:block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;}
.${uid}-f input,.${uid}-f select,.${uid}-f textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 13px;font-family:'Poppins',sans-serif;font-size:14px;color:#0f172a;outline:none;transition:border-color .15s;}
.${uid}-f textarea{resize:vertical;}
.${uid}-f input:focus,.${uid}-f select:focus,.${uid}-f textarea:focus{border-color:#204280;box-shadow:0 0 0 3px rgba(32,66,128,.1);}
.${uid}-qlw{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.${uid}-qual{border:1.5px solid #e2e8f0;border-radius:999px;padding:7px 16px;font-family:'Poppins',sans-serif;font-size:13px;font-weight:500;color:#374151;background:#fff;cursor:pointer;transition:all .15s;}
.${uid}-qual.on{background:#204280;border-color:#204280;color:#fff;font-weight:600;}
.${uid}-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px;}
.${uid}-prv{font-size:12px;color:#94a3b8;}.${uid}-prv a{color:#204280;text-decoration:none;}
.${uid}-btn{border:0;border-radius:8px;background:#0d1f3c;color:#fff;padding:12px 28px;font-family:'Poppins',sans-serif;font-size:15px;font-weight:700;cursor:pointer;}
.${uid}-btn:disabled{opacity:.6;cursor:not-allowed;}
.${uid}-err{display:none;margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#b91c1c;}
#${uid}-ty{display:none;padding:48px 24px;text-align:center;background:#fff;border:1px solid #e5e7eb;border-radius:14px;}
#${uid}-tyi{width:64px;height:64px;border-radius:50%;background:#204280;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;margin:0 auto 20px;}
#${uid}-tyh{font-size:22px;font-weight:700;color:#0d1f3c;margin:0 0 10px;}
#${uid}-tyd{font-size:15px;color:#64748b;line-height:1.7;margin:0;}
#${uid}-right{display:flex;flex-direction:column;gap:16px;}
.${uid}-rc{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;}
.${uid}-rch{background:#0d1f3c;padding:14px 20px;}
.${uid}-rchl{font-size:11px;font-weight:700;color:#72cdf4;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;}
.${uid}-rcht{font-size:16px;font-weight:700;color:#fff;}
.${uid}-rcb{padding:18px 20px;}
.${uid}-ci{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;}.${uid}-ci:last-child{margin-bottom:0;}
.${uid}-cic{width:36px;height:36px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.${uid}-cil{font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px;}
.${uid}-civ{font-size:14px;font-weight:600;color:#374151;display:block;}
.${uid}-cis{font-size:12px;color:#64748b;margin-top:2px;}
.${uid}-shr{display:flex;justify-content:space-between;font-size:14px;color:#374151;padding:8px 0;border-bottom:1px solid #f1f5f9;}.${uid}-shr:last-child{border-bottom:0;}
.${uid}-rn{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;display:flex;gap:8px;margin-top:10px;}
.${uid}-rni{font-size:14px;color:#16a34a;flex-shrink:0;}.${uid}-rnt{font-size:12px;color:#166534;line-height:1.5;}
.${uid}-slg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.${uid}-sl{display:flex;align-items:center;gap:10px;background:#1e293b;border-radius:10px;padding:10px 14px;text-decoration:none;}
.${uid}-sic{width:30px;height:30px;border-radius:6px;background:#334155;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.${uid}-sp{font-size:13px;font-weight:600;color:#fff;}.${uid}-sha{font-size:11px;color:#94a3b8;}
.${uid}-faq{display:flex;align-items:center;gap:14px;background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:16px 20px;}
.${uid}-faqi{width:36px;height:36px;border-radius:50%;background:#e0e7ff;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.${uid}-faqt{font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px;}.${uid}-faqd{font-size:12px;color:#64748b;}
.${uid}-faqb{flex-shrink:0;border:1.5px solid #204280;border-radius:8px;padding:8px 14px;font-family:'Poppins',sans-serif;font-size:13px;font-weight:700;color:#204280;background:#fff;text-decoration:none;white-space:nowrap;}
@media(max-width:900px){#${uid}-lay{grid-template-columns:1fr;}}
@media(max-width:600px){.${uid}-g2{grid-template-columns:1fr;}.${uid}-foot{flex-direction:column;align-items:stretch;}.${uid}-btn{width:100%;text-align:center;}}
</style>

<section id="${uid}">
  <div id="${uid}-lay">
    <div id="${uid}-left">
      <div id="${uid}-fw">
        <div id="${uid}-fhdr">
          <div id="${uid}-fhi">✉</div>
          <div>
            <div id="${uid}-fhl">${escapeHtml(formLabel)}</div>
            <div id="${uid}-fhs">${escapeHtml(formSubheader)}</div>
          </div>
        </div>
        <div id="${uid}-fb">
          <p class="${uid}-sec">Your Details</p>
          <div class="${uid}-g2">
            <div class="${uid}-f"><label>First Name *</label><input id="${uid}-fn" placeholder="e.g. Sarah" required></div>
            <div class="${uid}-f"><label>Last Name *</label><input id="${uid}-ln" placeholder="e.g. Mitchell" required></div>
          </div>
          <div class="${uid}-g2">
            <div class="${uid}-f"><label>Email Address *</label><input id="${uid}-em" type="email" placeholder="sarah@email.com" required></div>
            <div class="${uid}-f"><label>Phone / WhatsApp</label><input id="${uid}-ph" placeholder="+44 7700 000000"></div>
          </div>
          <p class="${uid}-sec">Your Enquiry</p>
          ${enquiryOptHtml ? `<div class="${uid}-f"><label>What are you enquiring about? *</label><select id="${uid}-eq"><option value="">Select a topic...</option>${enquiryOptHtml}</select></div>` : ''}
          ${qualButtonsHtml ? `<div class="${uid}-f"><label>Which qualification are you interested in?</label><div class="${uid}-qlw" id="${uid}-qlw">${qualButtonsHtml}</div><input type="hidden" id="${uid}-qv" value=""></div>` : ''}
          <div class="${uid}-f"><label>Your Message *</label><textarea id="${uid}-msg" rows="${messageRows}" style="min-height:${messageMinHeight}px;" placeholder="Tell us what you'd like to know — the more detail you share, the better we can help." required></textarea></div>
          ${howHeardOptHtml ? `<div class="${uid}-f"><label>How did you hear about VLS?</label><select id="${uid}-hh"><option value="">Select an option...</option>${howHeardOptHtml}</select></div>` : ''}
          <div class="${uid}-f"><div id="${uid}-ts"></div></div>
          <div class="${uid}-foot">
            <span class="${uid}-prv">🔒 Your data is handled securely — <a href="${attr(privacyUrl)}">Privacy Policy</a></span>
            <button class="${uid}-btn" id="${uid}-btn" type="button" onclick="${uid}Sub()">${escapeHtml(submitText)}</button>
          </div>
          <div class="${uid}-err" id="${uid}-err"></div>
        </div>
      </div>
      <div id="${uid}-ty">
        <div id="${uid}-tyi">✓</div>
        <h3 id="${uid}-tyh">${escapeHtml(thankTitle)}</h3>
        <p id="${uid}-tyd">${escapeHtml(thankDesc)}</p>
      </div>
    </div>
    ${hasRight ? `<div id="${uid}-right">
      ${(companyName || contactItems.length) ? `<div class="${uid}-rc"><div class="${uid}-rch"><div class="${uid}-rchl">${escapeHtml(contactInfoLabel)}</div><div class="${uid}-rcht">${escapeHtml(companyName)}</div></div><div class="${uid}-rcb">${contactItemsHtml}</div></div>` : ''}
      ${supportHours.length ? `<div class="${uid}-rc"><div class="${uid}-rcb"><p style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px;">${escapeHtml(supportHoursLabel)}</p>${hoursHtml}${responseNote ? `<div class="${uid}-rn"><span class="${uid}-rni">⚡</span><span class="${uid}-rnt">${escapeHtml(responseNote)}</span></div>` : ''}</div></div>` : ''}
      ${socialLinks.length ? `<div class="${uid}-rc"><div class="${uid}-rcb"><p style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px;">${escapeHtml(followLabel)}</p><div class="${uid}-slg">${socialHtml}</div></div></div>` : ''}
      ${faqTitle ? `<div class="${uid}-faq"><div class="${uid}-faqi">❓</div><div style="flex:1;"><div class="${uid}-faqt">${escapeHtml(faqTitle)}</div>${faqDesc ? `<div class="${uid}-faqd">${escapeHtml(faqDesc)}</div>` : ''}</div>${faqBtnText ? `<a href="${attr(faqBtnUrl || '#')}" class="${uid}-faqb">${escapeHtml(faqBtnText)}</a>` : ''}</div>` : ''}
    </div>` : ''}
  </div>
</section>
<script data-cfasync="false">
(function(){
  var RCP=${JSON.stringify(recipients)};
  var tsToken='';var tsWidget=null;
  function showErr(msg){var e=document.getElementById('${uid}-err');e.textContent=msg;e.style.display='block';}
  function resetTs(){tsToken='';if(window.turnstile&&tsWidget!==null)window.turnstile.reset(tsWidget);}
  function loadTs(){
    fetch('${API_BASE}/api/turnstile-site-key').then(function(r){return r.json();}).then(function(d){
      if(!d.ok||!d.siteKey)throw new Error('no key');
      function render(){tsWidget=window.turnstile.render('#${uid}-ts',{sitekey:d.siteKey,callback:function(t){tsToken=t;},'expired-callback':function(){tsToken='';},'error-callback':function(){tsToken='';showErr('Verification failed. Please refresh.');}});}
      if(window.turnstile){render();return;}
      var s=document.createElement('script');s.src='${TURNSTILE_SCRIPT}';s.async=true;s.defer=true;s.onload=render;document.head.appendChild(s);
    }).catch(function(){showErr('Verification could not load. Please refresh.');});
  }
  loadTs();
  window['${uid}TQ']=function(el){
    document.querySelectorAll('.${uid}-qual').forEach(function(b){b.classList.remove('on');});
    el.classList.add('on');
    var v=document.getElementById('${uid}-qv');if(v)v.value=el.getAttribute('data-val');
  };
  window['${uid}Sub']=async function(){
    var fn=document.getElementById('${uid}-fn').value.trim();
    var ln=document.getElementById('${uid}-ln').value.trim();
    var em=document.getElementById('${uid}-em').value.trim();
    var ph=document.getElementById('${uid}-ph').value.trim();
    var eqEl=document.getElementById('${uid}-eq');var eq=eqEl?eqEl.value:'';
    var qvEl=document.getElementById('${uid}-qv');var ql=qvEl?qvEl.value:'';
    var msg=document.getElementById('${uid}-msg').value.trim();
    var hhEl=document.getElementById('${uid}-hh');var hh=hhEl?hhEl.value:'';
    var btn=document.getElementById('${uid}-btn');
    var err=document.getElementById('${uid}-err');
    err.style.display='none';
    if(!fn){showErr('Please enter your first name.');return;}
    if(!ln){showErr('Please enter your last name.');return;}
    if(!em||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)){showErr('Please enter a valid email address.');return;}
    ${enquiryOptHtml ? `if(!eq){showErr('Please select an enquiry topic.');return;}` : ''}
    if(!msg){showErr('Please enter your message.');return;}
    if(!tsToken){showErr('Please complete the verification.');return;}
    var orig=btn.textContent;btn.disabled=true;btn.textContent='Sending…';
    try{
      var r=await fetch('${API_BASE}/api/submit-form',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({firstName:fn,lastName:ln,email:em,phone:ph,enquiry:eq,qualification:ql,comments:msg,howHeard:hh,recipients:RCP,turnstileToken:tsToken})});
      var data=await r.json();
      if(r.ok&&data.ok){
        document.getElementById('${uid}-fw').style.display='none';
        document.getElementById('${uid}-ty').style.display='block';
      }else{
        showErr(data.error||'Something went wrong. Please try again.');
        resetTs();btn.disabled=false;btn.textContent=orig;
      }
    }catch(e){
      showErr('Unable to send. Please check your connection and try again.');
      resetTs();btn.disabled=false;btn.textContent=orig;
    }
  };
})();
</script>`;
}

export function generateReportTyHtml(config: AnyConfig) {
  const uid = `rty${Math.random().toString(36).slice(2, 7)}`;
  const heroBg = safeHex(config.heroBg, '#0d1f3c');
  const steps = config.steps || [];
  const contacts = config.contacts || [];
  return `<section id="${uid}" style="font-family:Poppins,sans-serif;max-width:540px;margin:0 auto;background:#f9fafb;border:1px solid #e5e7eb;">
  <div style="background:${heroBg};padding:48px 32px 36px;text-align:center;">
    <div style="width:72px;height:72px;border-radius:50%;background:${safeHex(config.iconBg, '#1e3a5f')};display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:30px;color:#fff;">✓</div>
    <h1 style="font-family:Poppins,sans-serif;font-size:28px;font-weight:700;color:#fff;margin:0 0 10px;">${escapeHtml(config.heading || 'Report Received')}</h1>
    <p style="font-family:Poppins,sans-serif;font-size:15px;color:#94a3b8;margin:0;">${escapeHtml(config.subtitle || '')}</p>
  </div>
  <div style="background:#fff;border-bottom:1px solid #e5e7eb;padding:20px 24px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin:0 0 6px;">${escapeHtml(config.refLabel || 'YOUR REFERENCE NUMBER')}</p>
    <span style="font-size:22px;font-weight:700;color:#0d1f3c;">REF-000000</span>
  </div>
  <div style="padding:28px 24px 8px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin:0 0 20px;">${escapeHtml(config.stepsLabel || '')}</p>
    ${steps.map((step: any, i: number) => `<div style="display:flex;gap:14px;margin-bottom:20px;"><span style="width:32px;height:32px;min-width:32px;border-radius:50%;background:${heroBg};color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:2px;">${i + 1}</span><div><p style="font-weight:700;font-size:14px;color:#1a1a1a;margin:0 0 4px;">${escapeHtml(step.title || '')}</p><p style="font-size:13px;color:#6b7280;margin:0 0 8px;line-height:1.5;">${escapeHtml(step.desc || '')}</p>${step.badge ? `<span style="font-size:11px;font-weight:500;color:#1a56a3;background:#e8f0fe;border-radius:999px;padding:3px 10px;">${escapeHtml(step.badge)}</span>` : ''}</div></div>`).join('')}
  </div>
  <div style="margin:4px 24px 20px;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;background:#fff;">
    <p style="font-weight:700;font-size:14px;color:#1a1a1a;margin:0 0 5px;">${escapeHtml(config.fuTitle || '')}</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 10px;line-height:1.5;">${escapeHtml(config.fuDesc || '')}</p>
    ${contacts.map((item: string) => `<p style="font-size:13px;color:#204280;margin:0 0 5px;">${escapeHtml(item)}</p>`).join('')}
  </div>
  <div style="display:flex;gap:12px;padding:0 24px 32px;flex-wrap:wrap;">
    ${config.btn1Text ? `<a href="${attr(config.btn1Url || '#')}" style="flex:1;min-width:160px;text-align:center;color:${safeHex(config.btn1Tc, '#fff')};background:${safeHex(config.btn1Bg, heroBg)};border-radius:8px;padding:13px 20px;text-decoration:none;font-weight:700;">${escapeHtml(config.btn1Text)}</a>` : ''}
    ${config.btn2Text ? `<a href="${attr(config.btn2Url || '#')}" style="flex:1;min-width:160px;text-align:center;color:${safeHex(config.btn2Tc, '#204280')};background:#fff;border:1.5px solid ${safeHex(config.btn2Bc, '#204280')};border-radius:8px;padding:13px 20px;text-decoration:none;font-weight:700;">${escapeHtml(config.btn2Text)}</a>` : ''}
  </div>
</section>`;
}
