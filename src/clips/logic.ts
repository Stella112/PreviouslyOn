export interface ClipTime {created_at:string; id:string}
export interface MomentTime {id:number; peak_at:string}
export function nearestMoment(clip:ClipTime,moments:MomentTime[],maxDistanceMs=90000):number | undefined {
 const time=Date.parse(clip.created_at); if(!Number.isFinite(time)) return undefined;
 let best:number|undefined; let distance=maxDistanceMs+1;
 for(const moment of moments) { const d=Math.abs(Date.parse(moment.peak_at)-time); if(Number.isFinite(d) && d<distance) {distance=d;best=moment.id;} }
 return distance<=maxDistanceMs?best:undefined;
}
export function recapLink(videoId:string | null | undefined,offset:number | null | undefined,clipUrl:string):string {
 if(videoId && /^\d+$/.test(videoId) && typeof offset==='number' && Number.isFinite(offset) && offset>=0) return `https://www.twitch.tv/videos/${videoId}?t=${Math.floor(offset)}s`;
 return clipUrl;
}
export function isMp4(data:Uint8Array):boolean { return data.length>=12 && String.fromCharCode(...data.slice(4,8))==='ftyp'; }
