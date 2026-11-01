import type {EpisodeMoment} from './logic.js';
export interface Edit {title:string;teaser:string;moments:EpisodeMoment[];alternates:EpisodeMoment[]}
export function validateEdit(value:unknown, allowed:Map<number,{path:string;duration:number}>):value is Edit {
 if(!value||typeof value!=='object')return false;
 const v=value as Edit;
 if(typeof v.title!=='string'||!v.title.trim()||v.title.length>100||typeof v.teaser!=='string'||v.teaser.length>60||!Array.isArray(v.moments)||v.moments.length>3||!Array.isArray(v.alternates)||v.alternates.length>3)return false;
 const seen=new Set<number>();
 for(const m of [...v.moments,...v.alternates]){
  if(!m || !Number.isSafeInteger(m.clipId) || seen.has(m.clipId))return false;seen.add(m.clipId);
  const c=allowed.get(m.clipId);if(!c||m.localPath!==c.path || !Number.isFinite(m.inPoint)||!Number.isFinite(m.outPoint)||m.inPoint<0||m.outPoint<=m.inPoint||m.outPoint>c.duration||typeof m.caption!=='string'||m.caption.length>60||typeof m.checkTrim!=='boolean')return false;
  if(m.credit && (typeof m.credit.userName!=='string'||m.credit.userName.length>25||!/^\w+$/.test(m.credit.userName)||!['called_it','nominated','picked'].includes(m.credit.kind)))return false;
 }
 return true;
}
