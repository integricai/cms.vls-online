/** Paste-ready logged-out school page. Sign in goes to Zenler's own login. */
export function generateSchoolLoggedOutHtml(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,600&display=swap" rel="stylesheet" />
<style>
  .vls-school-out{
    --navy:#0E2A57; --ink:#15233D; --slate:#3D4A63;
    --blue:#1E50C8; --blue-strong:#1A45B0; --blue-50:#F2F6FF; --blue-100:#E7EEFD; --blue-200:#D6E2FB;
    --line:#E7EAF1; --line-soft:#EEF1F7;
    --shadow:0 24px 60px rgba(5,18,40,.40);
    box-sizing:border-box; margin:0; font-family:Poppins,system-ui,sans-serif; color:var(--ink);
    background:
      radial-gradient(900px 600px at 15% 10%, rgba(46,111,236,.22), transparent 60%),
      radial-gradient(700px 500px at 85% 90%, rgba(30,80,200,.18), transparent 60%),
      linear-gradient(165deg,#0B1F3A,#102E5C 55%,#0B1F3A);
    min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:34px 22px; -webkit-font-smoothing:antialiased;
  }
  .vls-school-out *{box-sizing:border-box;}
  .vls-school-out a{text-decoration:none;color:inherit;}
  .vls-school-out .lk{display:flex;align-items:center;gap:13px;margin-bottom:26px;}
  .vls-school-out .lk-mark{width:50px;height:50px;border-radius:13px;background:var(--blue);display:grid;place-items:center;color:#fff;font-weight:700;font-size:28px;flex:none;box-shadow:0 6px 20px rgba(30,80,200,.45);}
  .vls-school-out .lk-name{display:block;font-weight:600;font-size:19px;color:#fff;line-height:1.1;}
  .vls-school-out .lk-sub{display:block;font-size:9px;font-weight:600;letter-spacing:.155em;color:#93A8CC;text-transform:uppercase;margin-top:5px;}
  .vls-school-out .card{width:100%;max-width:470px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:36px 36px 30px;}
  .vls-school-out .pill{display:inline-flex;align-items:center;gap:7px;background:var(--blue-50);border:1px solid var(--blue-100);color:var(--blue);font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:16px;}
  .vls-school-out h1{font-size:26px;color:var(--navy);font-weight:600;letter-spacing:-.015em;line-height:1.2;margin:0;}
  .vls-school-out h2{font-size:15px;color:var(--navy);font-weight:600;margin:0;}
  .vls-school-out .sub{color:var(--slate);font-size:15px;margin:10px 0 0;}
  .vls-school-out .btn{display:flex;align-items:center;justify-content:center;gap:9px;font:inherit;font-size:15.5px;font-weight:600;padding:14px 20px;border-radius:12px;border:1px solid transparent;cursor:pointer;width:100%;}
  .vls-school-out .btn svg{width:17px;height:17px;}
  .vls-school-out .btn-primary{background:var(--blue);color:#fff;box-shadow:0 5px 16px rgba(30,80,200,.3);}
  .vls-school-out .btn-primary:hover{background:var(--blue-strong);}
  .vls-school-out .btn-ghost{background:#fff;color:var(--navy);border-color:var(--line);}
  .vls-school-out .btn-ghost:hover{border-color:var(--blue-200);background:var(--blue-50);}
  .vls-school-out .primary-wrap{margin-top:24px;}
  .vls-school-out .or{display:flex;align-items:center;gap:14px;margin:22px 0 18px;color:var(--slate);font-size:11.5px;font-weight:600;letter-spacing:.1em;}
  .vls-school-out .or::before,.vls-school-out .or::after{content:"";flex:1;height:1px;background:var(--line);}
  .vls-school-out .second p{font-size:13.5px;color:var(--slate);margin:4px 0 13px;}
  .vls-school-out .foot{margin-top:24px;padding-top:18px;border-top:1px solid var(--line-soft);text-align:center;font-size:13px;color:var(--slate);}
  .vls-school-out .foot a{color:var(--blue);font-weight:600;}
  .vls-school-out .below{margin-top:22px;font-size:12.5px;color:#8FA3C8;text-align:center;max-width:470px;}
  .vls-school-out .below a{color:#B9CBEA;text-decoration:underline;text-underline-offset:2px;}
  @media(max-width:520px){
    .vls-school-out .card{padding:28px 24px 24px;}
    .vls-school-out h1{font-size:22px;}
  }
</style>
<div class="vls-school-out">
  <a class="lk" href="https://vls-online.com">
    <span class="lk-mark">V</span>
    <span><span class="lk-name">Vertex Learning Solutions</span><span class="lk-sub">Changing Behaviours Through Education</span></span>
  </a>
  <div class="card">
    <span class="pill">Student portal</span>
    <h1>Sign in to your school</h1>
    <p class="sub">Your courses, progress and account live here. Use the email address you enrolled with.</p>
    <div class="primary-wrap">
      <a class="btn btn-primary" href="/login">
        Sign in to my school
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
    <div class="or">OR</div>
    <div class="second">
      <h2>Not enrolled yet?</h2>
      <p>Course details, fees, exam dates and enrolment are on the main Vertex site.</p>
      <a class="btn btn-ghost" href="https://vls-online.com">
        Go to vls-online.com
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
      </a>
    </div>
    <div class="foot">Trouble signing in? <a href="https://vls-online.com/report-an-issue">Report an issue</a> or email <a href="mailto:office@vls-online.com">office@vls-online.com</a></div>
  </div>
  <p class="below">This is the Vertex student portal. For course information and enrolment visit <a href="https://vls-online.com">vls-online.com</a>.</p>
</div>`;
}
