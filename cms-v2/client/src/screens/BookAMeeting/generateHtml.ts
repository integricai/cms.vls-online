import type { BookMeetingState } from '../../types/cms';
import { escapeHtml, normalize, textStyle, type DefaultKey } from '../../utils/text';

function attr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function linesToTags(tags: BookMeetingState['tags'], uid: string): string {
  return tags
    .map(tag => normalize(tag, 'bookTag'))
    .filter(tag => tag.text.trim())
    .map(tag => `<span class="${uid}-tag" style="${textStyle(tag)}">${escapeHtml(tag.text.trim())}</span>`)
    .join('');
}

function td(value: Parameters<typeof normalize>[0], key: DefaultKey) {
  return normalize(value, key);
}

export function generateBookMeetingHtml(data: BookMeetingState): string {
  const uid = 'vlsbook' + Math.random().toString(36).slice(2, 7);
  const calendlyUrl = data.calendlyUrl || 'https://calendly.com/vls121/live-handholding-hour';
  const calendlyHeight = Math.max(500, Number(data.calendlyHeight) || 700);
  const maxWidth = 1120;
  const leftEyebrow = td(data.leftEyebrow, 'bookEyebrow');
  const leftTitle = td(data.leftTitle, 'bookIntroTitle');
  const expectTitle = td(data.expectTitle, 'bookCardTitle');
  const tutorName = td(data.tutorName, 'bookTutorName');
  const tutorRole = td(data.tutorRole, 'bookTutorRole');
  const tutorBio = td(data.tutorBio, 'bookTutorBio');
  const contactTitle = td(data.contactTitle, 'bookEyebrow');
  const contactEmail = td(data.contactEmail, 'bookContactText');
  const contactWhatsapp = td(data.contactWhatsapp, 'bookContactText');
  const meetingTitle = td(data.meetingTitle, 'bookMeetingTitle');
  const meetingSubtitle = td(data.meetingSubtitle, 'bookMeetingSub');

  const bulletItems = data.bullets
    .map(item => td(item.text, 'bookBullet'))
    .filter(item => item.text.trim())
    .map((item, index) => `
          <li>
            <span>${index + 1}</span>
            <p style="${textStyle(item)}">${item.text}</p>
          </li>`)
    .join('');

  const expectItems = data.expectItems
    .map(item => ({ ...item, titleData: td(item.title, 'bookExpectTitle'), descData: td(item.desc, 'bookExpectDesc') }))
    .filter(item => item.titleData.text.trim() || item.descData.text.trim())
    .map(item => `
          <li>
            <span style="background:${attr(item.iconBg || '#eaf3ff')}">${escapeHtml(item.icon || '')}</span>
            <p>${item.titleData.text ? `<strong style="${textStyle(item.titleData)}">${escapeHtml(item.titleData.text)}</strong>` : ''}${item.descData.text ? ` <span style="${textStyle(item.descData)}">- ${item.descData.text}</span>` : ''}</p>
          </li>`)
    .join('');

  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
.${uid}{box-sizing:border-box;width:100%;background:${data.bg};padding:${data.padTop}px ${data.padRight}px ${data.padBottom}px ${data.padLeft}px;font-family:Poppins,Arial,sans-serif;color:#0f172a;}
.${uid} *{box-sizing:border-box;}
.${uid}-wrap{max-width:${maxWidth}px;margin:0 auto;display:flex;flex-direction:column;gap:18px;align-items:stretch;}
.${uid}-rail{display:flex;flex-direction:column;gap:18px;}
.${uid}-card{overflow:hidden;border:1px solid #dfe6f0;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.03);}
.${uid}-intro-head{background:${data.leftHeaderBg};padding:18px 20px;color:#fff;}
.${uid}-eyebrow{margin:0 0 6px;text-transform:uppercase;}
.${uid}-intro-title{margin:0;line-height:1.35;}
.${uid}-bullets{list-style:none;margin:0;padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;}
.${uid}-bullets li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:12px;align-items:start;}
.${uid}-bullets span{display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:6px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;}
.${uid}-bullets p{margin:0;line-height:1.65;}
.${uid}-small-card{padding:18px;}
.${uid}-card-title{margin:0 0 14px;text-transform:uppercase;}
.${uid}-expect{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px;}
.${uid}-expect li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;align-items:start;}
.${uid}-expect span{display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;font-size:14px;}
.${uid}-expect p{margin:0;line-height:1.55;}
.${uid}-expect strong{font-weight:800;}
.${uid}-tutor{display:grid;grid-template-columns:48px minmax(0,1fr);gap:13px;align-items:center;}
.${uid}-avatar{display:flex;width:48px;height:48px;align-items:center;justify-content:center;border-radius:50%;background:#09376c;color:#fff;font-size:16px;font-weight:800;box-shadow:inset 0 0 0 4px #0b4b8f;}
.${uid}-tutor h3{margin:0 0 3px;}
.${uid}-tutor p{margin:0;line-height:1.5;}
.${uid}-contact{background:${data.leftHeaderBg};color:#bfdbfe;border-color:${data.leftHeaderBg};}
.${uid}-contact p{margin:8px 0 0;line-height:1.5;}
.${uid}-main{overflow:hidden;border:1px solid #dfe6f0;border-radius:14px;background:#fff;min-height:${calendlyHeight + 94}px;}
.${uid}-main-head{display:block;padding:22px 26px 18px;border-bottom:1px solid #e8eef7;}
.${uid}-main h2{margin:0;}
.${uid}-main p{margin:3px 0 0;}
.${uid}-tags{display:flex;flex-wrap:wrap;gap:9px;padding:10px 26px 14px;background:#f8fafc;border-bottom:1px solid #e8eef7;}
.${uid}-tag{display:inline-flex;align-items:center;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;padding:5px 13px;}
.${uid}-calendar{background:#f6f8fc;min-height:${calendlyHeight}px;}
.${uid}-calendar .calendly-inline-widget{width:100%;}
@media(max-width:860px){.${uid}{padding:24px 14px;}.${uid}-main{min-height:auto;}.${uid}-main-head{padding:18px;}.${uid}-tags{padding:10px 18px 14px;}}
</style>
<section class="${uid}">
  <div class="${uid}-wrap">
    <aside class="${uid}-rail">
      <div class="${uid}-card">
        <div class="${uid}-intro-head">
          <p class="${uid}-eyebrow" style="${textStyle(leftEyebrow)}">${escapeHtml(leftEyebrow.text)}</p>
          <h2 class="${uid}-intro-title" style="${textStyle(leftTitle)}">${escapeHtml(leftTitle.text)}</h2>
        </div>
        <ol class="${uid}-bullets">${bulletItems}</ol>
      </div>
      <div class="${uid}-card ${uid}-small-card">
        <h3 class="${uid}-card-title" style="${textStyle(expectTitle)}">${escapeHtml(expectTitle.text)}</h3>
        <ul class="${uid}-expect">${expectItems}</ul>
      </div>
      <div class="${uid}-card ${uid}-small-card">
        <div class="${uid}-tutor">
          <div class="${uid}-avatar">${escapeHtml(data.tutorInitials)}</div>
          <div>
            <h3 style="${textStyle(tutorName)}">${escapeHtml(tutorName.text)}</h3>
            <p><strong style="${textStyle(tutorRole)}">${escapeHtml(tutorRole.text)}</strong><br><span style="${textStyle(tutorBio)}">${tutorBio.text}</span></p>
          </div>
        </div>
      </div>
      <div class="${uid}-card ${uid}-small-card ${uid}-contact">
        <h3 class="${uid}-card-title" style="${textStyle(contactTitle)}">${escapeHtml(contactTitle.text)}</h3>
        <p style="${textStyle(contactEmail)}">${escapeHtml(contactEmail.text)}</p>
        <p style="${textStyle(contactWhatsapp)}">${escapeHtml(contactWhatsapp.text)}</p>
      </div>
    </aside>
    <main class="${uid}-main">
      <header class="${uid}-main-head">
        <div>
          <h2 style="${textStyle(meetingTitle)}">${escapeHtml(meetingTitle.text)}</h2>
          <p style="${textStyle(meetingSubtitle)}">${escapeHtml(meetingSubtitle.text)}</p>
        </div>
      </header>
      <div class="${uid}-tags">${linesToTags(data.tags, uid)}</div>
      <div class="${uid}-calendar">
        <!-- Calendly inline widget begin -->
        <div class="calendly-inline-widget" data-url="${attr(calendlyUrl)}" style="min-width:320px;height:${calendlyHeight}px;"></div>
        <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
        <!-- Calendly inline widget end -->
      </div>
    </main>
  </div>
</section>`;
}
