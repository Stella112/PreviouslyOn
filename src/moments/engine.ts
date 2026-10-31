export interface Settings { bucketSeconds:number; baselineSeconds:number; baselineFloor:number; threshold:number; cooldownSeconds:number; messageWeight:number; uniqueWeight:number; emoteWeight:number; hypeWeight:number }
export interface Input { at:number; type:string; userId?:string; userName?:string; text?:string; emotes:string[]; broadcasterId?:string; hype?:boolean }
export interface Moment { startedAt:number; peakAt:number; score:number; reason:string; topEmotes:string[]; sampleMessages:string[]; creditUser?:string; creditKind?:'called_it'|'nominated'|'picked'; trigger:'auto'|'banger'|'hotkey' }
const median=(values:number[])=>{ const sorted=[...values].sort((a,b)=>a-b); const mid=Math.floor(sorted.length/2); return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2; };
export class MomentEngine {
 private bucketStart?:number; private bucket:Input[]=[]; private recent:Input[]=[]; private history:Array<{at:number;count:number}>=[]; private last?:Moment; private users=new Map<string,number>(); private lastCommand=-Infinity;
 constructor(private s:Settings, private emit:(moment:Moment, merged:boolean)=>void) {}
 reset():void {this.bucketStart=undefined;this.bucket=[];this.recent=[];this.history=[];this.last=undefined;this.users.clear();this.lastCommand=-Infinity;}
 ingest(e:Input):void {
  if (!Number.isFinite(e.at)) return;
  this.advance(e.at);
  this.recent.push(e); this.recent=this.recent.filter(x=>x.at>=e.at-30000);
  this.bucket.push(e);
  if (e.type==='channel.chat.message' && /^!banger(?:\s|$)/i.test(e.text?.trim() ?? '') && e.userId && e.at-this.lastCommand>=30000 && e.at-(this.users.get(e.userId) ?? -Infinity)>=120000) {
   this.lastCommand=e.at; this.users.set(e.userId,e.at);
   this.mark(e.at,'banger',e.userId !== e.broadcasterId ? e.userName : undefined);
  }
 }
 advance(now:number):void {
  const width=this.s.bucketSeconds*1000; const next=Math.floor(now/width)*width;
  if (this.bucketStart===undefined) {this.bucketStart=next; return;}
  while(this.bucketStart<next) {this.finishBucket(); this.bucketStart+=width; this.bucket=[];}
 }
 mark(at:number, trigger:'banger'|'hotkey', userName?:string):void {
  const m:Moment={startedAt:at-20000,peakAt:at,score:this.s.threshold,reason:trigger==='banger'?'Chat nomination':'Streamer marked',topEmotes:[],sampleMessages:[],trigger};
  if (userName) {m.creditUser=userName;m.creditKind=trigger==='banger'?'nominated':'picked';}
  this.emitMoment(m);
 }
 private finishBucket():void {
  const at=this.bucketStart!; const chats=this.bucket.filter(e=>e.type==='channel.chat.message');
  const counts=new Map<string,number>(); for (const e of chats) for(const emote of e.emotes) counts.set(emote,(counts.get(emote)??0)+1);
  const top=[...counts].sort((a,b)=>b[1]-a[1]).map(([s])=>s); const unique=new Set(chats.map(e=>e.userId).filter(Boolean)).size;
  const baseline=Math.max(this.s.baselineFloor, this.history.length ? median(this.history.map(x=>x.count)) : 0);
  const emoteCount=[...counts.values()].reduce((a,b)=>a+b,0); const hype=this.bucket.filter(e=>e.hype).length;
  const score=Math.max(0,chats.length-baseline)*this.s.messageWeight+unique*this.s.uniqueWeight+emoteCount*this.s.emoteWeight+hype*this.s.hypeWeight;
  if(score>=this.s.threshold) {
   const eligible=this.recent.filter(e=>e.at>=at-10000 && e.at<=at && e.userId && e.userId!==e.broadcasterId);
   const credit=eligible.find(e=>(top[0] && e.emotes.includes(top[0])) || /\b(called it|i knew it|i called it)\b/i.test(e.text??''));
   const m:Moment={startedAt:at-20000,peakAt:at,score,reason:hype?'Hype event':emoteCount?'Emote burst':'Chat spike',topEmotes:top.slice(0,3),sampleMessages:chats.map(e=>e.text??'').filter(Boolean).slice(0,15),trigger:'auto'};
   if(credit?.userName){m.creditUser=credit.userName;m.creditKind='called_it';} this.emitMoment(m);
  }
  this.history.push({at,count:chats.length}); this.history=this.history.filter(x=>x.at>=at-this.s.baselineSeconds*1000);
 }
 private emitMoment(m:Moment):void {
  if(this.last && m.peakAt-this.last.peakAt<this.s.cooldownSeconds*1000) {
   if(m.trigger!=='auto' && this.last.trigger==='auto') { this.last.trigger=m.trigger;this.last.reason=m.reason;this.last.creditUser=m.creditUser;this.last.creditKind=m.creditKind; }
   if(m.score>this.last.score) { this.last.score=m.score; this.last.peakAt=m.peakAt;this.last.topEmotes=m.topEmotes;this.last.sampleMessages=m.sampleMessages; }
   this.last.startedAt=Math.min(this.last.startedAt,m.startedAt); this.emit({...this.last},true); return;
  }
  this.last=m;this.emit({...m},false);
 }
}
