import { escapeHtml, normalize, textStyle } from '../../utils/text';

type AnyConfig = Record<string, any>;

function attr(value: string) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function safeHex(value: string | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value! : fallback;
}

export function generateContactFormHtml(config: AnyConfig) {
  const uid = `vlsf${Math.random().toString(36).slice(2, 7)}`;
  const title = normalize(config.formTitle, 'formTitle');
  const submit = normalize(config.submitText, 'formButton');
  const thankTitle = normalize(config.thankTitle, 'formThankTitle');
  const thankDesc = normalize(config.thankDesc, 'formThank');
  const enquiryOptions = config.enquiryOptions || [];
  const apiUrl = '/api/submit-form';

  const optionHtml = enquiryOptions
    .filter((option: any) => String(option.label || '').trim())
    .map((option: any) => `<option value="${attr(option.label)}">${escapeHtml(option.label)}</option>`)
    .join('\n');

  return `<style>
.${uid}{font-family:Poppins,sans-serif;max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 8px 30px rgba(15,23,42,.08);}
.${uid} *{box-sizing:border-box;}
.${uid} label{display:block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;}
.${uid} input,.${uid} select,.${uid} textarea{width:100%;border:1px solid #d8dee8;border-radius:8px;padding:10px 12px;font-family:Poppins,sans-serif;font-size:14px;color:#172033;outline:none;}
.${uid} input:focus,.${uid} select:focus,.${uid} textarea:focus{border-color:#204280;box-shadow:0 0 0 3px rgba(32,66,128,.14);}
.${uid}-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.${uid}-field{margin-bottom:14px;}
.${uid}-btn{width:100%;border:0;border-radius:8px;background:#204280;padding:12px 18px;cursor:pointer;font-family:Poppins,sans-serif;${textStyle(submit)}}
.${uid}-thanks{display:none;text-align:center;padding:24px 10px;}
@media(max-width:640px){.${uid}-grid{grid-template-columns:1fr;}}
</style>
<form class="${uid}" action="${attr(apiUrl)}" method="post">
  <div class="${uid}-form">
    <h2 style="font-family:Poppins,sans-serif;margin:0 0 18px;${textStyle(title)}">${escapeHtml(title.text)}</h2>
    <div class="${uid}-grid">
      <div class="${uid}-field"><label>First name</label><input name="firstName" required></div>
      <div class="${uid}-field"><label>Last name</label><input name="lastName" required></div>
    </div>
    <div class="${uid}-field"><label>Email</label><input type="email" name="email" required></div>
    <div class="${uid}-grid">
      <div class="${uid}-field"><label>Country code</label><input name="countryCode" placeholder="+44"></div>
      <div class="${uid}-field"><label>Phone</label><input name="phone"></div>
    </div>
    <div class="${uid}-field"><label>Enquiry</label><select name="enquiryType" required><option value="">Select...</option>${optionHtml}</select></div>
    <div class="${uid}-field"><label>Message</label><textarea name="message" rows="4"></textarea></div>
    <button class="${uid}-btn" type="submit">${escapeHtml(submit.text)}</button>
  </div>
  <div class="${uid}-thanks">
    <h3 style="font-family:Poppins,sans-serif;margin:0 0 8px;${textStyle(thankTitle)}">${escapeHtml(thankTitle.text)}</h3>
    <p style="font-family:Poppins,sans-serif;margin:0;line-height:1.6;${textStyle(thankDesc)}">${thankDesc.text}</p>
  </div>
</form>`;
}

export function generateReportIssueHtml(config: AnyConfig) {
  const uid = `vlsri${Math.random().toString(36).slice(2, 7)}`;
  const accent = safeHex(config.accent, '#204280');
  const quals = config.qualifications || [];
  const issueTypes = config.issueTypes || [];
  const steps = config.steps || [];
  const cards = config.cards || [];
  const contacts = config.contactItems || [];

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
    <form class="${uid}-main" action="/api/submit-report" method="post">
      <input type="hidden" name="thankYouUrl" value="${attr(config.tyUrl || '')}">
      <div class="${uid}-field"><label>Name</label><input name="name" required></div>
      <div class="${uid}-field"><label>Email</label><input name="email" type="email" required></div>
      <div class="${uid}-field"><label>Qualification</label><select name="qualification">${quals.map((q: string) => `<option>${escapeHtml(q)}</option>`).join('')}</select></div>
      <div class="${uid}-field"><label>Issue type</label><select name="issueType">${issueTypes.map((issue: string) => `<option>${escapeHtml(issue)}</option>`).join('')}</select></div>
      <div class="${uid}-field"><label>Course / paper</label><input name="course"></div>
      <div class="${uid}-field"><label>Describe the issue</label><textarea name="message" rows="6" required></textarea></div>
      <button class="${uid}-btn" type="submit">${escapeHtml(config.btnText || 'Submit Report')}</button>
    </form>
  </div>
</section>`;
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
