import {existsSync} from 'node:fs';
import {basename} from 'node:path';
import {db,getToken} from '../db.js';
import {caption} from '../captions/captions.js';
import {rank,trim,totalSeconds,type Candidate,type EpisodeMoment} from './logic.js';
type Row={clip_id:number;moment_id:number;local_path:string;duration:number;requested_at:string|null;peak_at:string;score:number;trigger:string;reason:string;credit_user:string|null;credit_kind:string|null;sample_messages_json:string};
export async function buildEpisode(sessionId:number):Promise<number>{
 const session=db.prepare('SELECT id FROM stream_sessions WHERE id=?').get(sessionId);if(!session)throw new Error('Session not found');
 const rows=db.prepare(`SELECT c.id clip_id,m.id moment_id,c.local_path,c.duration,c.requested_at,m.peak_at,m.score,m.trigger,m.reason,m.credit_user,m.credit_kind,m.sample_messages_json FROM clips c JOIN moments m ON c.moment_id=m.id WHERE m.session_id=? AND c.status='ready' AND c.local_path IS NOT NULL AND c.duration>0`).all(sessionId) as Row[];
 const candidates=rank(rows.filter(r=>existsSync(r.local_path)).map(r=>({clipId:r.clip_id,momentId:r.moment_id,localPath:'/media/'+encodeURIComponent(basename(r.local_path)),duration:r.duration,requestedAt:r.requested_at,peakAt:r.peak_at,score:r.score,trigger:r.trigger,reason:r.reason,creditUser:r.credit_user,creditKind:r.credit_kind,sampleMessages:JSON.parse(r.sample_messages_json) as string[]})));
 if(!candidates.length)throw new Error('No playable clips for this session');
 const convert=async(c:Candidate):Promise<EpisodeMoment>=>{const credit=c.creditUser && ['called_it','nominated','picked'].includes(c.creditKind??'') ? {userName:c.creditUser,kind:c.creditKind as 'called_it'|'nominated'|'picked'}:undefined;return {clipId:c.clipId,localPath:c.localPath,...trim(c),caption:await caption(c.reason,c.sampleMessages),...(credit?{credit}:{})};};
 const all=await Promise.all(candidates.map(convert));const moments=all.slice(0,3),alternates=all.slice(3,6);const channel=getToken()?.login??'channel';const now=new Date().toISOString();
 const result=db.prepare('INSERT INTO episodes (session_id,channel_name,title,teaser,status,total_seconds,moments_json,alternates_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(sessionId,channel,`Previously on ${channel}...`,'','draft',totalSeconds(moments),JSON.stringify(moments),JSON.stringify(alternates),now);
 return Number(result.lastInsertRowid);
}
