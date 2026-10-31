import express from 'express';
import { config, scopes } from './config.js';
import { getToken } from './db.js';
import { authorizeUrl, exchange, validateSession } from './auth/oauth.js';
import { newState, validState } from './auth/state.js';
import { randomBytes } from 'node:crypto';
import { startEventSub, listen } from './eventsub/runtime.js';
import { demoEvent, startDemo } from './demo/simulator.js';
import { markMoment } from './moments/runtime.js';
const app = express();
const states = new Map<string,number>();
const csrf = randomBytes(32).toString('hex');
app.disable('x-powered-by');
app.use((req,res,next) => { const allowed = [`localhost:${config.port}`,`127.0.0.1:${config.port}`]; if (!allowed.includes(req.headers.host || '')) { res.status(400).send('Invalid host'); return; } res.setHeader('X-Content-Type-Options','nosniff'); next(); });
app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/auth/login',(req,res)=>{
 if (req.hostname !== 'localhost') { res.redirect(`http://localhost:${config.port}/auth/login`); return; }
 if (!config.clientId || !config.clientSecret) { res.status(503).send('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env first.'); return; }
 for (const [key,expires] of states) if (expires < Date.now()) states.delete(key);
 const state = newState(); states.set(state,Date.now()+10*60_000);
 res.setHeader('Set-Cookie',`oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=600`); res.redirect(authorizeUrl(state));
});
app.get('/auth/callback',async (req,res)=>{
 res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
 const state = typeof req.query.state === 'string' ? req.query.state : '';
 const cookie = (req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('oauth_state='))?.slice('oauth_state='.length);
 const expiry = states.get(state); states.delete(state); res.setHeader('Set-Cookie','oauth_state=; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=0');
 if (!expiry || expiry < Date.now() || !validState(cookie,state)) { res.status(400).send('Invalid or expired OAuth state.'); return; }
 if (typeof req.query.code !== 'string' || !req.query.code) { res.status(400).send('Twitch authorization was not completed.'); return; }
 try { await exchange(req.query.code); void startEventSub(); res.redirect('/status'); } catch { res.status(502).send('Twitch login failed. Please try again.'); }
});
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
app.get('/status',(_req,res)=>{ const token=getToken(); const granted:string[]=token ? JSON.parse(token.scopes) as string[] : []; res.type('html').send(`<!doctype html><html><head><title>Previously On status</title><meta name="viewport" content="width=device-width"><style>body{background:#12101c;color:#f5f1ff;font:16px system-ui;max-width:850px;margin:40px auto;padding:0 20px}a{color:#cba5ff}li{margin:6px 0}button{padding:8px;margin-right:8px}.feed li{border-bottom:1px solid #3c344e;padding:8px;overflow-wrap:anywhere}.label{color:#dcbbff}</style></head><body><h1>Previously On</h1><p>${token ? `Logged in as ${escape(token.login)}` : 'Not logged in'}</p><p><a href="/auth/login">Connect Twitch</a></p><ul>${scopes.map(s=>`<li>${granted.includes(s) ? '🟢' : '⚪'} ${escape(s)}</li>`).join('')}</ul><p><a href="/studio">Studio</a> · <a href="/overlay">Overlay</a></p><h2>Event feed ${process.env.DEMO === '1' ? '(SIMULATED)' : ''}</h2><p id="connection">Connecting…</p>${process.env.DEMO === '1' ? '<button data-demo="online">SIMULATED online</button><button data-demo="offline">SIMULATED offline</button>' : ''}<ul id="feed" class="feed"></ul><h2>Moments</h2><button id="mark">Mark moment</button><ul id="moments"></ul><script>const token=${JSON.stringify(csrf)}; const source=new EventSource('/api/events'); source.onmessage=e=>{const state=JSON.parse(e.data); document.querySelector('#connection').textContent=state.status; const feed=document.querySelector('#feed'); feed.replaceChildren(); for(const item of state.events){const li=document.createElement('li'); li.textContent=(item.simulated?'SIMULATED · ':'')+item.type+' · '+(item.userName||'')+' '+(item.text||''); feed.appendChild(li)} const moments=document.querySelector('#moments'); moments.replaceChildren(); for(const item of state.moments){const li=document.createElement('li'); li.textContent=item.reason+' · '+item.trigger+' · '+item.peak_at; moments.appendChild(li)}}; document.querySelector('#mark').onclick=async()=>{const result=await fetch('/api/mark',{method:'POST',headers:{'X-CSRF-Token':token}});if(!result.ok) alert('Start a live stream before marking a moment.');}; source.onerror=()=>document.querySelector('#connection').textContent='Feed disconnected; reconnecting'; for(const button of document.querySelectorAll('[data-demo]')) button.onclick=()=>fetch('/api/demo/'+button.dataset.demo,{method:'POST',headers:{'X-CSRF-Token':token}});</script></body></html>`); });
app.get('/api/events',(req,res)=>{ res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); res.flushHeaders(); const unsubscribe=listen(data=>res.write(`data: ${JSON.stringify(data)}\n\n`)); req.on('close',unsubscribe); });
app.post('/api/demo/:type',(req,res)=>{ const origin=req.get('origin'); if (origin !== `http://localhost:${config.port}` && origin !== `http://127.0.0.1:${config.port}`) { res.sendStatus(403); return; } if (req.get('x-csrf-token') !== csrf || process.env.DEMO !== '1' || !['online','offline'].includes(req.params.type)) { res.sendStatus(403); return; } demoEvent(req.params.type); res.sendStatus(204); });
app.post('/api/mark',(req,res)=>{ const origin=req.get('origin'); if ((origin !== `http://localhost:${config.port}` && origin !== `http://127.0.0.1:${config.port}`) || req.get('x-csrf-token') !== csrf) { res.sendStatus(403); return; } if (!markMoment()) { res.status(409).send('No live stream session'); return; } res.sendStatus(204); });
app.get('/studio',(_req,res)=>res.type('html').send('<h1>Studio</h1><p>Coming in a later phase.</p>'));
app.get('/overlay',(_req,res)=>res.type('html').send('<!doctype html><title>Previously On overlay</title>'));
if (process.env.DEMO !== '1') await validateSession().catch(()=>console.warn('Could not validate Twitch session at startup.'));
void startEventSub();
if (process.env.DEMO === '1') startDemo();
if (process.env.DEMO !== '1') setInterval(()=>void validateSession().catch(()=>console.warn('Could not validate Twitch session.')),60*60_000).unref();
app.listen(config.port,'127.0.0.1',()=>console.log(`Previously On: http://localhost:${config.port}/status`));
