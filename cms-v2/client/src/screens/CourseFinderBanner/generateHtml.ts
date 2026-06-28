import {
  defaultCourseFinderConfig,
  normalizeCourseFinderConfig,
  type CourseFinderConfig,
  type CourseFinderCourse,
} from '../CourseFinder/generateHtml';

export const COURSE_FINDER_BANNER_API_URL = 'https://api.cms.vls-online.com/api/publish-course-finder-banner';
export const COURSE_FINDER_BANNER_ROOT_ID = 'vls-course-finder-banner';

function runtimeScriptUrl(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl);
    return `${parsed.origin}/api/public/course-finder-banner.js`;
  } catch {
    return '/api/public/course-finder-banner.js';
  }
}

function buildStaticQualOptions(courses: EmbeddedCourse[], placeholder: string): string {
  const seen = new Set<string>();
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const course of courses) {
    const qual = String(course.qualification || 'Other').trim() || 'Other';
    if (seen.has(qual)) continue;
    seen.add(qual);
    options.push(`<option value="${escapeHtml(qual)}">${escapeHtml(qual)}</option>`);
  }
  return options.join('');
}

type EmbeddedCourse = {
  id: number;
  name: string;
  slug: string;
  category: string;
  level: string;
  status: string;
  url: string;
  sortOrder: number;
  qualification: string;
  courseLevel: string;
  courseLevels: string[];
  courseOption: string;
};

function publicCourseUrl(course: CourseFinderCourse): string {
  const raw = course.zenlerUrl || (course.slug ? `/courses/${course.slug}` : '#');
  return raw.replace('https://vls.newzenler.com', 'https://vls-online.com');
}

function mapCoursesForEmbed(courses: CourseFinderCourse[]): EmbeddedCourse[] {
  return courses
    .filter(course => course.isActive !== false && course.name)
    .map(course => ({
      id: course.id,
      name: course.name,
      slug: course.slug || '',
      category: course.category || '',
      level: course.level || '',
      status: course.status || '',
      url: publicCourseUrl(course),
      sortOrder: course.sortOrder || 0,
      qualification: course.qualification || '',
      courseLevel: course.courseLevel || '',
      courseLevels: course.courseLevels || (course.courseLevel ? [course.courseLevel] : []),
      courseOption: course.courseOption || '',
    }));
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch
  ));
}

function titleHtml(title: string, accent: string): string {
  const safeTitle = escapeHtml(title);
  const safeAccent = escapeHtml(accent);
  if (!accent || !title.includes(accent)) return safeTitle;
  return safeTitle.replace(safeAccent, `<em>${safeAccent}</em>`);
}

function cssFontFamily(value: string): string {
  return `'${String(value || 'Poppins').replace(/['"<>]/g, '').trim() || 'Poppins'}'`;
}

export const defaultCourseFinderBannerConfig: CourseFinderConfig = {
  ...defaultCourseFinderConfig,
  subtitle: 'Choose your qualification, level, course, and option.',
  findButtonText: 'Find Course →',
};

export function generateCourseFinderBannerHtml(courses: CourseFinderCourse[], rawConfig?: Partial<CourseFinderConfig> | null): string {
  const config = normalizeCourseFinderConfig({ ...defaultCourseFinderBannerConfig, ...(rawConfig || {}) });
  const rootId = COURSE_FINDER_BANNER_ROOT_ID;
  const embedded = mapCoursesForEmbed(courses);
  const fallback = { courses: embedded, config };

  return `
<style>
#${rootId}, #${rootId} * { box-sizing: border-box; }
#${rootId} { font-family: ${cssFontFamily(config.fontFamily)}, Arial, sans-serif; width: 100%; }
#${rootId} .cfb-banner { background: #0f1e3c; border-radius: 16px; overflow: hidden; position: relative; }
#${rootId} .cfb-banner:before { content: ''; position: absolute; top: -60px; right: -60px; width: 260px; height: 260px; border-radius: 50%; background: rgba(78,168,222,.05); pointer-events: none; }
#${rootId} .cfb-banner:after { content: ''; position: absolute; bottom: -40px; left: -40px; width: 180px; height: 180px; border-radius: 50%; background: rgba(78,168,222,.04); pointer-events: none; }
#${rootId} .cfb-top { padding: 24px 32px 18px; display: flex; align-items: center; justify-content: space-between; gap: 24px; position: relative; z-index: 1; }
#${rootId} .cfb-eyebrow { font-size: ${config.eyebrowSize}px; font-weight: ${config.eyebrowWeight}; letter-spacing: 1.2px; text-transform: uppercase; color: #4ea8de; margin-bottom: 7px; display: flex; align-items: center; gap: 6px; }
#${rootId} .cfb-dot { width: 4px; height: 4px; border-radius: 50%; background: #4ea8de; }
#${rootId} .cfb-title { font-size: ${config.titleSize}px; font-weight: ${config.titleWeight}; color: #fff; margin-bottom: 3px; line-height: 1.25; }
#${rootId} .cfb-title em { color: #4ea8de; font-style: normal; }
#${rootId} .cfb-sub { font-size: ${config.subtitleSize}px; font-weight: ${config.subtitleWeight}; color: rgba(255,255,255,.56); line-height: 1.6; }
#${rootId} .cfb-stats { display: flex; gap: 10px; flex-shrink: 0; }
#${rootId} .cfb-stat { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px 16px; text-align: center; min-width: 80px; }
#${rootId} .cfb-stat strong { display: block; font-size: 16px; font-weight: 800; color: #fff; line-height: 1.2; }
#${rootId} .cfb-stat span { font-size: 9px; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .4px; }
#${rootId} .cfb-dropdowns { background: rgba(255,255,255,.04); border-top: 1px solid rgba(255,255,255,.08); padding: 16px 32px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; position: relative; z-index: 1; }
#${rootId} .dd-group { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
#${rootId} .dd-label { font-size: ${config.labelSize}px; font-weight: ${config.labelWeight}; letter-spacing: .8px; text-transform: uppercase; color: rgba(255,255,255,.48); display: flex; align-items: center; gap: 5px; }
#${rootId} .dd-step { width: 15px; height: 15px; border-radius: 50%; background: rgba(78,168,222,.15); border: 1px solid rgba(78,168,222,.25); display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: #4ea8de; flex-shrink: 0; }
#${rootId} .dd-step.active { background: #185fa5; border-color: #185fa5; color: #fff; }
#${rootId} .dd-step.done { background: #0a5c2e; border-color: #0a5c2e; color: #fff; }
#${rootId} .dd-select { width: 100%; background-color: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 9px 28px 9px 11px; font-size: 11px; font-weight: 600; color: #fff !important; font-family: inherit; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='rgba(255,255,255,0.45)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; transition: border-color .15s, background-color .15s; }
#${rootId} .dd-select:hover:not(:disabled) { border-color: rgba(78,168,222,.5); background-color: rgba(255,255,255,.12); }
#${rootId} .dd-select:disabled { opacity: .3; cursor: not-allowed; }
#${rootId} .dd-select.selected { border-color: rgba(78,168,222,.55); background-color: rgba(24,95,165,.25); }
#${rootId} .dd-select option { background: #0f1e3c; color: #fff; }
#${rootId} .cfb-find-btn { background: #4ea8de; color: #0f1e3c; font-size: ${config.buttonSize}px; font-weight: ${config.buttonWeight}; padding: 9px 20px; border-radius: 8px; border: 0; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .15s; align-self: end; }
#${rootId} .cfb-find-btn:hover:not(:disabled) { background: #7ec8f0; }
#${rootId} .cfb-find-btn:disabled { opacity: .35; cursor: not-allowed; }
#${rootId} .cfb-message { display: none; padding: 10px 32px 14px; color: #ffdf8a; font-size: 11px; position: relative; z-index: 1; }
#${rootId} .cfb-message.visible { display: block; }
@media (max-width: 900px) {
  #${rootId} .cfb-top { align-items: flex-start; flex-direction: column; }
  #${rootId} .cfb-stats { width: 100%; }
  #${rootId} .cfb-stat { flex: 1; }
  #${rootId} .cfb-dropdowns { grid-template-columns: 1fr 1fr; }
  #${rootId} .cfb-find-btn { width: 100%; grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  #${rootId} .cfb-top, #${rootId} .cfb-dropdowns, #${rootId} .cfb-message { padding-left: 16px; padding-right: 16px; }
  #${rootId} .cfb-dropdowns { grid-template-columns: 1fr; }
  #${rootId} .cfb-stats { display: none; }
}
</style>
<div id="${rootId}" data-vls-course-finder-banner="1">
  <div class="cfb-banner">
    <div class="cfb-top">
      <div>
        <div class="cfb-eyebrow"><span class="cfb-dot"></span> ${escapeHtml(config.eyebrow)}</div>
        <div class="cfb-title">${titleHtml(config.title, config.titleAccent)}</div>
        <div class="cfb-sub">${escapeHtml(config.subtitle)}</div>
      </div>
      <div class="cfb-stats">
        <div class="cfb-stat"><strong data-role="stat-courses">${embedded.length}</strong><span>${escapeHtml(config.statCoursesLabel)}</span></div>
        <div class="cfb-stat"><strong data-role="stat-quals">0</strong><span>${escapeHtml(config.statQualificationsLabel)}</span></div>
        <div class="cfb-stat"><strong data-role="stat-papers">0</strong><span>${escapeHtml(config.statPapersLabel)}</span></div>
      </div>
    </div>
    <div class="cfb-dropdowns">
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step active" data-step="1">1</div>${escapeHtml(config.qualificationLabel)}</div>
        <select class="dd-select" data-role="qual">${buildStaticQualOptions(embedded, config.qualificationPlaceholder)}</select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="2">2</div>${escapeHtml(config.levelLabel)}</div>
        <select class="dd-select" data-role="level" disabled><option value="">${escapeHtml(config.levelPlaceholder)}</option></select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="3">3</div>${escapeHtml(config.courseLabel)}</div>
        <select class="dd-select" data-role="course" disabled><option value="">${escapeHtml(config.coursePlaceholder)}</option></select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="4">4</div>${escapeHtml(config.optionLabel)}</div>
        <select class="dd-select" data-role="option" disabled><option value="">${escapeHtml(config.optionPlaceholder)}</option></select>
      </div>
      <button class="cfb-find-btn" type="button" data-role="find" disabled>${escapeHtml(config.findButtonText)}</button>
    </div>
    <div class="cfb-message" data-role="message">${escapeHtml(config.messageText)}</div>
  </div>
</div>
<script type="application/json" id="vls-cfb-fallback">${escapeScriptJson(fallback)}</script>
<script data-cfasync="false" type="text/javascript" src="${escapeHtml(runtimeScriptUrl(COURSE_FINDER_BANNER_API_URL))}" data-vls-cfb-api="${escapeHtml(COURSE_FINDER_BANNER_API_URL)}"><\/script>`;
}
