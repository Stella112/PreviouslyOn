import { readFileSync } from 'node:fs';
import { db, getToken } from '../db.js';
import type { NormalizedEvent } from '../eventsub/messages.js';
import { MomentEngine, type Settings, type Moment } from './engine.js';
const settings = (JSON.parse(readFileSync('config.json','utf8')) as {moments:Settings}).moments;
if (!settings || Object.values(settings).some(value=>typeof value !== 'number' || !Number.isFinite(value)) || settings.bucketSeconds<=0 || settings.baselineSeconds<=0 || settings.cooldownSeconds<=0) throw new Error('Invalid moment settings in config.json');
let sessionId:number | undefined; let lastId:number | undefined;
const engine=new MomentEngine(settings,(m,merged)=>{
 if (!sessionId) return;
 const values=[new Date(m.startedAt).toISOString(),new Date(m.peakAt).toISOString(),m.score,m.reason,JSON.stringify(m.topEmotes),JSON.stringify(m.sampleMessages),m.creditUser??null,m.creditKind??null,m.trigger];
 if(merged && lastId) db.prepare('UPDATE moments SET started_at=?,peak_at=?,score=?,reason=?,top_emotes_json=?,sample_messages_json=?,credit_user=?,credit_kind=?,trigger=? WHERE id=?').run(...values,lastId);
 else { const r=db.prepare('INSERT INTO moments (started_at,peak_at,score,reason,top_emotes_json,sample_messages_json,credit_user,credit_kind,trigger,session_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...values,sessionId); lastId=Number(r.lastInsertRowid); }
});
function currentSession():number | undefined { return (db.prepare('SELECT id FROM stream_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as {id:number}|undefined)?.id; }
function syncSession():boolean {const current=currentSession(); if(current!==sessionId) {engine.reset();lastId=undefined;sessionId=current;} return !!current;}
export function ingestMomentEvent(e:NormalizedEvent):void {
 if(e.simulated) return;
 if(e.type==='stream.offline') { engine.advance(Date.parse(e.at)+settings.bucketSeconds*1000); engine.reset();sessionId=undefined;lastId=undefined;return; }
 if(!syncSession()) return;
 const hype=e.type==='channel.follow' || (e.type==='channel.chat.notification' && ['raid','sub','resub','sub_gift','community_sub_gift'].includes(String(e.data.notice_type)));
 engine.ingest({at:Date.parse(e.at),type:e.type,userId:e.userId,userName:e.userName,text:e.text,emotes:e.emotes,broadcasterId:getToken()?.user_id,hype});
}
export function markMoment():boolean { if(!syncSession()) return false;engine.mark(Date.now(),'hotkey');return true; }
export function recentMoments():unknown[] { return db.prepare('SELECT id,peak_at,score,reason,credit_user,trigger,status FROM moments ORDER BY id DESC LIMIT 20').all(); }
setInterval(()=>{if(syncSession()) engine.advance(Date.now());},1000).unref();
