import { readFileSync } from 'node:fs';
import { db, getToken } from '../db.js';
import type { NormalizedEvent } from '../eventsub/messages.js';
import { MomentEngine, type Settings, type Moment } from './engine.js';
import {queueMomentClip,importSessionClips} from '../clips/runtime.js';
const settings = (JSON.parse(readFileSync('config.json','utf8')) as {moments:Settings}).moments;
if (!settings || Object.values(settings).some(value=>typeof value !== 'number' || !Number.isFinite(value)) || settings.bucketSeconds<=0 || settings.baselineSeconds<=0 || settings.cooldownSeconds<=0) throw new Error('Invalid moment settings in config.json');
let sessionId:number | undefined; let lastId:number | undefined;
let demoLive=false;let demoMoments:Moment[]=[];
const demoEngine=new MomentEngine(settings,(moment,merged)=>{if(merged) demoMoments[demoMoments.length-1]=moment;else demoMoments.push(moment);});
const engine=new MomentEngine(settings,(m,merged)=>{
 if (!sessionId) return;
 const values=[new Date(m.startedAt).toISOString(),new Date(m.peakAt).toISOString(),m.score,m.reason,JSON.stringify(m.topEmotes),JSON.stringify(m.sampleMessages),m.creditUser??null,m.creditKind??null,m.trigger];
 if(merged && lastId) db.prepare('UPDATE moments SET started_at=?,peak_at=?,score=?,reason=?,top_emotes_json=?,sample_messages_json=?,credit_user=?,credit_kind=?,trigger=? WHERE id=?').run(...values,lastId);
 else { const r=db.prepare('INSERT INTO moments (started_at,peak_at,score,reason,top_emotes_json,sample_messages_json,credit_user,credit_kind,trigger,session_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...values,sessionId); lastId=Number(r.lastInsertRowid); queueMomentClip(lastId,m.reason); }
});
function currentSession():number | undefined { return (db.prepare('SELECT id FROM stream_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as {id:number}|undefined)?.id; }
function syncSession():boolean {const current=currentSession(); if(current!==sessionId) {engine.reset();lastId=undefined;sessionId=current;} return !!current;}
export function ingestMomentEvent(e:NormalizedEvent):void {
 if(e.simulated) {
  if(e.type==='demo.online'){demoLive=true;demoMoments=[];demoEngine.reset();return;}
  if(e.type==='demo.offline'){demoEngine.advance(Date.parse(e.at)+settings.bucketSeconds*1000);demoLive=false;demoEngine.reset();return;}
  if(demoLive) demoEngine.ingest({at:Date.parse(e.at),type:e.type==='demo.chat'||e.type==='demo.emote'?'channel.chat.message':'channel.chat.notification',userId:e.userName,userName:e.userName,text:e.text,emotes:e.emotes,hype:e.type==='demo.raid'||e.type==='demo.follow'});
  return;
 }
 if(e.type==='stream.offline') { engine.advance(Date.parse(e.at)+settings.bucketSeconds*1000); const ended=sessionId ?? (db.prepare('SELECT id FROM stream_sessions WHERE ended_at=? ORDER BY id DESC LIMIT 1').get(e.at) as {id:number}|undefined)?.id; if(ended) importSessionClips(ended); engine.reset();sessionId=undefined;lastId=undefined;return; }
 if(!syncSession()) return;
 const hype=e.type==='channel.follow' || (e.type==='channel.chat.notification' && ['raid','sub','resub','sub_gift','community_sub_gift'].includes(String(e.data.notice_type)));
 engine.ingest({at:Date.parse(e.at),type:e.type,userId:e.userId,userName:e.userName,text:e.text,emotes:e.emotes,broadcasterId:getToken()?.user_id,hype});
}
export function markMoment():boolean { if(process.env.DEMO==='1'){if(!demoLive)return false;demoEngine.mark(Date.now(),'hotkey');return true;} if(!syncSession()) return false;engine.mark(Date.now(),'hotkey');return true; }
export function recentMoments():unknown[] { if(process.env.DEMO==='1')return demoMoments.slice(-20).reverse().map((m,id)=>({id,peak_at:new Date(m.peakAt).toISOString(),score:m.score,reason:'SIMULATED '+m.reason,credit_user:m.creditUser,trigger:m.trigger,status:'demo',local_path:'/demo-media/simulated.mp4'}));return db.prepare('SELECT id,peak_at,score,reason,credit_user,trigger,status FROM moments ORDER BY id DESC LIMIT 20').all(); }
setInterval(()=>{if(process.env.DEMO==='1'){if(demoLive)demoEngine.advance(Date.now());}else if(syncSession())engine.advance(Date.now());},1000).unref();
