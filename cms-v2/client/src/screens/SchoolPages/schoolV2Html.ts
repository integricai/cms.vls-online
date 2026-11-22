/** School V2 body. Header and footer stay in Global Header/Footer. */
export function generateSchoolV2Html(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,600&display=swap" rel="stylesheet" />
<style>
  .vls-school-v2{
    --navy:#0E2A57; --ink:#15233D; --slate:#3D4A63; --prose:#26324B; --muted:#6B7890;
    --blue:#1E50C8; --blue-strong:#1A45B0; --blue-50:#F2F6FF; --blue-100:#E7EEFD; --blue-200:#D6E2FB;
    --green:#17824D; --line:#E4E8F0; --line-soft:#EEF1F7; --wash:#F6F8FC;
    --sh:0 18px 48px rgba(14,42,87,.13); --gutter:28px;
    box-sizing:border-box; margin:0; font-family:Poppins,system-ui,sans-serif; color:var(--ink);
    background:var(--wash); font-size:15.5px; line-height:1.6; -webkit-font-smoothing:antialiased;
  }
  .vls-school-v2 *,.vls-school-v2 *::before,.vls-school-v2 *::after{box-sizing:border-box;}
  .vls-school-v2 h1,.vls-school-v2 h2,.vls-school-v2 h3{margin:0;color:var(--navy);font-weight:600;line-height:1.22;letter-spacing:-.012em;}
  .vls-school-v2 a{color:var(--blue);text-decoration:none;}
  .vls-school-v2 .sv2-wrap{max-width:1120px;margin:0 auto;padding:0 var(--gutter);}
  .vls-school-v2 .sv2-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font:inherit;font-size:15px;font-weight:600;padding:13px 22px;border-radius:12px;border:1.5px solid transparent;cursor:pointer;transition:.15s;text-decoration:none;}
  .vls-school-v2 .sv2-btn svg{width:17px;height:17px;}
  .vls-school-v2 .sv2-btn-primary{background:var(--blue);color:#fff;box-shadow:0 5px 16px rgba(30,80,200,.3);}
  .vls-school-v2 .sv2-btn-primary:hover{background:var(--blue-strong);transform:translateY(-1px);}
  .vls-school-v2 .sv2-btn-outline{background:#fff;color:var(--navy);border-color:var(--blue-200);}
  .vls-school-v2 .sv2-btn-outline:hover{background:var(--blue-50);border-color:var(--blue);}
  .vls-school-v2 .sv2-btn-quiet{background:transparent;color:var(--slate);border-color:var(--line);}
  .vls-school-v2 .sv2-btn-quiet:hover{background:#fff;color:var(--navy);}
  .vls-school-v2 .sv2-btn-block{width:100%;}
  .vls-school-v2 .sv2-auth{display:grid;grid-template-columns:1fr 440px;gap:46px;align-items:center;padding:44px 0 60px;}
  .vls-school-v2 .sv2-pitch h1{font-size:clamp(28px,3.8vw,40px);}
  .vls-school-v2 .sv2-pitch h1 em{color:var(--blue);font-style:italic;}
  .vls-school-v2 .sv2-lead{font-size:17px;color:var(--prose);margin:15px 0 0;max-width:500px;}
  .vls-school-v2 .sv2-feats{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:14px;max-width:480px;}
  .vls-school-v2 .sv2-feats li{display:flex;gap:14px;align-items:flex-start;}
  .vls-school-v2 .sv2-fic{width:40px;height:40px;border-radius:11px;flex:none;display:grid;place-items:center;color:#fff;}
  .vls-school-v2 .sv2-fic svg{width:19px;height:19px;}
  .vls-school-v2 .sv2-fic.a{background:linear-gradient(140deg,#15336B,#2E6FEC);}
  .vls-school-v2 .sv2-fic.b{background:linear-gradient(140deg,#0F6B3F,#21A05C);}
  .vls-school-v2 .sv2-fic.c{background:linear-gradient(140deg,#3B2A7A,#6B5BE0);}
  .vls-school-v2 .sv2-fic.d{background:linear-gradient(140deg,#8A4F08,#D08A1E);}
  .vls-school-v2 .sv2-feats b{display:block;font-size:15px;color:var(--navy);}
  .vls-school-v2 .sv2-feats span span{font-size:13.5px;color:var(--muted);line-height:1.5;}
  .vls-school-v2 .sv2-card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--sh);overflow:hidden;}
  .vls-school-v2 .sv2-tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--wash);border-bottom:1px solid var(--line);}
  .vls-school-v2 .sv2-tab{font:inherit;font-size:14.5px;font-weight:600;color:var(--muted);background:transparent;border:0;padding:15px 10px;cursor:pointer;position:relative;transition:.14s;}
  .vls-school-v2 .sv2-tab:hover{color:var(--navy);}
  .vls-school-v2 .sv2-tab.on{background:#fff;color:var(--navy);}
  .vls-school-v2 .sv2-tab.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:var(--blue);}
  .vls-school-v2 .sv2-body{padding:26px 26px 24px;}
  .vls-school-v2 .sv2-pane{display:none;}
  .vls-school-v2 .sv2-pane.on{display:block;}
  .vls-school-v2 .sv2-box{border:1px solid var(--line);border-radius:15px;padding:22px 20px;background:linear-gradient(170deg,#fff,var(--wash));}
  .vls-school-v2 .sv2-ic{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;color:#fff;margin-bottom:14px;}
  .vls-school-v2 .sv2-ic svg{width:24px;height:24px;}
  .vls-school-v2 .sv2-ic.in{background:linear-gradient(140deg,#15336B,#2E6FEC);box-shadow:0 6px 18px rgba(30,80,200,.3);}
  .vls-school-v2 .sv2-ic.reg{background:linear-gradient(140deg,#0F6B3F,#21A05C);box-shadow:0 6px 18px rgba(23,130,77,.3);}
  .vls-school-v2 .sv2-box h3{font-size:18px;}
  .vls-school-v2 .sv2-box>p{font-size:13.5px;color:var(--prose);margin:7px 0 0;line-height:1.55;}
  .vls-school-v2 .sv2-pts{list-style:none;margin:16px 0 18px;padding:0;display:grid;gap:9px;}
  .vls-school-v2 .sv2-pts li{display:flex;gap:9px;font-size:13px;color:var(--prose);line-height:1.45;}
  .vls-school-v2 .sv2-pts svg{width:16px;height:16px;color:var(--green);flex:none;margin-top:2px;}
  .vls-school-v2 .sv2-ext{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);margin-top:11px;justify-content:center;width:100%;}
  .vls-school-v2 .sv2-ext svg{width:12px;height:12px;flex:none;}
  .vls-school-v2 .sv2-note{display:flex;gap:10px;background:var(--blue-50);border:1px solid var(--blue-100);border-radius:11px;padding:11px 13px;margin:14px 0 0;}
  .vls-school-v2 .sv2-note svg{width:16px;height:16px;color:var(--blue);flex:none;margin-top:2px;}
  .vls-school-v2 .sv2-note p{margin:0;font-size:12.5px;color:var(--prose);line-height:1.5;}
  .vls-school-v2 .sv2-foot{text-align:center;font-size:13px;color:var(--muted);margin-top:16px;padding-top:16px;border-top:1px solid var(--line-soft);}
  .vls-school-v2 .sv2-div{display:flex;align-items:center;gap:13px;margin:20px 0 16px;color:var(--muted);font-size:11.5px;font-weight:600;letter-spacing:.08em;}
  .vls-school-v2 .sv2-div::before,.vls-school-v2 .sv2-div::after{content:"";flex:1;height:1px;background:var(--line);}
  .vls-school-v2 .sv2-help{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 22px;margin:0 0 40px;flex-wrap:wrap;}
  .vls-school-v2 .sv2-hic{width:40px;height:40px;border-radius:11px;background:#FFF6E9;color:#B4690E;display:grid;place-items:center;flex:none;}
  .vls-school-v2 .sv2-hic svg{width:19px;height:19px;}
  .vls-school-v2 .sv2-help b{display:block;font-size:15px;color:var(--navy);}
  .vls-school-v2 .sv2-help p{margin:2px 0 0;font-size:13.5px;color:var(--muted);}
  .vls-school-v2 .sv2-acts{margin-left:auto;display:flex;gap:9px;flex-wrap:wrap;}
  .vls-school-v2 .sv2-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
  @media(max-width:980px){
    .vls-school-v2 .sv2-auth{grid-template-columns:1fr;gap:30px;padding:30px 0 50px;}
    .vls-school-v2 .sv2-pitch{order:2;}
    .vls-school-v2 .sv2-card{order:1;max-width:460px;margin:0 auto;width:100%;}
  }
  @media(max-width:620px){
    .vls-school-v2{--gutter:18px;}
    .vls-school-v2 .sv2-acts{margin-left:0;width:100%;}
  }
</style>
<div class="vls-school-v2">
  <div class="sv2-wrap sv2-auth">
    <div class="sv2-pitch">
      <h1>Your courses, <em>all in one place.</em></h1>
      <p class="sv2-lead">Sign in to pick up where you left off — lessons, notes, quizzes and mock exams, with your progress tracked as you go.</p>
      <ul class="sv2-feats">
        <li>
          <span class="sv2-fic a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10 8 6 4-6 4V8Z"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg></span>
          <span><b>Carry on where you stopped</b><span>Every lesson remembers your place, on any device.</span></span>
        </li>
        <li>
          <span class="sv2-fic b"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 3 4-6"/></svg></span>
          <span><b>See your progress</b><span>Know exactly how much of each paper is left before your sitting.</span></span>
        </li>
        <li>
          <span class="sv2-fic c"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg></span>
          <span><b>Plan your study</b><span>Build a day-by-day schedule that finishes before exam day.</span></span>
        </li>
        <li>
          <span class="sv2-fic d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg></span>
          <span><b>Ask your tutor</b><span>Support throughout your studies, not just a video library.</span></span>
        </li>
      </ul>
    </div>
    <div class="sv2-card">
      <div class="sv2-tabs">
        <button class="sv2-tab on" type="button" data-vls-tab="signin">Sign in</button>
        <button class="sv2-tab" type="button" data-vls-tab="register">Register</button>
      </div>
      <div class="sv2-body">
        <div class="sv2-pane on" data-vls-pane="signin">
          <div class="sv2-box">
            <span class="sv2-ic in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>
            </span>
            <h3>Sign in to your school</h3>
            <p>Your courses, lessons and progress are waiting. You'll sign in on the Vertex school itself.</p>
            <ul class="sv2-pts">
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg><span>Use the email address you enrolled with</span></li>
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg><span>Lands you straight on your dashboard</span></li>
            </ul>
            <a class="sv2-btn sv2-btn-primary sv2-btn-block" href="/login">
              Continue to sign in
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <span class="sv2-ext">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              Secure sign-in on the Vertex school
            </span>
          </div>
          <div class="sv2-foot">
            <a href="/password/reset">Forgot your password?</a> &nbsp;·&nbsp;
            New here? <a href="#register" data-vls-tab="register">Register</a>
          </div>
        </div>
        <div class="sv2-pane" data-vls-pane="register">
          <div class="sv2-box">
            <span class="sv2-ic reg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 12-4.9M18 13v6M15 16h6"/></svg>
            </span>
            <h3>Create your account</h3>
            <p>Bought a course already? Set up your login to unlock it.</p>
            <div class="sv2-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              <p>Register with the <strong>same email you paid with</strong> — that's how your courses are matched to you.</p>
            </div>
            <ul class="sv2-pts" style="margin-top:14px">
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg><span>Takes about a minute</span></li>
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg><span>Unlocks every course on your account</span></li>
            </ul>
            <a class="sv2-btn sv2-btn-primary sv2-btn-block" href="/register">
              Continue to register
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <span class="sv2-ext">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              Secure registration on the Vertex school
            </span>
          </div>
          <div class="sv2-foot">Already have an account? <a href="#signin" data-vls-tab="signin">Sign in</a></div>
        </div>
        <div class="sv2-div">NOT ENROLLED YET?</div>
        <a class="sv2-btn sv2-btn-outline sv2-btn-block" href="https://vls-online.com/courses" target="_blank" rel="noopener">
          Browse courses on vls-online.com
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
          <span class="sv2-sr">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  </div>
  <div class="sv2-wrap">
    <div class="sv2-help">
      <span class="sv2-hic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01"/></svg></span>
      <div><b>Trouble signing in?</b><p>We'll get you back into your account.</p></div>
      <div class="sv2-acts">
        <a class="sv2-btn sv2-btn-quiet" href="https://vls-online.com/report-an-issue" target="_blank" rel="noopener">Report an issue</a>
        <a class="sv2-btn sv2-btn-quiet" href="mailto:office@vls-online.com">office@vls-online.com</a>
      </div>
    </div>
  </div>
</div>
<script>
(function(){
  var root=document.querySelector('.vls-school-v2');
  if(!root) return;
  function show(name){
    var panes=root.querySelectorAll('[data-vls-pane]');
    var tabs=root.querySelectorAll('[data-vls-tab]');
    for(var i=0;i<panes.length;i++) panes[i].classList.toggle('on', panes[i].getAttribute('data-vls-pane')===name);
    for(var j=0;j<tabs.length;j++) tabs[j].classList.toggle('on', tabs[j].getAttribute('data-vls-tab')===name);
  }
  root.addEventListener('click', function(event){
    var trigger=event.target && event.target.closest ? event.target.closest('[data-vls-tab]') : null;
    if(!trigger || !root.contains(trigger)) return;
    if(trigger.tagName==='A') event.preventDefault();
    show(trigger.getAttribute('data-vls-tab'));
  });
})();
</script>`;
}
