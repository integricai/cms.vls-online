/** School home body. Header and footer stay in Global Header/Footer. */
export function generateSchoolHomeHtml(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  .vls-school-home{
    --navy:#204280; --ink:#172033; --slate:#475569; --muted:#526079;
    --blue:#1A56A3; --cyan:#02BAF2; --line:#E3EAF4; --line-soft:#EEF1F6;
    box-sizing:border-box; margin:0; font-family:Poppins,system-ui,sans-serif;
    color:var(--ink); background:#fff; -webkit-font-smoothing:antialiased;
  }
  .vls-school-home *,.vls-school-home *::before,.vls-school-home *::after{box-sizing:border-box;}
  .vls-school-home a{color:inherit;text-decoration:none;}
  .vls-school-home h1,.vls-school-home h2,.vls-school-home h3{margin:0;color:var(--ink);font-weight:700;}
  .vls-school-home p{margin:0;}
  .vls-school-home .wrap{max-width:1200px;margin:0 auto;padding-left:24px;padding-right:24px;}
  .vls-school-home .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
  .vls-school-home .stage{
    background-color:#F5F9FF;
    background-image:
      radial-gradient(900px 480px at 8% 0%, rgba(26,86,163,.12), transparent 60%),
      radial-gradient(700px 420px at 100% 30%, rgba(2,186,242,.10), transparent 60%),
      radial-gradient(rgba(32,66,128,.08) 1px, transparent 1px);
    background-size:auto, auto, 22px 22px;
  }
  .vls-school-home .stage-inner{display:flex;flex-wrap:wrap;align-items:center;gap:48px;padding:72px 24px 80px;}
  .vls-school-home .copy{flex:1 1 460px;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:18px;}
  .vls-school-home .pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 10px;border-radius:999px;background:rgba(32,66,128,.07);border:1px solid rgba(32,66,128,.12);font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--navy);}
  .vls-school-home .dot{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 4px rgba(2,186,242,.18);}
  .vls-school-home h1{font-size:54px;line-height:1.08;letter-spacing:-.025em;}
  .vls-school-home .journey{background:linear-gradient(100deg,#204280 0%,#1A56A3 55%,#1D8FD6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .vls-school-home .lead{font-size:17px;line-height:1.75;color:var(--slate);max-width:34em;}
  .vls-school-home .actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:10px;}
  .vls-school-home .btn{display:inline-flex;align-items:center;gap:12px;font:inherit;font-weight:600;border-radius:12px;cursor:pointer;}
  .vls-school-home .btn-primary{background:linear-gradient(135deg,#204280 0%,#1A56A3 100%);color:#fff;font-size:19px;padding:20px 36px;box-shadow:0 10px 24px -10px rgba(32,66,128,.65);}
  .vls-school-home .btn-primary:hover{filter:brightness(1.06);}
  .vls-school-home .btn-quiet{color:var(--navy);font-size:16px;font-weight:500;padding:18px 26px;border-radius:12px;border:1.5px solid #C9D6EA;background:rgba(255,255,255,.8);gap:10px;position:relative;}
  .vls-school-home .btn-quiet:hover{border-color:var(--navy);background:#fff;}
  .vls-school-home .figure{margin:0;width:100%;max-width:520px;aspect-ratio:13/10;border-radius:24px;background:linear-gradient(160deg,#1A56A3 0%,#204280 55%,#0F2155 100%);box-shadow:0 30px 60px -30px rgba(15,33,85,.45);position:relative;overflow:hidden;}
  .vls-school-home .figure svg{display:block;width:100%;height:100%;}
  .vls-school-home .stage-art{flex:1 1 420px;min-width:0;display:flex;justify-content:center;}
  .vls-school-home .dest{padding:64px 24px 80px;display:flex;flex-direction:column;gap:24px;}
  .vls-school-home h2{font-size:26px;letter-spacing:-.02em;}
  .vls-school-home .cards{display:flex;flex-wrap:wrap;gap:24px;align-items:stretch;}
  .vls-school-home .card{flex:1 1 320px;min-width:0;border-radius:18px;display:flex;flex-direction:column;box-sizing:border-box;}
  .vls-school-home .session{color:#fff;background:radial-gradient(360px 220px at 100% 0%, rgba(2,186,242,.35), transparent 65%), linear-gradient(130deg,#0F2155 0%,#204280 60%,#1A56A3 100%);padding:36px 32px;gap:14px;box-shadow:0 30px 60px -30px rgba(15,33,85,.55);}
  .vls-school-home .icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex:none;}
  .vls-school-home .session .icon{background:rgba(255,255,255,.14);}
  .vls-school-home .state-in{display:none;}
  .vls-school-home .state-out,.vls-school-home.is-in .state-in{display:flex;flex-direction:column;gap:14px;flex:1;}
  .vls-school-home.is-in .state-out{display:none;}
  .vls-school-home .session h3{color:#fff;font-size:24px;letter-spacing:-.015em;}
  .vls-school-home .session p{font-size:15px;line-height:1.65;color:#C9DCF5;}
  .vls-school-home .btn-light{margin-top:auto;align-self:flex-start;background:#fff;color:var(--navy);font-size:16px;padding:14px 24px;border:0;gap:10px;}
  .vls-school-home .btn-light:hover{background:#F2F6FD;}
  .vls-school-home .plain{background:#fff;border:1px solid var(--line);padding:32px 28px 26px;gap:12px;box-shadow:0 1px 2px rgba(15,33,85,.04), 0 8px 24px -16px rgba(15,33,85,.18);}
  .vls-school-home .plain h3{font-size:20px;letter-spacing:-.01em;}
  .vls-school-home .plain p{font-size:15px;line-height:1.65;color:var(--slate);}
  .vls-school-home .btn-outline{margin-top:8px;justify-content:center;color:var(--ink);font-size:16px;padding:16px 20px;border:1px solid #DCE3EE;background:#fff;position:relative;gap:10px;}
  .vls-school-home .btn-outline:hover{border-color:var(--navy);background:#F7FAFF;}
  .vls-school-home .help{margin-top:auto;padding-top:18px;border-top:1px solid var(--line-soft);text-align:center;font-size:14px;line-height:1.6;color:var(--slate);}
  .vls-school-home .help a{font-weight:600;color:var(--blue);}
  .vls-school-home .account{position:relative;overflow:hidden;background:#fff;border:1px solid var(--line);padding:36px 28px 32px;gap:14px;box-shadow:0 1px 2px rgba(15,33,85,.04), 0 8px 24px -16px rgba(15,33,85,.18);}
  .vls-school-home .account:hover{border-color:#C5D4EA;}
  .vls-school-home .account .bar{position:absolute;top:0;left:0;right:0;height:4px;background:var(--blue);}
  .vls-school-home .account .icon{background:#F2F6FD;}
  .vls-school-home .account h3{font-size:20px;letter-spacing:-.01em;}
  .vls-school-home .account p{font-size:14.5px;line-height:1.7;color:var(--muted);}
  .vls-school-home .more{margin-top:auto;padding-top:8px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);}
  @media(max-width:760px){
    .vls-school-home .stage-inner{padding:40px 20px 48px;gap:28px;}
    .vls-school-home h1{font-size:36px;}
    .vls-school-home .btn-primary{font-size:17px;padding:16px 24px;}
    .vls-school-home .dest{padding:40px 20px 56px;}
  }
</style>
<div class="vls-school-home">
  <section class="stage" aria-labelledby="stage-title">
    <div class="wrap stage-inner">
      <div class="copy">
        <span class="pill"><span class="dot"></span>Vertex Learning Solutions School</span>
        <h1 id="stage-title">Start your <span class="journey">journey</span> here</h1>
        <p class="lead">Everything you've enrolled in lives in one place. Pick up your lessons, track your progress and get exam-ready at your own pace.</p>
        <div class="actions">
          <a class="btn btn-primary" href="/mycourses">
            Go to My Courses
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H19 M13 6 L19 12 L13 18" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </a>
          <a class="btn btn-quiet" href="https://vls-online.com" target="_blank" rel="noopener">
            VLS website
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 L11 5 M6 5 H11 V10" fill="none" stroke="#204280" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <span class="sr">(opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div class="stage-art">
        <figure class="figure">
          <svg viewBox="0 0 520 400" aria-hidden="true">
            <circle cx="400" cy="110" r="150" fill="#FFFFFF" opacity="0.06"></circle>
            <circle cx="400" cy="110" r="96" fill="#FFFFFF" opacity="0.08"></circle>
            <circle cx="400" cy="110" r="38" fill="#02BAF2"></circle>
            <path d="M70 340 C 160 330, 210 290, 260 250 S 350 160, 400 150" fill="none" stroke="#8FD8F7" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"></path>
            <rect x="40" y="320" width="100" height="80" fill="#FFFFFF" opacity="0.10"></rect>
            <rect x="140" y="280" width="100" height="120" fill="#FFFFFF" opacity="0.14"></rect>
            <rect x="240" y="236" width="100" height="164" fill="#FFFFFF" opacity="0.18"></rect>
            <rect x="340" y="186" width="140" height="214" fill="#FFFFFF" opacity="0.22"></rect>
            <rect x="40" y="320" width="100" height="5" fill="#FFFFFF" opacity="0.9"></rect>
            <rect x="140" y="280" width="100" height="5" fill="#FFFFFF" opacity="0.9"></rect>
            <rect x="240" y="236" width="100" height="5" fill="#FFFFFF" opacity="0.9"></rect>
            <rect x="340" y="186" width="140" height="5" fill="#FFFFFF" opacity="0.9"></rect>
            <line x1="430" y1="186" x2="430" y2="96" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"></line>
            <path d="M432 98 L470 110 L432 124 Z" fill="#02BAF2"></path>
            <circle cx="70" cy="304" r="9" fill="#FFFFFF"></circle>
          </svg>
        </figure>
      </div>
    </div>
  </section>
  <section aria-labelledby="dest-title">
    <div class="wrap dest">
      <h2 id="dest-title">Where would you like to go?</h2>
      <div class="cards">
        <div class="card session">
          <span class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="#FFFFFF" stroke-width="1.8"></rect><path d="M8.5 10.5 V7.5 C 8.5 3.5, 15.5 3.5, 15.5 7.5 V10.5" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"></path><circle cx="12" cy="15.5" r="1.4" fill="#FFFFFF"></circle></svg>
          </span>
          <div class="state-in">
            <h3>You're signed in</h3>
            <p>Finished for today, or on a shared computer? Sign out to keep your account safe.</p>
            <button type="button" class="btn btn-light" id="vls-school-home-logout">
              Log out
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4 H6 V20 H14 M10 12 H20 M16.5 8.5 L20 12 L16.5 15.5" fill="none" stroke="#204280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </button>
          </div>
          <div class="state-out">
            <h3>Welcome back</h3>
            <p>Log in with the email you used at checkout to reach your courses.</p>
            <a class="btn btn-light" href="/login">
              Log in
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4 H18 V20 H10 M4 12 H14 M10.5 8.5 L14 12 L10.5 15.5" fill="none" stroke="#204280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </a>
          </div>
        </div>
        <div class="card plain">
          <h3>Not enrolled yet?</h3>
          <p>Course details, fees, exam dates and enrolment are on the main Vertex site.</p>
          <a class="btn btn-outline" href="https://vls-online.com" target="_blank" rel="noopener">
            Go to vls-online.com
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 L11 5 M6 5 H11 V10" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <span class="sr">(opens in a new tab)</span>
          </a>
          <div class="help">Trouble signing in? <a href="https://vls-online.com/report-an-issue">Report an issue</a> or email <a href="mailto:office@vls-online.com">office@vls-online.com</a></div>
        </div>
        <a class="card account" href="/account">
          <span class="bar" aria-hidden="true"></span>
          <span class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4" fill="none" stroke="#204280" stroke-width="1.8"></circle><path d="M4.5 20 C 5.5 15.5, 18.5 15.5, 19.5 20" fill="none" stroke="#204280" stroke-width="1.8" stroke-linecap="round"></path></svg>
          </span>
          <h3>My Account</h3>
          <p>Profile, password, purchases and invoices.</p>
          <span class="more">Manage account →</span>
        </a>
      </div>
    </div>
  </section>
</div>
<script>
(function(){
  var root=document.querySelector('.vls-school-home');
  if(!root) return;
  function sessionAlive(){
    var forced=document.documentElement.getAttribute('data-vls-school-state');
    if(forced==='in'||forced==='out') return forced==='in';
    var nav=document.querySelector('.navbar-buttons.jqLoginLogout');
    if(!nav) return false;
    var summary=Array.prototype.map.call(nav.querySelectorAll('a,button'),function(node){
      return ((node.textContent||'')+' '+(node.getAttribute('href')||''));
    }).join(' ').toLowerCase();
    if(/logout|log out|my account|my settings/.test(summary)) return true;
    if(/login|log in|sign in/.test(summary)) return false;
    return !!nav.querySelector('a[href*="logout"]');
  }
  function apply(){ root.classList.toggle('is-in', sessionAlive()); }
  apply();
  var logout=document.getElementById('vls-school-home-logout');
  if(logout){
    logout.addEventListener('click', function(event){
      event.preventDefault();
      var form=document.getElementById('logout-form');
      if(form) form.submit();
      else location.href='/logout';
    });
  }
  if(document.documentElement.getAttribute('data-vls-school-state')) return;
  var tries=0;
  var poll=setInterval(function(){ tries++; apply(); if(tries>20) clearInterval(poll); },400);
})();
</script>`;
}
