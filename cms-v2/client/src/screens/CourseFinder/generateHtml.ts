export interface CourseFinderCourse {
  id: number;
  zenlerCourseId: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenlerUrl: string | null;
  isActive: boolean;
  sortOrder?: number;
  qualification?: string | null;
  courseLevel?: string | null;
  courseLevels?: string[];
  courseOption?: string | null;
  lastSyncedAt: string | null;
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

export interface CourseFinderStyleConfig {
  fontFamily: string;
  eyebrowSize: number;
  eyebrowWeight: number;
  titleSize: number;
  titleWeight: number;
  subtitleSize: number;
  subtitleWeight: number;
  labelSize: number;
  labelWeight: number;
  buttonSize: number;
  buttonWeight: number;
}

export interface CourseFinderTextConfig {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  qualificationLabel: string;
  levelLabel: string;
  courseLabel: string;
  optionLabel: string;
  qualificationPlaceholder: string;
  levelPlaceholder: string;
  coursePlaceholder: string;
  optionPlaceholder: string;
  findButtonText: string;
  statCoursesLabel: string;
  statQualificationsLabel: string;
  statPapersLabel: string;
  matchLabel: string;
  messageText: string;
  resetText: string;
  matchLinkText: string;
  defaultListTitle: string;
  defaultListSub: string;
  filteredPrefix: string;
  noCoursesTitle: string;
  noCoursesSub: string;
  detailsText: string;
  enrolText: string;
  sortDefaultText: string;
  sortAzText: string;
  sortLevelText: string;
  countSingular: string;
  countPlural: string;
  allPrefix: string;
  showingText: string;
  ofText: string;
}

export interface CourseFinderConfig extends CourseFinderTextConfig, CourseFinderStyleConfig {}

export const defaultCourseFinderConfig: CourseFinderConfig = {
  fontFamily: 'Poppins',
  eyebrowSize: 10,
  eyebrowWeight: 700,
  titleSize: 20,
  titleWeight: 800,
  subtitleSize: 11,
  subtitleWeight: 400,
  labelSize: 9,
  labelWeight: 700,
  buttonSize: 12,
  buttonWeight: 800,
  eyebrow: 'Course Finder',
  title: 'Find the right course for you.',
  titleAccent: 'right course',
  subtitle: 'Filter by qualification, level, and course type. Results update as you select.',
  qualificationLabel: 'Qualification',
  levelLabel: 'Level',
  courseLabel: 'Course',
  optionLabel: 'Course Option',
  qualificationPlaceholder: 'All qualifications',
  levelPlaceholder: 'All levels',
  coursePlaceholder: 'All courses',
  optionPlaceholder: 'All options',
  findButtonText: 'View Course →',
  statCoursesLabel: 'Courses',
  statQualificationsLabel: 'Qualifications',
  statPapersLabel: 'Papers',
  matchLabel: 'Exact match found',
  messageText: 'Please select a course and option first.',
  resetText: 'Reset filters',
  matchLinkText: 'Go to course →',
  defaultListTitle: 'All VLS Courses',
  defaultListSub: 'Browse the full course library',
  filteredPrefix: 'Filtered by:',
  noCoursesTitle: 'No courses found',
  noCoursesSub: 'Try adjusting your filters above',
  detailsText: 'Details',
  enrolText: 'Enrol →',
  sortDefaultText: 'Default order',
  sortAzText: 'A - Z',
  sortLevelText: 'By level',
  countSingular: 'course',
  countPlural: 'courses',
  allPrefix: 'All',
  showingText: 'Showing',
  ofText: 'of',
};

export function normalizeCourseFinderConfig(config?: Partial<CourseFinderConfig> | null): CourseFinderConfig {
  return { ...defaultCourseFinderConfig, ...(config || {}) };
}

function publicCourseUrl(course: CourseFinderCourse): string {
  const raw = course.zenlerUrl || (course.slug ? `/courses/${course.slug}` : '#');
  return raw.replace('https://vls.newzenler.com', 'https://vls-online.com');
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

export function generateCourseFinderHtml(courses: CourseFinderCourse[], rawConfig?: Partial<CourseFinderConfig> | null): string {
  const config = normalizeCourseFinderConfig(rawConfig);
  const uid = `vlscf-${Date.now().toString(36)}`;
  const embedded: EmbeddedCourse[] = courses
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

  return `
<style>
#${uid}, #${uid} * { box-sizing: border-box; }
#${uid} { font-family: ${cssFontFamily(config.fontFamily)}, Arial, sans-serif; color: #0f1e3c; width: 100%; }
#${uid} .cf-banner { background: #0f1e3c; border-radius: 16px; overflow: hidden; position: relative; margin: 0 0 20px; }
#${uid} .cf-banner:before { content: ''; position: absolute; top: -60px; right: -60px; width: 260px; height: 260px; border-radius: 50%; background: rgba(78,168,222,.05); pointer-events: none; }
#${uid} .cf-banner:after { content: ''; position: absolute; bottom: -40px; left: -40px; width: 180px; height: 180px; border-radius: 50%; background: rgba(78,168,222,.04); pointer-events: none; }
#${uid} .cf-top { padding: 28px 32px 22px; display: flex; align-items: center; justify-content: space-between; gap: 24px; position: relative; z-index: 1; }
#${uid} .cf-eyebrow { font-size: ${config.eyebrowSize}px; font-weight: ${config.eyebrowWeight}; letter-spacing: 1.2px; text-transform: uppercase; color: #4ea8de; margin-bottom: 7px; display: flex; align-items: center; gap: 6px; }
#${uid} .cf-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: #4ea8de; }
#${uid} .cf-title { font-size: ${config.titleSize}px; font-weight: ${config.titleWeight}; color: #fff; margin-bottom: 3px; line-height: 1.25; }
#${uid} .cf-title em { color: #4ea8de; font-style: normal; }
#${uid} .cf-sub { font-size: ${config.subtitleSize}px; font-weight: ${config.subtitleWeight}; color: rgba(255,255,255,.56); line-height: 1.6; }
#${uid} .cf-stats { display: flex; gap: 10px; flex-shrink: 0; }
#${uid} .cf-stat { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px 16px; text-align: center; min-width: 80px; }
#${uid} .cf-stat strong { display: block; font-size: 16px; font-weight: 800; color: #fff; line-height: 1.2; }
#${uid} .cf-stat span { font-size: 9px; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .4px; }
#${uid} .cf-dropdowns { background: rgba(255,255,255,.04); border-top: 1px solid rgba(255,255,255,.08); padding: 16px 32px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; position: relative; z-index: 1; }
#${uid} .dd-group { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
#${uid} .dd-label { font-size: ${config.labelSize}px; font-weight: ${config.labelWeight}; letter-spacing: .8px; text-transform: uppercase; color: rgba(255,255,255,.48); display: flex; align-items: center; gap: 5px; }
#${uid} .dd-step { width: 15px; height: 15px; border-radius: 50%; background: rgba(78,168,222,.15); border: 1px solid rgba(78,168,222,.25); display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: #4ea8de; flex-shrink: 0; }
#${uid} .dd-step.active { background: #185fa5; border-color: #185fa5; color: #fff; }
#${uid} .dd-step.done { background: #0a5c2e; border-color: #0a5c2e; color: #fff; }
#${uid} .dd-select { width: 100%; background-color: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 9px 28px 9px 11px; font-size: 11px; font-weight: 600; color: #fff !important; font-family: inherit; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='rgba(255,255,255,0.45)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; transition: border-color .15s, background-color .15s; }
#${uid} .dd-select:hover:not(:disabled) { border-color: rgba(78,168,222,.5); background-color: rgba(255,255,255,.12); }
#${uid} .dd-select:disabled { opacity: .3; cursor: not-allowed; }
#${uid} .dd-select.selected { border-color: rgba(78,168,222,.55); background-color: rgba(24,95,165,.25); }
#${uid} .dd-select option { background: #0f1e3c; color: #fff; }
#${uid} .cf-find-btn { background: #4ea8de; color: #0f1e3c; font-size: ${config.buttonSize}px; font-weight: ${config.buttonWeight}; padding: 9px 20px; border-radius: 8px; border: 0; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .15s; align-self: end; }
#${uid} .cf-find-btn:hover:not(:disabled) { background: #7ec8f0; }
#${uid} .cf-find-btn:disabled { opacity: .35; cursor: not-allowed; }
#${uid} .cf-match { background: rgba(10,92,46,.2); border-top: 1px solid rgba(10,92,46,.35); padding: 12px 32px; display: none; align-items: center; justify-content: space-between; gap: 14px; position: relative; z-index: 1; }
#${uid} .cf-match.visible { display: flex; }
#${uid} .cm-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
#${uid} .cm-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(93,219,154,.2); border: 1px solid rgba(93,219,154,.3); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
#${uid} .cm-label { font-size: 9px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: #5ddb9a; margin-bottom: 2px; }
#${uid} .cm-name { font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${uid} .cm-path { font-size: 10px; color: rgba(255,255,255,.5); margin-top: 1px; }
#${uid} .cm-btns { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
#${uid} .cm-go { background: #fff; color: #0f1e3c !important; font-size: 11px; font-weight: 800; padding: 8px 18px; border-radius: 7px; text-decoration: none !important; white-space: nowrap; }
#${uid} .cm-reset { background: transparent; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.65); font-size: 10px; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-family: inherit; }
#${uid} .course-list-section { background: #fff; border: 1px solid #e0e7f0; border-radius: 16px; overflow: hidden; }
#${uid} .cls-header { padding: 16px 24px; border-bottom: 1px solid #e8edf5; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#${uid} .cls-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
#${uid} .cls-icon { width: 36px; height: 36px; border-radius: 9px; background: #0f1e3c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
#${uid} .cls-title { font-size: 15px; font-weight: 800; color: #0f1e3c; line-height: 1.2; }
#${uid} .cls-sub { font-size: 11px; color: #888; margin-top: 2px; }
#${uid} .cls-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
#${uid} .cls-count { font-size: 11px; color: #888; background: #f0f2f7; border: 1px solid #e0e7f0; border-radius: 20px; padding: 4px 12px; white-space: nowrap; }
#${uid} .cls-sort { font-size: 11px; color: #555; background: #fff; border: 1px solid #d4dae8; border-radius: 7px; padding: 6px 10px; font-family: inherit; outline: none; cursor: pointer; }
#${uid} .course-row { display: flex; align-items: center; gap: 14px; padding: 13px 24px; border-bottom: 1px solid #f0f2f7; transition: background .12s; }
#${uid} .course-row:last-of-type { border-bottom: 0; }
#${uid} .course-row:hover { background: #fafbfd; }
#${uid} .cr-num { font-size: 11px; font-weight: 600; color: #aaa; width: 28px; flex-shrink: 0; text-align: center; }
#${uid} .cr-thumb { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; flex-shrink: 0; }
#${uid} .ct-blue { background: linear-gradient(135deg,#0c3d7a,#185fa5); }
#${uid} .ct-teal { background: linear-gradient(135deg,#085041,#1a8a6a); }
#${uid} .ct-purple { background: linear-gradient(135deg,#2d1a6e,#5b3fc8); }
#${uid} .ct-amber { background: linear-gradient(135deg,#633806,#a05020); }
#${uid} .ct-navy { background: linear-gradient(135deg,#0c2a5c,#1a4a8a); }
#${uid} .ct-grey { background: linear-gradient(135deg,#2a2a3a,#404060); }
#${uid} .cr-info { flex: 1; min-width: 0; }
#${uid} .cr-title { font-size: 13px; font-weight: 700; color: #0f1e3c; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${uid} .cr-title a { color: #185fa5 !important; text-decoration: none !important; }
#${uid} .cr-title a:hover { text-decoration: underline !important; }
#${uid} .cr-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#${uid} .level-badge { font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 20px; white-space: nowrap; }
#${uid} .lb-blue { background: #e6f1fb; color: #0c447c; border: 1px solid #b5d4f4; }
#${uid} .lb-teal { background: #e6f7ee; color: #085041; border: 1px solid #a8dbb9; }
#${uid} .lb-purple { background: #f0ecfb; color: #3d2490; border: 1px solid #c5b9f4; }
#${uid} .lb-amber { background: #fff8e6; color: #633806; border: 1px solid #f0d080; }
#${uid} .lb-navy { background: #e6eeff; color: #0c2a5c; border: 1px solid #b5c8f4; }
#${uid} .lb-grey { background: #f0f2f7; color: #555; border: 1px solid #d4dae8; }
#${uid} .opt-pills { display: flex; gap: 5px; flex-wrap: wrap; }
#${uid} .opt-pill { font-size: 9px; padding: 2px 7px; border-radius: 20px; background: #f4f6fb; border: 1px solid #e0e7f0; color: #666; white-space: nowrap; }
#${uid} .cr-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
#${uid} .cr-enrol { font-size: 10px; font-weight: 800; background: #0f1e3c; color: #fff !important; padding: 6px 14px; border-radius: 7px; text-decoration: none !important; white-space: nowrap; transition: background .15s; }
#${uid} .cr-enrol:hover { background: #185fa5; }
#${uid} .cr-view { font-size: 10px; font-weight: 700; color: #185fa5 !important; background: #e6f1fb; border: 1px solid #b5d4f4; padding: 6px 12px; border-radius: 7px; text-decoration: none !important; white-space: nowrap; }
#${uid} .cr-view:hover { background: #d0e8f8; }
#${uid} .cls-empty { padding: 40px 24px; text-align: center; }
#${uid} .cls-empty-icon { font-size: 32px; margin-bottom: 10px; }
#${uid} .cls-empty-title { font-size: 14px; font-weight: 800; color: #0f1e3c; margin-bottom: 4px; }
#${uid} .cls-empty-sub { font-size: 12px; color: #888; }
#${uid} .cls-pagination { padding: 14px 24px; border-top: 1px solid #e8edf5; background: #f7f8fc; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#${uid} .pg-info { font-size: 11px; color: #888; }
#${uid} .pg-info strong { color: #0f1e3c; font-weight: 700; }
#${uid} .pg-btns { display: flex; gap: 4px; align-items: center; }
#${uid} .pg-btn { min-width: 30px; height: 30px; border-radius: 7px; border: 1px solid #d4dae8; background: #fff; font-size: 11px; font-weight: 600; color: #555; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; padding: 0 6px; transition: all .12s; }
#${uid} .pg-btn:hover:not(:disabled):not(.active) { background: #e6f1fb; border-color: #b5d4f4; color: #185fa5; }
#${uid} .pg-btn.active { background: #0f1e3c; color: #fff; border-color: #0f1e3c; font-weight: 800; }
#${uid} .pg-btn:disabled { opacity: .3; cursor: not-allowed; }
#${uid} .pg-ellipsis { font-size: 12px; color: #bbb; padding: 0 4px; }
@media (max-width: 900px) {
  #${uid} .cf-top, #${uid} .cls-header { align-items: flex-start; flex-direction: column; }
  #${uid} .cf-stats { width: 100%; }
  #${uid} .cf-stat { flex: 1; }
  #${uid} .cf-dropdowns { grid-template-columns: 1fr 1fr; }
  #${uid} .cf-find-btn { width: 100%; grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  #${uid} .cf-top, #${uid} .cf-dropdowns, #${uid} .cf-match, #${uid} .cls-header, #${uid} .course-row, #${uid} .cls-pagination { padding-left: 16px; padding-right: 16px; }
  #${uid} .cf-dropdowns { grid-template-columns: 1fr; }
  #${uid} .cf-stats { display: none; }
  #${uid} .cf-match, #${uid} .course-row, #${uid} .cls-pagination { align-items: stretch; flex-direction: column; }
  #${uid} .cr-num { display: none; }
  #${uid} .cr-actions { width: 100%; }
  #${uid} .cr-actions a { flex: 1; text-align: center; }
}
</style>
<div id="${uid}">
  <div class="cf-banner">
    <div class="cf-top">
      <div>
        <div class="cf-eyebrow"><span class="cf-eyebrow-dot"></span> ${escapeHtml(config.eyebrow)}</div>
        <div class="cf-title">${titleHtml(config.title, config.titleAccent)}</div>
        <div class="cf-sub">${escapeHtml(config.subtitle)}</div>
      </div>
      <div class="cf-stats">
        <div class="cf-stat"><strong data-role="stat-courses">0</strong><span>${escapeHtml(config.statCoursesLabel)}</span></div>
        <div class="cf-stat"><strong data-role="stat-quals">0</strong><span>${escapeHtml(config.statQualificationsLabel)}</span></div>
        <div class="cf-stat"><strong data-role="stat-papers">0</strong><span>${escapeHtml(config.statPapersLabel)}</span></div>
      </div>
    </div>
    <div class="cf-dropdowns">
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step active" data-step="1">1</div>${escapeHtml(config.qualificationLabel)}</div>
        <select class="dd-select" data-role="qual"><option value="">${escapeHtml(config.qualificationPlaceholder)}</option></select>
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
      <button class="cf-find-btn" type="button" data-role="find">${escapeHtml(config.findButtonText)}</button>
    </div>
    <div class="cf-match" data-role="match">
      <div class="cm-left">
        <div class="cm-icon" data-role="match-icon">OK</div>
        <div>
          <div class="cm-label">${escapeHtml(config.matchLabel)}</div>
          <div class="cm-name" data-role="match-name">-</div>
          <div class="cm-path" data-role="match-path">-</div>
        </div>
      </div>
      <div class="cm-btns">
        <button class="cm-reset" type="button" data-role="reset">${escapeHtml(config.resetText)}</button>
        <a class="cm-go" data-role="match-link" href="#">${escapeHtml(config.matchLinkText)}</a>
      </div>
    </div>
  </div>
  <div class="course-list-section" data-role="list-section">
    <div class="cls-header">
      <div class="cls-header-left">
        <div class="cls-icon" data-role="list-icon">CF</div>
        <div>
          <div class="cls-title" data-role="list-title">${escapeHtml(config.defaultListTitle)}</div>
          <div class="cls-sub" data-role="list-sub">${escapeHtml(config.defaultListSub)}</div>
        </div>
      </div>
      <div class="cls-right">
        <span class="cls-count" data-role="count">0 courses</span>
        <select class="cls-sort" data-role="sort">
          <option value="default">${escapeHtml(config.sortDefaultText)}</option>
          <option value="az">${escapeHtml(config.sortAzText)}</option>
          <option value="level">${escapeHtml(config.sortLevelText)}</option>
        </select>
      </div>
    </div>
    <div data-role="body"></div>
    <div class="cls-pagination" data-role="pagination">
      <div class="pg-info" data-role="pg-info"></div>
      <div class="pg-btns" data-role="pg-btns"></div>
    </div>
  </div>
</div>
<script>
(function(){
  var root = document.getElementById('${uid}');
  if (!root) return;
  var rawCourses = ${escapeScriptJson(embedded)};
  var ui = ${escapeScriptJson(config)};
  var PAGE_SIZE = 10;
  var state = { qual: '', level: '', course: '', option: '', sort: 'default', page: 1 };
  var levelStyle = {
    foundation: ['Foundation Diploma','lb-blue','ct-blue','FD'],
    knowledge: ['Applied Knowledge','lb-teal','ct-teal','AK'],
    skills: ['Applied Skills','lb-purple','ct-purple','AS'],
    professional: ['Strategic Professional','lb-amber','ct-amber','SP'],
    revision: ['Revision Courses','lb-navy','ct-navy','RV'],
    bundles: ['Bundles & Subscriptions','lb-grey','ct-grey','BD'],
    certificate: ['Certificate Level','lb-blue','ct-blue','CL'],
    operational: ['Operational Level','lb-teal','ct-teal','OL'],
    management: ['Management Level','lb-purple','ct-purple','ML'],
    strategic: ['Strategic Level','lb-amber','ct-amber','SL'],
    cma_all: ['CMA Qualification','lb-amber','ct-amber','CM'],
    cia_all: ['CIA Qualification','lb-navy','ct-navy','IA'],
    ifrs_all: ['IFRS Qualification','lb-grey','ct-grey','IF'],
    other_all: ['Other Courses','lb-grey','ct-grey','OT']
  };

  function $(role){ return root.querySelector('[data-role="' + role + '"]'); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function textKey(course){ return (course.name + ' ' + course.slug + ' ' + course.category + ' ' + course.level).toLowerCase(); }
  function hasWord(text, word){ return new RegExp('(^|[^a-z0-9])' + word + '([^a-z0-9]|$)', 'i').test(text); }
  function cleanValue(value, fallback){
    var text = String(value || '').replace(/\\s+/g, ' ').trim();
    return text || fallback;
  }
  function getQualification(course){ return cleanValue(course.qualification, 'Other'); }
  function getCourseLevels(course){
    var levels = Array.isArray(course.courseLevels) ? course.courseLevels.map(function(level){ return cleanValue(level, ''); }).filter(Boolean) : [];
    if (!levels.length && course.courseLevel) levels = [cleanValue(course.courseLevel, '')].filter(Boolean);
    return levels.length ? levels : [inferLevelLabel(course)];
  }
  function inferLevelLabel(course){
    var t = textKey(course);
    if (/subscription|bundle|fullaccess|full access|annual/.test(t)) return 'Bundles & Subscriptions';
    if (/revision|mock/.test(t)) return 'Revision Courses';
    if (/\\bba[1-4]\\b|certificate/.test(t)) return 'Certificate Level';
    if (/\\be1\\b|\\bp1\\b|\\bf1\\b|operational|digital world/.test(t)) return 'Operational Level';
    if (/\\be2\\b|\\bp2\\b|\\bf2\\b|management level|managing performance|advanced management accounting|advanced financial reporting/.test(t)) return 'Management Level';
    if (/\\be3\\b|\\bp3\\b|\\bf3\\b|strategic level|financial strategy/.test(t)) return 'Strategic Level';
    if (/\\bfa1\\b|\\bma1\\b|\\bfa2\\b|\\bma2\\b|foundation/.test(t)) return 'Foundation Diploma';
    if (hasWord(t,'bt') || hasWord(t,'ma') || hasWord(t,'fa') || /applied knowledge|business and technology|management accounting|financial accounting/.test(t)) return 'Applied Knowledge';
    if (hasWord(t,'lw') || hasWord(t,'pm') || hasWord(t,'tx') || hasWord(t,'fr') || hasWord(t,'aa') || hasWord(t,'fm') || /applied skills|corporate and business law|taxation/.test(t)) return 'Applied Skills';
    if (/\\bsbl\\b|\\bsbr\\b|\\bafm\\b|\\bapm\\b|\\batx\\b|\\baaa\\b|strategic professional|advanced/.test(t)) return 'Strategic Professional';
    return 'Other Courses';
  }
  function inferOption(course){
    if (course.courseOption) return course.courseOption;
    var t = textKey(course);
    if (/coming soon/.test(t)) return 'Coming Soon';
    if (/annual|subscription|fullaccess|full access/.test(t)) return 'Annual Plan';
    if (/bundle/.test(t)) return 'Bundle';
    if (/mock/.test(t)) return 'Mock Exam';
    if (/revision/.test(t)) return 'Revision Course';
    if (/note|study material/.test(t)) return 'Study Notes';
    return 'Full Course';
  }
  function cleanLabel(name){
    return String(name || '')
      .replace(/\\s+-\\s+Draft$/i, '')
      .replace(/\\s+Draft$/i, '')
      .replace(/\\s+-\\s+Backup$/i, '')
      .replace(/\\s+Backup$/i, '')
      .trim();
  }
  function isAlternateLanguage(course){
    var t = textKey(course);
    if (/urdu|hindi/.test(t)) return true;
    var url = String(course.url || course.slug || '').toLowerCase();
    return /urdu|hindi/.test(url);
  }
  function languageKeySuffix(course){
    return isAlternateLanguage(course) ? '-urdu-hindi' : '';
  }
  function preferCourseLabel(current, candidate, course){
    var cur = cleanLabel(current);
    var next = cleanLabel(candidate);
    var curAlt = /urdu|hindi/i.test(cur);
    var nextAlt = isAlternateLanguage(course);
    if (curAlt && !nextAlt) return next;
    if (!curAlt && nextAlt) return cur;
    return next.length < cur.length ? next : cur;
  }
  function compareCourseRows(a, b){
    var aAlt = /urdu|hindi/i.test(a.label) ? 1 : 0;
    var bAlt = /urdu|hindi/i.test(b.label) ? 1 : 0;
    if (aAlt !== bAlt) return aAlt - bAlt;
    return (a.order || 0) - (b.order || 0);
  }
  function levelStyleKey(label){
    var clean = cleanValue(label, '').toLowerCase();
    for (var levelKey in levelStyle) {
      if (levelStyle[levelKey][0].toLowerCase() === clean) return levelKey;
    }
    if (/foundation/.test(clean)) return 'foundation';
    if (/knowledge/.test(clean)) return 'knowledge';
    if (/skills/.test(clean)) return 'skills';
    if (/professional/.test(clean)) return 'professional';
    if (/revision/.test(clean)) return 'revision';
    if (/bundle|subscription/.test(clean)) return 'bundles';
    if (/certificate/.test(clean)) return 'certificate';
    if (/operational/.test(clean)) return 'operational';
    if (/management/.test(clean)) return 'management';
    if (/strategic/.test(clean)) return 'strategic';
    if (/cma/.test(clean)) return 'cma_all';
    if (/cia/.test(clean)) return 'cia_all';
    if (/ifr/.test(clean)) return 'ifrs_all';
    return 'other_all';
  }
  function qualIcon(label){
    var clean = cleanValue(label, 'Other');
    var letters = clean.replace(/[^a-z0-9 ]/gi, ' ').split(/\\s+/).filter(Boolean).map(function(part){ return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    return letters || 'OT';
  }
  function courseKey(course, qual, level){
    var t = textKey(course);
    var codes = ['fa1','ma1','fa2','ma2','fbt','fab','fma','ffa','sbl','sbr','afm','apm','atx','aaa','ba1','ba2','ba3','ba4','e1','p1','f1','e2','p2','f2','e3','p3','f3','cma1','cma2','cia1','cia2','cia3','dipifr','certifr','bt','ma','fa','lw','pm','tx','fr','aa','fm'];
    var prefix = (qual + '-' + level).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var langSuffix = languageKeySuffix(course);
    for (var i=0;i<codes.length;i++){ if (hasWord(t, codes[i])) return prefix + '-' + codes[i] + langSuffix; }
    return prefix + '-' + cleanLabel(course.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }
  function buildGroups(){
    var map = {};
    rawCourses.forEach(function(course, index){
      var qual = getQualification(course);
      var levels = getCourseLevels(course);
      levels.forEach(function(level){
        var key = courseKey(course, qual, level);
        var option = inferOption(course);
        if (!map[key]) {
          map[key] = {
            key: key, qual: qual, level: level, label: cleanLabel(course.name), order: course.sortOrder || index,
            urls: {}, options: [], sourceNames: []
          };
        }
        map[key].label = preferCourseLabel(map[key].label, course.name, course);
        map[key].urls[option] = course.url || '#';
        if (map[key].options.indexOf(option) === -1) map[key].options.push(option);
        map[key].sourceNames.push(cleanLabel(course.name));
      });
    });
    return Object.keys(map).map(function(key){ return map[key]; });
  }
  var rows = buildGroups();
  function levelLabel(key){ return key || 'Other Courses'; }
  function badgeClass(key){ return (levelStyle[levelStyleKey(key)] || levelStyle.other_all)[1]; }
  function thumbClass(key){ return (levelStyle[levelStyleKey(key)] || levelStyle.other_all)[2]; }
  function thumbText(key){ return (levelStyle[levelStyleKey(key)] || levelStyle.other_all)[3]; }
  function urlFor(row){ return row.urls[state.option] || row.urls['Full Course'] || row.urls[row.options[0]] || '#'; }
  function optionSort(a,b){
    var order = ['Full Course','Revision Course','Mock Exam','Study Notes','Bundle','Annual Plan','Coming Soon'];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  }
  function populate(select, items, placeholder){
    select.innerHTML = '<option value="">' + esc(placeholder) + '</option>';
    items.forEach(function(item){
      var opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      select.appendChild(opt);
    });
  }
  function setStep(n, mode){
    var el = root.querySelector('[data-step="' + n + '"]');
    if (!el) return;
    el.className = 'dd-step' + (mode === 'active' ? ' active' : mode === 'done' ? ' done' : '');
    el.textContent = mode === 'done' ? 'OK' : String(n);
  }
  function filteredRows(){
    return rows.filter(function(row){
      return (!state.qual || row.qual === state.qual) &&
        (!state.level || row.level === state.level) &&
        (!state.course || row.key === state.course) &&
        (!state.option || row.options.indexOf(state.option) !== -1);
    });
  }
  function sortedRows(items){
    var copy = items.slice();
    if (state.sort === 'az') copy.sort(function(a,b){ return a.label.localeCompare(b.label); });
    else if (state.sort === 'level') copy.sort(function(a,b){ return (a.qual + levelLabel(a.level) + a.label).localeCompare(b.qual + levelLabel(b.level) + b.label); });
    else copy.sort(function(a,b){
      var aAlt = /urdu|hindi/i.test(a.label) ? 1 : 0;
      var bAlt = /urdu|hindi/i.test(b.label) ? 1 : 0;
      if (aAlt !== bAlt) return aAlt - bAlt;
      return a.order - b.order;
    });
    return copy;
  }
  function unique(items, getValue, getLabel){
    var seen = {};
    var output = [];
    items.forEach(function(item){
      var value = getValue(item);
      if (!value || seen[value]) return;
      seen[value] = true;
      output.push({ value: value, label: getLabel(item) });
    });
    return output;
  }
  function qualificationSortRank(name){
    var order = ['ACCA', 'CIMA', 'CMA', 'Other'];
    var upper = String(name || '').trim().toUpperCase();
    for (var i = 0; i < order.length; i++) {
      if (order[i].toUpperCase() === upper) return i;
    }
    return 100;
  }
  function sortQualificationItems(items){
    return items.slice().sort(function(a, b){
      var diff = qualificationSortRank(a.value) - qualificationSortRank(b.value);
      if (diff !== 0) return diff;
      return String(a.label).localeCompare(String(b.label));
    });
  }
  function resetFrom(stage){
    if (stage <= 2) { $('level').innerHTML = '<option value="">' + esc(ui.levelPlaceholder) + '</option>'; $('level').disabled = true; $('level').classList.remove('selected'); }
    if (stage <= 3) { $('course').innerHTML = '<option value="">' + esc(ui.coursePlaceholder) + '</option>'; $('course').disabled = true; $('course').classList.remove('selected'); }
    if (stage <= 4) { $('option').innerHTML = '<option value="">' + esc(ui.optionPlaceholder) + '</option>'; $('option').disabled = true; $('option').classList.remove('selected'); }
    $('match').classList.remove('visible');
  }
  function renderList(){
    var items = sortedRows(filteredRows());
    var total = items.length;
    var pages = Math.ceil(total / PAGE_SIZE);
    state.page = Math.min(state.page, pages || 1);
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = items.slice(start, start + PAGE_SIZE);
    var qd = state.qual || '';
    var currentLevel = state.level ? levelLabel(state.level) : '';
    var selectedCourse = state.course ? rows.filter(function(row){ return row.key === state.course; })[0] : null;
    $('list-icon').textContent = state.qual ? qualIcon(state.qual) : 'CF';
    $('list-title').textContent = selectedCourse ? selectedCourse.label : currentLevel ? qd + ' - ' + currentLevel : qd ? ui.allPrefix + ' ' + qd + ' ' + ui.countPlural : ui.defaultListTitle;
    $('list-sub').textContent = state.qual ? ui.filteredPrefix + ' ' + (currentLevel || qd) : ui.defaultListSub;
    $('count').textContent = total + ' ' + (total === 1 ? ui.countSingular : ui.countPlural);
    if (!slice.length) {
      $('body').innerHTML = '<div class="cls-empty"><div class="cls-empty-icon">?</div><div class="cls-empty-title">' + esc(ui.noCoursesTitle) + '</div><div class="cls-empty-sub">' + esc(ui.noCoursesSub) + '</div></div>';
    } else {
      $('body').innerHTML = slice.map(function(row, i){
        var optionHtml = row.options.slice().sort(optionSort).map(function(option){ return '<span class="opt-pill">' + esc(option) + '</span>'; }).join('');
        return '<div class="course-row">' +
          '<div class="cr-num">' + (start + i + 1) + '</div>' +
          '<div class="cr-thumb ' + thumbClass(row.level) + '">' + esc(thumbText(row.level)) + '</div>' +
          '<div class="cr-info"><div class="cr-title"><a href="' + esc(urlFor(row)) + '" target="_blank" rel="noopener">' + esc(row.label) + '</a></div>' +
          '<div class="cr-meta"><span class="level-badge ' + badgeClass(row.level) + '">' + esc(levelLabel(row.level)) + '</span><div class="opt-pills">' + optionHtml + '</div></div></div>' +
          '<div class="cr-actions"><a class="cr-view" href="' + esc(urlFor(row)) + '" target="_blank" rel="noopener">' + esc(ui.detailsText) + '</a><a class="cr-enrol" href="' + esc(urlFor(row)) + '" target="_blank" rel="noopener">' + esc(ui.enrolText) + '</a></div>' +
          '</div>';
      }).join('');
    }
    $('pg-info').innerHTML = total > 0 ? esc(ui.showingText) + ' <strong>' + (start + 1) + '-' + Math.min(start + PAGE_SIZE, total) + '</strong> ' + esc(ui.ofText) + ' <strong>' + total + '</strong> ' + esc(ui.countPlural) : '';
    if (pages <= 1) { $('pg-btns').innerHTML = ''; return; }
    var html = '<button class="pg-btn" type="button" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>&lt;</button>';
    for (var p=1;p<=pages;p++) {
      if (p === 1 || p === pages || Math.abs(p - state.page) <= 1) html += '<button class="pg-btn ' + (p === state.page ? 'active' : '') + '" type="button" data-page="' + p + '">' + p + '</button>';
      else if (Math.abs(p - state.page) === 2) html += '<span class="pg-ellipsis">...</span>';
    }
    html += '<button class="pg-btn" type="button" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>&gt;</button>';
    $('pg-btns').innerHTML = html;
  }
  function updateStats(){
    var quals = {};
    rows.forEach(function(row){ quals[row.qual] = true; });
    $('stat-courses').textContent = String(rawCourses.length);
    $('stat-quals').textContent = String(Object.keys(quals).length);
    $('stat-papers').textContent = String(rows.length);
  }
  function initDropdowns(){
    var qualItems = sortQualificationItems(unique(rows, function(row){ return row.qual; }, function(row){ return row.qual; }));
    populate($('qual'), qualItems, ui.qualificationPlaceholder);
  }
  $('qual').addEventListener('change', function(){
    state.qual = $('qual').value; state.level = ''; state.course = ''; state.option = ''; state.page = 1;
    resetFrom(2);
    $('qual').classList.toggle('selected', !!state.qual);
    if (!state.qual) { setStep(1,'active'); setStep(2,''); setStep(3,''); setStep(4,''); }
    else {
      setStep(1,'done'); setStep(2,'active');
      populate($('level'), unique(filteredRows(), function(row){ return row.level; }, function(row){ return levelLabel(row.level); }), ui.levelPlaceholder);
      $('level').disabled = false;
    }
    renderList();
  });
  $('level').addEventListener('change', function(){
    state.level = $('level').value; state.course = ''; state.option = ''; state.page = 1;
    resetFrom(3);
    $('level').classList.toggle('selected', !!state.level);
    if (!state.level) { setStep(2,'active'); setStep(3,''); setStep(4,''); }
    else {
      setStep(2,'done'); setStep(3,'active');
      populate($('course'), unique(filteredRows().slice().sort(compareCourseRows), function(row){ return row.key; }, function(row){ return row.label; }), ui.coursePlaceholder);
      $('course').disabled = false;
    }
    renderList();
  });
  $('course').addEventListener('change', function(){
    state.course = $('course').value; state.option = ''; state.page = 1;
    resetFrom(4);
    $('course').classList.toggle('selected', !!state.course);
    if (!state.course) { setStep(3,'active'); setStep(4,''); }
    else {
      setStep(3,'done'); setStep(4,'active');
      var selected = rows.filter(function(row){ return row.key === state.course; })[0];
      populate($('option'), (selected ? selected.options.slice().sort(optionSort) : []).map(function(option){ return { value: option, label: option }; }), ui.optionPlaceholder);
      $('option').disabled = false;
    }
    renderList();
  });
  $('option').addEventListener('change', function(){
    state.option = $('option').value; state.page = 1;
    $('option').classList.toggle('selected', !!state.option);
    setStep(4, state.option ? 'done' : 'active');
    $('match').classList.remove('visible');
    renderList();
  });
  $('find').addEventListener('click', function(){
    if (!state.course || !state.option) return;
    var selected = rows.filter(function(row){ return row.key === state.course; })[0];
    if (!selected) return;
    $('match-icon').textContent = state.option === 'Mock Exam' ? 'ME' : state.option === 'Revision Course' ? 'RV' : state.option === 'Study Notes' ? 'SN' : 'OK';
    $('match-name').textContent = selected.label;
    $('match-path').textContent = selected.qual + ' > ' + levelLabel(selected.level) + ' > ' + state.option;
    $('match-link').href = urlFor(selected);
    $('match').classList.add('visible');
  });
  $('reset').addEventListener('click', function(){
    state = { qual: '', level: '', course: '', option: '', sort: state.sort, page: 1 };
    $('qual').value = '';
    $('qual').classList.remove('selected');
    resetFrom(2);
    setStep(1,'active'); setStep(2,''); setStep(3,''); setStep(4,'');
    renderList();
  });
  $('sort').addEventListener('change', function(){ state.sort = $('sort').value; state.page = 1; renderList(); });
  $('pg-btns').addEventListener('click', function(event){
    var btn = event.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.getAttribute('data-page')) || 1;
    renderList();
    var section = $('list-section');
    if (section && section.scrollIntoView) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  updateStats();
  initDropdowns();
  renderList();
})();
</script>`;
}
