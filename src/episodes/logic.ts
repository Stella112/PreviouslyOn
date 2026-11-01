export type Candidate={clipId:number;momentId?:number;localPath:string;duration:number;requestedAt:string|null;peakAt:string;score:number;trigger:string;reason:string;creditUser:string|null;creditKind:string|null;sampleMessages:string[]};
export type EpisodeMoment={clipId:number;localPath:string;inPoint:number;outPoint:number;caption:string;credit?:{userName:string;kind:'called_it'|'nominated'|'picked'};checkTrim:boolean};
export function rank(candidates:Candidate[]):Candidate[]{const seen=new Set<number>();return candidates.filter(c=>c.localPath && Number.isFinite(c.duration) && c.duration>0).sort((a,b)=>(b.score+(['banger','hotkey'].includes(b.trigger)?5:0))-(a.score+(['banger','hotkey'].includes(a.trigger)?5:0)) || a.clipId-b.clipId).filter(c=>{if(c.momentId===undefined)return true;if(seen.has(c.momentId))return false;seen.add(c.momentId);return true;}).slice(0,6);}
export function trim(clip:Candidate):{inPoint:number;outPoint:number;checkTrim:boolean}{
 const duration=clip.duration;const length=Math.min(7,duration);const request=clip.requestedAt ? Date.parse(clip.requestedAt):NaN;const peak=Date.parse(clip.peakAt);
 // Twitch's default published segment is approximately the last 30 seconds of its capture window.
 const estimate=Number.isFinite(request)&&Number.isFinite(peak)?duration-5+(peak-request)/1000:duration/2;
 const start=Math.max(0,Math.min(duration-length,estimate-length/2));
 return {inPoint:Math.round(start*10)/10,outPoint:Math.round((start+length)*10)/10,checkTrim:true};
}
export function totalSeconds(moments:EpisodeMoment[]):number{return 3+4+3+moments.reduce((sum,m)=>sum+Math.max(0,m.outPoint-m.inPoint),0);}
