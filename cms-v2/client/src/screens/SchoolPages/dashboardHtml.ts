/** Paste-ready school dashboard for the Zenler logged-in homepage. */
export function generateSchoolDashboardHtml(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&display=swap" rel="stylesheet" />
<style>
  .vls-school-dash{
    --navy:#0E2A57; --ink:#15233D; --slate:#3D4A63; --prose:#26324B;
    --blue:#1E50C8; --blue-strong:#1A45B0; --blue-50:#F2F6FF; --blue-100:#E7EEFD; --blue-200:#D6E2FB;
    --green:#17824D; --amber:#B4690E; --amber-50:#FFF6E9; --amber-100:#FBE7C4;
    --line:#E7EAF1; --line-soft:#EEF1F7; --wash:#F6F8FC;
    --shadow-sm:0 1px 3px rgba(14,42,87,.06); --shadow:0 12px 36px rgba(14,42,87,.10);
    --gutter:40px;
    margin:0; font-family:Poppins,system-ui,sans-serif; color:var(--ink); background:var(--wash);
    font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased;
  }
  .vls-school-dash h1,.vls-school-dash h2,.vls-school-dash h3,.vls-school-dash h4{margin:0;color:var(--navy);font-weight:600;line-height:1.22;letter-spacing:-.01em;}
  .vls-school-dash a{color:inherit;text-decoration:none;}
  .vls-school-dash .wrap{max-width:1180px;margin:0 auto;padding:0 var(--gutter);}
  .vls-school-dash .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:14.5px;font-weight:600;padding:11px 20px;border-radius:11px;border:1px solid transparent;cursor:pointer;transition:.15s;}
  .vls-school-dash .btn-primary{background:var(--blue);color:#fff;box-shadow:0 4px 14px rgba(30,80,200,.28);}
  .vls-school-dash .btn-primary:hover{background:var(--blue-strong);}
  .vls-school-dash .btn-ghost{background:#fff;color:var(--navy);border-color:var(--line);}
  .vls-school-dash .btn-ghost:hover{border-color:var(--blue-200);background:var(--blue-50);}
  .vls-school-dash .btn svg{width:16px;height:16px;}
  .vls-school-dash .appbar{position:sticky;top:0;z-index:80;background:#fff;border-bottom:1px solid var(--line);}
  .vls-school-dash .appbar .in{display:flex;align-items:center;gap:22px;height:72px;}
  .vls-school-dash .brand{display:flex;align-items:center;gap:12px;flex:none;}
  .vls-school-dash .brand-mark{width:44px;height:44px;border-radius:11px;background:var(--blue);display:grid;place-items:center;color:#fff;font-weight:700;font-size:25px;flex:none;}
  .vls-school-dash .brand-name{display:block;font-weight:600;font-size:16.5px;color:var(--navy);line-height:1.1;white-space:nowrap;}
  .vls-school-dash .brand-sub{display:block;font-size:8.5px;font-weight:600;letter-spacing:.15em;color:var(--slate);text-transform:uppercase;margin-top:3px;white-space:nowrap;}
  .vls-school-dash .appnav{display:flex;gap:4px;margin-left:12px;}
  .vls-school-dash .appnav a{font-size:14.5px;font-weight:500;color:var(--slate);padding:8px 14px;border-radius:9px;}
  .vls-school-dash .appnav a:hover,.vls-school-dash .appnav a.on{background:var(--blue-50);color:var(--navy);}
  .vls-school-dash .appnav a.on{font-weight:600;}
  .vls-school-dash .right{margin-left:auto;display:flex;align-items:center;gap:12px;}
  .vls-school-dash .to-site{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--navy);background:var(--blue-50);border:1px solid var(--blue-100);padding:9px 15px;border-radius:10px;white-space:nowrap;}
  .vls-school-dash .to-site:hover{background:var(--blue-100);border-color:var(--blue-200);}
  .vls-school-dash .to-site svg{width:14px;height:14px;color:var(--blue);}
  .vls-school-dash .avatar-wrap{position:relative;}
  .vls-school-dash .avatar{width:42px;height:42px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:600;font-size:15px;cursor:pointer;border:2px solid transparent;}
  .vls-school-dash .avatar:hover{border-color:var(--blue-200);}
  .vls-school-dash .menu{position:absolute;right:0;top:52px;width:238px;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:7px;display:none;}
  .vls-school-dash .menu.open{display:block;}
  .vls-school-dash .menu .who{padding:11px 13px 12px;border-bottom:1px solid var(--line-soft);margin-bottom:6px;}
  .vls-school-dash .menu .who b{display:block;font-size:14.5px;color:var(--navy);}
  .vls-school-dash .menu .who span{font-size:12.5px;color:var(--slate);}
  .vls-school-dash .menu a{display:flex;align-items:center;gap:11px;padding:9px 13px;border-radius:9px;font-size:14px;color:var(--prose);}
  .vls-school-dash .menu a:hover{background:var(--blue-50);color:var(--navy);}
  .vls-school-dash .menu a svg{width:16px;height:16px;color:var(--slate);}
  .vls-school-dash .menu .sep{height:1px;background:var(--line-soft);margin:6px 0;}
  .vls-school-dash .menu a.out{color:#C0392B;}
  .vls-school-dash .menu a.out svg{color:#C0392B;}
  .vls-school-dash .dash{padding:30px 0 60px;}
  .vls-school-dash .hello{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px;}
  .vls-school-dash .hello h1{font-size:30px;}
  .vls-school-dash .hello p{color:var(--slate);margin:6px 0 0;font-size:15px;}
  .vls-school-dash .resume{background:linear-gradient(135deg,var(--navy),#1B4484);border-radius:18px;padding:28px 30px;color:#fff;display:grid;grid-template-columns:1fr auto;gap:26px;align-items:center;margin-bottom:26px;box-shadow:var(--shadow);}
  .vls-school-dash .resume .k{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#9FB4DA;}
  .vls-school-dash .resume h2{color:#fff;font-size:23px;margin:7px 0 4px;}
  .vls-school-dash .resume .ch{color:#C3D2EC;font-size:14.5px;}
  .vls-school-dash .rbar{height:9px;background:rgba(255,255,255,.16);border-radius:999px;margin-top:16px;max-width:460px;overflow:hidden;}
  .vls-school-dash .rbar i{display:block;height:100%;width:62%;background:linear-gradient(90deg,#3B73F0,#6E9BFF);border-radius:999px;}
  .vls-school-dash .rmeta{font-size:12.5px;color:#9FB4DA;margin-top:9px;}
  .vls-school-dash .resume .btn-primary{background:#fff;color:var(--navy);box-shadow:none;padding:13px 24px;font-size:15px;}
  .vls-school-dash .resume .btn-primary:hover{background:#EAF0FF;}
  .vls-school-dash .sec-head{display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px;gap:16px;flex-wrap:wrap;}
  .vls-school-dash .sec-head h2{font-size:21px;}
  .vls-school-dash .sec-head a{font-size:14px;font-weight:600;color:var(--blue);}
  .vls-school-dash .courses{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:34px;}
  .vls-school-dash .course{background:#fff;border:1px solid var(--line);border-radius:15px;overflow:hidden;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;}
  .vls-school-dash .course:hover{border-color:var(--blue-200);box-shadow:var(--shadow);}
  .vls-school-dash .course .top{height:86px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;}
  .vls-school-dash .course .top.a{background:linear-gradient(135deg,#1E50C8,#3B73F0);}
  .vls-school-dash .course .top.b{background:linear-gradient(135deg,#0E2A57,#235296);}
  .vls-school-dash .course .top.c{background:linear-gradient(135deg,#17824D,#2AA76A);}
  .vls-school-dash .course .code{font-size:25px;font-weight:700;color:#fff;letter-spacing:-.02em;}
  .vls-school-dash .course .badge{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.26);color:#fff;font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px;}
  .vls-school-dash .course .body{padding:16px 18px 18px;flex:1;display:flex;flex-direction:column;}
  .vls-school-dash .course h3{font-size:15.5px;line-height:1.35;}
  .vls-school-dash .course .sess{font-size:12.5px;color:var(--slate);margin-top:5px;}
  .vls-school-dash .pbar{height:7px;background:var(--blue-50);border:1px solid var(--blue-100);border-radius:999px;margin:14px 0 7px;overflow:hidden;}
  .vls-school-dash .pbar i{display:block;height:100%;background:var(--blue);border-radius:999px;}
  .vls-school-dash .pct{display:flex;justify-content:space-between;font-size:12px;color:var(--slate);}
  .vls-school-dash .pct b{color:var(--navy);}
  .vls-school-dash .course .go{margin-top:14px;width:100%;}
  .vls-school-dash .lower{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:34px;}
  .vls-school-dash .panel{background:#fff;border:1px solid var(--line);border-radius:15px;padding:22px 24px;box-shadow:var(--shadow-sm);}
  .vls-school-dash .panel h3{font-size:17px;margin-bottom:14px;}
  .vls-school-dash .kv{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line-soft);font-size:14px;}
  .vls-school-dash .kv:last-of-type{border-bottom:0;}
  .vls-school-dash .kv span{color:var(--slate);}
  .vls-school-dash .kv b{color:var(--navy);font-weight:500;text-align:right;}
  .vls-school-dash .help-row{display:flex;gap:11px;margin-top:14px;flex-wrap:wrap;}
  .vls-school-dash .crosssell{background:linear-gradient(135deg,var(--blue-50),#E7EEFD);border:1px solid var(--blue-100);border-radius:18px;padding:30px 32px;}
  .vls-school-dash .cs-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:20px;}
  .vls-school-dash .crosssell h2{font-size:22px;}
  .vls-school-dash .crosssell p{color:var(--prose);font-size:15px;margin:8px 0 0;max-width:520px;}
  .vls-school-dash .cs-links{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  .vls-school-dash .cs{background:#fff;border:1px solid var(--blue-100);border-radius:12px;padding:15px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
  .vls-school-dash .cs:hover{border-color:var(--blue);}
  .vls-school-dash .cs b{font-size:14.5px;color:var(--navy);font-weight:600;display:block;}
  .vls-school-dash .cs span{font-size:12px;color:var(--slate);}
  .vls-school-dash .cs svg{width:16px;height:16px;color:var(--blue);flex:none;}
  .vls-school-dash .foot{background:var(--navy);color:#B9C6E0;padding:40px 0 26px;margin-top:50px;}
  .vls-school-dash .f-top{display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap;padding-bottom:26px;border-bottom:1px solid rgba(255,255,255,.1);}
  .vls-school-dash .foot .brand-mark{background:#fff;color:var(--navy);}
  .vls-school-dash .foot .brand-name{color:#fff;}
  .vls-school-dash .foot .brand-sub{color:#8A9EC6;}
  .vls-school-dash .f-cols{display:flex;gap:54px;flex-wrap:wrap;}
  .vls-school-dash .f-col h4{color:#fff;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;}
  .vls-school-dash .f-col a{display:block;font-size:13.5px;color:#B9C6E0;margin-bottom:8px;}
  .vls-school-dash .f-col a:hover{color:#fff;}
  .vls-school-dash .f-bot{padding-top:18px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12.5px;}
  .vls-school-dash .f-bot a{color:#B9C6E0;margin-left:18px;}
  @media(max-width:1040px){
    .vls-school-dash .courses{grid-template-columns:repeat(2,1fr);}
    .vls-school-dash .cs-links{grid-template-columns:repeat(2,1fr);}
  }
  @media(max-width:860px){.vls-school-dash .appnav{display:none;}}
  @media(max-width:760px){
    .vls-school-dash{--gutter:22px;}
    .vls-school-dash .courses,.vls-school-dash .lower,.vls-school-dash .resume{grid-template-columns:1fr;}
    .vls-school-dash .hello h1{font-size:25px;}
    .vls-school-dash .brand-sub,.vls-school-dash .to-site span{display:none;}
    .vls-school-dash .to-site{padding:9px 11px;}
  }
</style>
<div class="vls-school-dash">
  <header class="appbar">
    <div class="wrap in">
      <a class="brand" href="https://vls-online.com">
        <span class="brand-mark">V</span>
        <span><span class="brand-name">Vertex Learning Solutions</span><span class="brand-sub">Changing Behaviours Through Education</span></span>
      </a>
      <nav class="appnav">
        <a class="on" href="/">Dashboard</a>
        <a href="/mycourses">My courses</a>
        <a href="/account">Account</a>
      </nav>
      <div class="right">
        <a class="to-site" href="https://vls-online.com">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
          <span>Main site</span>
        </a>
        <div class="avatar-wrap">
          <div class="avatar" id="vls-dash-avatar" role="button" tabindex="0">SA</div>
          <div class="menu" id="vls-dash-menu">
            <div class="who"><b>Sara Ahmed</b><span>sara@example.com</span></div>
            <a href="/account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> My account</a>
            <a href="https://vls-online.com/report-an-issue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg> Report an issue</a>
            <div class="sep"></div>
            <a href="https://vls-online.com"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg> Go to main site</a>
            <div class="sep"></div>
            <a class="out" href="/logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg> Log out</a>
          </div>
        </div>
      </div>
    </div>
  </header>
  <main class="dash">
    <div class="wrap">
      <div class="hello">
        <div>
          <h1>Welcome back, Sara</h1>
          <p>You're 62% through your current paper. Pick up where you left off.</p>
        </div>
      </div>
      <section class="resume">
        <div>
          <div class="k">Continue where you left off</div>
          <h2>ACCA SBR — Strategic Business Reporting</h2>
          <div class="ch">December 2026 sitting</div>
          <div class="rbar"><i></i></div>
          <div class="rmeta">62% complete · last studied 2 days ago</div>
        </div>
        <a class="btn btn-primary" href="/mycourses">Continue</a>
      </section>
      <div class="sec-head">
        <h2>My courses</h2>
        <a href="/mycourses">View all courses →</a>
      </div>
      <div class="courses">
        <article class="course">
          <div class="top a"><span class="code">SBR</span><span class="badge">In progress</span></div>
          <div class="body">
            <h3>Strategic Business Reporting</h3>
            <div class="sess">December 2026 sitting</div>
            <div class="pbar"><i style="width:62%"></i></div>
            <div class="pct"><span>Progress</span><b>62%</b></div>
            <a class="btn btn-primary go" href="/mycourses">Continue</a>
          </div>
        </article>
        <article class="course">
          <div class="top b"><span class="code">AFM</span><span class="badge">In progress</span></div>
          <div class="body">
            <h3>Advanced Financial Management</h3>
            <div class="sess">March 2027 sitting</div>
            <div class="pbar"><i style="width:24%"></i></div>
            <div class="pct"><span>Progress</span><b>24%</b></div>
            <a class="btn btn-ghost go" href="/mycourses">Continue</a>
          </div>
        </article>
        <article class="course">
          <div class="top c"><span class="code">FR</span><span class="badge">Completed</span></div>
          <div class="body">
            <h3>Financial Reporting</h3>
            <div class="sess">Passed · June 2026</div>
            <div class="pbar"><i style="width:100%;background:#17824D"></i></div>
            <div class="pct"><span>Progress</span><b>100%</b></div>
            <a class="btn btn-ghost go" href="/mycourses">Open course</a>
          </div>
        </article>
      </div>
      <div class="lower">
        <div class="panel">
          <h3>Account</h3>
          <div class="kv"><span>Name</span><b>Sara Ahmed</b></div>
          <div class="kv"><span>Email</span><b>sara@example.com</b></div>
          <div class="kv"><span>Access</span><b>Annual · renews 14 Jun 2027</b></div>
          <div class="kv"><span>Last payment</span><b>£149.00 · 14 Jun 2026</b></div>
          <div class="help-row">
            <a class="btn btn-ghost" href="/account">Manage account</a>
          </div>
        </div>
        <div class="panel">
          <h3>Need a hand?</h3>
          <p style="color:var(--prose);font-size:14.5px;margin:0 0 4px">Can't open a course, or something not working as expected? Tell us and the support team will come back to you.</p>
          <div class="kv" style="margin-top:12px"><span>Support email</span><b>office@vls-online.com</b></div>
          <div class="kv"><span>WhatsApp</span><b>+44 7446 426261</b></div>
          <div class="help-row">
            <a class="btn btn-primary" href="https://vls-online.com/report-an-issue">Report an issue</a>
            <a class="btn btn-ghost" href="https://vls-online.com/blog">Study tips &amp; blog</a>
          </div>
        </div>
      </div>
      <section class="crosssell">
        <div class="cs-top">
          <div>
            <h2>Looking for your next paper?</h2>
            <p>Browse the full range of ACCA, CIMA, CMA and CIA courses, exam dates and study resources on the main Vertex site.</p>
          </div>
          <a class="btn btn-primary" href="https://vls-online.com/courses">Explore all courses
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </a>
        </div>
        <div class="cs-links">
          <a class="cs" href="https://vls-online.com/accacourses"><span><b>ACCA</b><span>Knowledge → Strategic</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
          <a class="cs" href="https://vls-online.com/cimacourses"><span><b>CIMA</b><span>Operational → Strategic</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
          <a class="cs" href="https://vls-online.com/cmacourses"><span><b>CMA (USA)</b><span>Part 1 &amp; Part 2</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
          <a class="cs" href="https://vls-online.com/accadates"><span><b>Exam dates</b><span>Sittings &amp; fees</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
        </div>
      </section>
    </div>
  </main>
  <footer class="foot">
    <div class="wrap">
      <div class="f-top">
        <a class="brand" href="https://vls-online.com">
          <span class="brand-mark">V</span>
          <span><span class="brand-name">Vertex Learning Solutions</span><span class="brand-sub">Changing Behaviours Through Education</span></span>
        </a>
        <div class="f-cols">
          <div class="f-col"><h4>Study</h4><a href="/mycourses">My courses</a><a href="/account">My account</a></div>
          <div class="f-col"><h4>Main site</h4><a href="https://vls-online.com">vls-online.com</a><a href="https://vls-online.com/courses">All courses</a><a href="https://vls-online.com/blog">Blog</a></div>
          <div class="f-col"><h4>Support</h4><a href="https://vls-online.com/report-an-issue">Report an issue</a><a href="mailto:office@vls-online.com">office@vls-online.com</a><a href="https://vls-online.com/contact">Contact</a></div>
        </div>
      </div>
      <div class="f-bot">
        <span>© 2026 Vertex Learning Solutions Ltd · Registered in England &amp; Wales</span>
        <span><a href="https://vls-online.com/terms">Terms</a><a href="https://vls-online.com/privacy">Privacy</a><a href="https://vls-online.com/cookies">Cookies</a></span>
      </div>
    </div>
  </footer>
</div>
<script>
(function(){
  var avatar=document.getElementById('vls-dash-avatar');
  var menu=document.getElementById('vls-dash-menu');
  if(!avatar||!menu)return;
  avatar.addEventListener('click',function(event){event.stopPropagation();menu.classList.toggle('open');});
  document.addEventListener('click',function(){menu.classList.remove('open');});
  menu.addEventListener('click',function(event){event.stopPropagation();});
})();
</script>`;
}
