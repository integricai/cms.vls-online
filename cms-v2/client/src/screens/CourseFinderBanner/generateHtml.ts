import {
  defaultCourseFinderConfig,
  normalizeCourseFinderConfig,
  type CourseFinderConfig,
  type CourseFinderCourse,
} from '../CourseFinder/generateHtml';

export const COURSE_FINDER_BANNER_API_URL = 'https://api.cms.vls-online.com/api/publish-course-finder-banner';
export const COURSE_FINDER_BANNER_ROOT_ID = 'vls-course-finder-banner';

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
        <div class="cfb-stat"><strong data-role="stat-courses">0</strong><span>${escapeHtml(config.statCoursesLabel)}</span></div>
        <div class="cfb-stat"><strong data-role="stat-quals">0</strong><span>${escapeHtml(config.statQualificationsLabel)}</span></div>
        <div class="cfb-stat"><strong data-role="stat-papers">0</strong><span>${escapeHtml(config.statPapersLabel)}</span></div>
      </div>
    </div>
    <div class="cfb-dropdowns">
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
      <button class="cfb-find-btn" type="button" data-role="find" disabled>${escapeHtml(config.findButtonText)}</button>
    </div>
    <div class="cfb-message" data-role="message">${escapeHtml(config.messageText)}</div>
  </div>
</div>
<script type="text/javascript">
(function(){
  var ROOT_ID = ${JSON.stringify(rootId)};
  var API = ${JSON.stringify(COURSE_FINDER_BANNER_API_URL)};
  var FALLBACK = ${escapeScriptJson(fallback)};
  var booted = false;

  function mergeConfig(config){
    var base = FALLBACK.config || {};
    var patch = config && typeof config === 'object' ? config : {};
    var merged = {};
    for (var key in base) { if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key]; }
    for (var patchKey in patch) { if (Object.prototype.hasOwnProperty.call(patch, patchKey)) merged[patchKey] = patch[patchKey]; }
    return merged;
  }

  function init(root, rawCourses, ui){
    var state = { qual: '', level: '', course: '', option: '' };
    var rows = [];

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
      return String(name || '').replace(/\\s+-\\s+Draft$/i, '').replace(/\\s+Draft$/i, '').replace(/\\s+-\\s+Backup$/i, '').replace(/\\s+Backup$/i, '').trim();
    }
    function courseKey(course, qual, level){
      var t = textKey(course);
      var codes = ['fa1','ma1','fa2','ma2','fbt','fab','fma','ffa','sbl','sbr','afm','apm','atx','aaa','ba1','ba2','ba3','ba4','e1','p1','f1','e2','p2','f2','e3','p3','f3','cma1','cma2','cia1','cia2','cia3','dipifr','certifr','bt','ma','fa','lw','pm','tx','fr','aa','fm'];
      var prefix = (qual + '-' + level).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      for (var i=0;i<codes.length;i++){ if (hasWord(t, codes[i])) return prefix + '-' + codes[i]; }
      return prefix + '-' + cleanLabel(course.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    }
    function buildGroups(courses){
      var map = {};
      courses.forEach(function(course, index){
        var qual = getQualification(course);
        var levels = getCourseLevels(course);
        levels.forEach(function(level){
          var key = courseKey(course, qual, level);
          var option = inferOption(course);
          if (!map[key]) map[key] = { key: key, qual: qual, level: level, label: cleanLabel(course.name), order: course.sortOrder || index, urls: {}, options: [] };
          if (option === 'Full Course' || map[key].label.length > cleanLabel(course.name).length) map[key].label = cleanLabel(course.name);
          map[key].urls[option] = course.url || '#';
          if (map[key].options.indexOf(option) === -1) map[key].options.push(option);
        });
      });
      return Object.keys(map).map(function(key){ return map[key]; });
    }
    function optionSort(a,b){
      var order = ['Full Course','Revision Course','Mock Exam','Study Notes','Bundle','Annual Plan','Coming Soon'];
      return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
    }
    function urlFor(row){ return row.urls[state.option] || row.urls['Full Course'] || row.urls[row.options[0]] || '#'; }
    function filteredRows(){
      return rows.filter(function(row){
        return (!state.qual || row.qual === state.qual) && (!state.level || row.level === state.level) && (!state.course || row.key === state.course);
      });
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
    function populate(select, items, placeholder){
      if (!select) return;
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
    function resetFrom(stage){
      if (stage <= 2) { populate($('level'), [], ui.levelPlaceholder); if ($('level')) { $('level').disabled = true; $('level').classList.remove('selected'); } }
      if (stage <= 3) { populate($('course'), [], ui.coursePlaceholder); if ($('course')) { $('course').disabled = true; $('course').classList.remove('selected'); } }
      if (stage <= 4) { populate($('option'), [], ui.optionPlaceholder); if ($('option')) { $('option').disabled = true; $('option').classList.remove('selected'); } }
      if ($('message')) $('message').classList.remove('visible');
      updateFindButton();
    }
    function updateFindButton(){ if ($('find')) $('find').disabled = !(state.course && state.option); }
    function updateStats(){
      var quals = {};
      rows.forEach(function(row){ quals[row.qual] = true; });
      if ($('stat-courses')) $('stat-courses').textContent = String(rawCourses.length);
      if ($('stat-quals')) $('stat-quals').textContent = String(Object.keys(quals).length);
      if ($('stat-papers')) $('stat-papers').textContent = String(rows.length);
    }
    function initDropdowns(){
      populate($('qual'), unique(rows, function(row){ return row.qual; }, function(row){ return row.qual; }), ui.qualificationPlaceholder);
    }
    function onQualChange(){
      state.qual = $('qual') ? $('qual').value : '';
      state.level = ''; state.course = ''; state.option = '';
      resetFrom(2);
      if ($('qual')) $('qual').classList.toggle('selected', !!state.qual);
      if (!state.qual) { setStep(1,'active'); setStep(2,''); setStep(3,''); setStep(4,''); }
      else {
        setStep(1,'done'); setStep(2,'active');
        populate($('level'), unique(filteredRows(), function(row){ return row.level; }, function(row){ return row.level || 'Other Courses'; }), ui.levelPlaceholder);
        if ($('level')) $('level').disabled = false;
      }
    }
    function onLevelChange(){
      state.level = $('level') ? $('level').value : '';
      state.course = ''; state.option = '';
      resetFrom(3);
      if ($('level')) $('level').classList.toggle('selected', !!state.level);
      if (!state.level) { setStep(2,'active'); setStep(3,''); setStep(4,''); }
      else {
        setStep(2,'done'); setStep(3,'active');
        populate($('course'), unique(filteredRows(), function(row){ return row.key; }, function(row){ return row.label; }), ui.coursePlaceholder);
        if ($('course')) $('course').disabled = false;
      }
    }
    function onCourseChange(){
      state.course = $('course') ? $('course').value : '';
      state.option = '';
      resetFrom(4);
      if ($('course')) $('course').classList.toggle('selected', !!state.course);
      if (!state.course) { setStep(3,'active'); setStep(4,''); }
      else {
        setStep(3,'done'); setStep(4,'active');
        var selected = rows.filter(function(row){ return row.key === state.course; })[0];
        populate($('option'), (selected ? selected.options.slice().sort(optionSort) : []).map(function(option){ return { value: option, label: option }; }), ui.optionPlaceholder);
        if ($('option')) $('option').disabled = false;
      }
      updateFindButton();
    }
    function onOptionChange(){
      state.option = $('option') ? $('option').value : '';
      if ($('option')) $('option').classList.toggle('selected', !!state.option);
      setStep(4, state.option ? 'done' : 'active');
      if ($('message')) $('message').classList.remove('visible');
      updateFindButton();
    }
    function onFindClick(){
      var selected = rows.filter(function(row){ return row.key === state.course; })[0];
      if (!selected || !state.option) {
        if ($('message')) $('message').classList.add('visible');
        return;
      }
      window.location.href = urlFor(selected);
    }

    rows = buildGroups(Array.isArray(rawCourses) ? rawCourses : []);
    if (!rows.length) {
      if ($('message')) {
        $('message').textContent = 'Unable to load courses right now.';
        $('message').classList.add('visible');
      }
      return;
    }

    root.addEventListener('change', function(e){
      var target = e.target;
      if (!target || !target.getAttribute) return;
      var role = target.getAttribute('data-role');
      if (role === 'qual') onQualChange();
      else if (role === 'level') onLevelChange();
      else if (role === 'course') onCourseChange();
      else if (role === 'option') onOptionChange();
    });
    root.addEventListener('click', function(e){
      var target = e.target;
      if (!target || !target.closest) return;
      if (target.closest('[data-role="find"]')) onFindClick();
    });

    updateStats();
    initDropdowns();
  }

  function boot(){
    if (booted) return;
    booted = true;
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    function start(rawCourses, config){
      init(root, rawCourses || [], mergeConfig(config));
    }

    fetch(API + '?t=' + Date.now(), { mode: 'cors', cache: 'no-store' })
      .then(function(r){
        if (!r.ok) throw new Error('VLS Course Finder Banner API returned ' + r.status);
        return r.json();
      })
      .then(function(data){
        start(data.courses || [], data.config);
      })
      .catch(function(err){
        if (window.console && console.warn) console.warn('VLS Course Finder Banner:', err.message || err);
        start(FALLBACK.courses || [], FALLBACK.config);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;
}
