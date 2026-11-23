// CareNow: backend + customer app + partner app in ONE file. Zero dependencies.
// Run: node carenow.js   ->  customer http://localhost:3000  |  partner http://localhost:3000/provider
// Env: PORT, ADMIN_KEY (if set, new partners wait for approval),
//      SUPABASE_URL + SUPABASE_KEY (store everything in a free Supabase database so nothing is lost on restart),
//      FAST2SMS_KEY (text reset codes with Fast2SMS; add FAST2SMS_SENDER_ID + FAST2SMS_TEMPLATE_ID once your DLT template is approved),
//      SMS_WEBHOOK_URL (or any other SMS service: we POST {phone, message} there). With neither, the reset code is printed in the server log.
//      DATA_FILE (local backup file, default data.json).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const DB = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SVC = { nanny: { n: 'Nanny', ic: '🧸', r: 300 }, newborn: { n: 'Newborn care', ic: '👶', r: 400 }, elder: { n: 'Elder-care nurse', ic: '🧓', r: 600 }, postop: { n: 'Post-surgery nurse', ic: '🩺', r: 700 } };
const AREAS = ['Andheri West', 'Bandra West', 'Powai', 'Goregaon East', 'Malad West', 'Juhu', 'Worli', 'Thane West'];
const PAGES = {
  index: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>CareNow – Nannies & Nurses at your door</title>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Figtree:wght@400;500;600&display=swap\">\n<style>\n:root{--bg:#F2F6F7;--card:#fff;--ink:#12313A;--mute:#5B747B;--line:#D5E1E4;--teal:#1B7F8C;--tealtx:#fff;--tint:#E3F0F2;--sun:#F2B632;--hero:#12313A;--herotx:#fff;\nbox-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\n@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--bg:#0D1C21;--card:#14292F;--ink:#E8F1F3;--mute:#93AEB5;--line:#26424A;--teal:#4FB8C6;--tealtx:#0D1C21;--tint:#1B3A42;--hero:#14292F}}\n:root[data-theme=\"dark\"]{--bg:#0D1C21;--card:#14292F;--ink:#E8F1F3;--mute:#93AEB5;--line:#26424A;--teal:#4FB8C6;--tealtx:#0D1C21;--tint:#1B3A42;--hero:#14292F}\nhtml{scroll-padding-top:env(safe-area-inset-top,0px);scroll-behavior:smooth}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Figtree,system-ui,sans-serif;padding-bottom:84px}\n.w{max-width:760px;margin:auto;padding:0 18px}\nh1,h2,h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.02em;margin:0}\nh2{font-size:24px;margin:34px 0 12px}\nheader{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}\nheader .w{display:flex;justify-content:space-between;align-items:center;height:56px}\n.logo{font:800 22px 'Bricolage Grotesque',sans-serif}.logo span{color:var(--teal)}\nselect,input,textarea{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;width:100%}\nheader select{width:auto;padding:6px 10px;font-size:14px}\n.hero{background:var(--hero);color:var(--herotx);border-radius:18px;padding:26px 20px;margin-top:16px}\n.hero h1{font-size:34px;line-height:1.05}.hero p{margin:10px 0 18px;opacity:.85}\n.badge{display:inline-block;background:var(--sun);color:#12313A;font-weight:600;font-size:13px;border-radius:99px;padding:3px 12px;margin-bottom:12px}\n.btn{background:var(--teal);color:var(--tealtx);border:0;border-radius:12px;padding:13px 20px;font:600 16px Figtree,sans-serif;cursor:pointer;width:100%}\n.btn.sun{background:var(--sun);color:#12313A}.btn.alt{background:var(--card);color:var(--ink);border:1px solid var(--line)}\n.btn:focus-visible,summary:focus-visible,.svc:focus-visible{outline:3px solid var(--sun);outline-offset:2px}\n.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}\n.stats div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}\n.stats b{display:block;font:800 20px 'Bricolage Grotesque',sans-serif}.stats small{color:var(--mute)}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.svc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:left;cursor:pointer;color:var(--ink);font:inherit}\n.ic{width:46px;height:46px;border-radius:12px;background:var(--tint);display:grid;place-items:center;font-size:24px;margin-bottom:10px}\n.svc b{display:block;font-size:16px}.svc small{color:var(--mute)}.svc em{font-style:normal;font-weight:600;color:var(--teal);display:block;margin-top:6px}\n.steps{display:grid;gap:10px}.step{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}\n.n{flex:none;width:34px;height:34px;border-radius:50%;background:var(--sun);color:#12313A;font:800 17px 'Bricolage Grotesque';display:grid;place-items:center}\n.step p{margin:2px 0 0;color:var(--mute);font-size:14.5px}\n.tabs{display:flex;gap:8px;margin-bottom:10px}.tabs button{flex:1;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:9px;font:600 14px Figtree;cursor:pointer}\n.tabs button[aria-pressed=true]{background:var(--ink);color:var(--bg)}\n.list{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 16px}\n.list div{padding:9px 0;border-bottom:1px solid var(--line);display:flex;gap:10px}.list div:last-child{border:0}\n.chips{display:flex;flex-wrap:wrap;gap:8px}.chips span{background:var(--tint);border-radius:99px;padding:5px 14px;font-size:14px}\n.rev{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}\n.rev small{color:var(--mute)}\ndetails{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:8px}\nsummary{cursor:pointer;font-weight:600}details p{margin:8px 0 0;color:var(--mute)}\nfooter{color:var(--mute);font-size:13px;text-align:center;margin:30px 0 10px}\n.bar{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:10px 18px calc(10px + env(safe-area-inset-bottom,0px));z-index:6}\n.bar .w{display:flex;gap:10px;padding:0}.bar .btn{width:auto;flex:1}.bar .btn.alt{flex:none}\n#sheet{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10;display:none;align-items:flex-end}\n#sheet.open{display:flex}\n.panel{background:var(--bg);width:100%;max-width:760px;margin:auto;border-radius:20px 20px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));max-height:92%;overflow:auto}\n.panel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}\n.x{background:none;border:0;color:var(--ink);font-size:26px;cursor:pointer}\nlabel{display:block;font-weight:600;font-size:14px;margin:12px 0 5px}\n.seg{display:flex;flex-wrap:wrap;gap:8px}.seg button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:8px 12px;font:500 14px Figtree;cursor:pointer}\n.seg button[aria-pressed=true]{background:var(--teal);color:var(--tealtx);border-color:var(--teal)}\n.sum{background:var(--tint);border-radius:12px;padding:12px 14px;margin:14px 0;display:flex;justify-content:space-between;align-items:center}\n.sum b{font:800 22px 'Bricolage Grotesque'}\n.bk{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px}\n.st{font-size:12.5px;font-weight:600;border-radius:6px;padding:2px 8px;background:var(--sun);color:#12313A}.st.ok{background:#CDEFD8}\n.tick{font-size:46px;text-align:center}\n</style>\n</head>\n<body>\n<header><div class=\"w\"><div class=\"logo\">Care<span>Now</span></div>\n<div style=\"display:flex;gap:8px;align-items:center\"><button class=\"btn alt\" id=\"acct\" style=\"width:auto;padding:6px 12px;font-size:14px\">Log in</button><select id=\"area\" aria-label=\"Your locality\"></select></div></div></header>\n\n<main class=\"w\">\n  <section class=\"hero\">\n    <span class=\"badge\">Same-day slots · 7 AM – 8 PM</span>\n    <h1>Verified nannies & nurses, at your door.</h1>\n    <p>Book trained, background-checked care by the hour. No lock-ins. Free cancellation before the visit.</p>\n    <button class=\"btn sun\" data-open=\"\">Book care now</button>\n  </section>\n  <div class=\"stats\"><div><b>4.9★</b><small>avg rating</small></div><div><b>100%</b><small>ID + police checked</small></div><div><b>1–4 hrs</b><small>flexible blocks</small></div></div>\n\n  <h2>What do you need?</h2>\n  <div class=\"grid\" id=\"svcs\"></div>\n\n  <h2>How it works</h2>\n  <div class=\"steps\">\n    <div class=\"step\"><div class=\"n\">1</div><div><b>Choose care and a slot</b><p>Pick nanny or nurse, your locality, date, and 30 min to 4 hrs. Repeat weekly if you like.</p></div></div>\n    <div class=\"step\"><div class=\"n\">2</div><div><b>We match a verified expert</b><p>Matched on your locality, care type, and ratings. You see who is coming before they arrive.</p></div></div>\n    <div class=\"step\"><div class=\"n\">3</div><div><b>Relax, then rate</b><p>Pay after the visit. Rate your expert so quality stays high.</p></div></div>\n  </div>\n\n  <h2>What's included</h2>\n  <div class=\"tabs\"><button data-sc=\"nanny\" aria-pressed=\"true\">Nanny</button><button data-sc=\"nurse\" aria-pressed=\"false\">Nurse</button></div>\n  <div class=\"list\" id=\"scope\"></div>\n\n  <h2>Why families trust us</h2>\n  <div class=\"list\">\n    <div>🪪 <span>Government ID verified for every expert</span></div>\n    <div>🛡️ <span>Police verification and reference checks</span></div>\n    <div>📜 <span>Nursing licence checked for all nurses</span></div>\n    <div>⭐ <span>Rated after every visit; low-rated experts are removed</span></div>\n  </div>\n\n  <h2>Now serving in Mumbai</h2>\n  <div class=\"chips\" id=\"areas\"></div>\n\n  <h2>Loved by families</h2>\n  <div class=\"rev\">“Meera was wonderful with our toddler. Arrived on time and sent photo updates.” <br><small>Neha, Andheri West</small></div>\n  <div class=\"rev\">“Booked a nurse for my father's post-surgery dressings. Professional and gentle.” <br><small>Rohan, Powai</small></div>\n\n  <h2>Questions</h2>\n  <details><summary>Can nurses give injections?</summary><p>Licensed nurses can give injections and dress wounds when you share the doctor's prescription.</p></details>\n  <details><summary>Can I cancel?</summary><p>Yes, free cancellation or rescheduling before the visit starts.</p></details>\n  <details><summary>Is this for emergencies?</summary><p>No. For emergencies call 112 or your nearest hospital.</p></details>\n  <footer>CareNow demo · Sample data only · <a href=\"/provider\" style=\"color:inherit\">Provider app</a></footer>\n</main>\n\n<div class=\"bar\"><div class=\"w\"><button class=\"btn alt\" id=\"mine\">My bookings</button><button class=\"btn\" data-open=\"\">Book care</button></div></div>\n\n<div id=\"sheet\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Book care\"><div class=\"panel\" id=\"panel\"></div></div>\n\n<script>\nconst $=(s)=>document.querySelector(s);\nconst money=(n)=>'₹'+n.toLocaleString('en-IN');\nconst areas=['Andheri West','Bandra West','Powai','Goregaon East','Malad West','Juhu','Worli','Thane West'];\nconst svcs=[\n {id:'nanny',ic:'🧸',n:'Nanny',d:'Child care & school runs',r:300,pool:['Meera Nair','Sunita Rao']},\n {id:'newborn',ic:'👶',n:'Newborn care',d:'Infant specialist',r:400,pool:['Priya Das','Kavita Shah']},\n {id:'elder',ic:'🧓',n:'Elder-care nurse',d:'Vitals, meds, mobility',r:600,pool:['Rahul Menon','Joseph D’Souza']},\n {id:'postop',ic:'🩺',n:'Post-surgery nurse',d:'Dressings & injections',r:700,pool:['Anita Joseph','Farah Khan']}];\nconst scope={nanny:[['✓','Feeding, bathing, diaper changes'],['✓','Play, stories and activities'],['✓','School pickups and homework help'],['✗','Medical care or giving medicines'],['✗','General house cleaning']],\n nurse:[['✓','Vitals: BP, sugar, temperature'],['✓','Medication reminders and injections'],['✓','Wound dressing and post-surgery care'],['✗','Emergency or ICU-level care'],['✗','Diagnosis or changing prescriptions']]};\nlet token='',user=null;try{token=localStorage.getItem('tok')||''}catch(e){}\nconst esc=(v)=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst api=async(u,o={})=>{const r=await fetch(u,{method:o.body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:o.body&&JSON.stringify(o.body)});const d=await r.json();if(r.status===401&&token&&u!=='/api/login'&&u!=='/api/signup')logout(true);if(!r.ok)throw new Error(d.error||'Something went wrong');return d};\nlet bookings=[],poll;\nlet area=areas[0];\n$('#area').innerHTML=areas.map(a=>`<option>${a}</option>`).join('');\n$('#area').onchange=e=>area=e.target.value;\n$('#areas').innerHTML=areas.map(a=>`<span>${a}</span>`).join('');\n$('#svcs').innerHTML=svcs.map(s=>`<button class=\"svc\" data-open=\"${s.id}\"><div class=\"ic\">${s.ic}</div><b>${s.n}</b><small>${s.d}</small><em>from ${money(s.r)}/hr</em></button>`).join('');\nfunction showScope(k){$('#scope').innerHTML=scope[k].map(([m,t])=>`<div><b style=\"color:${m==='✓'?'var(--teal)':'var(--mute)'}\">${m}</b><span>${t}</span></div>`).join('');\n document.querySelectorAll('[data-sc]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sc===k))}\ndocument.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>showScope(b.dataset.sc));showScope('nanny');\n\nconst sheet=$('#sheet'),panel=$('#panel');\nconst open=()=>sheet.classList.add('open'),close=()=>sheet.classList.remove('open');\nsheet.onclick=e=>{if(e.target===sheet)close()};\ndocument.addEventListener('keydown',e=>{if(e.key==='Escape')close()});\ndocument.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>need(()=>form(b.dataset.open||'nanny')));\n$('#mine').onclick=()=>need(list);\n\nconst need=(fn)=>!user?authSheet(fn):user.verified===false?verifySheet(fn):fn();\nconst acct=()=>{$('#acct').textContent=user?user.name.split(' ')[0]:'Log in'};\n$('#acct').onclick=()=>user?accountSheet():authSheet(null);\nasync function logout(quiet){try{await fetch('/api/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch(e){}\n token='';user=null;bookings=[];clearInterval(poll);try{localStorage.removeItem('tok')}catch(e){}acct();if(!quiet)close()}\nfunction authSheet(next,mode){const su=mode==='signup';panel.dataset.v='auth';\n panel.innerHTML=`<div class=\"top\"><h3>${su?'Create account':'Log in'}</h3><button class=\"x\" aria-label=\"Close\">×</button></div>\n <p style=\"color:var(--mute);margin:4px 0 0\">${su?'Sign up to book verified care.':'Log in to book and track care.'}</p>\n ${su?'<label for=\"an\">Your name</label><input id=\"an\" autocomplete=\"name\">':''}\n <label for=\"ap\">Mobile number</label><input id=\"ap\" type=\"tel\" inputmode=\"numeric\" autocomplete=\"tel\" placeholder=\"10-digit number\">\n <label for=\"aw\">Password</label><input id=\"aw\" type=\"password\" autocomplete=\"${su?'new-password':'current-password'}\" placeholder=\"${su?'At least 6 characters':''}\">\n ${su?'':'<button id=\"fg\" style=\"background:none;border:0;padding:8px 0 0;color:var(--teal);text-decoration:underline;font:inherit;font-size:14px;cursor:pointer\">Forgot password?</button>'}\n <p id=\"ae\" role=\"alert\" style=\"color:#C0392B;font-size:14px;min-height:20px;margin:8px 0 0\"></p>\n <button class=\"btn\" id=\"ag\">${su?'Create account':'Log in'}</button>\n <button class=\"btn alt\" id=\"as\" style=\"margin-top:10px\">${su?'I already have an account':'New here? Create account'}</button>`;\n panel.querySelector('.x').onclick=close;\n $('#as').onclick=()=>authSheet(next,su?'login':'signup');\n if(!su)$('#fg').onclick=()=>forgotSheet(next,$('#ap').value);\n const go=async()=>{$('#ag').disabled=true;$('#ae').textContent='';\n  try{const d=await api(su?'/api/signup':'/api/login',{body:{name:su?$('#an').value:undefined,phone:$('#ap').value,password:$('#aw').value}});\n   token=d.token;try{localStorage.setItem('tok',token)}catch(e){}user={name:d.name,phone:d.phone,verified:d.verified};acct();d.verified?(next?next():close()):verifySheet(next)}\n  catch(e){$('#ae').textContent=e.message;$('#ag').disabled=false}};\n $('#ag').onclick=go;panel.querySelectorAll('input').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter')go()});open();(su?$('#an'):$('#ap')).focus()}\nfunction forgotSheet(next,phone,sms){const two=sms!==undefined;panel.dataset.v='forgot';\n panel.innerHTML=`<div class=\"top\"><h3>Reset password</h3><button class=\"x\" aria-label=\"Close\">×</button></div>\n <p id=\"fm\" style=\"color:var(--mute);margin:4px 0 0\"></p>\n <label for=\"fp\">Mobile number</label><input id=\"fp\" type=\"tel\" inputmode=\"numeric\" autocomplete=\"tel\" ${two?'readonly':''}>\n ${two?'<label for=\"fc\">6-digit code</label><input id=\"fc\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\"><label for=\"fw\">New password</label><input id=\"fw\" type=\"password\" autocomplete=\"new-password\" placeholder=\"At least 6 characters\">':''}\n <p id=\"fe\" role=\"alert\" style=\"color:#C0392B;font-size:14px;min-height:20px;margin:8px 0 0\"></p>\n <button class=\"btn\" id=\"fg1\">${two?'Reset password':'Send code'}</button>\n <button class=\"btn alt\" id=\"fb\" style=\"margin-top:10px\">Back to log in</button>`;\n $('#fp').value=phone||'';\n $('#fm').textContent=!two?'Enter your mobile number and we will send you a 6-digit code.':sms?'If this number has an account, a 6-digit code is on its way. It works for 10 minutes. Nothing after a minute? Contact CareNow support.':'We could not text a code. Ask CareNow support for your reset code, then enter it below.';\n panel.querySelector('.x').onclick=close;$('#fb').onclick=()=>authSheet(next);\n const go=async()=>{$('#fg1').disabled=true;$('#fe').textContent='';\n  try{if(!two){const d=await api('/api/forgot',{body:{role:'customer',phone:$('#fp').value}});forgotSheet(next,$('#fp').value,d.sms)}\n   else{const d=await api('/api/reset',{body:{role:'customer',phone:$('#fp').value,code:$('#fc').value,password:$('#fw').value}});\n    token=d.token;try{localStorage.setItem('tok',token)}catch(e){}user={name:d.name,phone:$('#fp').value};acct();next?next():close()}}\n  catch(e){$('#fe').textContent=e.message;$('#fg1').disabled=false}};\n $('#fg1').onclick=go;panel.querySelectorAll('input').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter')go()});open();(two?$('#fc'):$('#fp')).focus()}\nfunction verifySheet(next){panel.dataset.v='verify';\n panel.innerHTML=`<div class=\"top\"><h3>Verify your number</h3><button class=\"x\" aria-label=\"Close\">×</button></div>\n <p id=\"vm\" style=\"color:var(--mute);margin:4px 0 0\"></p>\n <label for=\"vc\">6-digit code</label><input id=\"vc\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\">\n <p id=\"ve\" role=\"alert\" style=\"color:#C0392B;font-size:14px;min-height:20px;margin:8px 0 0\"></p>\n <button class=\"btn\" id=\"vg\">Verify</button>\n <button class=\"btn alt\" id=\"vr\" style=\"margin-top:10px\">Send a new code</button>`;\n $('#vm').textContent='We sent a 6-digit code to +91 '+user.phone+'. It works for 10 minutes. This keeps CareNow safe for families and partners.';\n panel.querySelector('.x').onclick=close;\n const go=async()=>{$('#vg').disabled=true;$('#ve').textContent='';\n  try{await api('/api/verify',{body:{code:$('#vc').value}});user.verified=true;next?next():close()}\n  catch(e){$('#ve').textContent=e.message;$('#vg').disabled=false}};\n $('#vg').onclick=go;$('#vc').onkeydown=e=>{if(e.key==='Enter')go()};\n $('#vr').onclick=async()=>{$('#ve').textContent='';try{await api('/api/verify/send',{body:{}});$('#vm').textContent='A new code is on its way to +91 '+user.phone+'.'}catch(e){$('#ve').textContent=e.message}};\n open();$('#vc').focus()}\nfunction accountSheet(){panel.dataset.v='acct';\n panel.innerHTML=`<div class=\"top\"><h3>My account</h3><button class=\"x\" aria-label=\"Close\">×</button></div>\n <div class=\"bk\"><b id=\"un\"></b><br><small id=\"up\" style=\"color:var(--mute)\"></small></div>\n <button class=\"btn alt\" id=\"mb\" style=\"margin-top:12px\">My bookings</button>\n <button class=\"btn\" id=\"lo\" style=\"margin-top:10px\">Log out</button>\n <p style=\"margin-top:14px\"><a href=\"/provider\" style=\"color:var(--teal)\">Are you a nanny or nurse? Open the partner app</a></p>`;\n $('#un').textContent=user.name;$('#up').textContent='+91 '+user.phone;\n panel.querySelector('.x').onclick=close;$('#mb').onclick=list;$('#lo').onclick=()=>logout();open()}\nif(token)api('/api/me').then(d=>{user=d;acct()}).catch(()=>{});\n\n\nfunction form(id){\n const today=new Date().toISOString().slice(0,10);let f={svc:id,hours:2,rec:false};\n const draw=()=>{const s=svcs.find(x=>x.id===f.svc);\n panel.innerHTML=`<div class=\"top\"><h3>Book care</h3><button class=\"x\" aria-label=\"Close\">×</button></div>\n <label>Care type</label><div class=\"seg\">${svcs.map(x=>`<button data-s=\"${x.id}\" aria-pressed=\"${x.id===f.svc}\">${x.ic} ${x.n}</button>`).join('')}</div>\n <label for=\"a2\">Locality</label><select id=\"a2\">${areas.map(a=>`<option ${a===area?'selected':''}>${a}</option>`).join('')}</select>\n <label for=\"d\">Date</label><input id=\"d\" type=\"date\" min=\"${today}\" value=\"${f.date||today}\">\n <label>Duration</label><div class=\"seg\">${[.5,1,1.5,2,3,4].map(h=>`<button data-h=\"${h}\" aria-pressed=\"${h===f.hours}\">${h<1?'30 min':h+' hr'}</button>`).join('')}</div>\n <label style=\"display:flex;gap:8px;align-items:center;font-weight:500\"><input id=\"r\" type=\"checkbox\" style=\"width:auto\" ${f.rec?'checked':''}> Repeat weekly on this day</label>\n <label for=\"n\">Notes (child's age, care needs)</label><textarea id=\"n\" rows=\"2\">${f.notes||''}</textarea>\n <div class=\"sum\"><span>${money(s.r)}/hr × ${f.hours<1?'0.5':f.hours} hr${f.rec?' · weekly':''}</span><b>${money(s.r*f.hours)}</b></div>\n <button class=\"btn\" id=\"go\">Confirm booking</button>`;\n panel.querySelector('.x').onclick=close;\n const keep=()=>{f.date=$('#d').value;f.notes=$('#n').value;f.rec=$('#r').checked;area=$('#a2').value;$('#area').value=area};\n panel.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{keep();f.svc=b.dataset.s;draw()});\n panel.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{keep();f.hours=+b.dataset.h;draw()});\n $('#r').onchange=()=>{keep();draw()};\n $('#go').onclick=async()=>{keep();$('#go').disabled=true;try{confirmed(await api('/api/bookings',{body:{svc:f.svc,area,date:f.date||today,hours:f.hours,rec:f.rec,notes:f.notes}}))}catch(e){alert(e.message);$('#go').disabled=false}};};\n draw();open()}\n\nfunction confirmed(b){panel.dataset.v='ok';\n panel.innerHTML=`<div class=\"tick\">✅</div><h3 style=\"text-align:center\">Request sent</h3>\n <div class=\"bk\"><b>${b.ic} ${b.svc}</b> in ${b.area}<br><small>${b.date} · ${b.hours<1?'30 min':b.hours+' hr'} · ${money(b.total)}${b.rec?' · weekly':''}</small></div>\n <p style=\"color:var(--mute);font-size:14px\">We're sending your request to verified experts near you. You'll see who accepts under My bookings. You pay after the visit.</p>\n <button class=\"btn\" id=\"v\">View my bookings</button>`;$('#v').onclick=list}\n\nconst LBL={searching:'Finding expert',accepted:'Confirmed',completed:'Completed',cancelled:'Cancelled'};\nasync function list(){panel.dataset.v='mine';clearInterval(poll);\n const draw=async()=>{try{bookings=await api('/api/bookings')}catch(e){}\n  if(panel.dataset.v!=='mine'||!sheet.classList.contains('open'))return clearInterval(poll);\n  panel.innerHTML=`<div class=\"top\"><h3>My bookings</h3><button class=\"x\" aria-label=\"Close\">×</button></div>`+\n  (bookings.length?bookings.map(b=>`<div class=\"bk\"><div style=\"display:flex;justify-content:space-between\"><b>${b.ic} ${b.svc}</b><span class=\"st ${['accepted','completed'].includes(b.status)?'ok':''}\">${LBL[b.status]}</span></div>\n   <div>${b.who?esc(b.who)+' is your expert':'Matching a verified expert…'}</div><small style=\"color:var(--mute)\">${b.area} · ${b.date} · ${b.hours<1?'30 min':b.hours+' hr'} · ${money(b.total)}${b.rec?' · weekly':''}</small>\n   ${['searching','accepted'].includes(b.status)?`<div style=\"margin-top:8px\"><button class=\"btn alt\" data-c=\"${b.id}\" style=\"padding:8px\">Cancel (free)</button></div>`:''}</div>`).join(''):'<p style=\"color:var(--mute)\">No bookings yet.</p>')+\n  `<button class=\"btn\" id=\"nb\" style=\"margin-top:14px\">Book care</button>`;\n  panel.querySelector('.x').onclick=close;$('#nb').onclick=()=>form('nanny');\n  panel.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{try{await api('/api/bookings/'+b.dataset.c+'/cancel',{body:{}})}catch(e){alert(e.message)}draw()})};\n await draw();open();poll=setInterval(draw,3000)}\n</script>\n</body>\n</html>\n",
  provider: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>CareNow Partner</title>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Figtree:wght@400;500;600&display=swap\">\n<style>\n:root{--bg:#F2F6F7;--card:#fff;--ink:#12313A;--mute:#5B747B;--line:#D5E1E4;--teal:#1B7F8C;--tealtx:#fff;--tint:#E3F0F2;--sun:#F2B632;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\n@media (prefers-color-scheme:dark){:root{--bg:#0D1C21;--card:#14292F;--ink:#E8F1F3;--mute:#93AEB5;--line:#26424A;--teal:#4FB8C6;--tealtx:#0D1C21;--tint:#1B3A42}}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Figtree,system-ui,sans-serif}\n.w{max-width:560px;margin:auto;padding:16px 18px 60px}\nh1,h2{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;margin:0}h1{font-size:28px}h2{font-size:20px;margin:22px 0 10px}\n.logo span{color:var(--teal)}.mute{color:var(--mute);font-size:14px}\ninput{width:100%;font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px;margin:6px 0 10px}\n.btn{background:var(--teal);color:var(--tealtx);border:0;border-radius:10px;padding:11px 16px;font:600 15px Figtree;cursor:pointer}\n.btn.alt{background:var(--card);color:var(--ink);border:1px solid var(--line)}.btn.full{width:100%}\n.btn:focus-visible,input:focus-visible{outline:3px solid var(--sun);outline-offset:2px}\n.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}\n.row{display:flex;justify-content:space-between;align-items:center;gap:10px}\n.pay{font:800 20px 'Bricolage Grotesque';color:var(--teal)}\n.acts{display:flex;gap:8px;margin-top:10px}.acts .btn{flex:1}\n.top{display:flex;justify-content:space-between;align-items:center}\n.tog{display:flex;align-items:center;gap:8px;font-weight:600}.tog input{width:auto;margin:0;transform:scale(1.4)}\n.big{background:var(--ink);color:var(--bg);border-radius:16px;padding:18px;margin:14px 0}.big b{font:800 34px 'Bricolage Grotesque';display:block}\n.err{color:#C0392B;font-size:14px;min-height:20px}\n.demo{background:var(--tint);border-radius:10px;padding:10px 12px;font-size:13.5px;margin-top:14px}\n.chk{display:inline-flex;gap:6px;align-items:center;margin:0 10px 6px 0;font-weight:500}.chk input{width:auto;margin:0}\n</style>\n</head>\n<body><div class=\"w\" id=\"app\"></div>\n<script>\nconst $=(s)=>document.querySelector(s),app=$('#app');\nconst money=(n)=>'₹'+n.toLocaleString('en-IN');\nlet token='';try{token=localStorage.getItem('ptoken')||''}catch(e){}\nconst api=async(u,o={})=>{const r=await fetch(u,{method:o.body?'POST':(o.method||'GET'),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:o.body&&JSON.stringify(o.body)});\n const d=await r.json();if(r.status===401&&token){logout()}if(!r.ok)throw new Error(d.error||'Error');return d};\nconst esc=(v)=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst SV=[['nanny','Nanny'],['newborn','Newborn care'],['elder','Elder-care nurse'],['postop','Post-surgery nurse']];\nconst AR=['Andheri West','Bandra West','Powai','Goregaon East','Malad West','Juhu','Worli','Thane West'];\nconst logout=()=>{try{fetch('/api/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch(e){}token='';try{localStorage.removeItem('ptoken')}catch(e){}clearInterval(timer);login()};\nlet timer;\n\nfunction forgot(phone,sms){const two=sms!==undefined;\n app.innerHTML=`<h1 class=\"logo\">Care<span>Now</span> Partner</h1><p class=\"mute\" id=\"fm\"></p>\n <label>Mobile number<input id=\"fp\" type=\"tel\" inputmode=\"numeric\" autocomplete=\"tel\" ${two?'readonly':''}></label>\n ${two?'<label>6-digit code<input id=\"fc\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\"></label><label>New password<input id=\"fw\" type=\"password\" autocomplete=\"new-password\"></label>':''}\n <div class=\"err\" id=\"err\" role=\"alert\"></div><button class=\"btn full\" id=\"go\">${two?'Reset password':'Send code'}</button>\n <button class=\"btn alt full\" id=\"bk\" style=\"margin-top:10px\">Back to log in</button>`;\n $('#fp').value=phone||'';\n $('#fm').textContent=!two?'Enter your mobile number and we will send you a 6-digit code.':sms?'If this number has an account, a 6-digit code is on its way. It works for 10 minutes. Nothing after a minute? Contact CareNow support.':'We could not text a code. Ask CareNow support for your reset code, then enter it below.';\n $('#bk').onclick=()=>login();\n $('#go').onclick=async()=>{$('#go').disabled=true;$('#err').textContent='';\n  try{if(!two){const d=await api('/api/forgot',{body:{role:'provider',phone:$('#fp').value}});forgot($('#fp').value,d.sms)}\n   else{const d=await api('/api/reset',{body:{role:'provider',phone:$('#fp').value,code:$('#fc').value,password:$('#fw').value}});token=d.token;try{localStorage.setItem('ptoken',token)}catch(e){}home()}}\n  catch(e){$('#err').textContent=e.message;$('#go').disabled=false}}}\nfunction login(mode){const su=mode==='signup';\n app.innerHTML=`<h1 class=\"logo\">Care<span>Now</span> Partner</h1><p class=\"mute\">${su?'Create a partner account to receive nanny and nurse jobs.':'Log in to receive nanny and nurse jobs near you.'}</p>\n ${su?'<label>Your name<input id=\"nm\" autocomplete=\"name\"></label>':''}\n <label>Mobile number<input id=\"ph\" type=\"tel\" inputmode=\"numeric\" autocomplete=\"tel\"></label>\n <label>Password<input id=\"pw\" type=\"password\" autocomplete=\"${su?'new-password':'current-password'}\"></label>\n ${su?`<p class=\"mute\" style=\"margin:6px 0 4px\"><b>Services you offer</b></p><div id=\"sv\">${SV.map(([k,l])=>`<label class=\"chk\"><input type=\"checkbox\" value=\"${k}\"> ${l}</label>`).join('')}</div>\n <p class=\"mute\" style=\"margin:10px 0 4px\"><b>Areas you can work in</b></p><div id=\"ar\">${AR.map(a=>`<label class=\"chk\"><input type=\"checkbox\" value=\"${a}\"> ${a}</label>`).join('')}</div>`:''}\n ${su?'':'<button id=\"fg\" style=\"background:none;border:0;padding:0 0 8px;color:var(--teal);text-decoration:underline;font:inherit;font-size:14px;cursor:pointer\">Forgot password?</button>'}\n <div class=\"err\" id=\"err\" role=\"alert\"></div><button class=\"btn full\" id=\"go\">${su?'Create account':'Log in'}</button>\n <button class=\"btn alt full\" id=\"sw\" style=\"margin-top:10px\">${su?'I already have an account':'New partner? Create account'}</button>\n ${su?'':'<div class=\"demo\"><b>Demo partners</b> (password 1234)<br>9000000001 Meera, nanny and newborn<br>9000000002 Sunita, nanny<br>9000000004 Rahul, elder-care nurse<br>9000000005 Anita, post-surgery nurse</div>'}`;\n const pick=(id)=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value);\n $('#sw').onclick=()=>login(su?'':'signup');\n if(!su)$('#fg').onclick=()=>forgot($('#ph').value);\n $('#go').onclick=async()=>{$('#go').disabled=true;$('#err').textContent='';\n  try{const d=await api(su?'/api/provider/signup':'/api/provider/login',{body:{name:su?$('#nm').value:undefined,phone:$('#ph').value,password:$('#pw').value,services:su?pick('sv'):undefined,areas:su?pick('ar'):undefined}});\n   token=d.token;try{localStorage.setItem('ptoken',token)}catch(e){}home()}\n  catch(e){$('#err').textContent=e.message;$('#go').disabled=false}}}\n\nfunction verify(){\n app.innerHTML=`<h1 class=\"logo\">Care<span>Now</span> Partner</h1><p class=\"mute\">We sent a 6-digit code to your mobile number. Enter it to start receiving jobs. It works for 10 minutes.</p>\n <label>6-digit code<input id=\"vc\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\"></label>\n <div class=\"err\" id=\"err\" role=\"alert\"></div><button class=\"btn full\" id=\"go\">Verify</button>\n <button class=\"btn alt full\" id=\"rs\" style=\"margin-top:10px\">Send a new code</button>\n <button class=\"btn alt full\" id=\"lo2\" style=\"margin-top:10px\">Log out</button>`;\n $('#lo2').onclick=logout;\n $('#go').onclick=async()=>{$('#go').disabled=true;$('#err').textContent='';try{await api('/api/verify',{body:{code:$('#vc').value}});home()}catch(e){$('#err').textContent=e.message;$('#go').disabled=false}};\n $('#rs').onclick=async()=>{$('#err').textContent='';try{await api('/api/verify/send',{body:{}});$('#err').textContent='A new code is on its way.'}catch(e){$('#err').textContent=e.message}}}\nasync function home(){\n let me;try{me=await api('/api/provider/me')}catch(e){return login()}\n if(me.verified===false)return verify();\n app.innerHTML=`<div class=\"top\"><div><h1>Hi, ${esc(me.name.split(' ')[0])}</h1><div class=\"mute\">${me.services.join(', ')}</div></div><button class=\"btn alt\" id=\"lo\">Log out</button></div>\n <div class=\"card row\"><label class=\"tog\"><input type=\"checkbox\" id=\"on\" ${me.online?'checked':''}> <span id=\"onl\">${me.online?'You are online':'You are offline'}</span></label><span class=\"mute\">${me.areas.join(' · ')}</span></div>\n ${me.approved?'':'<div class=\"demo\" style=\"margin:0 0 12px\"><b>Waiting for approval.</b> Your account is being checked. You will get requests once it is approved.</div>'}<div class=\"big\"><span class=\"mute\" style=\"color:inherit;opacity:.7\">Total earnings (after 20% fee)</span><b id=\"earn\">₹0</b></div>\n <h2>New requests</h2><div id=\"offers\"></div><h2>Upcoming</h2><div id=\"up\"></div><h2>Completed</h2><div id=\"done\"></div>`;\n $('#lo').onclick=logout;\n $('#on').onchange=async(e)=>{await api('/api/provider/online',{body:{online:e.target.checked}});$('#onl').textContent=e.target.checked?'You are online':'You are offline';refresh()};\n refresh();clearInterval(timer);timer=setInterval(refresh,3000)}\n\nconst card=(j,acts)=>`<div class=\"card\"><div class=\"row\"><b>${j.ic} ${j.svc}</b><span class=\"pay\">${money(j.payout)}</span></div>\n <div class=\"mute\">${j.area} · ${j.date} · ${j.hours<1?'30 min':j.hours+' hr'}${j.rec?' · repeats weekly':''}</div>${j.notes?`<div>“${esc(j.notes)}”</div>`:''}${acts||''}</div>`;\nasync function refresh(){let d;try{d=await api('/api/provider/jobs')}catch(e){return}\n if(!$('#offers'))return;\n $('#earn').textContent=money(d.earnings);\n $('#offers').innerHTML=d.offers.map(j=>card(j,`<div class=\"acts\"><button class=\"btn\" data-a=\"accept\" data-id=\"${j.id}\">Accept</button><button class=\"btn alt\" data-a=\"decline\" data-id=\"${j.id}\">Decline</button></div>`)).join('')||'<p class=\"mute\">No new requests. Stay online to get jobs in your areas.</p>';\n $('#up').innerHTML=d.upcoming.map(j=>card(j,`<div class=\"acts\"><button class=\"btn\" data-a=\"complete\" data-id=\"${j.id}\">Mark completed</button></div>`)).join('')||'<p class=\"mute\">Nothing scheduled.</p>';\n $('#done').innerHTML=d.done.map(j=>card(j)).join('')||'<p class=\"mute\">No completed jobs yet.</p>';\n app.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{try{await api(`/api/provider/jobs/${b.dataset.id}/${b.dataset.a}`,{body:{}})}catch(e){alert(e.message)}refresh()})}\ntoken?home():login();\n</script></body></html>\n",
};
const ICON = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAACQUlEQVR42u3dQW0DURBEwc9jWYRgCASPgQVBCORkre3pnpIeglYdd/+c6/tH+rdjAsEhOASH4BAcgkNwCA7BITgkOASH4BAcgkNwCA7BITgEhwSH4BAcgkNwCA7BITgEh+CQ4BAcgkNwCA7BITgEh+AQHIJDgkNwCI6n+n18PRccQICyA8ftJlYpOVggsgjHm1kUEzlYIFKOYwiLMiKHDD46cYxl0UHkkMFHG44gGbk+Dhl8lOAIZRFK5JDBBxxw9OKokRHk45DBRzCOShkRPg4ZfMABRxeOehnDfRwy+IADjhYcq2SM9QEHHFE4FsqY6QMOOHJwrJUx0AcccITgWC5jmg844IADjmgcWEzzAQcccMABBxyFOIAY6AMOOOCAAw444IADDjjggAMOOOCAAw444IADDjjggAMOOOCAAw444IBDcMABBxxw8OEbUjjggAMOOODwrywZcMABBxxe9iEDDjjg4MNrgnDAwYcXjOGAw9UEMuCAowrH5VITHMt9TB4fDjhicVzuysKx0Mf82d2yJyMfR5OPlMHhgKMCR4ePoLXDcEQTids5Ekeij8SRU3Fk+QhdOBhHio/cebNxDCeSPmwDjpk+ClYtwTGKSM2eVTg+TqRsyUIcHyFSuWEtjrcRKV6vHMfrlGwYbQuOW6BsG2ojDsEhOASH4BAcgkNwCA7BIcEhOASH4BAcgkNwCA7BITgEhxUEh+AQHIJDcAgOwSE4BIfgkOAQHIJDcAgOwSE4BIfgEBwSHIJDcOj+/gACY5JSdIWklAAAAABJRU5ErkJggg==', 'base64');
const MANIFEST = JSON.stringify({ name: 'CareNow', short_name: 'CareNow', start_url: '/', display: 'standalone', background_color: '#F2F6F7', theme_color: '#1B7F8C', icons: [{ src: '/icon.png', sizes: '180x180', type: 'image/png' }] });
const HEAD = '<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1B7F8C"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="CareNow"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="apple-touch-icon" href="/icon.png">';
for (const k in PAGES) PAGES[k] = PAGES[k].replace('<head>', '<head>' + HEAD);
const CUT = 0.2; // platform commission
const SMS_URL = process.env.SMS_WEBHOOK_URL || '', RESET_TTL = +process.env.RESET_TTL_MS || 10 * 6e4;
const FAST_KEY = process.env.FAST2SMS_KEY || '', FAST_URL = process.env.FAST2SMS_URL || 'https://www.fast2sms.com/dev/bulkV2';
const SMS_ON = !!(FAST_KEY || SMS_URL);
const DAY = 864e5;
const resets = {};   // password-reset codes, kept in memory only: 6 digits, 10 minutes, 5 tries
const codeHash = (code, k) => crypto.createHash('sha256').update(k + ':' + code).digest('hex');
const sameHash = (a, b) => crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
// Sends the code. If texting fails (or no SMS service is set up) the code goes to the server log so you can pass it on by hand.
const deliver = async (phone, code, role) => {
  const log = (why) => console.log(`RESET CODE (${role} ${phone}): ${code}` + (why ? `   [SMS failed: ${why}]` : ''));
  try {
    if (FAST_KEY) {
      const tpl = process.env.FAST2SMS_TEMPLATE_ID;   // set after DLT approval: sends your approved template with the code filled in
      const body = tpl ? { route: 'dlt', sender_id: process.env.FAST2SMS_SENDER_ID, message: tpl, variables_values: code, numbers: phone }
        : { route: 'q', message: `Your CareNow code is ${code}. It is valid for 10 minutes. Do not share it.`, language: 'english', flash: 0, numbers: phone };   // Quick SMS: no DLT, higher price
      const r = await fetch(FAST_URL, { method: 'POST', headers: { authorization: FAST_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.return === false) throw new Error(j.message ? JSON.stringify(j.message) : 'HTTP ' + r.status);
    } else if (SMS_URL) {
      const r = await fetch(SMS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message: `Your CareNow code is ${code}. It is valid for 10 minutes.` }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } else log();
  } catch (e) { log(e.message); }
};
// One code store for password reset and mobile verification: 6 digits, 10 minutes, 5 tries, 3 codes an hour.
const issue = (k, phone, role, real = true) => {
  const rs = (resets[k] ||= { sent: [] }); rs.sent = rs.sent.filter((t) => t > Date.now() - 36e5);
  if (rs.sent.length >= 3) return false;
  rs.sent.push(Date.now());   // counted even for unknown numbers, so the answer never reveals who has an account
  if (real) { const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); Object.assign(rs, { hash: codeHash(code, k), exp: Date.now() + RESET_TTL, tries: 0 }); deliver(phone, code, role); }
  return true;
};
const check = (k, code) => {   // null when the code is right, otherwise [message, status]
  const rs = resets[k];
  if (!rs || !rs.hash || rs.exp < Date.now()) return ['This code has expired. Request a new one.', 400];
  if (++rs.tries > 5) { rs.hash = null; return ['Too many wrong codes. Request a new one.', 429]; }
  if (!sameHash(rs.hash, codeHash(String(code || '').trim(), k))) return ['Wrong code.', 400];
  rs.hash = null; return null;
};

// ---- passwords: scrypt with a random salt per account
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const mkPw = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPw(pw, salt) }; };
const okPw = (u, pw) => !!u && crypto.timingSafeEqual(Buffer.from(hashPw(String(pw), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));

// ---- data
const seed = (id, name, phone, services, areas) => ({ id, name, phone, ...mkPw('1234'), services, areas, online: true, approved: true });
let db = {
  next: 1, nextUser: 1, bookings: [], users: [], sessions: {},
  providers: [
    seed(1, 'Meera Nair', '9000000001', ['nanny', 'newborn'], ['Andheri West', 'Bandra West', 'Juhu']),
    seed(2, 'Sunita Rao', '9000000002', ['nanny'], ['Powai', 'Goregaon East', 'Malad West']),
    seed(3, 'Priya Das', '9000000003', ['newborn', 'nanny'], ['Bandra West', 'Powai', 'Worli']),
    seed(4, 'Rahul Menon', '9000000004', ['elder', 'postop'], ['Malad West', 'Goregaon East', 'Andheri West']),
    seed(5, 'Anita Joseph', '9000000005', ['postop', 'elder'], ['Andheri West', 'Powai', 'Bandra West', 'Thane West']),
  ],
};
try { db = JSON.parse(fs.readFileSync(DB)); } catch {}
const fix = () => {
  db.users ||= []; db.sessions ||= {}; db.nextUser ||= db.users.length + 1;
  db.providers.forEach((p) => { if (p.pin) { Object.assign(p, mkPw(p.pin)); delete p.pin; } if (p.approved === undefined) p.approved = true; });
};

// ---- storage: a local file always, plus Supabase when SUPABASE_URL and SUPABASE_KEY are set.
// The whole dataset is one JSON row (table "store"). ponytail: fine for thousands of bookings, move to real tables when it grows.
const SB = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), KEY = process.env.SUPABASE_KEY || '';
const SBH = { apikey: KEY, ...(KEY.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + KEY }) };
let pushing = false, dirty = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const push = () => {
  if (!SB) return;
  dirty = true; if (pushing) return; pushing = true;
  (async () => {
    while (dirty) {
      dirty = false;
      try {
        const r = await fetch(SB + '/rest/v1/store', { method: 'POST', headers: { ...SBH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: 'main', data: db }) });
        if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      } catch (e) { console.error('Database save failed, retrying:', e.message); dirty = true; await sleep(5000); }
    }
    pushing = false;
  })();
};
const save = () => { fs.writeFileSync(DB + '.tmp', JSON.stringify(db, null, 1)); fs.renameSync(DB + '.tmp', DB); push(); };
// on shutdown (Render redeploys send SIGTERM) finish any save in progress
process.on('SIGTERM', async () => { for (let i = 0; i < 50 && (pushing || dirty); i++) await sleep(200); process.exit(0); });

// ---- helpers
const send = (res, code, d) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
const readBody = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } }); });
const phoneOf = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };   // Indian mobile: 10 digits starting 6-9
const isVer = (a) => a.verified !== false;   // accounts made before verification existed count as verified
const nameOf = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const pwOk = (s) => typeof s === 'string' && s.length >= 6 && s.length <= 100;
const who = (b) => (b.providerId ? db.providers.find((p) => p.id === b.providerId).name : null);
const pub = (b) => ({ id: b.id, svc: SVC[b.svc].n, ic: SVC[b.svc].ic, area: b.area, date: b.date, hours: b.hours, rec: b.rec, total: b.total, notes: b.notes, status: b.status, who: who(b) });
const job = (b) => ({ ...pub(b), payout: Math.round(b.total * (1 - CUT)) });
const eligible = (p, b) => p.approved && isVer(p) && p.online && p.services.includes(b.svc) && p.areas.includes(b.area) && !b.declined.includes(p.id);

// sessions last 30 days and are stored with the data, so a restart does not log people out
const newSession = (role, id) => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = { role, id, exp: Date.now() + 30 * DAY }; for (const k in db.sessions) if (db.sessions[k].exp < Date.now()) delete db.sessions[k]; save(); return t; };
const sessionOf = (req) => { const t = (req.headers.authorization || '').replace('Bearer ', ''); const s = db.sessions[t]; return s && s.exp > Date.now() ? { t, ...s } : null; };

// 5 wrong passwords locks that phone number for 5 minutes
const fails = {};
const locked = (k) => fails[k] && fails[k].until > Date.now();
const fail = (k) => { const f = (fails[k] ||= { n: 0, until: 0 }); if (++f.n >= 5) { f.until = Date.now() + 5 * 6e4; f.n = 0; } };

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  const sess = sessionOf(req);
  const user = sess && sess.role === 'customer' ? db.users.find((u) => u.id === sess.id) : null;
  const me = sess && sess.role === 'provider' ? db.providers.find((x) => x.id === sess.id) : null;
  let r;

  // ---- customer accounts
  if (p === '/api/signup' && m === 'POST') {
    const b = await readBody(req), name = nameOf(b.name), phone = phoneOf(b.phone);
    if (name.length < 2 || name.length > 60) return send(res, 400, { error: 'Enter your name.' });
    if (!phone) return send(res, 400, { error: 'Enter a valid 10-digit Indian mobile number.' });
    if (!pwOk(b.password)) return send(res, 400, { error: 'Password must be at least 6 characters.' });
    if (db.users.some((u) => u.phone === phone)) return send(res, 409, { error: 'This number already has an account. Log in instead.' });
    const u = { id: db.nextUser++, name, phone, ...mkPw(b.password), verified: !SMS_ON }; db.users.push(u);
    if (SMS_ON) issue('vcustomer' + phone, phone, 'customer');
    return send(res, 201, { token: newSession('customer', u.id), name, phone, verified: u.verified });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readBody(req), phone = phoneOf(b.phone), k = 'c' + phone;
    if (locked(k)) return send(res, 429, { error: 'Too many wrong attempts. Try again in 5 minutes.' });
    const u = db.users.find((x) => x.phone === phone);
    if (!u || !okPw(u, b.password)) { fail(k); return send(res, 401, { error: 'Wrong mobile number or password.' }); }
    return send(res, 200, { token: newSession('customer', u.id), name: u.name, phone, verified: isVer(u) });
  }
  if (p === '/api/logout' && m === 'POST') { if (sess) { delete db.sessions[sess.t]; save(); } return send(res, 200, { ok: true }); }
  if (p === '/api/me' && m === 'GET') return user ? send(res, 200, { name: user.name, phone: user.phone, verified: isVer(user) }) : send(res, 401, { error: 'Please log in.' });

  // ---- forgot / reset password (works for customers and partners)
  if ((p === '/api/forgot' || p === '/api/reset') && m === 'POST') {
    const b = await readBody(req), role = ['customer', 'provider'].includes(b.role) ? b.role : '', phone = phoneOf(b.phone);
    if (!role || !phone) return send(res, 400, { error: 'Enter a valid 10-digit Indian mobile number.' });
    const acct = (role === 'provider' ? db.providers : db.users).find((x) => x.phone === phone), k = role + phone;
    if (p === '/api/forgot') {
      if (!issue(k, phone, role, !!acct)) return send(res, 429, { error: 'Too many requests. Try again in an hour.' });
      return send(res, 200, { ok: true, sms: SMS_ON });   // same answer whether or not the number has an account
    }
    if (!pwOk(b.password)) return send(res, 400, { error: 'Password must be at least 6 characters.' });
    const bad = acct ? check(k, b.code) : ['This code has expired. Request a new one.', 400];
    if (bad) return send(res, bad[1], { error: bad[0] });
    Object.assign(acct, mkPw(b.password)); acct.verified = true;   // getting the code proves the number is theirs
    for (const t in db.sessions) if (db.sessions[t].role === role && db.sessions[t].id === acct.id) delete db.sessions[t];   // log out everywhere
    delete fails[(role === 'provider' ? 'p' : 'c') + phone];
    return send(res, 200, { token: newSession(role, acct.id), name: acct.name, verified: true });
  }

  // ---- verify mobile number (only required when an SMS service is set up)
  if ((p === '/api/verify/send' || p === '/api/verify') && m === 'POST') {
    const a = user || me; if (!a) return send(res, 401, { error: 'Please log in.' });
    if (isVer(a)) return send(res, 200, { ok: true, verified: true });
    const role = user ? 'customer' : 'provider', k = 'v' + role + a.phone;
    if (p === '/api/verify/send') return issue(k, a.phone, role) ? send(res, 200, { ok: true, sms: SMS_ON }) : send(res, 429, { error: 'Too many requests. Try again in an hour.' });
    const bad = check(k, (await readBody(req)).code);
    if (bad) return send(res, bad[1], { error: bad[0] });
    a.verified = true; save(); return send(res, 200, { ok: true, verified: true });
  }

  // ---- customer bookings
  if (p === '/api/bookings') {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    if (m === 'GET') return send(res, 200, db.bookings.filter((b) => b.client === user.id).map(pub));
    if (m === 'POST') {
      if (!isVer(user)) return send(res, 403, { error: 'Verify your mobile number first.', needsVerify: true });
      const b = await readBody(req);
      if (!SVC[b.svc] || !AREAS.includes(b.area) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return send(res, 400, { error: 'Choose care type, locality and date.' });
      if (!(b.hours >= 0.5 && b.hours <= 4 && (b.hours * 2) % 1 === 0)) return send(res, 400, { error: 'Book 30 minutes to 4 hours.' });
      const bk = { id: db.next++, client: user.id, svc: b.svc, area: b.area, date: b.date, hours: b.hours, rec: !!b.rec, notes: String(b.notes || '').slice(0, 300), total: SVC[b.svc].r * b.hours, status: 'searching', providerId: null, declined: [] };
      db.bookings.unshift(bk); save();
      return send(res, 201, pub(bk));
    }
  }
  if ((r = p.match(/^\/api\/bookings\/(\d+)\/cancel$/)) && m === 'POST') {
    const b = user && db.bookings.find((x) => x.id === +r[1] && x.client === user.id);
    if (!b || !['searching', 'accepted'].includes(b.status)) return send(res, 400, { error: 'Cannot cancel this booking.' });
    b.status = 'cancelled'; save(); return send(res, 200, pub(b));
  }

  // ---- partner accounts
  if (p === '/api/provider/signup' && m === 'POST') {
    const b = await readBody(req), name = nameOf(b.name), phone = phoneOf(b.phone);
    const services = [...new Set(b.services)].filter((s) => SVC[s]), areas = [...new Set(b.areas)].filter((a) => AREAS.includes(a));
    if (name.length < 2 || name.length > 60) return send(res, 400, { error: 'Enter your name.' });
    if (!phone) return send(res, 400, { error: 'Enter a valid 10-digit Indian mobile number.' });
    if (!pwOk(b.password)) return send(res, 400, { error: 'Password must be at least 6 characters.' });
    if (!services.length || !areas.length) return send(res, 400, { error: 'Pick at least one service and one area.' });
    if (db.providers.some((x) => x.phone === phone)) return send(res, 409, { error: 'This number already has a partner account. Log in instead.' });
    const pr = { id: Math.max(0, ...db.providers.map((x) => x.id)) + 1, name, phone, ...mkPw(b.password), services, areas, online: true, approved: !ADMIN_KEY, verified: !SMS_ON };
    db.providers.push(pr);
    if (SMS_ON) issue('vprovider' + phone, phone, 'provider');
    return send(res, 201, { token: newSession('provider', pr.id), name, approved: pr.approved, verified: pr.verified });
  }
  if (p === '/api/provider/login' && m === 'POST') {
    const b = await readBody(req), phone = phoneOf(b.phone), k = 'p' + phone;
    if (locked(k)) return send(res, 429, { error: 'Too many wrong attempts. Try again in 5 minutes.' });
    const pr = db.providers.find((x) => x.phone === phone);
    if (!pr || !okPw(pr, b.password ?? b.pin ?? '')) { fail(k); return send(res, 401, { error: 'Wrong mobile number or password.' }); }
    return send(res, 200, { token: newSession('provider', pr.id), name: pr.name, verified: isVer(pr) });
  }
  if (p.startsWith('/api/provider/')) {
    if (!me) return send(res, 401, { error: 'Please log in.' });
    if (p === '/api/provider/me') return send(res, 200, { name: me.name, online: me.online, approved: me.approved, verified: isVer(me), services: me.services.map((s) => SVC[s].n), areas: me.areas });
    if (p === '/api/provider/online' && m === 'POST') { me.online = !!(await readBody(req)).online; save(); return send(res, 200, { online: me.online }); }
    if (p === '/api/provider/jobs') {
      const mine = db.bookings.filter((b) => b.providerId === me.id);
      const done = mine.filter((b) => b.status === 'completed');
      return send(res, 200, {
        offers: db.bookings.filter((b) => b.status === 'searching' && eligible(me, b)).map(job),
        upcoming: mine.filter((b) => b.status === 'accepted').map(job),
        done: done.map(job),
        earnings: done.reduce((s, b) => s + Math.round(b.total * (1 - CUT)), 0),
      });
    }
    if ((r = p.match(/^\/api\/provider\/jobs\/(\d+)\/(accept|decline|complete)$/)) && m === 'POST') {
      const b = db.bookings.find((x) => x.id === +r[1]);
      if (!b) return send(res, 404, { error: 'Job not found.' });
      if (r[2] === 'complete') {
        if (b.providerId !== me.id || b.status !== 'accepted') return send(res, 400, { error: 'Cannot complete this job.' });
        b.status = 'completed';
      } else {
        if (b.status !== 'searching' || !eligible(me, b)) return send(res, 409, { error: 'This job was already taken or cancelled.' });
        if (r[2] === 'accept') { b.status = 'accepted'; b.providerId = me.id; } else b.declined.push(me.id);
      }
      save(); return send(res, 200, job(b));
    }
  }

  // ---- admin (only when ADMIN_KEY is set): approve new partners after you have checked their documents
  if (p.startsWith('/api/admin/')) {
    if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return send(res, 404, { error: 'Not found' });
    if (p === '/api/admin/providers') return send(res, 200, db.providers.map((x) => ({ id: x.id, name: x.name, phone: x.phone, approved: x.approved, services: x.services, areas: x.areas })));
    if ((r = p.match(/^\/api\/admin\/providers\/(\d+)\/(approve|suspend)$/)) && m === 'POST') {
      const x = db.providers.find((q) => q.id === +r[1]); if (!x) return send(res, 404, { error: 'Not found' });
      x.approved = r[2] === 'approve'; save(); return send(res, 200, { id: x.id, approved: x.approved });
    }
  }

  if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
  if (p === '/manifest.json') { res.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return res.end(MANIFEST); }
  if (p === '/icon.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(ICON); }
  const page = p === '/' ? PAGES.index : p === '/provider' ? PAGES.provider : null;
  if (!page) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

(async () => {
  if (SB) {
    // The database is the source of truth. If it cannot be read we stop instead of starting empty and overwriting it.
    const r = await fetch(SB + '/rest/v1/store?id=eq.main&select=data', { headers: SBH });
    if (!r.ok) throw new Error('Could not read the database: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const rows = await r.json();
    if (rows.length) db = rows[0].data;
    console.log(rows.length ? 'Loaded data from the database.' : 'Database is empty, starting fresh.');
  }
  fix(); save();
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log('CareNow:  customer http://localhost:' + port + '   partner /provider'));
})().catch((e) => { console.error(e.message); process.exit(1); });
