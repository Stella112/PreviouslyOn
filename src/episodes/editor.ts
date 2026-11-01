import {basename} from 'node:path';
import {db} from '../db.js';
import {totalSeconds} from './logic.js';
import {validateEdit} from './validation.js';
export function listEpisodes():unknown[]{return db.prepare('SELECT id,session_id,channel_name,title,teaser,status,total_seconds,created_at FROM episodes ORDER BY id DESC').all();}
export function getEpisode(id:number):any {const row=db.prepare('SELECT * FROM episodes WHERE id=?').get(id) as Record<string,unknown>|undefined;if(!row)return undefined;return {...row,moments:JSON.parse(row.moments_json as string),alternates:JSON.parse(row.alternates_json as string),moments_json:undefined,alternates_json:undefined};}
export function saveEpisode(id:number,value:unknown):boolean{
 const episode=getEpisode(id);if(!episode)return false;
 const rows=db.prepare(`SELECT c.id,c.local_path,c.duration FROM clips c JOIN moments m ON m.id=c.moment_id WHERE m.session_id=? AND c.status='ready'`).all(episode.session_id) as {id:number;local_path:string;duration:number}[];
 const allowed=new Map(rows.map(r=>[r.id,{path:(r.local_path.replaceAll('\\','/').startsWith('public/demo-media/')?'/demo-media/':'/media/')+encodeURIComponent(basename(r.local_path)),duration:r.duration}]));
 if(!validateEdit(value,allowed))return false;
 db.prepare(`UPDATE episodes SET title=?,teaser=?,moments_json=?,alternates_json=?,total_seconds=?,status='draft' WHERE id=?`).run(value.title,value.teaser,JSON.stringify(value.moments),JSON.stringify(value.alternates),totalSeconds(value.moments),id);return true;
}
export function setEpisodeStatus(id:number,status:'approved'|'armed'):boolean{const e=getEpisode(id);if(!e||!e.moments.length||(status==='armed'&&!['approved','armed'].includes(e.status)))return false;if(status==='armed')db.prepare(`UPDATE episodes SET status='approved' WHERE status='armed'`).run();db.prepare('UPDATE episodes SET status=? WHERE id=?').run(status,id);return true;}
