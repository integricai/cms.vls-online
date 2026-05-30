import type { CourseFinderCourse } from '../CourseFinder/generateHtml';

type EmbeddedCourse = {
  id: number;
  name: string;
  slug: string;
  category: string;
  level: string;
  status: string;
  url: string;
};

function publicCourseUrl(course: CourseFinderCourse): string {
  const raw = course.zenlerUrl || (course.slug ? `/courses/${course.slug}` : '#');
  return raw.replace('https://vls.newzenler.com', 'https://vls-online.com');
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

export function generateCourseFinderBannerHtml(courses: CourseFinderCourse[]): string {
  const uid = `vlscfb-${Date.now().toString(36)}`;
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
    }));

  return `
<style>
#${uid}, #${uid} * { box-sizing: border-box; }
#${uid} { font-family: Poppins, Arial, sans-serif; width: 100%; }
#${uid} .cfb-banner { background: #0f1e3c; border-radius: 16px; overflow: hidden; position: relative; }
#${uid} .cfb-banner:before { content: ''; position: absolute; top: -60px; right: -60px; width: 260px; height: 260px; border-radius: 50%; background: rgba(78,168,222,.05); pointer-events: none; }
#${uid} .cfb-banner:after { content: ''; position: absolute; bottom: -40px; left: -40px; width: 180px; height: 180px; border-radius: 50%; background: rgba(78,168,222,.04); pointer-events: none; }
#${uid} .cfb-top { padding: 24px 32px 18px; display: flex; align-items: center; justify-content: space-between; gap: 24px; position: relative; z-index: 1; }
#${uid} .cfb-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #4ea8de; margin-bottom: 7px; display: flex; align-items: center; gap: 6px; }
#${uid} .cfb-dot { width: 4px; height: 4px; border-radius: 50%; background: #4ea8de; }
#${uid} .cfb-title { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 3px; line-height: 1.25; }
#${uid} .cfb-title em { color: #4ea8de; font-style: normal; }
#${uid} .cfb-sub { font-size: 11px; color: rgba(255,255,255,.56); line-height: 1.6; }
#${uid} .cfb-stats { display: flex; gap: 10px; flex-shrink: 0; }
#${uid} .cfb-stat { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px 16px; text-align: center; min-width: 80px; }
#${uid} .cfb-stat strong { display: block; font-size: 16px; font-weight: 800; color: #fff; line-height: 1.2; }
#${uid} .cfb-stat span { font-size: 9px; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .4px; }
#${uid} .cfb-dropdowns { background: rgba(255,255,255,.04); border-top: 1px solid rgba(255,255,255,.08); padding: 16px 32px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; position: relative; z-index: 1; }
#${uid} .dd-group { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
#${uid} .dd-label { font-size: 9px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: rgba(255,255,255,.48); display: flex; align-items: center; gap: 5px; }
#${uid} .dd-step { width: 15px; height: 15px; border-radius: 50%; background: rgba(78,168,222,.15); border: 1px solid rgba(78,168,222,.25); display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: #4ea8de; flex-shrink: 0; }
#${uid} .dd-step.active { background: #185fa5; border-color: #185fa5; color: #fff; }
#${uid} .dd-step.done { background: #0a5c2e; border-color: #0a5c2e; color: #fff; }
#${uid} .dd-select { width: 100%; background-color: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 9px 28px 9px 11px; font-size: 11px; font-weight: 600; color: #fff !important; font-family: inherit; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='rgba(255,255,255,0.45)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; transition: border-color .15s, background-color .15s; }
#${uid} .dd-select:hover:not(:disabled) { border-color: rgba(78,168,222,.5); background-color: rgba(255,255,255,.12); }
#${uid} .dd-select:disabled { opacity: .3; cursor: not-allowed; }
#${uid} .dd-select.selected { border-color: rgba(78,168,222,.55); background-color: rgba(24,95,165,.25); }
#${uid} .dd-select option { background: #0f1e3c; color: #fff; }
#${uid} .cfb-find-btn { background: #4ea8de; color: #0f1e3c; font-size: 12px; font-weight: 800; padding: 9px 20px; border-radius: 8px; border: 0; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .15s; align-self: end; }
#${uid} .cfb-find-btn:hover:not(:disabled) { background: #7ec8f0; }
#${uid} .cfb-find-btn:disabled { opacity: .35; cursor: not-allowed; }
#${uid} .cfb-message { display: none; padding: 10px 32px 14px; color: #ffdf8a; font-size: 11px; position: relative; z-index: 1; }
#${uid} .cfb-message.visible { display: block; }
@media (max-width: 900px) {
  #${uid} .cfb-top { align-items: flex-start; flex-direction: column; }
  #${uid} .cfb-stats { width: 100%; }
  #${uid} .cfb-stat { flex: 1; }
  #${uid} .cfb-dropdowns { grid-template-columns: 1fr 1fr; }
  #${uid} .cfb-find-btn { width: 100%; grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  #${uid} .cfb-top, #${uid} .cfb-dropdowns, #${uid} .cfb-message { padding-left: 16px; padding-right: 16px; }
  #${uid} .cfb-dropdowns { grid-template-columns: 1fr; }
  #${uid} .cfb-stats { display: none; }
}
</style>
<div id="${uid}">
  <div class="cfb-banner">
    <div class="cfb-top">
      <div>
        <div class="cfb-eyebrow"><span class="cfb-dot"></span> Course Finder</div>
        <div class="cfb-title">Find the <em>right course</em> for you.</div>
        <div class="cfb-sub">Choose your qualification, level, course, and option.</div>
      </div>
      <div class="cfb-stats">
        <div class="cfb-stat"><strong data-role="stat-courses">0</strong><span>Courses</span></div>
        <div class="cfb-stat"><strong data-role="stat-quals">0</strong><span>Qualifications</span></div>
        <div class="cfb-stat"><strong data-role="stat-papers">0</strong><span>Papers</span></div>
      </div>
    </div>
    <div class="cfb-dropdowns">
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step active" data-step="1">1</div>Qualification</div>
        <select class="dd-select" data-role="qual"><option value="">All qualifications</option></select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="2">2</div>Level</div>
        <select class="dd-select" data-role="level" disabled><option value="">All levels</option></select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="3">3</div>Course</div>
        <select class="dd-select" data-role="course" disabled><option value="">All courses</option></select>
      </div>
      <div class="dd-group">
        <div class="dd-label"><div class="dd-step" data-step="4">4</div>Course Option</div>
        <select class="dd-select" data-role="option" disabled><option value="">All options</option></select>
      </div>
      <button class="cfb-find-btn" type="button" data-role="find" disabled>Find Course &rarr;</button>
    </div>
    <div class="cfb-message" data-role="message">Please select a course and option first.</div>
  </div>
</div>
<script>
(function(){
  var root = document.getElementById('${uid}');
  if (!root) return;
  var rawCourses = ${escapeScriptJson(embedded)};
  var state = { qual: '', level: '', course: '', option: '' };
  var qualOrder = ['acca','cima','cma','cia','ifrs','other'];
  var qualLabels = { acca: 'ACCA', cima: 'CIMA', cma: 'CMA', cia: 'CIA', ifrs: 'Dip-IFR / IFRS', other: 'Other' };
  var levelLabels = {
    foundation: 'Foundation Diploma', knowledge: 'Applied Knowledge', skills: 'Applied Skills',
    professional: 'Strategic Professional', revision: 'Revision Courses', bundles: 'Bundles & Subscriptions',
    certificate: 'Certificate Level', operational: 'Operational Level', management: 'Management Level',
    strategic: 'Strategic Level', cma_all: 'CMA Qualification', cia_all: 'CIA Qualification',
    ifrs_all: 'IFRS Qualification', other_all: 'Other Courses'
  };
  function $(role){ return root.querySelector('[data-role="' + role + '"]'); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function textKey(course){ return (course.name + ' ' + course.slug + ' ' + course.category + ' ' + course.level).toLowerCase(); }
  function hasWord(text, word){ return new RegExp('(^|[^a-z0-9])' + word + '([^a-z0-9]|$)', 'i').test(text); }
  function classifyQual(course){
    var t = textKey(course);
    if (/ifrs|dip-?ifr|cert-?ifr/.test(t)) return 'ifrs';
    if (/\\bcia\\b|internal auditing/.test(t)) return 'cia';
    if (/\\bcma\\b|strategic financial management/.test(t)) return 'cma';
    if (/\\bcima\\b|\\bba[1-4]\\b|fundamentals of business economics|digital world|managing performance|financial strategy/.test(t)) return 'cima';
    if (/\\bacca\\b|\\bfa1\\b|\\bma1\\b|\\bfa2\\b|\\bma2\\b|\\bfbt\\b|\\bfab\\b|\\bfma\\b|\\bffa\\b|\\bsbl\\b|\\bsbr\\b|\\bafm\\b|\\bapm\\b|\\batx\\b|\\baaa\\b|performance management|financial reporting|financial management|audit and assurance|business and technology|management accounting|financial accounting/.test(t)) return 'acca';
    return 'other';
  }
  function classifyLevel(course, qual){
    var t = textKey(course);
    if (/subscription|bundle|fullaccess|full access|annual/.test(t)) return 'bundles';
    if (/revision|mock/.test(t) && qual === 'acca') return 'revision';
    if (qual === 'cima') {
      if (/\\bba[1-4]\\b|certificate/.test(t)) return 'certificate';
      if (/\\be1\\b|\\bp1\\b|\\bf1\\b|operational|digital world/.test(t)) return 'operational';
      if (/\\be2\\b|\\bp2\\b|\\bf2\\b|management level|managing performance|advanced management accounting|advanced financial reporting/.test(t)) return 'management';
      return 'strategic';
    }
    if (qual === 'cma') return 'cma_all';
    if (qual === 'cia') return 'cia_all';
    if (qual === 'ifrs') return 'ifrs_all';
    if (qual === 'other') return 'other_all';
    if (/\\bfa1\\b|\\bma1\\b|\\bfa2\\b|\\bma2\\b|\\bfbt\\b|\\bfab\\b|\\bfma\\b|\\bffa\\b|foundation/.test(t)) return 'foundation';
    if (hasWord(t,'bt') || hasWord(t,'ma') || hasWord(t,'fa') || /applied knowledge|business and technology|management accounting|financial accounting|\\bf2\\b|\\bf3\\b/.test(t)) return 'knowledge';
    if (hasWord(t,'lw') || hasWord(t,'pm') || hasWord(t,'tx') || hasWord(t,'fr') || hasWord(t,'aa') || hasWord(t,'fm') || /applied skills|\\bf4\\b|\\bf5\\b|\\bf6\\b|\\bf7\\b|\\bf8\\b|\\bf9\\b|corporate and business law|taxation/.test(t)) return 'skills';
    if (/\\bsbl\\b|\\bsbr\\b|\\bafm\\b|\\bapm\\b|\\batx\\b|\\baaa\\b|strategic professional|advanced/.test(t)) return 'professional';
    return 'skills';
  }
  function inferOption(course){
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
    for (var i=0;i<codes.length;i++){ if (hasWord(t, codes[i])) return qual + '-' + level + '-' + codes[i]; }
    return qual + '-' + level + '-' + cleanLabel(course.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }
  function buildGroups(){
    var map = {};
    rawCourses.forEach(function(course, index){
      var qual = classifyQual(course);
      var level = classifyLevel(course, qual);
      var key = courseKey(course, qual, level);
      var option = inferOption(course);
      if (!map[key]) map[key] = { key: key, qual: qual, level: level, label: cleanLabel(course.name), order: index, urls: {}, options: [] };
      if (option === 'Full Course' || map[key].label.length > cleanLabel(course.name).length) map[key].label = cleanLabel(course.name);
      map[key].urls[option] = course.url || '#';
      if (map[key].options.indexOf(option) === -1) map[key].options.push(option);
    });
    return Object.keys(map).map(function(key){ return map[key]; });
  }
  var rows = buildGroups();
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
    output.sort(function(a,b){ return a.label.localeCompare(b.label); });
    return output;
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
  function resetFrom(stage){
    if (stage <= 2) { $('level').innerHTML = '<option value="">All levels</option>'; $('level').disabled = true; $('level').classList.remove('selected'); }
    if (stage <= 3) { $('course').innerHTML = '<option value="">All courses</option>'; $('course').disabled = true; $('course').classList.remove('selected'); }
    if (stage <= 4) { $('option').innerHTML = '<option value="">All options</option>'; $('option').disabled = true; $('option').classList.remove('selected'); }
    $('message').classList.remove('visible');
    updateFindButton();
  }
  function updateFindButton(){ $('find').disabled = !(state.course && state.option); }
  function updateStats(){
    var quals = {};
    rows.forEach(function(row){ quals[row.qual] = true; });
    $('stat-courses').textContent = String(rawCourses.length);
    $('stat-quals').textContent = String(Object.keys(quals).length);
    $('stat-papers').textContent = String(rows.length);
  }
  function initDropdowns(){
    var qualItems = qualOrder.filter(function(q){ return rows.some(function(row){ return row.qual === q; }); }).map(function(q){ return { value: q, label: qualLabels[q] }; });
    populate($('qual'), qualItems, 'All qualifications');
  }
  $('qual').addEventListener('change', function(){
    state.qual = $('qual').value; state.level = ''; state.course = ''; state.option = '';
    resetFrom(2);
    $('qual').classList.toggle('selected', !!state.qual);
    if (!state.qual) { setStep(1,'active'); setStep(2,''); setStep(3,''); setStep(4,''); }
    else {
      setStep(1,'done'); setStep(2,'active');
      populate($('level'), unique(filteredRows(), function(row){ return row.level; }, function(row){ return levelLabels[row.level] || 'Other Courses'; }), 'All levels');
      $('level').disabled = false;
    }
  });
  $('level').addEventListener('change', function(){
    state.level = $('level').value; state.course = ''; state.option = '';
    resetFrom(3);
    $('level').classList.toggle('selected', !!state.level);
    if (!state.level) { setStep(2,'active'); setStep(3,''); setStep(4,''); }
    else {
      setStep(2,'done'); setStep(3,'active');
      populate($('course'), unique(filteredRows(), function(row){ return row.key; }, function(row){ return row.label; }), 'All courses');
      $('course').disabled = false;
    }
  });
  $('course').addEventListener('change', function(){
    state.course = $('course').value; state.option = '';
    resetFrom(4);
    $('course').classList.toggle('selected', !!state.course);
    if (!state.course) { setStep(3,'active'); setStep(4,''); }
    else {
      setStep(3,'done'); setStep(4,'active');
      var selected = rows.filter(function(row){ return row.key === state.course; })[0];
      populate($('option'), (selected ? selected.options.slice().sort(optionSort) : []).map(function(option){ return { value: option, label: option }; }), 'All options');
      $('option').disabled = false;
    }
    updateFindButton();
  });
  $('option').addEventListener('change', function(){
    state.option = $('option').value;
    $('option').classList.toggle('selected', !!state.option);
    setStep(4, state.option ? 'done' : 'active');
    $('message').classList.remove('visible');
    updateFindButton();
  });
  $('find').addEventListener('click', function(){
    var selected = rows.filter(function(row){ return row.key === state.course; })[0];
    if (!selected || !state.option) {
      $('message').classList.add('visible');
      return;
    }
    window.location.href = urlFor(selected);
  });
  updateStats();
  initDropdowns();
})();
</script>`;
}
