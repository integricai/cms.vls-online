/** Dashboard 2 body. Header and footer stay in Global Header/Footer. */
const STUDY_PLANNER_URL = 'https://scheduler.vls-online.com';

export function generateSchoolDashboardV2Html(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,600&display=swap" rel="stylesheet" />
<style>
  .vls-school-dash2{
    --navy:#0E2A57; --ink:#15233D; --slate:#3D4A63; --muted:#6B7890;
    --blue:#1E50C8; --blue-strong:#1A45B0; --line:#E4E8F0; --wash:#F6F8FC;
    --sh-sm:0 1px 3px rgba(14,42,87,.06); --sh:0 18px 48px rgba(14,42,87,.13);
    --gutter:28px;
    box-sizing:border-box; margin:0; font-family:Poppins,system-ui,sans-serif; color:var(--ink);
    background:var(--wash); font-size:15.5px; line-height:1.6; -webkit-font-smoothing:antialiased;
  }
  .vls-school-dash2 *,.vls-school-dash2 *::before,.vls-school-dash2 *::after{box-sizing:border-box;}
  .vls-school-dash2 h1,.vls-school-dash2 h2{margin:0;color:var(--navy);font-weight:600;line-height:1.22;letter-spacing:-.012em;}
  .vls-school-dash2 a{color:inherit;text-decoration:none;}
  .vls-school-dash2 .d2-wrap{max-width:1120px;margin:0 auto;padding:0 var(--gutter) 40px;}
  .vls-school-dash2 .d2-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font:inherit;font-size:15px;font-weight:600;padding:13px 22px;border-radius:12px;border:1.5px solid transparent;cursor:pointer;transition:.15s;text-decoration:none;}
  .vls-school-dash2 .d2-btn svg{width:17px;height:17px;}
  .vls-school-dash2 .d2-btn-primary{background:var(--blue);color:#fff;box-shadow:0 5px 16px rgba(30,80,200,.3);}
  .vls-school-dash2 .d2-btn-primary:hover{background:var(--blue-strong);transform:translateY(-1px);}
  .vls-school-dash2 .d2-btn-quiet{background:transparent;color:var(--slate);border-color:var(--line);}
  .vls-school-dash2 .d2-btn-quiet:hover{background:#fff;color:var(--navy);}
  .vls-school-dash2 .d2-welcome{padding:34px 0 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;}
  .vls-school-dash2 .d2-who{display:flex;align-items:center;gap:14px;}
  .vls-school-dash2 .d2-welcome h1{font-size:30px;}
  .vls-school-dash2 .d2-welcome p{color:var(--slate);margin:6px 0 0;font-size:15px;}
  .vls-school-dash2 #vls-dash2-summary a{color:var(--blue);font-weight:600;text-decoration:underline;text-underline-offset:2px;}
  .vls-school-dash2 .d2-avatar{width:46px;height:46px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:600;font-size:16px;flex:none;}
  .vls-school-dash2 .d2-resume{background:linear-gradient(135deg,var(--navy),#1B4484);border-radius:18px;padding:24px 26px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:22px;flex-wrap:wrap;margin:18px 0 22px;}
  .vls-school-dash2 .d2-k{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9FB4DA;}
  .vls-school-dash2 .d2-resume h2{color:#fff;font-size:21px;margin:6px 0 3px;}
  .vls-school-dash2 .d2-ch{color:#C3D2EC;font-size:13.5px;}
  .vls-school-dash2 .d2-bar{height:8px;background:rgba(255,255,255,.17);border-radius:999px;margin-top:14px;max-width:420px;overflow:hidden;}
  .vls-school-dash2 .d2-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3B73F0,#6E9BFF);border-radius:999px;}
  .vls-school-dash2 .d2-resume .d2-btn{background:#fff;color:var(--navy);box-shadow:none;flex:none;}
  .vls-school-dash2 .d2-resume .d2-btn:hover{background:#EAF0FF;transform:none;}
  .vls-school-dash2 .d2-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
  .vls-school-dash2 .d2-tile{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:var(--sh-sm);transition:.15s;display:block;}
  .vls-school-dash2 .d2-tile:hover{border-color:#D6E2FB;transform:translateY(-2px);box-shadow:var(--sh);text-decoration:none;}
  .vls-school-dash2 .d2-tic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff;margin-bottom:13px;}
  .vls-school-dash2 .d2-tic svg{width:21px;height:21px;}
  .vls-school-dash2 .d2-tile b{display:block;font-size:15.5px;color:var(--navy);}
  .vls-school-dash2 .d2-tile span{display:block;font-size:13px;color:var(--muted);margin-top:4px;line-height:1.45;}
  .vls-school-dash2 .d2-go{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--blue);margin-top:11px;}
  .vls-school-dash2 .d2-go svg{width:13px;height:13px;}
  .vls-school-dash2 .d2-help{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 22px;margin-top:22px;flex-wrap:wrap;}
  .vls-school-dash2 .d2-hic{width:40px;height:40px;border-radius:11px;background:#FFF6E9;color:#B4690E;display:grid;place-items:center;flex:none;}
  .vls-school-dash2 .d2-hic svg{width:19px;height:19px;}
  .vls-school-dash2 .d2-help b{display:block;font-size:15px;color:var(--navy);}
  .vls-school-dash2 .d2-help p{margin:2px 0 0;font-size:13.5px;color:var(--muted);}
  .vls-school-dash2 .d2-acts{margin-left:auto;display:flex;gap:9px;flex-wrap:wrap;}
  .vls-school-dash2 .d2-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
  .vls-school-dash2 .d2-off{display:none;}
  .vls-school-dash2 .d2-courses{display:grid;gap:12px;margin:0 0 22px;}
  .vls-school-dash2 .d2-course{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--sh-sm);}
  .vls-school-dash2 .d2-course-top{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}
  .vls-school-dash2 .d2-course b{font-size:15.5px;color:var(--navy);}
  .vls-school-dash2 .d2-course .d2-pct{font-size:13px;font-weight:600;color:var(--blue);flex:none;}
  .vls-school-dash2 .d2-pbar{height:8px;background:#F2F6FF;border-radius:999px;margin-top:10px;overflow:hidden;}
  .vls-school-dash2 .d2-pbar i{display:block;height:100%;width:0;background:var(--blue);border-radius:999px;}
  @media(max-width:980px){
    .vls-school-dash2 .d2-tiles{grid-template-columns:repeat(2,1fr);}
  }
  @media(max-width:620px){
    .vls-school-dash2{--gutter:18px;}
    .vls-school-dash2 .d2-tiles{grid-template-columns:1fr;}
    .vls-school-dash2 .d2-resume{flex-direction:column;align-items:flex-start;}
    .vls-school-dash2 .d2-acts{margin-left:0;width:100%;}
  }
  @media(max-width:400px){
    .vls-school-dash2 .d2-welcome h1{font-size:24px;}
  }
</style>
<div class="vls-school-dash2">
  <div class="d2-wrap">
    <div class="d2-welcome">
      <div class="d2-who">
        <span class="d2-avatar" id="vls-dash2-initials"></span>
        <div><h1 id="vls-dash2-hello">Welcome back</h1><p id="vls-dash2-summary">You don't have a course yet. Visit the <a href="https://vls-online.com" target="_blank" rel="noopener">VLS website</a> and enrol in a course first.</p></div>
      </div>
      <button class="d2-btn d2-btn-quiet" type="button" id="vls-school-dash2-logout">Log out</button>
    </div>
    <div class="d2-resume d2-off" id="vls-dash2-resume">
      <div>
        <div class="d2-k">Continue where you left off</div>
        <h2 id="vls-dash2-resume-name">Your course</h2>
        <div class="d2-ch" id="vls-dash2-resume-meta"></div>
        <div class="d2-bar"><i id="vls-dash2-resume-bar"></i></div>
      </div>
      <a class="d2-btn d2-btn-primary" href="/mycourses">Continue</a>
    </div>
    <div class="d2-courses" id="vls-dash2-courses"></div>
    <div class="d2-tiles">
      <a class="d2-tile" href="/mycourses">
        <span class="d2-tic" style="background:linear-gradient(140deg,#15336B,#2E6FEC)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z"/><path d="M8 7h7M8 11h7"/></svg></span>
        <b>My Courses</b><span>All the courses you're enrolled in.</span>
        <span class="d2-go">Open <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
      </a>
      <a class="d2-tile" href="${STUDY_PLANNER_URL}" target="_blank" rel="noopener">
        <span class="d2-tic" style="background:linear-gradient(140deg,#0F6B3F,#21A05C)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg></span>
        <b>Study Planner</b><span>Your day-by-day schedule to exam day.</span>
        <span class="d2-go">Open <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
        <span class="d2-sr">(opens in a new tab)</span>
      </a>
      <a class="d2-tile" href="/account">
        <span class="d2-tic" style="background:linear-gradient(140deg,#3B2A7A,#6B5BE0)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span>
        <b>My Account</b><span>Profile, password, purchases and invoices.</span>
        <span class="d2-go">Open <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
      </a>
      <a class="d2-tile" href="https://vls-online.com" target="_blank" rel="noopener">
        <span class="d2-tic" style="background:linear-gradient(140deg,#8A4F08,#D08A1E)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></span>
        <b>VLS Website</b><span>Browse more courses, dates and fees.</span>
        <span class="d2-go">Visit <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
        <span class="d2-sr">(opens in a new tab)</span>
      </a>
    </div>
    <div class="d2-help">
      <span class="d2-hic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01"/></svg></span>
      <div><b>Need a hand?</b><p>Something not working, or a question for your tutor?</p></div>
      <div class="d2-acts">
        <a class="d2-btn d2-btn-quiet" href="https://vls-online.com/report-an-issue" target="_blank" rel="noopener">Report an issue</a>
        <a class="d2-btn d2-btn-quiet" href="mailto:office@vls-online.com">Email support</a>
      </div>
    </div>
  </div>
</div>
<script>
(function(){
  var API='https://api.cms.vls-online.com/api/public/school-dashboard';
  var logout=document.getElementById('vls-school-dash2-logout');
  if(logout){
    logout.addEventListener('click', function(event){
      event.preventDefault();
      var form=document.getElementById('logout-form');
      if(form) form.submit();
      else location.href='/logout';
    });
  }
  function text(id, value){ var node=document.getElementById(id); if(node) node.textContent=value; }
  function showEnrol(){
    var node=document.getElementById('vls-dash2-summary');
    if(!node) return;
    node.textContent='';
    node.appendChild(document.createTextNode("You don't have a course yet. Visit the "));
    var link=document.createElement('a');
    link.href='https://vls-online.com';
    link.target='_blank';
    link.rel='noopener';
    link.textContent='VLS website';
    node.appendChild(link);
    node.appendChild(document.createTextNode(' and enrol in a course first.'));
  }
  function initials(name){
    var parts=String(name||'').trim().split(/\\s+/).filter(Boolean);
    if(!parts.length) return '';
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0].charAt(0)+parts[1].charAt(0)).toUpperCase();
  }
  function emailFrom(html){
    var doc=new DOMParser().parseFromString(html,'text/html');
    var input=doc.querySelector('input[type="email"],input[name="email"],input[name="user_email"]');
    var value=input&&input.value?String(input.value).trim():'';
    if(value.indexOf('@')>0) return value;
    var match=html.match(/"email"\\s*:\\s*"([^"]+@[^"]+)"/i);
    return match?match[1].trim():'';
  }
  function paint(data){
    var courses=Array.isArray(data.courses)?data.courses:[];
    var name=String(data.firstName||'').trim();
    text('vls-dash2-hello', name?'Welcome back, '+name:'Welcome back');
    text('vls-dash2-initials', initials(name));
    var list=document.getElementById('vls-dash2-courses');
    if(list) list.textContent='';
    if(!courses.length){
      showEnrol();
      return;
    }
    var counted=courses.filter(function(course){ return typeof course.percent==='number'; }).length;
    text('vls-dash2-summary', courses.length===1
      ? (typeof courses[0].percent==='number' ? courses[0].percent+'% through '+courses[0].name+'.' : courses[0].name+'.')
      : courses.length+' courses'+(counted?'. Each one shows how much you have finished.':'.'));
    var resume=document.getElementById('vls-dash2-resume');
    var lead=courses[0];
    if(resume && lead){
      resume.classList.remove('d2-off');
      text('vls-dash2-resume-name', lead.name);
      text('vls-dash2-resume-meta', typeof lead.percent==='number' ? lead.percent+'% complete' : 'Enrolled');
      var bar=document.getElementById('vls-dash2-resume-bar');
      if(bar) bar.style.width=(typeof lead.percent==='number'?lead.percent:0)+'%';
    }
    courses.forEach(function(course){
      if(!list) return;
      var card=document.createElement('div');
      card.className='d2-course';
      var top=document.createElement('div');
      top.className='d2-course-top';
      var title=document.createElement('b');
      title.textContent=course.name||'Course';
      var pct=document.createElement('span');
      pct.className='d2-pct';
      pct.textContent=typeof course.percent==='number'?course.percent+'%':'Enrolled';
      top.appendChild(title);
      top.appendChild(pct);
      card.appendChild(top);
      if(typeof course.percent==='number'){
        var track=document.createElement('div');
        track.className='d2-pbar';
        var fill=document.createElement('i');
        fill.style.width=course.percent+'%';
        track.appendChild(fill);
        card.appendChild(track);
      }
      list.appendChild(card);
    });
  }
  if(!window.fetch || !window.DOMParser) return;
  fetch('/account',{credentials:'same-origin'}).then(function(response){
    if(!response.ok || /\\/login/i.test(response.url)) return '';
    return response.text();
  }).then(function(html){
    var email=html?emailFrom(html):'';
    if(!email) return null;
    return fetch(API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email})
    });
  }).then(function(response){
    if(!response || !response.ok) return null;
    return response.json();
  }).then(function(payload){
    if(payload && payload.found) paint(payload);
  }).catch(function(){});
})();
</script>`;
}
