(function(){
  var script = document.currentScript;
  var API = (script && script.getAttribute('data-vls-cfb-api')) || 'https://api.cms.vls-online.com/api/publish-course-finder-banner';
  var ROOT_ID = 'vls-course-finder-banner';
  var started = false;
  var attempts = 0;

  function getRoot(){
    var el = document.getElementById(ROOT_ID);
    if (el) return el;
    if (script) {
      var node = script.previousElementSibling;
      if (node && node.id === 'vls-cfb-fallback') node = node.previousElementSibling;
      if (node && (node.id === ROOT_ID || node.getAttribute('data-vls-course-finder-banner'))) return node;
    }
    return document.querySelector('[data-vls-course-finder-banner="1"]');
  }

  function readFallback(){
    var node = document.getElementById('vls-cfb-fallback');
    if (!node || !node.textContent) return { courses: [], config: null };
    try { return JSON.parse(node.textContent); } catch (e) { return { courses: [], config: null }; }
  }

  function mergeConfig(base, patch){
    base = base && typeof base === 'object' ? base : {};
    patch = patch && typeof patch === 'object' ? patch : {};
    var merged = {};
    var key;
    for (key in base) { if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key]; }
    for (key in patch) { if (Object.prototype.hasOwnProperty.call(patch, key)) merged[key] = patch[key]; }
    return merged;
  }

  function defaultUi(){
    return {
      qualificationPlaceholder: 'All qualifications',
      levelPlaceholder: 'All levels',
      coursePlaceholder: 'All courses',
      optionPlaceholder: 'All options',
      messageText: 'Please select a course and option first.'
    };
  }

  function init(root, rawCourses, ui){
    if (root.getAttribute('data-vls-cfb-ready') === '1') return;
    root.setAttribute('data-vls-cfb-ready', '1');

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
      var text = String(value || '').replace(/\s+/g, ' ').trim();
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
      if (/\bba[1-4]\b|certificate/.test(t)) return 'Certificate Level';
      if (/\be1\b|\bp1\b|\bf1\b|operational|digital world/.test(t)) return 'Operational Level';
      if (/\be2\b|\bp2\b|\bf2\b|management level|managing performance|advanced management accounting|advanced financial reporting/.test(t)) return 'Management Level';
      if (/\be3\b|\bp3\b|\bf3\b|strategic level|financial strategy/.test(t)) return 'Strategic Level';
      if (/\bfa1\b|\bma1\b|\bfa2\b|\bma2\b|foundation/.test(t)) return 'Foundation Diploma';
      if (hasWord(t,'bt') || hasWord(t,'ma') || hasWord(t,'fa') || /applied knowledge|business and technology|management accounting|financial accounting/.test(t)) return 'Applied Knowledge';
      if (hasWord(t,'lw') || hasWord(t,'pm') || hasWord(t,'tx') || hasWord(t,'fr') || hasWord(t,'aa') || hasWord(t,'fm') || /applied skills|corporate and business law|taxation/.test(t)) return 'Applied Skills';
      if (/\bsbl\b|\bsbr\b|\bafm\b|\bapm\b|\batx\b|\baaa\b|strategic professional|advanced/.test(t)) return 'Strategic Professional';
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
      return String(name || '').replace(/\s+-\s+Draft$/i, '').replace(/\s+Draft$/i, '').replace(/\s+-\s+Backup$/i, '').replace(/\s+Backup$/i, '').trim();
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
    function courseKey(course, qual, level){
      var t = textKey(course);
      var codes = ['fa1','ma1','fa2','ma2','fbt','fab','fma','ffa','sbl','sbr','afm','apm','atx','aaa','ba1','ba2','ba3','ba4','e1','p1','f1','e2','p2','f2','e3','p3','f3','cma1','cma2','cia1','cia2','cia3','dipifr','certifr','bt','ma','fa','lw','pm','tx','fr','aa','fm'];
      var prefix = (qual + '-' + level).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      var langSuffix = languageKeySuffix(course);
      for (var i = 0; i < codes.length; i++) { if (hasWord(t, codes[i])) return prefix + '-' + codes[i] + langSuffix; }
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
          map[key].label = preferCourseLabel(map[key].label, course.name, course);
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
        populate($('course'), unique(filteredRows().slice().sort(compareCourseRows), function(row){ return row.key; }, function(row){ return row.label; }), ui.coursePlaceholder);
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

  function start(root){
    if (started) return;
    started = true;
    var fallback = readFallback();
    var baseUi = mergeConfig(defaultUi(), fallback.config || {});

    function load(rawCourses, config){
      init(root, rawCourses || [], mergeConfig(baseUi, config));
    }

    fetch(API + (API.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(), { mode: 'cors', cache: 'no-store' })
      .then(function(r){
        if (!r.ok) throw new Error('VLS Course Finder Banner API returned ' + r.status);
        return r.json();
      })
      .then(function(data){
        load(data.courses || [], data.config);
      })
      .catch(function(err){
        if (window.console && console.warn) console.warn('VLS Course Finder Banner:', err.message || err);
        load(fallback.courses || [], fallback.config);
      });
  }

  function boot(){
    var root = getRoot();
    if (!root) {
      attempts += 1;
      if (attempts < 80) setTimeout(boot, 100);
      return;
    }
    start(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 250);
  setTimeout(boot, 1000);
  setTimeout(boot, 3000);
})();
