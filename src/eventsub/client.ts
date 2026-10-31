import WebSocket from 'ws';
import { parseMessage, normalize, Deduper, type NormalizedEvent } from './messages.js';
const BASE = 'wss://eventsub.wss.twitch.tv/ws';
export type Subscription = { type: string; version: string; condition: Record<string,string> };
export function subscriptions(userId: string): Subscription[] {
 const broadcaster_user_id = userId;
 return [
  {type:'channel.chat.message',version:'1',condition:{broadcaster_user_id,user_id:userId}},
  {type:'channel.chat.notification',version:'1',condition:{broadcaster_user_id,user_id:userId}},
  {type:'channel.follow',version:'2',condition:{broadcaster_user_id,moderator_user_id:userId}},
  {type:'stream.online',version:'1',condition:{broadcaster_user_id}},
  {type:'stream.offline',version:'1',condition:{broadcaster_user_id}}
 ];
}
export class EventSubClient {
 private active?: WebSocket; private pending?: WebSocket; private timer?: NodeJS.Timeout; private retry?: NodeJS.Timeout; private stopped = false; private dedupe = new Deduper(); private attempts = 0; private timeout = 0;
 constructor(private createSubscription:(sessionId:string, sub:Subscription)=>Promise<void>, private userId:string, private onEvent:(event:NormalizedEvent)=>void, private onStatus:(s:string)=>void, private factory:(url:string)=>WebSocket = url=>new WebSocket(url)) {}
 start(): void { this.stopped=false; this.connect(BASE, false); }
 stop(): void { this.stopped=true; clearTimeout(this.timer); clearTimeout(this.retry); this.pending?.terminate(); this.active?.terminate(); this.pending=undefined; this.active=undefined; }
 private connect(url:string, directed:boolean): void {
  if (this.stopped) return;
  const ws = this.factory(url); if (directed) this.pending=ws; else this.active=ws;
  let welcomed = false;
  ws.on('message', (raw) => {
   const msg = parseMessage(raw.toString()); if (!msg) return;
   if (msg.metadata.message_type === 'session_welcome') {
    const session=msg.payload.session; if (!session?.id || !session.keepalive_timeout_seconds) { ws.terminate(); return; }
    welcomed=true; this.attempts=0;
    if (directed) { const old=this.active; this.active=ws; this.pending=undefined; old?.close(); }
    this.timeout=session.keepalive_timeout_seconds*1000; this.watchdog(ws); this.onStatus('Connected');
    if (!directed) void this.subscribe(session.id,ws);
   } else if (ws === this.active && (msg.metadata.message_type === 'session_keepalive' || msg.metadata.message_type === 'notification')) {
    this.watchdog(ws);
    if (msg.metadata.message_type === 'notification' && this.dedupe.accept(msg.metadata.message_id)) { const event=normalize(msg); if (event) this.onEvent(event); }
   } else if (ws === this.active && msg.metadata.message_type === 'session_reconnect') {
    const next=msg.payload.session?.reconnect_url;
    let valid = false; try { const parsed = new URL(next ?? ''); valid = parsed.protocol === 'wss:' && parsed.hostname === 'eventsub.wss.twitch.tv'; } catch { /* invalid URL */ }
    if (next && valid && !this.pending) { this.onStatus('Reconnecting'); this.connect(next,true); }
   } else if (msg.metadata.message_type === 'revocation') {
    this.onStatus(`Subscription revoked: ${msg.payload.subscription?.type ?? 'unknown'} (${msg.payload.subscription?.status ?? 'unknown'})`);
   }
  });
  ws.on('error',()=>{ this.onStatus('EventSub connection error'); });
  ws.on('close',()=>{
   if (this.stopped) return;
   if (ws === this.pending) { this.pending=undefined; if (this.active?.readyState === WebSocket.OPEN) return; }
   if (ws !== this.active) return;
   this.active=undefined; clearTimeout(this.timer);
   if (this.pending && !welcomed) return;
   if (this.pending) { this.pending.terminate(); this.pending=undefined; }
   this.onStatus('Disconnected; reconnecting');
   const delay=Math.min(30000,1000*2**Math.min(this.attempts++,5)); this.retry=setTimeout(()=>this.connect(BASE,false),delay);
  });
 }
 private watchdog(ws:WebSocket): void { clearTimeout(this.timer); this.timer=setTimeout(()=>{ if (ws===this.active) { this.onStatus('EventSub keepalive timed out'); ws.terminate(); } },this.timeout+1000); }
 private async subscribe(session:string,ws:WebSocket): Promise<void> {
  try { for (const sub of subscriptions(this.userId)) { if (ws!==this.active) return; await this.createSubscription(session,sub); } this.onStatus('Connected: all subscriptions active'); }
  catch { this.onStatus('Subscription failed; reconnecting'); ws.terminate(); }
 }
}
