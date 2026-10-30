import express from 'express';
import { config, scopes } from './config.js';
import { getToken } from './db.js';
import { authorizeUrl, exchange, validateSession } from './auth/oauth.js';
import { newState, validState } from './auth/state.js';
const app = express();
const states = new Map<string,number>();
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
 try { await exchange(req.query.code); res.redirect('/status'); } catch { res.status(502).send('Twitch login failed. Please try again.'); }
});
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
app.get('/status',(_req,res)=>{ const token=getToken(); const granted:string[]=token ? JSON.parse(token.scopes) as string[] : []; res.type('html').send(`<!doctype html><html><head><title>Previously On status</title></head><body><h1>Previously On</h1><p>${token ? `Logged in as ${escape(token.login)}` : 'Not logged in'}</p><p><a href="/auth/login">Connect Twitch</a></p><ul>${scopes.map(s=>`<li>${granted.includes(s) ? '🟢' : '⚪'} ${escape(s)}</li>`).join('')}</ul><p><a href="/studio">Studio</a> · <a href="/overlay">Overlay</a></p></body></html>`); });
app.get('/studio',(_req,res)=>res.type('html').send('<h1>Studio</h1><p>Coming in a later phase.</p>'));
app.get('/overlay',(_req,res)=>res.type('html').send('<!doctype html><title>Previously On overlay</title>'));
await validateSession().catch(()=>console.warn('Could not validate Twitch session at startup.'));
setInterval(()=>void validateSession().catch(()=>console.warn('Could not validate Twitch session.')),60*60_000).unref();
app.listen(config.port,'127.0.0.1',()=>console.log(`Previously On: http://localhost:${config.port}/status`));
