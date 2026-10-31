import type {HelixClient} from '../twitch/helix.js';
export interface TwitchClip {id:string;url:string;thumbnail_url:string;duration:number;created_at:string;video_id:string;vod_offset:number|null}
type ClipResponse={data:TwitchClip[];pagination?:{cursor?:string}};
export class ClipsApi {
 constructor(private api:HelixClient,private userId:string){}
 private async json<T>(path:string,init?:RequestInit):Promise<T> {const response=await this.api.request(path,init);if(!response.ok) throw new Error(`Twitch clip request failed (HTTP ${response.status})`);return await response.json() as T;}
 async create(title:string):Promise<string> {const q=new URLSearchParams({broadcaster_id:this.userId,title,duration:'30'});const r=await this.json<{data:{id:string}[]}>(`/clips?${q}`,{method:'POST'});if(!r.data[0]?.id)throw new Error('Twitch did not return a clip id');return r.data[0].id;}
 async get(id:string):Promise<TwitchClip|undefined> {const q=new URLSearchParams({id});return (await this.json<ClipResponse>(`/clips?${q}`)).data[0];}
 async list(startedAt:string,endedAt:string):Promise<TwitchClip[]> {
  const clips:TwitchClip[]=[];let cursor:string|undefined;
  do {const q=new URLSearchParams({broadcaster_id:this.userId,started_at:startedAt,ended_at:endedAt,first:'100'});if(cursor)q.set('after',cursor);const r=await this.json<ClipResponse>(`/clips?${q}`);clips.push(...r.data);cursor=r.pagination?.cursor;} while(cursor);
  return clips;
 }
 async downloadUrl(id:string):Promise<string> {const q=new URLSearchParams({broadcaster_id:this.userId,editor_id:this.userId,clip_id:id});const r=await this.json<{data:{landscape_download_url:string|null}[]}>(`/clips/downloads?${q}`);const url=r.data[0]?.landscape_download_url;if(!url)throw new Error('Twitch did not provide a landscape download');return url;}
 async fromVod(vodId:string,offset:number,title:string,duration:number):Promise<string> {
  if(!vodId || !Number.isInteger(offset) || duration<5 || duration>60 || offset<duration || !title.trim()) throw new Error('Invalid VOD clip parameters');
  const q=new URLSearchParams({broadcaster_id:this.userId,editor_id:this.userId,vod_id:vodId,vod_offset:String(offset),title,duration:String(duration)});
  const r=await this.json<{data:{id:string}[]}>(`/videos/clips?${q}`,{method:'POST'});if(!r.data[0]?.id)throw new Error('Twitch did not return a clip id');return r.data[0].id;
 }
}
