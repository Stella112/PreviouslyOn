import { db, getToken } from '../db.js';
import { config } from '../config.js';
import { refresh } from '../auth/oauth.js';
import { HelixClient } from '../twitch/helix.js';
import { ClipsApi, type TwitchClip } from './api.js';
import { createAndPoll } from './poll.js';
import { downloadMedia } from './media.js';
import { nearestMoment } from './logic.js';
import { open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isMp4 } from './logic.js';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
let queue:Promise<void>=Promise.resolve();
function enqueue(task:()=>Promise<void>):void {queue=queue.then(task).catch(()=>console.warn('Clip task failed; see clip status.'));}
function api():ClipsApi { const token=getToken();if(!token)throw new Error('Twitch login required');return new ClipsApi(new HelixClient({clientId:config.clientId,getAccessToken:()=>getToken()?.access_token??'',refresh:async()=>{await refresh();}}),token.user_id);}
async function saveClip(momentId:number,requestedAt:string,clip:TwitchClip,source='twitch'):Promise<void> {
 const row=db.prepare('INSERT INTO clips (moment_id,twitch_clip_id,url,thumbnail_url,duration,created_at,requested_at,video_id,vod_offset,source,status) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(twitch_clip_id) DO NOTHING').run(momentId,clip.id,clip.url,clip.thumbnail_url,clip.duration,clip.created_at,requestedAt,clip.video_id || null,clip.vod_offset,source,'downloading');
 if(!row.changes)return;
 try {const url=await api().downloadUrl(clip.id);const path=await downloadMedia(url);db.prepare('UPDATE clips SET local_path=?,status=? WHERE twitch_clip_id=?').run(path,'ready',clip.id);db.prepare('UPDATE moments SET status=? WHERE id=?').run('clipped',momentId);}
 catch {db.prepare('UPDATE clips SET status=? WHERE twitch_clip_id=?').run('download_failed',clip.id);db.prepare('UPDATE moments SET status=? WHERE id=?').run('download_failed',momentId);}
}
export function queueMomentClip(momentId:number,reason:string):void {
 if(process.env.DEMO==='1')return;
 db.prepare('UPDATE moments SET status=? WHERE id=?').run('clip_queued',momentId);
 enqueue(async()=>{const requestedAt=new Date().toISOString();try{const service=api();const clip=await createAndPoll(()=>service.create(`Previously On: ${reason}`),id=>service.get(id),sleep,60000);await saveClip(momentId,requestedAt,clip);}catch{db.prepare('UPDATE moments SET status=? WHERE id=?').run('clip_failed',momentId);}});
}
export function importSessionClips(sessionId:number):void {
 if(process.env.DEMO==='1')return;
 enqueue(async()=>{const session=db.prepare('SELECT started_at,ended_at FROM stream_sessions WHERE id=?').get(sessionId) as {started_at:string;ended_at:string|null}|undefined;if(!session?.ended_at)return;
  const service=api();const clips=await service.list(session.started_at,session.ended_at);
  for(const clip of clips) {const existing=db.prepare('SELECT id FROM clips WHERE twitch_clip_id=?').get(clip.id);if(existing)continue;
   const moments=db.prepare('SELECT id,peak_at FROM moments WHERE session_id=?').all(sessionId) as {id:number;peak_at:string}[];
   let momentId=nearestMoment(clip,moments);
   if(!momentId){const at=Date.parse(clip.created_at);if(!Number.isFinite(at))continue;const row=db.prepare(`INSERT INTO moments (session_id,started_at,peak_at,score,reason,top_emotes_json,sample_messages_json,trigger,status) VALUES (?,?,?,?,?,?,?,?,?)`).run(sessionId,new Date(at-20000).toISOString(),clip.created_at,0,'Imported clip','[]','[]','imported','detected');momentId=Number(row.lastInsertRowid);}
   await saveClip(momentId,clip.created_at,clip);
  }
  try {const {buildEpisode}=await import('../episodes/store.js');await buildEpisode(sessionId);}catch{console.warn('Episode was not drafted: no playable clips or build failed.');}
 });
}
export async function recaptureVod(momentId:number,vodId:string,offset:number,title:string,duration:number):Promise<void> {
 const moment=db.prepare('SELECT id FROM moments WHERE id=?').get(momentId);if(!moment)throw new Error('Moment not found');
 const service=api();const requestedAt=new Date().toISOString();
 const clip=await createAndPoll(()=>service.fromVod(vodId,offset,title,duration),id=>service.get(id),sleep,60000);
 await saveClip(momentId,requestedAt,clip);
}
export async function attachLocal(momentId:number,name:string):Promise<void> {
 if(!/^[a-zA-Z0-9_-]+\.mp4$/i.test(name))throw new Error('Invalid local filename');
 if(!db.prepare('SELECT id FROM moments WHERE id=?').get(momentId))throw new Error('Moment not found');
 const path=join('data','media',name);const info=await stat(path);if(!info.isFile() || info.size<12)throw new Error('Invalid local file');
 const file=await open(path,'r');try{const header=Buffer.alloc(12);await file.read(header,0,12,0);if(!isMp4(header))throw new Error('Invalid local MP4');}finally{await file.close();}
 db.prepare('INSERT INTO clips (moment_id,local_path,source,status) VALUES (?,?,?,?)').run(momentId,path,'local','ready');
 db.prepare('UPDATE moments SET status=? WHERE id=?').run('clipped',momentId);
}
export async function retryClipDownload(id:number):Promise<void> {
 const clip=db.prepare('SELECT id,moment_id,twitch_clip_id FROM clips WHERE id=?').get(id) as {id:number;moment_id:number;twitch_clip_id:string|null}|undefined;
 if(!clip?.twitch_clip_id)throw new Error('Twitch clip not found');
 const url=await api().downloadUrl(clip.twitch_clip_id);const path=await downloadMedia(url);
 db.prepare('UPDATE clips SET local_path=?,status=? WHERE id=?').run(path,'ready',id);
 db.prepare('UPDATE moments SET status=? WHERE id=?').run('clipped',clip.moment_id);
}
setInterval(()=>{
 if(process.env.DEMO==='1' || !getToken()) return;
 enqueue(async()=>{const rows=db.prepare('SELECT twitch_clip_id FROM clips WHERE source=? AND vod_offset IS NULL AND twitch_clip_id IS NOT NULL LIMIT 50').all('twitch') as {twitch_clip_id:string}[];const service=api();for(const row of rows){try{const clip=await service.get(row.twitch_clip_id);if(clip && clip.vod_offset!==null)db.prepare('UPDATE clips SET video_id=?,vod_offset=? WHERE twitch_clip_id=?').run(clip.video_id,clip.vod_offset,clip.id);}catch{console.warn('Could not refresh a clip VOD offset.');}}});
},120000).unref();
