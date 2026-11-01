import {getEpisode} from '../episodes/editor.js';
import {db,getToken} from '../db.js';
import type {NormalizedEvent} from '../eventsub/messages.js';
import {readFileSync} from 'node:fs';
import {PlaybackGuard} from './state.js';
import {randomUUID} from 'node:crypto';
type State={playing:boolean;id?:string;episode?:unknown;startedAt?:number};
let state:State={playing:false};let timer:NodeJS.Timeout|undefined;let autoTimer:NodeJS.Timeout|undefined;const guard=new PlaybackGuard();const listeners=new Set<()=>void>();
const settings=JSON.parse(readFileSync('config.json','utf8')) as {playback?:{autoDelaySeconds?:number}};
const autoDelay=Math.max(0,Math.min(300,settings.playback?.autoDelaySeconds??10));
export function playbackState():State{return state;}
export function onPlaybackChange(listener:()=>void):void {listeners.add(listener);}
function publish():void {for(const listener of listeners)listener();}
export function playEpisode(id:number,trigger='studio',automatic=false):boolean {
 const episode=getEpisode(id);if(!episode||!episode.moments.length)return false;
 const current=db.prepare('SELECT id,twitch_stream_id FROM stream_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as {id:number;twitch_stream_id:string}|undefined;
 if(automatic && current && db.prepare('SELECT 1 FROM playbacks WHERE session_id=? LIMIT 1').get(current.id))return false;
 if(!guard.start(current?.twitch_stream_id,automatic))return false;
 const result=db.prepare('INSERT INTO playbacks (episode_id,session_id,at,trigger) VALUES (?,?,?,?)').run(id,current?.id??null,new Date().toISOString(),trigger);void result;
 clearTimeout(timer);state={playing:true,id:randomUUID(),episode,startedAt:Date.now()};publish();
 timer=setTimeout(()=>{state={playing:false};guard.stop();db.prepare(`UPDATE episodes SET status='played' WHERE id=?`).run(id);publish();},Math.ceil(episode.total_seconds*1000)+3000);timer.unref();return true;
}
export function stopPlayback():void {clearTimeout(timer);state={playing:false};guard.stop();publish();}
export function handlePlaybackEvent(e:NormalizedEvent):void{
 if(e.type==='stream.offline'){clearTimeout(autoTimer);return;}
 if(e.type==='stream.online'){
  const armed=db.prepare(`SELECT id FROM episodes WHERE status='armed' ORDER BY id DESC LIMIT 1`).get() as {id:number}|undefined;
  if(armed){const streamId=e.data.id;clearTimeout(autoTimer);autoTimer=setTimeout(()=>{const current=db.prepare('SELECT twitch_stream_id FROM stream_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as {twitch_stream_id:string}|undefined;const episode=getEpisode(armed.id);if(current?.twitch_stream_id===streamId && episode?.status==='armed')playEpisode(armed.id,'online',true);},autoDelay*1000);autoTimer.unref();}
 }
 if(e.type==='channel.chat.message' && /^!previously(?:\s|$)/i.test(e.text?.trim()??'') && !!e.userId && (e.userId===getToken()?.user_id||e.badges.includes('moderator'))){
  const episode=db.prepare(`SELECT id FROM episodes WHERE status IN ('armed','approved','played') ORDER BY id DESC LIMIT 1`).get() as {id:number}|undefined;if(episode)playEpisode(episode.id,'chat');
 }
}
