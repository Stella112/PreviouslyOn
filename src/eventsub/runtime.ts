import { config } from '../config.js';
import { getToken } from '../db.js';
import { refresh } from '../auth/oauth.js';
import { HelixClient } from '../twitch/helix.js';
import { EventSubClient } from './client.js';
import { endSession, recordEvent, startSession } from './store.js';
import type { NormalizedEvent } from './messages.js';
import { ingestMomentEvent, recentMoments } from '../moments/runtime.js';
const feed: NormalizedEvent[]=[]; const listeners=new Set<(data:unknown)=>void>();
let status='Not connected'; let client:EventSubClient | undefined;
const publish=()=>{ for(const listener of listeners) listener(snapshot()); };
setInterval(publish,5000).unref();
export function snapshot() { return {status, events:feed.slice(-50).reverse(), moments:recentMoments(), simulated:process.env.DEMO === '1'}; }
export function listen(listener:(data:unknown)=>void):()=>void { listeners.add(listener); listener(snapshot()); return ()=>listeners.delete(listener); }
export function addEvent(e:NormalizedEvent): void { if (!recordEvent(e)) return; ingestMomentEvent(e); feed.push(e); if (feed.length>50) feed.shift(); publish(); }
export async function startEventSub(): Promise<void> {
 if (process.env.DEMO === '1') { status='SIMULATED'; publish(); return; }
 const token=getToken(); if (!token) { status='Log in to connect EventSub'; publish(); return; }
 client?.stop();
 const api=new HelixClient({clientId:config.clientId,getAccessToken:()=>getToken()?.access_token ?? '',refresh:async()=>{await refresh();}});
 client = new EventSubClient(async(session,sub)=>{
  const response=await api.request('/eventsub/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...sub,transport:{method:'websocket',session_id:session}})});
  if (!response.ok) { console.warn(`EventSub ${sub.type} failed (HTTP ${response.status})`); throw new Error('Subscription failed'); }
 },token.user_id,addEvent,s=>{status=s; publish();});
 client.start();
 try {
  const response=await api.request(`/streams?user_id=${encodeURIComponent(token.user_id)}`);
  if (!response.ok) throw new Error('Get Streams failed');
  const body=await response.json() as {data:Array<{id:string;started_at:string}>};
  if (body.data[0]) startSession(body.data[0].id,body.data[0].started_at); else endSession(new Date().toISOString());
 } catch { status='Could not determine current stream status'; publish(); }
}
